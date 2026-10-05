// Provider-agnostic AI service. Feature code calls `ai.generate()` / `ai.generateJSON()`
// with a task + prompts; which model/provider answers is decided here only.
import { Capacitor } from '@capacitor/core';
import { aiLanguageInstruction } from '../../lib/i18n';
import { isOnline } from '../../lib/cache';
import { track } from '../../lib/analytics';
import { store } from '../../lib/store';
import { createBackendProvider } from './providers/backend';
import { createGeminiProvider } from './providers/gemini';
import { AIError, type AIProvider, type AIRequest, type AIResult } from './types';

export * from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();
const GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

function selectProvider(): AIProvider | null {
  if (API_BASE) return createBackendProvider(API_BASE);
  if (GEMINI_KEY) return createGeminiProvider(GEMINI_KEY);
  // Web build served by server.ts: same-origin backend.
  if (!Capacitor.isNativePlatform()) return createBackendProvider('');
  return null;
}

const provider = selectProvider();

/** Shared persona and safety rules, prepended to every feature prompt. */
export const BASE_SYSTEM = `You are "Kisan Mitra" (किसान मित्र), a trusted agricultural advisor for Indian farmers.
Principles:
- Be practical, specific and brief. Prefer actions the farmer can take today with locally available inputs.
- Give both organic/low-cost and chemical options where relevant; for chemicals give the common name, a typical dose per litre or per acre, and safety precautions. Only mention chemicals approved for use in India.
- Never present a diagnosis, price or forecast as certain. Use words like "संभावित"/"likely". Advise consulting the local Krishi Vigyan Kendra (KVK) or agriculture officer for serious cases and before heavy chemical use.
- Never invent government schemes, subsidy amounts, helpline numbers, prices or statistics. If unsure, say so and point to the official source.
- Never guarantee future market prices.
- Stay on agriculture, livestock, weather, markets and rural livelihood topics; politely decline unrelated requests.
- Do not use markdown symbols such as **, # or tables unless JSON is requested.`;

// ---- Client-side rate limiting (protects the key/quota; the backend enforces its own) ----
const LIMIT_PER_MINUTE = 12;
const LIMIT_PER_DAY = 300;
const recent: number[] = [];

function checkRateLimit() {
  const now = Date.now();
  while (recent.length && now - recent[0] > 60_000) recent.shift();
  if (recent.length >= LIMIT_PER_MINUTE) throw new AIError('rate-limit');
  const day = new Date().toISOString().slice(0, 10);
  const usage = store.get<{ day: string; count: number }>('ai.usage', { day, count: 0 });
  const count = usage.day === day ? usage.count : 0;
  if (count >= LIMIT_PER_DAY) throw new AIError('rate-limit');
  recent.push(now);
  store.set('ai.usage', { day, count: count + 1 });
}

const TIMEOUT_MS = 75_000;

async function withTimeout(req: AIRequest, run: (signal: AbortSignal) => Promise<AIResult>): Promise<AIResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  req.signal?.addEventListener('abort', onAbort);
  try {
    return await run(controller.signal);
  } catch (e) {
    if (controller.signal.aborted && !req.signal?.aborted) throw new AIError('timeout');
    throw e;
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onAbort);
  }
}

/** Pull the first JSON object/array out of a model reply (handles ``` fences and prose). */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new AIError('bad-response', 'No JSON in response');
  const open = body[start];
  const end = body.lastIndexOf(open === '{' ? '}' : ']');
  if (end <= start) throw new AIError('bad-response', 'Unterminated JSON');
  body = body.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    // Common model slip: trailing commas.
    try {
      return JSON.parse(body.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new AIError('bad-response', 'Invalid JSON');
    }
  }
}

export const ai = {
  /** Whether any provider is configured for this build. */
  available(): boolean {
    return !!provider;
  },

  providerId(): string {
    return provider?.id || 'none';
  },

  async generate(req: AIRequest): Promise<AIResult> {
    if (!provider) throw new AIError('not-configured');
    if (!isOnline()) throw new AIError('offline');
    checkRateLimit();
    const fullSystem = [BASE_SYSTEM, req.system, aiLanguageInstruction()].filter(Boolean).join('\n\n');
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await withTimeout(req, signal => provider.generate({ ...req, signal, fullSystem }));
        return result;
      } catch (e) {
        lastError = e;
        const retryable = e instanceof AIError && (e.code === 'network' || e.code === 'bad-response');
        if (!retryable || attempt === 1 || req.signal?.aborted) break;
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    track('error', { area: 'ai', task: req.task, code: lastError instanceof AIError ? lastError.code : 'unknown' });
    throw lastError instanceof AIError ? lastError : new AIError('network', String(lastError));
  },

  /**
   * Ask for a JSON object. `validate` should check/normalise the shape and throw on bad data;
   * a malformed reply is retried once with a stricter instruction.
   */
  async generateJSON<T>(
    req: AIRequest,
    validate: (value: any) => T,
  ): Promise<{ data: T; sources: AIResult['sources'] }> {
    const jsonReq: AIRequest = {
      ...req,
      json: true,
      prompt: `${req.prompt}\n\nReturn ONLY one valid JSON object, with no extra text.`,
    };
    let result = await ai.generate(jsonReq);
    try {
      return { data: validate(extractJSON(result.text)), sources: result.sources };
    } catch {
      result = await ai.generate({
        ...jsonReq,
        prompt: `${jsonReq.prompt}\nYour previous reply was not valid JSON for the requested shape. Reply with the JSON object only.`,
      });
      try {
        return { data: validate(extractJSON(result.text)), sources: result.sources };
      } catch (e) {
        throw e instanceof AIError ? e : new AIError('bad-response', String(e));
      }
    }
  },
};

/** Strip markdown the model may still emit, for plain-text bubbles. */
export function toPlainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^(\s*)[*-]\s+/gm, '$1• ')
    .replace(/^#{1,6}\s*/gm, '')
    .trim();
}

/** Small validation helpers for generateJSON validators. */
export const v = {
  str(x: unknown, fallback = ''): string {
    return typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : fallback;
  },
  strArr(x: unknown, max = 12): string[] {
    return Array.isArray(x) ? x.map(i => v.str(i)).filter(Boolean).slice(0, max) : [];
  },
  num(x: unknown, fallback = 0): number {
    const n = typeof x === 'number' ? x : parseFloat(String(x ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : fallback;
  },
  oneOf<T extends string>(x: unknown, options: readonly T[], fallback: T): T {
    return options.includes(x as T) ? (x as T) : fallback;
  },
};
