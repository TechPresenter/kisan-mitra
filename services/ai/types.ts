import type { GroundingSource } from '../../types/models';

/** What the request is for — used for rate limits, analytics and backend routing. */
export type AITask =
  | 'chat'
  | 'diagnosis'
  | 'advisory'
  | 'daily'
  | 'soil'
  | 'market'
  | 'mandi-prices'
  | 'calendar'
  | 'generic';

export interface AIRequest {
  task: AITask;
  /** Feature-specific system prompt (the shared persona/safety rules are prepended). */
  system?: string;
  /** Earlier turns, oldest first (text only). */
  history?: { role: 'user' | 'assistant'; text: string }[];
  prompt: string;
  /** JPEG/PNG data URLs. */
  images?: string[];
  /** Allow live web search for time-sensitive facts (prices, weather, schemes). */
  grounding?: boolean;
  /** Expect a single JSON object back. */
  json?: boolean;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface AIResult {
  text: string;
  sources: GroundingSource[];
  provider: string;
}

/** A pluggable model backend. Swap providers without touching feature code. */
export interface AIProvider {
  id: string;
  generate(req: AIRequest & { fullSystem: string }): Promise<AIResult>;
}

export type AIErrorCode =
  | 'not-configured'
  | 'offline'
  | 'rate-limit'
  | 'timeout'
  | 'blocked'
  | 'bad-response'
  | 'network';

export class AIError extends Error {
  constructor(public code: AIErrorCode, message?: string) {
    super(message || code);
    this.name = 'AIError';
  }
  /** i18n key for a friendly message (see lib/common-strings.ts). */
  get messageKey(): string {
    return `ai.error.${this.code}`;
  }
}
