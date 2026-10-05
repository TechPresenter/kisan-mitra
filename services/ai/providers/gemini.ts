// Direct Gemini provider (used by app builds without a backend). The key is bundled into
// the build — see README "AI backend for the app" for the security trade-off.
import { GoogleGenAI, type Content, type GenerateContentResponse } from '@google/genai';
import type { GroundingSource } from '../../../types/models';
import { AIError, type AIProvider, type AIRequest, type AIResult } from '../types';

const MODEL = 'gemini-3.8-flash';

let client: GoogleGenAI | null = null;

const toHistory = (history: AIRequest['history'] = []): Content[] => {
  const contents: Content[] = [];
  for (const turn of history) {
    if (!turn.text.trim()) continue;
    const role = turn.role === 'user' ? 'user' : 'model';
    if (contents.length === 0 && role === 'model') continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts!.push({ text: turn.text });
    else contents.push({ role, parts: [{ text: turn.text }] });
  }
  // The new prompt is the user turn; history must end with the model.
  if (contents.length && contents[contents.length - 1].role === 'user') contents.pop();
  return contents;
};

const toImagePart = (dataUrl: string) => {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  return { inlineData: { mimeType, data } };
};

function extractSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const out: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    out.push({ title: chunk.web?.title || uri, uri });
  }
  return out.slice(0, 6);
}

function mapError(e: any): AIError {
  if (e instanceof AIError) return e;
  if (e?.name === 'AbortError') return new AIError('timeout', 'Request aborted');
  const status = Number(e?.status ?? e?.code);
  if (status === 429) return new AIError('rate-limit', e?.message);
  if (status === 400 && /safety|block/i.test(e?.message || '')) return new AIError('blocked', e?.message);
  if (status >= 500) return new AIError('network', e?.message);
  return new AIError('network', e?.message || String(e));
}

export function createGeminiProvider(apiKey: string): AIProvider {
  return {
    id: 'gemini',
    async generate(req): Promise<AIResult> {
      client ??= new GoogleGenAI({ apiKey });
      const parts: any[] = [...(req.images || []).map(toImagePart), { text: req.prompt }];
      try {
        const response = await client.models.generateContent({
          model: MODEL,
          contents: [...toHistory(req.history), { role: 'user', parts }],
          config: {
            systemInstruction: req.fullSystem,
            ...(req.grounding ? { tools: [{ googleSearch: {} }] } : {}),
            // JSON mode cannot be combined with search grounding; grounded JSON is parsed from text.
            ...(req.json && !req.grounding ? { responseMimeType: 'application/json' } : {}),
            ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
            ...(req.signal ? { abortSignal: req.signal } : {}),
          },
        });
        if (response.promptFeedback?.blockReason) throw new AIError('blocked', String(response.promptFeedback.blockReason));
        const finish = response.candidates?.[0]?.finishReason;
        if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT') throw new AIError('blocked', finish);
        const text = response.text?.trim() || '';
        if (!text) throw new AIError('bad-response', 'Empty response');
        return { text, sources: extractSources(response), provider: 'gemini' };
      } catch (e) {
        throw mapError(e);
      }
    },
  };
}
