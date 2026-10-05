// Screen 26 — योजना की जानकारी ('scheme' { id }). Verified official content from
// data/schemes.ts: who can apply, benefits (amounts highlighted), a document checklist the
// farmer ticks locally, numbered steps, the official website and the sources, with the
// per-scheme date ("अंतिम जांच" for entries re-confirmed in the catalog review, otherwise the
// official document's date) and a rules-can-change disclaimer. Never adds scheme facts.
import './strings';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  FileText,
  HandCoins,
  Info,
  Landmark,
  ListOrdered,
  RotateCcw,
  Share2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Disclaimer,
  EmptyState,
  ListenButton,
  Screen,
  SectionHeader,
  ToneIcon,
  cx,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { SCHEMES_LAST_VERIFIED, getScheme } from '../../data/schemes';
import { track } from '../../lib/analytics';
import { useOnline } from '../../lib/cache';
import { formatDate } from '../../lib/format';
import { useT, type TFunction } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { usePersisted } from '../../lib/store';
import { shareText } from '../../services/native';
import { toggleSaved, useSaved } from '../../services/saved';
import { useSpeaker } from '../../services/voice';
import type { GovernmentScheme } from '../../types/models';
import { Amounts, asSentence, isSchemeOld, isSchemeReviewed, schemeCategoryKey, schemeCategoryVisual } from './parts';

/** Sources shown before "सभी स्रोत देखें". */
const SOURCES_PREVIEW = 3;
const NO_TICKS: readonly string[] = [];

/**
 * Routes whose view was already counted. StrictMode runs effects twice in dev, and the tab
 * stack remounts a tab's screens when the farmer comes back to it: one route = one view.
 */
const viewedRoutes = new Set<string>();

/** Source site → who published it (t() key). Unknown sites show the web address. */
const PUBLISHER_KEYS: Record<string, string> = {
  'pib.gov.in': 'schemes.src.pib',
  'static.pib.gov.in': 'schemes.src.pib',
  'indiabudget.gov.in': 'schemes.src.budget',
  'agriwelfare.gov.in': 'schemes.src.agriwelfare',
  'krishi.maharashtra.gov.in': 'schemes.src.maharashtra',
  'agriculture.hp.gov.in': 'schemes.src.hp',
  'newsonair.gov.in': 'schemes.src.air',
  'pmkisan.gov.in': 'schemes.src.pmkisan',
  'enam.gov.in': 'schemes.src.enam',
  'pdmc.da.gov.in': 'schemes.src.pdmc',
  'naturalfarming.dac.gov.in': 'schemes.src.nmnf',
};

export default function SchemeDetailScreen() {
  const { params } = useRoute<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const scheme = id ? getScheme(id) : undefined;
  return scheme ? <SchemeDetail scheme={scheme} /> : <MissingScheme id={id} />;
}

// ---------- Missing id ----------

function MissingScheme({ id }: { id: string }) {
  const t = useT();
  const nav = useNav();
  const saved = useSaved();
  const wasSaved = !!id && saved.isSaved('scheme', id);
  return (
    <Screen title={t('schemes.detail.title')}>
      <EmptyState
        art={<EmptyArt kind="search" />}
        title={t('schemes.missing.title')}
        body={t('schemes.missing.body')}
        action={{ label: t('schemes.missing.action'), onPress: () => nav.replace('schemes') }}
        secondaryAction={
          wasSaved
            ? {
                label: t('common.unsave'),
                icon: Bookmark,
                onPress: () => {
                  const item = saved.items.find(i => i.type === 'scheme' && i.refId === id);
                  if (item) saved.remove(item.id);
                  toast(t('schemes.detail.removed'));
                },
              }
            : undefined
        }
      />
    </Screen>
  );
}

// ---------- Detail ----------

function SchemeDetail({ scheme }: { scheme: GovernmentScheme }) {
  const t = useT();
  // Screens stay mounted in the tab stack, so heading ids must be unique per instance.
  const uid = useId();
  const { key: routeKey } = useRoute();
  const online = useOnline();
  const saved = useSaved();
  const isSaved = saved.isSaved('scheme', scheme.id);
  const { icon: CatIcon, tone } = schemeCategoryVisual(scheme.category);
  const categoryLabel = t(schemeCategoryKey(scheme.category));
  const officialHost = hostOf(scheme.officialUrl);
  // Two schemes have no portal of their own; their official link is a PDF (FAQ / PIB note).
  const openLabel = isPdf(scheme.officialUrl) ? t('schemes.detail.openDoc') : t('schemes.detail.openSite');

  useEffect(() => {
    const viewKey = `${routeKey}:${scheme.id}`;
    if (viewedRoutes.has(viewKey)) return;
    viewedRoutes.add(viewKey);
    track('scheme_view', { id: scheme.id });
  }, [routeKey, scheme.id]);

  // Read-aloud runs for over a minute on long schemes. The speaker is global, so stop it when
  // this screen goes away (back / tab switch); otherwise it keeps talking with no stop button.
  const listenId = `scheme-${scheme.id}`;
  const { speakingId, stop } = useSpeaker();
  const speakingRef = useRef(speakingId);
  useEffect(() => {
    speakingRef.current = speakingId;
  }, [speakingId]);
  useEffect(
    () => () => {
      if (speakingRef.current === listenId) stop();
    },
    [listenId, stop],
  );

  const verifiedOn = formatDate(scheme.lastVerified, { year: true });
  // `lastVerified` is the review date only for entries re-confirmed against a 2026 source;
  // otherwise it is the date of the newest official document, so say that instead.
  const reviewed = isSchemeReviewed(scheme);
  const isOld = isSchemeOld(scheme);
  const dateLine = t(reviewed ? 'schemes.detail.lastVerified' : 'schemes.detail.sourceDate', { date: verifiedOn });

  const listenText = useMemo(() => buildListenText(scheme, t), [scheme, t]);

  const onToggleSave = useCallback(() => {
    const now = toggleSaved({
      type: 'scheme',
      refId: scheme.id,
      title: scheme.nameHi,
      snippet: scheme.benefitsHi[0] ?? scheme.summaryHi,
      target: { screen: 'scheme', params: { id: scheme.id } },
    });
    if (now) toast.success(t('common.saved'));
    else toast(t('schemes.detail.removed'));
  }, [scheme, t]);

  // A second tap while the share sheet is open makes Android / Web Share reject, which
  // shareText would turn into a clipboard copy (and a second 'share' event).
  const sharing = useRef(false);
  const onShare = useCallback(async () => {
    if (sharing.current) return;
    sharing.current = true;
    try {
      const officialLabel = isPdf(scheme.officialUrl) ? t('schemes.detail.officialDoc') : t('schemes.share.official');
      const text = [
        scheme.nameHi,
        scheme.summaryHi,
        scheme.benefitsHi[0] ? `${t('schemes.share.benefit')}: ${scheme.benefitsHi[0]}` : '',
        `${officialLabel}: ${scheme.officialUrl}`,
        // A forwarded message must carry the date its figures come from.
        dateLine,
        `— ${t('schemes.share.footer')}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      const result = await shareText(scheme.nameHi, text);
      if (result === 'copied') toast.success(t('schemes.share.copied'));
      if (result !== 'failed') track('share', { type: 'scheme', id: scheme.id, via: result });
    } finally {
      sharing.current = false;
    }
  }, [scheme, t, dateLine]);

  return (
    <Screen
      title={t('schemes.detail.title')}
      subtitle={t('schemes.title')}
      footer={
        <div className="flex flex-col gap-2">
          {!online && (
            <p role="status" className="text-center text-caption text-ink-2">
              {t('schemes.detail.needsInternet')}
            </p>
          )}
          <a
            href={scheme.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('schemes.detail.opensBrowser', { label: `${openLabel} (${officialHost})` })}
            className="press inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-btn bg-brand-700 px-6 py-2 text-center text-card-title leading-snug font-bold text-white select-none hover:bg-brand-800 active:bg-brand-800"
          >
            <span className="pt-0.5">{openLabel}</span>
            <ExternalLink aria-hidden className="size-5.5 shrink-0" strokeWidth={2.25} />
          </a>
        </div>
      }
    >
      {/* Header: icon, names, ministry, category */}
      <Card as="section" aria-labelledby={`${uid}-name`}>
        <div className="flex items-start gap-3.5">
          <ToneIcon icon={CatIcon} tone={tone} size="lg" shape="rounded" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={tone}>{categoryLabel}</Badge>
              {isOld && (
                <Badge tone="amber" icon={Clock}>
                  {t('schemes.detail.oldSource')}
                </Badge>
              )}
            </div>
            <h2 id={`${uid}-name`} lang="hi" className="mt-2 text-section leading-snug font-bold text-ink">
              {scheme.nameHi}
            </h2>
            <p lang="en" className="mt-1 text-small leading-snug text-ink-2">
              {scheme.name}
            </p>
          </div>
        </div>
        {scheme.ministry && (
          <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-small text-ink-2">
            <Landmark aria-hidden className="mt-0.5 size-4.5 shrink-0 text-ink-3" />
            <span>
              <span className="sr-only">{t('schemes.detail.ministry')}: </span>
              <span lang="hi">{scheme.ministry}</span>
            </span>
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant={isSaved ? 'soft' : 'secondary'} icon={isSaved ? BookmarkCheck : Bookmark} onClick={onToggleSave} fullWidth>
            {isSaved ? t('schemes.detail.isSaved') : t('common.save')}
          </Button>
          <Button variant="secondary" icon={Share2} onClick={onShare} fullWidth>
            {t('common.share')}
          </Button>
        </div>
      </Card>

      {/* Summary + read aloud */}
      <Card as="section" aria-labelledby={`${uid}-about`}>
        <SectionHeader
          as="h3"
          icon={Info}
          title={<span id={`${uid}-about`}>{t('schemes.detail.about')}</span>}
          action={<ListenButton id={listenId} text={listenText} />}
          className="mb-3"
        />
        <p lang="hi" className="text-body leading-relaxed text-ink">
          <Amounts text={scheme.summaryHi} />
        </p>
      </Card>

      {/* Who can apply */}
      {scheme.eligibilityHi.length > 0 && (
        <Card as="section" aria-labelledby={`${uid}-eligibility`}>
          <SectionHeader as="h3" icon={UserCheck} title={<span id={`${uid}-eligibility`}>{t('schemes.detail.eligibility')}</span>} className="mb-3" />
          <ul className="flex flex-col gap-3">
            {scheme.eligibilityHi.map((line, i) => {
              // Exclusions get a red ✗ and rules (penalties, waiting periods, lottery) a neutral
              // ⓘ; only real qualifications get the green ✓.
              const kind = eligibilityKind(line);
              const Mark = kind === 'excluded' ? CircleX : kind === 'rule' ? Info : CircleCheck;
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <Mark
                    aria-hidden
                    className={cx(
                      'mt-0.5 size-5.5 shrink-0',
                      kind === 'excluded' ? 'text-tone-red' : kind === 'rule' ? 'text-ink-3' : 'text-tone-green',
                    )}
                    strokeWidth={2.25}
                  />
                  <span lang="hi" className="text-body leading-relaxed text-ink">
                    {line}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Benefits */}
      {scheme.benefitsHi.length > 0 && (
        <BenefitsCard scheme={scheme} oldNote={isOld ? t('schemes.detail.disclaimerOld', { date: verifiedOn }) : undefined} />
      )}

      {/* Documents checklist (ticks are saved on this phone, per scheme) */}
      {scheme.documentsHi.length > 0 && <DocumentsCard scheme={scheme} />}

      {/* How to apply */}
      {scheme.howToApplyHi.length > 0 && (
        <Card as="section" aria-labelledby={`${uid}-apply`}>
          <SectionHeader as="h3" icon={ListOrdered} title={<span id={`${uid}-apply`}>{t('schemes.detail.howToApply')}</span>} className="mb-3" />
          <ol className="flex flex-col gap-3.5">
            {scheme.howToApplyHi.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-small font-bold text-white tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="pt-1 text-body leading-relaxed text-ink">
                  <span className="sr-only">{t('schemes.speak.step', { n: i + 1 })}: </span>
                  <span lang="hi">{step}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Official site, sources, last check, disclaimer */}
      <OfficialCard scheme={scheme} verifiedOn={verifiedOn} dateLine={dateLine} reviewed={reviewed} isOld={isOld} />
    </Screen>
  );
}

// ---------- Sections ----------

/** `oldNote` is shown above the amounts when they come from an old official document. */
function BenefitsCard({ scheme, oldNote }: { scheme: GovernmentScheme; oldNote?: string }) {
  const t = useT();
  const uid = useId();
  const [key, ...rest] = scheme.benefitsHi;
  return (
    <Card as="section" aria-labelledby={`${uid}-benefits`}>
      <SectionHeader as="h3" icon={HandCoins} title={<span id={`${uid}-benefits`}>{t('schemes.detail.benefits')}</span>} className="mb-3" />
      {oldNote && (
        <Disclaimer variant="warning" className="mb-3">
          {oldNote}
        </Disclaimer>
      )}
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
        <p className="text-caption font-semibold text-ink-2">{t('schemes.detail.keyBenefit')}</p>
        <p lang="hi" className="mt-0.5 text-card-title leading-snug font-bold text-brand">
          {key}
        </p>
      </div>
      {rest.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {rest.map((line, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-2.5 size-2 shrink-0 rounded-full bg-brand-600" />
              <Amounts text={line} lang="hi" className="text-body leading-relaxed text-ink" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DocumentsCard({ scheme }: { scheme: GovernmentScheme }) {
  const t = useT();
  const uid = useId();
  const [stored, setChecked] = usePersisted<string[]>(`schemes.docs.${scheme.id}`, []);
  // A corrupted stored value must not crash the screen.
  const checked: readonly string[] = Array.isArray(stored) ? stored : NO_TICKS;
  // Lines such as "दस्तावेज़ों की सूची राज्य कृषि विभाग तय करता है…" are guidance, not a paper
  // to tick, so they render as a note and are left out of the count.
  const docs = useMemo(() => scheme.documentsHi.filter(d => !isGuidance(d)), [scheme.documentsHi]);
  const notes = useMemo(() => scheme.documentsHi.filter(isGuidance), [scheme.documentsHi]);
  // Papers only some farmers need (tenants, leased land, "(वैकल्पिक)") stay tickable but are
  // not counted, so an owner-farmer can reach "all ticked" honestly.
  const required = useMemo(() => docs.filter(d => !isOptionalDoc(d)), [docs]);
  // Ticks are stored by document text, so an edited catalog line simply starts unticked.
  const done = useMemo(() => required.filter(d => checked.includes(d)).length, [required, checked]);
  const anyTicked = useMemo(() => docs.some(d => checked.includes(d)), [docs, checked]);
  const total = required.length;
  const all = total > 0 && done === total;

  const setDoc = (doc: string, on: boolean) =>
    setChecked(prev => {
      const base = Array.isArray(prev) ? prev : [];
      const without = base.filter(d => d !== doc && docs.includes(d));
      return on ? [...without, doc] : without;
    });

  return (
    <Card as="section" aria-labelledby={`${uid}-docs`}>
      <SectionHeader
        as="h3"
        icon={FileText}
        title={<span id={`${uid}-docs`}>{t('schemes.detail.documents')}</span>}
        subtitle={docs.length > 0 ? t('schemes.detail.documentsHint') : undefined}
        className="mb-2"
      />
      {docs.length > 0 && (
        <ul className="flex flex-col">
          {docs.map((doc, i) => {
            const on = checked.includes(doc);
            return (
              <li key={doc} className={cx(i > 0 && 'border-t border-line')}>
                <Checkbox
                  shape="square"
                  size="md"
                  checked={on}
                  onChange={next => setDoc(doc, next)}
                  label={
                    <span lang="hi" className={cx('leading-relaxed', on && 'text-ink-2')}>
                      {doc}
                    </span>
                  }
                  description={isOptionalDoc(doc) ? t('schemes.detail.docOptional') : undefined}
                  className="w-full py-1.5"
                />
              </li>
            );
          })}
        </ul>
      )}
      {notes.map(note => (
        <p key={note} className="mt-2 flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-small leading-relaxed text-ink-2 hc:border hc:border-line">
          <Info aria-hidden className="mt-0.5 size-4.5 shrink-0 text-ink-3" />
          <span lang="hi">{note}</span>
        </p>
      ))}
      {total > 0 && (
        <div className="mt-2 border-t border-line pt-3">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2">
            <span role="status">
              <Badge tone={all ? 'green' : 'gray'} size="md" icon={all ? CircleCheck : undefined}>
                {all ? t('schemes.detail.docsAllReady') : t('schemes.detail.docsReady', { done, total })}
              </Badge>
            </span>
            {anyTicked && (
              <Button variant="ghost" icon={RotateCcw} onClick={() => setChecked([])} className="-mr-2">
                {t('schemes.detail.docsReset')}
              </Button>
            )}
          </div>
          {all && <p className="mt-1 text-small text-ink-2">{t('schemes.detail.docsAllNote')}</p>}
        </div>
      )}
    </Card>
  );
}

function OfficialCard({
  scheme,
  verifiedOn,
  dateLine,
  reviewed,
  isOld,
}: {
  scheme: GovernmentScheme;
  verifiedOn: string;
  dateLine: string;
  reviewed: boolean;
  isOld: boolean;
}) {
  const t = useT();
  const uid = useId();
  const [showAll, setShowAll] = useState(false);
  const sources = useMemo(() => scheme.sourceUrls.filter(u => u !== scheme.officialUrl), [scheme]);
  const visible = showAll ? sources : sources.slice(0, SOURCES_PREVIEW);

  return (
    <Card as="section" aria-labelledby={`${uid}-official`}>
      <SectionHeader as="h3" icon={ShieldCheck} title={<span id={`${uid}-official`}>{t('schemes.detail.official')}</span>} className="mb-3" />

      <LinkRow
        url={scheme.officialUrl}
        title={isPdf(scheme.officialUrl) ? t('schemes.detail.officialDoc') : t('schemes.detail.officialSite')}
        detail={hostOf(scheme.officialUrl)}
        primary
      />

      {sources.length > 0 && (
        <div className="mt-4">
          <p className="text-small font-semibold text-ink">{t('schemes.detail.sources')}</p>
          <p className="text-caption text-ink-2">{t('schemes.detail.sourcesHint')}</p>
          <ul className="mt-2 flex flex-col">
            {visible.map((url, i) => {
              const kind = isPdf(url) ? t('schemes.detail.pdf') : t('schemes.detail.webPage');
              const host = hostOf(url);
              const publisherKey = PUBLISHER_KEYS[host];
              return (
                <li key={url} className={cx(i > 0 && 'border-t border-line')}>
                  <LinkRow url={url} title={publisherKey ? t(publisherKey) : host} detail={`${kind} · ${host}`} />
                </li>
              );
            })}
          </ul>
          {sources.length > SOURCES_PREVIEW && (
            <Button
              variant="ghost"
              iconRight={showAll ? ChevronUp : ChevronDown}
              aria-expanded={showAll}
              onClick={() => setShowAll(v => !v)}
              className="-ml-2 mt-1"
            >
              {showAll ? t('schemes.detail.showFewerSources') : t('schemes.detail.showAllSources', { n: sources.length })}
            </Button>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-small font-medium text-ink">
            <Clock aria-hidden className="size-4 shrink-0 text-ink-3" />
            <span className="pt-0.5">{dateLine}</span>
          </span>
          {isOld && <Badge tone="amber">{t('schemes.detail.oldSource')}</Badge>}
        </div>
        {!reviewed && (
          <p className="mt-1 text-caption text-ink-2">
            {t('schemes.detail.listChecked', { date: formatDate(SCHEMES_LAST_VERIFIED, { year: true }) })}
          </p>
        )}
      </div>

      <Disclaimer variant="warning" className="mt-3">
        {t('schemes.detail.disclaimer')}
        {isOld && (
          <>
            {' '}
            {t('schemes.detail.disclaimerOld', { date: verifiedOn })}
          </>
        )}
      </Disclaimer>
    </Card>
  );
}

/** External link row (≥ 48px) that opens in the system browser. */
function LinkRow({ url, title, detail, primary = false }: { url: string; title: string; detail: string; primary?: boolean }) {
  const t = useT();
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('schemes.detail.opensBrowser', { label: `${title}, ${detail}` })}
      className={cx(
        'press flex min-h-12 items-center gap-3 py-2',
        primary && 'rounded-list border border-brand-100 bg-brand-50 px-3',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cx('block break-words leading-snug', primary ? 'text-body font-semibold text-ink' : 'text-small font-medium text-brand')}>
          {title}
        </span>
        <span className={cx('block break-all text-caption', primary ? 'font-medium text-brand' : 'text-ink-2')}>{detail}</span>
      </span>
      <ExternalLink aria-hidden className={cx('size-5 shrink-0', primary ? 'text-brand' : 'text-ink-3')} strokeWidth={2.25} />
    </a>
  );
}

// ---------- Helpers ----------

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A "documents" line that tells the farmer where to ask, rather than naming a paper. */
function isGuidance(line: string): boolean {
  return /तय कर(ता|ती) है/.test(line);
}

/** A paper only some farmers need: "… हो तो …", "(वैकल्पिक)", or the tenant-farmer line. */
function isOptionalDoc(line: string): boolean {
  return /हो तो|\(वैकल्पिक\)|^बटाईदार/.test(line);
}

/**
 * Eligibility lines mix qualifications with exclusions and rules. Until the catalog has
 * structured fields for them, tell them apart by wording.
 */
function eligibilityKind(line: string): 'excluded' | 'rule' | 'ok' {
  if (/पात्र नहीं|अपात्र/.test(line)) return 'excluded';
  if (/गलत घोषणा|बाद ही दोबारा|वसूल|लॉटरी/.test(line)) return 'rule';
  return 'ok';
}

function isPdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return /\.pdf($|\?)/i.test(url);
  }
}

/** Read-aloud text: name, summary, benefits and the numbered steps. */
function buildListenText(s: GovernmentScheme, t: TFunction): string {
  const parts = [asSentence(s.nameHi), asSentence(s.summaryHi)];
  if (s.benefitsHi.length) parts.push(`${t('schemes.detail.benefits')}: ${s.benefitsHi.map(asSentence).join(' ')}`);
  if (s.howToApplyHi.length)
    parts.push(
      `${t('schemes.detail.howToApply')}: ${s.howToApplyHi.map((step, i) => `${t('schemes.speak.step', { n: i + 1 })}: ${asSentence(step)}`).join(' ')}`,
    );
  return forSpeech(parts.join(' '), t);
}

/**
 * The speech chunker splits on every ".", so "1.5%" would be read as "1." + pause + "5%" and
 * "pmkisan.gov.in" as broken pieces. Dates (01.08.2019), decimals and web addresses are
 * rewritten so no "." is left inside them.
 */
function forSpeech(text: string, t: TFunction): string {
  const point = t('schemes.speak.decimal');
  const dot = t('schemes.speak.dot');
  return text
    .replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, '$1-$2-$3')
    .replace(/(\d+)\.(\d+)/g, (_m, whole: string, frac: string) => `${whole} ${point} ${frac.split('').join(' ')}`)
    .replace(/\.(?=[a-z])/gi, ` ${dot} `);
}
