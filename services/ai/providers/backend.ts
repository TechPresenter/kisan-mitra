// Backend provider: the app sends the request to our server (server.ts → /api/ai/generate),
// which holds the provider keys. This is the production-safe option.
import { AIError, type AIProvider, type AIResult } from '../types';

export function createBackendProvider(baseUrl: string): AIProvider {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    id: 'backend',
    async generate(req): Promise<AIResult> {
      let res: Response;
      try {
        res = await fetch(`${base}/api/ai/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: req.signal,
          body: JSON.stringify({
            task: req.task,
            system: req.fullSystem,
            history: req.history || [],
            prompt: req.prompt,
            images: req.images || [],
            grounding: !!req.grounding,
            json: !!req.json,
            maxOutputTokens: req.maxOutputTokens,
          }),
        });
      } catch (e: any) {
        throw new AIError(e?.name === 'AbortError' ? 'timeout' : 'network', e?.message);
      }
      if (res.status === 429) throw new AIError('rate-limit');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new AIError(body?.code === 'blocked' ? 'blocked' : 'network', body?.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      if (!body?.text) throw new AIError('bad-response', 'Empty response');
      return { text: String(body.text), sources: Array.isArray(body.sources) ? body.sources : [], provider: 'backend' };
    },
  };
}
