// AI module engine: conversation storage (KEYS.conversations), one AI call per turn, simple
// keyword rules for grounding / disclaimers, and helpers shared by the chat, voice and history
// screens. Requests run outside React so an answer still lands in the conversation when the
// farmer switches tabs while waiting (the tab's screens unmount); usePending() lets a remounted
// screen show the typing state again.
import { useSyncExternalStore } from 'react';
import { ai, AIError, toPlainText, v } from '../../services/ai';
import { getWeather } from '../../services/weather';
import { getPlace, getProfile } from '../../lib/app-state';
import { track } from '../../lib/analytics';
import { HOUR, MINUTE } from '../../lib/cache';
import { formatNumber, todayISO } from '../../lib/format';
import { tNow, type TFunction } from '../../lib/i18n';
import type { NavApi } from '../../lib/nav';
import { KEYS, collection, newId, useCollection } from '../../lib/store';
import { cropName, isCropKey } from '../../data/crop-keys';
import { SEASON_NAMES, catalogText, currentSeason, getCropInfo, stageForCrop, type Season } from '../../data/crops';
import type {
  AIConversation,
  AIMessage,
  Crop,
  CropStage,
  GeoPlace,
  GroundingSource,
  SavedItem,
  StructuredAnswer,
} from '../../types/models';
import { checkRules, detectAnswerMentions, detectIntent, limitWords, stripListMarker, type Intent } from './rules';
import './strings';

export { detectIntent, fold, type Intent } from './rules';

// ---------------------------------------------------------------------------------------------
// Types. Extra fields are optional and JSON-safe, so other modules can keep reading the records
// as plain AIConversation / AIMessage.
// ---------------------------------------------------------------------------------------------

export const ANSWER_KINDS = ['problem', 'advice', 'fertilizer', 'price', 'scheme', 'weather', 'general'] as const;
export type AnswerKind = (typeof ANSWER_KINDS)[number];

export interface ChatMessage extends AIMessage {
  /** What the answer is about (drives the disclaimer). Set by the model, or by keyword rules. */
  kind?: AnswerKind;
  /** Up to 3 follow-up questions generated with the answer. */
  followUps?: string[];
  /** i18n key for an error bubble (AIError#messageKey). */
  errorKey?: string;
  /** The stored thumbnail was removed to keep on-device storage small. */
  imageDropped?: boolean;
}

export interface ChatConversation extends AIConversation {
  messages: ChatMessage[];
  /** My-crops record the conversation is about (crop context is added to every turn). */
  cropId?: string;
  /** Where it started. */
  via?: 'chat' | 'voice';
}

export type DisclaimerKind = 'ai' | 'fertilizer' | 'price' | 'scheme' | 'weather';

// ---------------------------------------------------------------------------------------------
// Storage: newest first, at most 30 conversations without a saved answer (conversations with a
// saved answer are kept, so a saved answer always opens), photo thumbnails within a size budget.
// ---------------------------------------------------------------------------------------------

/** Conversations kept besides those with a saved answer. */
export const MAX_CONVERSATIONS = 30;
/** Earlier messages sent as context memory: the last 10 question–answer turns. */
const HISTORY_MESSAGES = 20;
/**
 * Total characters of stored photo thumbnails (~300 KB of JPEG, about 15–20 small thumbnails)
 * before the oldest are dropped. The whole list is rewritten on every message, so it stays small.
 */
const IMAGE_BUDGET_CHARS = 400_000;
/** Only the newest conversations keep their photo thumbnails. */
const IMAGE_CONVERSATIONS = 10;

const conversations = () => collection<ChatConversation>(KEYS.conversations);
const savedItems = () => collection<SavedItem>(KEYS.saved);

export const getConversation = (id: string | null | undefined): ChatConversation | undefined =>
  id ? conversations().get(id) : undefined;

/** All conversations, newest first (reactive). */
export function useConversations(): ChatConversation[] {
  return useCollection<ChatConversation>(KEYS.conversations).items;
}

/** Message ids of the saved AI answers ("मेरी सेव की गई जानकारी"). */
export function savedAnswerIds(items: SavedItem[] = savedItems().all()): Set<string> {
  return new Set(items.filter(i => i.type === 'ai-answer').map(i => i.refId));
}

export function hasSavedAnswer(c: ChatConversation, ids: Set<string>): boolean {
  return ids.size > 0 && c.messages.some(m => m.role === 'assistant' && ids.has(m.id));
}

function trimImages(list: ChatConversation[]): ChatConversation[] {
  let total = 0;
  return list.map((c, ci) => {
    let changed = false;
    const messages = c.messages.map(m => {
      if (!m.image) return m;
      total += m.image.length;
      if (ci < IMAGE_CONVERSATIONS && total <= IMAGE_BUDGET_CHARS) return m;
      changed = true;
      const { image: _drop, ...rest } = m;
      return { ...rest, imageDropped: true };
    });
    return changed ? { ...c, messages } : c;
  });
}

/** Drops the oldest conversations beyond the limit; ones with a saved answer always stay. */
function capList(list: ChatConversation[]): ChatConversation[] {
  if (list.length <= MAX_CONVERSATIONS) return list;
  const ids = savedAnswerIds();
  let unsaved = 0;
  return list.filter(c => hasSavedAnswer(c, ids) || ++unsaved <= MAX_CONVERSATIONS);
}

function writeAll(list: ChatConversation[]) {
  conversations().setAll(trimImages(capList(list)));
}

/** Saves `conv` as the newest conversation. */
function put(conv: ChatConversation) {
  const rest = conversations()
    .all()
    .filter(c => c.id !== conv.id);
  writeAll([conv, ...rest]);
}

function appendMessage(conversationId: string, msg: ChatMessage): boolean {
  const conv = getConversation(conversationId);
  if (!conv) return false; // deleted while the answer was on its way
  put({ ...conv, updatedAt: msg.createdAt, messages: [...conv.messages, msg] });
  return true;
}

const byNewest = (a: ChatConversation, b: ChatConversation) => b.updatedAt.localeCompare(a.updatedAt);

export interface RemovedConversation {
  conv: ChatConversation;
  index: number;
  /** Saved answers of the conversation, removed with it (they could no longer be opened). */
  saved: SavedItem[];
}

/** Saved answers that belong to `conv`. */
export function savedAnswersOf(conv: ChatConversation): SavedItem[] {
  const ids = new Set(conv.messages.map(m => m.id));
  return savedItems()
    .all()
    .filter(i => i.type === 'ai-answer' && ids.has(i.refId));
}

/** Removes one conversation and its saved answers; returns what is needed to undo it. */
export function removeConversation(id: string): RemovedConversation | null {
  const all = conversations().all();
  const index = all.findIndex(c => c.id === id);
  if (index < 0) return null;
  const conv = all[index];
  const saved = savedAnswersOf(conv);
  conversations().setAll(all.filter(c => c.id !== id));
  if (saved.length) {
    const drop = new Set(saved.map(i => i.id));
    savedItems().setAll(
      savedItems()
        .all()
        .filter(i => !drop.has(i.id)),
    );
  }
  if (session.lastActiveId === id) session.lastActiveId = null;
  return { conv, index, saved };
}

export function restoreConversation({ conv, index, saved }: RemovedConversation) {
  const all = conversations()
    .all()
    .filter(c => c.id !== conv.id);
  all.splice(Math.min(index, all.length), 0, conv);
  if (saved.length) {
    const current = savedItems().all();
    const have = new Set(current.map(i => `${i.type}:${i.refId}`));
    savedItems().setAll([...saved.filter(i => !have.has(`${i.type}:${i.refId}`)), ...current]);
  }
  writeAll(all);
}

/**
 * Deletes every conversation except those with a saved answer (saved answers stay openable).
 * Returns the deleted conversations for undo.
 */
export function clearConversations(): ChatConversation[] {
  const all = conversations().all();
  const ids = savedAnswerIds();
  const removed = all.filter(c => !hasSavedAnswer(c, ids));
  conversations().setAll(all.filter(c => hasSavedAnswer(c, ids)));
  if (session.lastActiveId && removed.some(c => c.id === session.lastActiveId)) session.lastActiveId = null;
  return removed;
}

export function restoreConversations(list: ChatConversation[]) {
  const current = conversations().all();
  const ids = new Set(current.map(c => c.id));
  writeAll([...current, ...list.filter(c => !ids.has(c.id))].sort(byNewest));
}

// ---------------------------------------------------------------------------------------------
// Session memory (not persisted): which conversation the AI tab root was showing, unsent drafts
// and the route keys whose params were already applied (a `prompt` is sent once, even under
// StrictMode's double effects; a remount after a tab switch resumes instead of re-applying).
// ---------------------------------------------------------------------------------------------

export const session = {
  lastActiveId: null as string | null,
  drafts: new Map<string, string>(),
  handledRoutes: new Set<string>(),
};

/** Full-size (1280px) photos kept in memory so a retry can resend the sharp version. */
const fullImages = new Map<string, string>();
function rememberFull(messageId: string, dataUrl: string) {
  fullImages.set(messageId, dataUrl);
  while (fullImages.size > 4) fullImages.delete(fullImages.keys().next().value as string);
}

// ---------------------------------------------------------------------------------------------
// Pending requests (per conversation)
// ---------------------------------------------------------------------------------------------

const pending = new Set<string>();
const pendingSubs = new Set<() => void>();

function setPending(id: string, on: boolean) {
  if (on) pending.add(id);
  else pending.delete(id);
  pendingSubs.forEach(fn => fn());
}

function subscribePending(fn: () => void) {
  pendingSubs.add(fn);
  return () => {
    pendingSubs.delete(fn);
  };
}

export const isPending = (id: string | null | undefined) => !!id && pending.has(id);

/** True while an answer for this conversation is being fetched. */
export function usePending(id: string | null | undefined): boolean {
  return useSyncExternalStore(subscribePending, () => isPending(id));
}

// ---------------------------------------------------------------------------------------------
// Keyword rules (screens/ai/rules.ts): when to use live search, and which disclaimer an answer needs.
// ---------------------------------------------------------------------------------------------

function kindFromIntent(i: Intent): AnswerKind {
  if (i.problem) return 'problem';
  if (i.price) return 'price';
  if (i.scheme) return 'scheme';
  if (i.weather) return 'weather';
  if (i.fertilizer) return 'fertilizer';
  return 'advice';
}

/** All the text of an answer (summary plus structured sections), for keyword checks. */
function answerBody(m: ChatMessage): string {
  const s = m.structured;
  return [m.text, s?.problem, ...(s?.causes || []), ...(s?.doList || []), ...(s?.dontList || []), s?.recheck].filter(Boolean).join('\n');
}

const MANDATORY: DisclaimerKind[] = ['price', 'ai', 'fertilizer'];

/**
 * Disclaimers to show under an answer, most important first. The AI, fertilizer and price
 * disclaimers are never dropped; they are chosen from the question, the model's `kind` and what
 * the answer itself says (a crop-advice answer that gives urea doses gets the fertilizer one).
 * At most one informational note (scheme or weather) follows them.
 */
export function disclaimersFor(m: ChatMessage, question?: ChatMessage): DisclaimerKind[] {
  const q = detectIntent(question?.text || '');
  const a = detectAnswerMentions(answerBody(m));
  const kind = m.kind;
  // Voice answers and older records carry no kind: treat them as advice.
  const isAdvice = !!m.structured || !!question?.image || q.problem || kind === 'problem' || kind === 'advice' || kind == null;
  const out: DisclaimerKind[] = [];
  if (kind === 'price' || q.price || a.price) out.push('price');
  if (isAdvice) out.push('ai');
  if (kind === 'fertilizer' || q.fertilizer || a.fertilizer) out.push('fertilizer');
  const info: DisclaimerKind[] = [];
  if (kind === 'scheme' || q.scheme) info.push('scheme');
  if (kind === 'weather' || q.weather || q.spray) info.push('weather');
  return [...out, ...info.slice(0, 1)];
}

// ---------------------------------------------------------------------------------------------
// Context for prompts (no names or phone numbers: place, season, crops, farm type only)
// ---------------------------------------------------------------------------------------------

/** "sown 2026-07-01, transplanted 2026-07-25, now at the Tillering stage (day 72 after transplanting)" */
function plantingText(c: Crop): string {
  if (!c.sowingDate && !c.transplantDate) return 'not sown yet (planned)';
  const info = getCropInfo(c.cropKey);
  const st = stageForCrop(c);
  // Day 0 as data/crops timelineFor() picks it: transplanting for transplanted crops (estimated from
  // sowing when not given), sowing for the rest, whichever date exists for crops outside the catalog.
  const fromTransplant = info ? !!info.transplanted || !c.sowingDate : !!c.transplantDate;
  const dates = [c.sowingDate ? `sown ${c.sowingDate}` : '', c.transplantDate ? `transplanted ${c.transplantDate}` : ''].filter(Boolean).join(', ');
  const since = fromTransplant ? `${c.transplantDate ? '' : 'estimated '}transplanting` : 'sowing';
  const stage = st.day >= 0 ? `now at the ${st.labelEn} stage (day ${st.day} after ${since})` : `${since} still ahead`;
  return `${dates}, ${stage}`;
}

/** Crop context text for prompts (crop, stage, area, place). */
export function cropContext(c: Crop): string {
  const info = getCropInfo(c.cropKey);
  const name = info ? `${info.nameEn} (${info.nameHi})` : c.name || c.cropKey;
  const parts = [
    name,
    c.variety ? `variety ${c.variety}` : '',
    `${c.area} ${c.unit}`,
    plantingText(c),
    c.irrigation ? `irrigation ${c.irrigation}` : '',
    c.soilType && c.soilType !== 'unknown' ? `soil ${c.soilType}` : '',
    c.place ? `field near ${c.place.nameEn || c.place.name}${c.place.state ? `, ${c.place.state}` : ''}` : '',
  ];
  return parts.filter(Boolean).join(', ');
}

export const getCrop = (id: string | null | undefined): Crop | undefined =>
  id ? collection<Crop>(KEYS.crops).get(id) : undefined;

function farmerContext(): string {
  const place = getPlace();
  const profile = getProfile();
  const season = currentSeason();
  const crops = collection<Crop>(KEYS.crops).all();
  const cropList = crops.length
    ? crops
        .slice(0, 6)
        .map(c => `${getCropInfo(c.cropKey)?.nameEn || c.name}${c.sowingDate || c.transplantDate ? ` (${stageForCrop(c).labelEn})` : ''}`)
        .join(', ')
    : (profile?.cropKeys || []).map(k => cropName(k, 'en')).join(', ');
  const farm = [
    profile?.farmingType ? `${profile.farmingType} farming` : '',
    profile?.soilType && profile.soilType !== 'unknown' ? `${profile.soilType} soil` : '',
    profile?.irrigation ? `${profile.irrigation} irrigation` : '',
    profile?.landArea ? `${profile.landArea} ${profile.landUnit || 'acre'} land` : '',
  ].filter(Boolean);
  return [
    `Today: ${todayISO()} (${SEASON_NAMES[season].en} season in India).`,
    `Farmer's location: ${place.nameEn || place.name}${place.district && place.district !== place.name ? `, ${place.district}` : ''}, ${place.state || 'India'}.`,
    cropList ? `Farmer's crops: ${cropList}.` : '',
    farm.length ? `Farm: ${farm.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Resolves to null when `p` fails or takes longer than `ms`. */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

const FORECAST_MAX_AGE_MS = 6 * HOUR;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The app's own forecast for the farmer's place (weather service cache, refreshed when older than
 * 30 min), for weather and spraying questions. Empty when there is no recent forecast.
 */
async function forecastContext(): Promise<string> {
  const place = getPlace();
  const res = await within(getWeather(place), 5000);
  if (!res || Date.now() - res.fetchedAt > FORECAST_MAX_AGE_MS) return '';
  const days = res.data.daily.slice(0, 4);
  if (!days.length) return '';
  const ageMin = Math.max(0, Math.round((Date.now() - res.fetchedAt) / MINUTE));
  const spray = res.data.spray;
  return [
    `Forecast for the farmer's place from the app (Open-Meteo, fetched ${ageMin} min ago):`,
    ...days.map(
      d =>
        `${d.date}: ${Math.round(d.tempMinC)}–${Math.round(d.tempMaxC)} °C, rain chance ${d.rainProbabilityPct}%, rain ${round1(d.rainMm)} mm, wind up to ${Math.round(d.windMaxKmh)} km/h`,
    ),
    `App's spray check: ${spray.suitable ? 'suitable' : 'not ideal'}${spray.bestWindow ? ` (best window ${spray.bestWindow})` : ''}. ${spray.reason}`,
    'Use this forecast for spraying, irrigation and field-work timing, and say that forecasts can change.',
  ].join('\n');
}

const CHAT_RULES = `You are answering inside the Kisan Mitra app's chat.
Reply with ONE JSON object of this shape:
{"answer": string, "kind": "problem"|"advice"|"fertilizer"|"price"|"scheme"|"weather"|"general", "structured": {"problem": string, "causes": [string], "doList": [string], "dontList": [string], "recheck": string} | null, "followUps": [string]}
Rules:
- "answer": plain text only (no markdown, no bullet symbols, no headings). Short paragraphs separated by a blank line, usually under 150 words. When "structured" is given, "answer" is a 1–2 sentence summary only.
- "structured": ONLY when the farmer describes or shows a problem in a crop or animal (disease, pest, yellowing, spots, wilting, poor growth, nutrient deficiency). problem = the likely issue in one line, said as likely and not certain; causes = 2–4 likely causes; doList = 3–5 practical steps for now, organic or low-cost first, then one chemical option with its common name, dose per litre and safety care; dontList = 2–3 common mistakes to avoid; recheck = when to check again and what to look for. Otherwise null.
- If a photo is unclear or does not show a plant, say so in "answer", set "structured" to null and ask for a clear, close daylight photo of one affected leaf.
- "kind": what the question is mainly about.
- "followUps": up to 3 short questions (at most 8 words, under 60 characters each) the farmer may want to ask next, written the way the farmer would ask them.
- For prices, schemes and weather use only what you can verify from search; give the date of any price and say it can differ at the local mandi. Never guarantee prices or yields.`;

const VOICE_RULES = `You are answering by voice in the Kisan Mitra app. The farmer spoke the question and will LISTEN to the answer.
- At most 120 words. Warm, simple spoken style with short sentences.
- No lists, symbols, markdown, links or tables. Say numbers in words a farmer would say.
- Most useful action first. For a crop problem: the likely issue (say "likely"), one or two things to do today, and when to check again.
- If the question is unclear, ask one short question back.
- For prices, schemes and weather use only verified information from search, and say prices can differ at the local mandi.`;

// ---------------------------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------------------------

export interface TurnInput {
  mode: 'chat' | 'voice';
  conversationId: string | null;
  text: string;
  /** full = 1280px JPEG sent to the AI; thumb = small copy stored in the message. */
  image?: { full: string; thumb: string };
  viaVoice?: boolean;
  cropId?: string;
}

export interface TurnResult {
  conversationId: string;
  message?: ChatMessage;
  /** The farmer's message the answer replies to. */
  question?: ChatMessage;
  error?: unknown;
}

export interface Turn {
  conversationId: string;
  userMessageId: string;
  done: Promise<TurnResult>;
}

const TITLE_MAX = 40;

/** Conversation title: the first question, at most 40 characters. */
export function makeTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return tNow('ai.chat.photoTitle');
  const chars = Array.from(clean);
  return chars.length > TITLE_MAX ? `${chars.slice(0, TITLE_MAX - 1).join('').trimEnd()}…` : clean;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

/** Answer as compact English-labelled text for the model's context memory. */
function answerForHistory(m: ChatMessage): string {
  const s = m.structured;
  return [
    m.text,
    s?.problem ? `Likely problem: ${s.problem}` : '',
    s?.causes?.length ? `Causes: ${s.causes.join('; ')}` : '',
    s?.doList?.length ? `Do: ${s.doList.join('; ')}` : '',
    s?.dontList?.length ? `Avoid: ${s.dontList.join('; ')}` : '',
    s?.recheck ? `Check again: ${s.recheck}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function historyFor(messages: ChatMessage[]): { role: 'user' | 'assistant'; text: string }[] {
  return messages
    .filter(m => !m.error && (m.text || m.structured || m.image || m.imageDropped))
    .slice(-HISTORY_MESSAGES)
    .map(m => ({
      role: m.role,
      text: clip(m.role === 'user' ? m.text || '[sent a photo of the crop]' : answerForHistory(m), 1200),
    }));
}

/** Strip markdown and a list marker from one line (never the digits of a dose like "2.5 ग्राम"). */
function cleanLine(s: string): string {
  return stripListMarker(toPlainText(s)).replace(/\s+/g, ' ').trim();
}

const FOLLOW_UP_MAX_CHARS = 60;

function cleanSources(sources: GroundingSource[] | undefined): GroundingSource[] {
  const seen = new Set<string>();
  const out: GroundingSource[] = [];
  for (const s of sources || []) {
    if (!s?.uri || !/^https?:\/\//i.test(s.uri) || seen.has(s.uri)) continue;
    seen.add(s.uri);
    out.push({ title: (s.title || '').trim() || hostOf(s.uri), uri: s.uri });
  }
  return out.slice(0, 4);
}

export function hostOf(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '');
  } catch {
    return uri;
  }
}

interface ChatReply {
  answer: string;
  kind: AnswerKind;
  structured?: StructuredAnswer;
  followUps: string[];
}

function parseChatReply(x: any): ChatReply {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Expected an object');
  const answer = toPlainText(v.str(x.answer ?? x.text ?? x.reply)).replace(/\n{3,}/g, '\n\n');
  let structured: StructuredAnswer | undefined;
  const s = x.structured;
  if (s && typeof s === 'object' && !Array.isArray(s)) {
    const st: StructuredAnswer = {
      problem: cleanLine(v.str(s.problem)),
      causes: v.strArr(s.causes, 5).map(cleanLine).filter(Boolean),
      doList: v.strArr(s.doList ?? s.do, 6).map(cleanLine).filter(Boolean),
      dontList: v.strArr(s.dontList ?? s.dont, 4).map(cleanLine).filter(Boolean),
      recheck: cleanLine(v.str(s.recheck)),
    };
    if (st.problem || st.doList?.length) {
      structured = {};
      if (st.problem) structured.problem = st.problem;
      if (st.causes?.length) structured.causes = st.causes;
      if (st.doList?.length) structured.doList = st.doList;
      if (st.dontList?.length) structured.dontList = st.dontList;
      if (st.recheck) structured.recheck = st.recheck;
    }
  }
  if (!answer && !structured) throw new Error('Empty answer');
  const followUps = v
    .strArr(x.followUps ?? x.follow_ups, 3)
    .map(cleanLine)
    .filter(f => f && Array.from(f).length <= FOLLOW_UP_MAX_CHARS);
  const kind = v.oneOf(x.kind, ANSWER_KINDS, structured ? 'problem' : 'general');
  return { answer, kind, structured, followUps };
}

const PHOTO_QUESTION = 'Please look at this photo of my crop. What is the likely problem and what should I do?';

type ReplyFields = Pick<ChatMessage, 'text' | 'kind' | 'structured' | 'followUps' | 'sources'>;

/** System context and grounding for a question: weather and spraying questions get the forecast. */
async function contextFor(rules: string, intent: Intent): Promise<{ system: string; grounding: boolean }> {
  const forecast = intent.weather || intent.spray ? await forecastContext() : '';
  return {
    system: [rules, farmerContext(), forecast].filter(Boolean).join('\n\n'),
    // A spraying question without a recent forecast falls back to live search for one.
    grounding: intent.grounding || (intent.spray && !forecast),
  };
}

async function askChat(user: ChatMessage, history: ReturnType<typeof historyFor>, crop?: Crop): Promise<ReplyFields> {
  const intent = detectIntent(user.text);
  const photo = user.image ? fullImages.get(user.id) || user.image : undefined;
  const prompt = [
    crop ? `This conversation is about the farmer's crop: ${cropContext(crop)}.` : '',
    photo ? 'The farmer attached a photo of the crop.' : '',
    `Farmer's message: ${user.text || PHOTO_QUESTION}`,
  ]
    .filter(Boolean)
    .join('\n');
  const { system, grounding } = await contextFor(CHAT_RULES, intent);
  const { data, sources } = await ai.generateJSON(
    {
      task: 'chat',
      system,
      history,
      prompt,
      images: photo ? [photo] : undefined,
      grounding,
    },
    parseChatReply,
  );
  const out: ReplyFields = { text: data.answer, kind: data.kind };
  if (data.structured) out.structured = data.structured;
  if (data.followUps.length) out.followUps = data.followUps;
  const src = cleanSources(sources);
  if (src.length) out.sources = src;
  return out;
}

/** Spoken answers: at most 120 words (VOICE_RULES asks for that; longer replies are cut). */
const VOICE_MAX_WORDS = 120;

async function askVoice(user: ChatMessage, history: ReturnType<typeof historyFor>, crop?: Crop): Promise<ReplyFields> {
  const intent = detectIntent(user.text);
  const prompt = [crop ? `This conversation is about the farmer's crop: ${cropContext(crop)}.` : '', `Farmer's question (spoken): ${user.text}`]
    .filter(Boolean)
    .join('\n');
  const { system, grounding } = await contextFor(VOICE_RULES, intent);
  // No maxOutputTokens: thinking models count their thinking against it, which cut answers short.
  const res = await ai.generate({ task: 'chat', system, history, prompt, grounding });
  const text = limitWords(
    toPlainText(res.text)
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^[ \t]*•[ \t]*/gm, '')
      .replace(/[*#_`]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    VOICE_MAX_WORDS,
  );
  if (!text) throw new AIError('bad-response', 'Empty voice answer');
  const out: ReplyFields = { text, kind: kindFromIntent(intent) };
  const src = cleanSources(res.sources);
  if (src.length) out.sources = src;
  return out;
}

async function run(conversationId: string, userMessageId: string, mode: 'chat' | 'voice'): Promise<TurnResult> {
  setPending(conversationId, true);
  try {
    const conv = getConversation(conversationId);
    const idx = conv ? conv.messages.findIndex(m => m.id === userMessageId) : -1;
    if (!conv || idx < 0) return { conversationId };
    const user = conv.messages[idx];
    const history = historyFor(conv.messages.slice(0, idx));
    const crop = getCrop(conv.cropId);
    const reply = mode === 'voice' ? await askVoice(user, history, crop) : await askChat(user, history, crop);
    const msg: ChatMessage = { id: newId('m'), role: 'assistant', createdAt: new Date().toISOString(), ...reply };
    appendMessage(conversationId, msg);
    return { conversationId, message: msg, question: user };
  } catch (e) {
    const msg: ChatMessage = {
      id: newId('m'),
      role: 'assistant',
      text: '',
      error: true,
      errorKey: e instanceof AIError ? e.messageKey : 'common.error.generic',
      createdAt: new Date().toISOString(),
    };
    appendMessage(conversationId, msg);
    return { conversationId, error: e };
  } finally {
    setPending(conversationId, false);
  }
}

function trackQuestion(input: TurnInput, count: number) {
  const props = { screen: input.mode, turn: Math.ceil(count / 2), crop: !!input.cropId, grounded: detectIntent(input.text).grounding };
  if (input.image) track('ai_photo_question', props);
  else if (input.viaVoice) track('ai_voice_question', props);
  else track('ai_question', props);
}

/**
 * Adds the farmer's message (creating the conversation when needed) and asks the AI.
 * Returns synchronously with the conversation id; `done` resolves once the answer (or an error
 * bubble) has been stored. Never throws.
 */
export function startTurn(input: TurnInput): Turn {
  const now = new Date().toISOString();
  const user: ChatMessage = { id: newId('m'), role: 'user', text: input.text.trim(), createdAt: now };
  if (input.image) {
    user.image = input.image.thumb;
    rememberFull(user.id, input.image.full);
  }
  if (input.viaVoice) user.viaVoice = true;

  const existing = getConversation(input.conversationId);
  const conv: ChatConversation = existing
    ? { ...existing, updatedAt: now, messages: [...existing.messages, user] }
    : {
        id: newId('c'),
        title: makeTitle(user.text),
        createdAt: now,
        updatedAt: now,
        messages: [user],
        via: input.mode,
        ...(input.cropId ? { cropId: input.cropId } : {}),
      };
  put(conv);
  trackQuestion(input, conv.messages.length);
  return { conversationId: conv.id, userMessageId: user.id, done: run(conv.id, user.id, input.mode) };
}

/** Re-asks the last unanswered question (drops the error bubble). Null when there is nothing to retry. */
export function retryTurn(conversationId: string, mode: 'chat' | 'voice' = 'chat'): Turn | null {
  const conv = getConversation(conversationId);
  if (!conv || isPending(conversationId)) return null;
  let i = conv.messages.length - 1;
  while (i >= 0 && conv.messages[i].role === 'assistant' && conv.messages[i].error) i--;
  const user = conv.messages[i];
  if (!user || user.role !== 'user') return null;
  put({ ...conv, updatedAt: new Date().toISOString(), messages: conv.messages.slice(0, i + 1) });
  return { conversationId, userMessageId: user.id, done: run(conversationId, user.id, mode) };
}

// ---------------------------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------------------------

/**
 * Answer as readable text in the UI language: with bullets for copy, share and saved snippets;
 * `speech` drops the bullet symbols (and ends each item with a pause) for text-to-speech.
 */
export function answerText(m: ChatMessage, t: TFunction, opts: { speech?: boolean } = {}): string {
  const s = m.structured;
  const item = (i: string) => (opts.speech ? (/[।.?!]$/.test(i) ? i : `${i}।`) : `• ${i}`);
  const list = (title: string, items?: string[]) => (items?.length ? `${title}:\n${items.map(item).join('\n')}` : '');
  return [
    m.text,
    s?.problem ? `${t('ai.answer.problem')}: ${s.problem}` : '',
    list(t('ai.answer.causes'), s?.causes),
    list(t('ai.answer.do'), s?.doList),
    list(t('ai.answer.dont'), s?.dontList),
    s?.recheck ? `${t('ai.answer.recheck')}: ${s.recheck}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * What "सुनें" and auto-speak read out: the answer followed by its AI / fertilizer / price
 * disclaimers, so a farmer who only listens also hears that it is an AI suggestion to verify.
 */
export function spokenAnswer(m: ChatMessage, t: TFunction, question?: ChatMessage): string {
  const notes = disclaimersFor(m, question)
    .filter(k => MANDATORY.includes(k))
    .map(k => disclaimerText(k, t));
  return [answerText(m, t, { speech: true }), ...notes].filter(Boolean).join('\n\n');
}

/** Text of a disclaimer, e.g. for copied and shared answers. */
export function disclaimerText(k: DisclaimerKind, t: TFunction): string {
  if (k === 'scheme') return t('ai.answer.schemeNote');
  if (k === 'weather') return t('ai.answer.weatherNote');
  return t(`common.disclaimer.${k}`);
}

/** Short one-line preview of a message. */
export function previewOf(m: ChatMessage | undefined): string {
  if (!m) return '';
  const text = m.text || m.structured?.problem || '';
  return text.replace(/\s+/g, ' ').trim();
}

/** The farmer's question an answer at `index` replies to. */
export function questionBefore(messages: ChatMessage[], index: number): ChatMessage | undefined {
  for (let i = index - 1; i >= 0; i--) if (messages[i].role === 'user') return messages[i];
  return undefined;
}

/**
 * Opens a stored conversation in the chat. Inside the AI tab the tab is reset to the chat root
 * (so back leaves the AI tab instead of stacking chats); elsewhere the current screen is replaced.
 */
export function openConversation(nav: NavApi, conversationId: string) {
  if (nav.tab === 'ai' && nav.stack[0]?.screen === 'ai') nav.switchTab('ai', { screen: 'ai', params: { conversationId } });
  else nav.replace('ai', { conversationId });
}

// ---------------------------------------------------------------------------------------------
// Suggestions and starter questions (built from the farmer's crops and the season)
// ---------------------------------------------------------------------------------------------

const DEFAULT_CROPS: Record<Season, string[]> = {
  rabi: ['wheat', 'mustard', 'gram'],
  kharif: ['paddy', 'soybean', 'cotton'],
  zaid: ['moong', 'okra', 'maize'],
};

export interface CropRef {
  key: string;
  name: string;
  stage?: CropStage;
  stageLabel?: string;
}

const isEn = (lang: string) => lang === 'en';

export function seasonLabel(lang: string, season: Season = currentSeason()): string {
  return isEn(lang) ? SEASON_NAMES[season].en : SEASON_NAMES[season].hi;
}

/**
 * A My-crops record's name in the UI language: the catalog name unless the farmer renamed it
 * (records store the Hindi catalog name by default).
 */
export function cropDisplayName(c: Pick<Crop, 'cropKey' | 'name'>, lang: string): string {
  if (!c.name || (isCropKey(c.cropKey) && c.name === cropName(c.cropKey, 'hi'))) return cropName(c.cropKey, lang);
  return c.name;
}

/** Place name in the UI language (places store the Hindi name, with an English one when known). */
export function placeName(p: Pick<GeoPlace, 'name' | 'nameEn'>, lang: string): string {
  return isEn(lang) ? p.nameEn || p.name : p.name;
}

/** The farmer's crops: My Crops records first, then onboarding choices, then season defaults. */
export function farmerCrops(crops: Crop[], profileKeys: string[] | undefined, lang: string): { list: CropRef[]; own: boolean } {
  const seen = new Set<string>();
  const list: CropRef[] = [];
  for (const c of crops) {
    if (seen.has(c.cropKey)) continue;
    seen.add(c.cropKey);
    const st = stageForCrop(c);
    list.push({
      key: c.cropKey,
      name: cropDisplayName(c, lang),
      stage: st.stage,
      stageLabel: catalogText(lang, st.labelHi, st.labelEn),
    });
  }
  for (const k of profileKeys || []) {
    if (seen.has(k)) continue;
    seen.add(k);
    list.push({ key: k, name: cropName(k, lang) });
  }
  if (list.length) return { list, own: true };
  return { list: DEFAULT_CROPS[currentSeason()].map(k => ({ key: k, name: cropName(k, lang) })), own: false };
}

function suggestionKeyFor(c: CropRef, slot: number, sowingSeason: boolean): string {
  switch (c.stage) {
    case 'planned':
      return slot % 2 ? 'ai.suggest.sowing' : 'ai.suggest.seed';
    case 'germination':
    case 'vegetative':
      return slot % 2 ? 'ai.suggest.fertilizer' : 'ai.suggest.yellow';
    case 'flowering':
    case 'fruiting':
      return slot % 2 ? 'ai.suggest.irrigation' : 'ai.suggest.pest';
    case 'maturity':
      return 'ai.suggest.harvest';
    case 'harvested':
      return 'ai.suggest.price';
    default:
      if (sowingSeason && slot === 0) return 'ai.suggest.sowing';
      return ['ai.suggest.yellow', 'ai.suggest.fertilizer', 'ai.suggest.pest'][slot % 3];
  }
}

/** 4–5 short question chips, e.g. "गेहूं में पीले पत्ते क्यों?". */
export function buildSuggestions(crops: CropRef[], lang: string, t: TFunction): string[] {
  const month = new Date().getMonth() + 1;
  const sowingSeason = [6, 7, 10, 11].includes(month);
  const out: string[] = [];
  // Long custom crop names would make a chip wider than the phone.
  const short = (c: CropRef) => {
    const chars = Array.from(c.name);
    return chars.length > 16 ? `${chars.slice(0, 15).join('')}…` : c.name;
  };
  crops.slice(0, 3).forEach((c, i) => out.push(t(suggestionKeyFor(c, i, sowingSeason), { crop: short(c) })));
  out.push(t('ai.suggest.sowNow', { season: seasonLabel(lang) }));
  out.push(t('ai.suggest.spray'));
  if (out.length < 5 && crops[0]) out.splice(1, 0, t('ai.suggest.price', { crop: short(crops[0]) }));
  return [...new Set(out)].slice(0, 5);
}

const listNames = (crops: CropRef[]) => crops.slice(0, 3).map(c => c.name).join(', ');

export function adviceStarter(t: TFunction, lang: string, crops: { list: CropRef[]; own: boolean }, place: string, focus?: CropRef): string {
  if (focus) return t('ai.starter.adviceCrop', { crop: focus.name, stage: focus.stageLabel || seasonLabel(lang) });
  if (!crops.own) return t('ai.starter.adviceNoCrops', { place, season: seasonLabel(lang) });
  return t('ai.starter.advice', { crops: listNames(crops.list), season: seasonLabel(lang) });
}

export function marketStarter(t: TFunction, crops: { list: CropRef[]; own: boolean }, place: string, focus?: CropRef): string {
  if (focus) return t('ai.starter.market', { crops: focus.name, place });
  if (!crops.own) return t('ai.starter.marketNoCrops', { place });
  return t('ai.starter.market', { crops: listNames(crops.list), place });
}

/** "2 एकड़" */
export function areaLabel(c: Crop, t: TFunction): string {
  return `${formatNumber(c.area)} ${t(`common.${c.unit}`)}`;
}

// ---------- Dev checks ----------

// Keyword and list-marker rules that once went wrong (doses read as list numbers, "अभाव" as a price).
if (import.meta.env.DEV) {
  const problems = checkRules();
  if (problems.length) console.warn(`[ai rules] ${problems.join('; ')}`);
}
