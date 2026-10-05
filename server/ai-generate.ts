// POST /api/ai/generate — the backend side of services/ai/providers/backend.ts.
// Keeps provider keys on the server, validates input and rate-limits per client IP.
// Gemini (with Google Search grounding) is used when GEMINI_API_KEY is set; otherwise Claude,
// with Anthropic's web search tool for grounded requests.
import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, type Content } from "@google/genai";

const GEMINI_MODEL = "gemini-3.8-flash";
const CLAUDE_MODEL = "claude-opus-5-5";
const CLAUDE_FALLBACK_MODEL = "claude-opus-4-8";

const LIMITS = { perMinute: 20, perDay: 400 };
const MAX_PROMPT_CHARS = 12_000;
const MAX_SYSTEM_CHARS = 12_000;
const MAX_HISTORY_TURNS = 20;
const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ≈ 4.5 MB per image

interface Body {
  task: string;
  system: string;
  history: { role: "user" | "assistant"; text: string }[];
  prompt: string;
  images: string[];
  grounding: boolean;
  json: boolean;
  maxOutputTokens?: number;
}

interface Source {
  title: string;
  uri: string;
}

// ---- Per-IP rate limiting (in-memory; use a shared store when running several instances) ----
const usage = new Map<string, { minute: number[]; day: string; count: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(ip) || { minute: [], day, count: 0 };
  u.minute = u.minute.filter(t => now - t < 60_000);
  if (u.day !== day) {
    u.day = day;
    u.count = 0;
  }
  if (u.minute.length >= LIMITS.perMinute || u.count >= LIMITS.perDay) {
    usage.set(ip, u);
    return true;
  }
  u.minute.push(now);
  u.count++;
  usage.set(ip, u);
  return false;
}

function parseBody(raw: any): Body | string {
  if (!raw || typeof raw !== "object") return "Invalid body";
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  if (!prompt.trim()) return "prompt is required";
  if (prompt.length > MAX_PROMPT_CHARS) return "prompt too long";
  const system = typeof raw.system === "string" ? raw.system.slice(0, MAX_SYSTEM_CHARS) : "";
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((h: any) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
        .slice(-MAX_HISTORY_TURNS)
        .map((h: any) => ({ role: h.role, text: String(h.text).slice(0, 6000) }))
    : [];
  const images = Array.isArray(raw.images) ? raw.images : [];
  if (images.length > MAX_IMAGES) return "too many images";
  for (const img of images) {
    if (typeof img !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(img)) return "images must be JPEG/PNG/WebP data URLs";
    if (img.length > MAX_IMAGE_BASE64_CHARS) return "image too large";
  }
  const maxOutputTokens = Number(raw.maxOutputTokens);
  return {
    task: typeof raw.task === "string" ? raw.task.slice(0, 40) : "generic",
    system,
    history,
    prompt,
    images,
    grounding: raw.grounding === true,
    json: raw.json === true,
    maxOutputTokens: Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? Math.min(maxOutputTokens, 16000) : undefined,
  };
}

const splitDataUrl = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  return { mime: header.match(/:(.*?);/)?.[1] || "image/jpeg", data };
};

async function viaGemini(body: Body, apiKey: string): Promise<{ text: string; sources: Source[] }> {
  const ai = new GoogleGenAI({ apiKey });
  const history: Content[] = [];
  for (const turn of body.history) {
    const role = turn.role === "user" ? "user" : "model";
    if (!history.length && role === "model") continue;
    const last = history[history.length - 1];
    if (last && last.role === role) last.parts!.push({ text: turn.text });
    else history.push({ role, parts: [{ text: turn.text }] });
  }
  if (history.length && history[history.length - 1].role === "user") history.pop();
  const parts: any[] = body.images.map(img => {
    const { mime, data } = splitDataUrl(img);
    return { inlineData: { mimeType: mime, data } };
  });
  parts.push({ text: body.prompt });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [...history, { role: "user", parts }],
    config: {
      systemInstruction: body.system,
      ...(body.grounding ? { tools: [{ googleSearch: {} }] } : {}),
      ...(body.json && !body.grounding ? { responseMimeType: "application/json" } : {}),
      ...(body.maxOutputTokens ? { maxOutputTokens: body.maxOutputTokens } : {}),
    },
  });
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const chunk of response.candidates?.[0]?.groundingMetadata?.groundingChunks || []) {
    const uri = chunk.web?.uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({ title: chunk.web?.title || uri, uri });
    }
  }
  return { text: response.text?.trim() || "", sources: sources.slice(0, 6) };
}

async function viaClaude(body: Body, client: Anthropic): Promise<{ text: string; sources: Source[] }> {
  const content: any[] = body.images.map(img => {
    const { mime, data } = splitDataUrl(img);
    return { type: "image", source: { type: "base64", media_type: mime, data } };
  });
  content.push({ type: "text", text: body.prompt });
  const messages: any[] = [
    ...body.history.map(h => ({ role: h.role, content: h.text })),
    { role: "user", content },
  ];
  // The API requires the conversation to start with a user turn.
  while (messages.length && messages[0].role !== "user") messages.shift();

  let response: any;
  // A grounded turn can pause while server-side search runs; resume up to 3 times.
  for (let i = 0; i < 4; i++) {
    response = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: body.maxOutputTokens || 16000,
      system: body.system,
      messages,
      output_config: { effort: body.task === "chat" || body.task === "diagnosis" ? "medium" : "low" },
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: CLAUDE_FALLBACK_MODEL }],
      ...(body.grounding ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] } : {}),
    } as any);
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  if (response.stop_reason === "refusal") throw Object.assign(new Error("declined"), { code: "blocked" });

  const sources: Source[] = [];
  const seen = new Set<string>();
  const texts: string[] = [];
  for (const block of response.content || []) {
    if (block.type === "text") texts.push(block.text);
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r.type === "web_search_result" && r.url && !seen.has(r.url)) {
          seen.add(r.url);
          sources.push({ title: r.title || r.url, uri: r.url });
        }
      }
    }
  }
  return { text: texts.join("").trim(), sources: sources.slice(0, 6) };
}

export function registerAiGenerate(app: Express, anthropic: Anthropic) {
  app.post("/api/ai/generate", async (req: Request, res: Response) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    if (rateLimited(ip)) return res.status(429).json({ error: "rate limited", code: "rate-limit" });

    const body = parseBody(req.body);
    if (typeof body === "string") return res.status(400).json({ error: body, code: "invalid" });

    const geminiKey = process.env.GEMINI_API_KEY;
    try {
      const result = geminiKey
        ? await viaGemini(body, geminiKey)
        : process.env.ANTHROPIC_API_KEY
          ? await viaClaude(body, anthropic)
          : null;
      if (!result) return res.status(503).json({ error: "No AI provider configured", code: "not-configured" });
      if (!result.text) return res.status(502).json({ error: "Empty response", code: "bad-response" });
      return res.json(result);
    } catch (e: any) {
      console.warn(`[ai/generate] ${body.task} failed:`, e?.message);
      if (e?.code === "blocked") return res.status(422).json({ error: "Request declined", code: "blocked" });
      if (Number(e?.status) === 429) return res.status(429).json({ error: "Provider rate limit", code: "rate-limit" });
      return res.status(502).json({ error: "AI provider error", code: "network" });
    }
  });
}
