
import { GoogleGenAI, type Content, type GenerateContentResponse } from "@google/genai";
import { GroundingSource } from "../types";

// Empty on the web (same-origin server). Set VITE_API_BASE_URL to send an app
// build to a deployed backend instead.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Android build only (from .env.android.local): with no backend URL, the app calls
// Gemini directly with this key. Anything bundled here can be extracted from the APK.
const GEMINI_API_KEY: string = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-3.8-flash";
const useDirectGemini = !API_BASE && !!GEMINI_API_KEY;

const SYSTEM_INSTRUCTION = `
You are "Kisan Mitra," an advanced agricultural expert and advisor for Indian farmers.

Rules:
1. Language: Answer in the user's chosen language, in simple words a farmer understands.
2. Image Analysis: Identify the crop disease in the photo and give organic/chemical solutions.
3. Response Structure (for crop problems):
   - 🌿 Identification: Exact name of the disease or pest.
   - 💊 Solution: Both Organic and Chemical methods, with dosage.
   - 🛡️ Prevention: Future prevention methods.
   - 📈 Mandi Tip: Current market trends for that crop.
   For general questions, answer directly and concisely.
4. Data freshness: Use Google Search for prices, weather, government schemes and anything time-sensitive.
5. Safety: Warn to follow government laws for chemicals and to consult the local Krishi Vigyan Kendra before heavy chemical use.
6. Formatting: Plain text only (the app cannot render markdown): no **, #, or tables. Use emojis as section markers and "•" for bullet points.
`;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// The chat bubble shows plain text, so strip markdown the model may still emit
const toPlainText = (text: string): string =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^(\s*)[*-]\s+/gm, '$1• ')
    .replace(/^#{1,6}\s*/gm, '');

let client: GoogleGenAI | null = null;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY }));

const extractSources = (response: GenerateContentResponse): GroundingSource[] => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ title: chunk.web?.title || uri, uri });
  }
  return sources.slice(0, 5);
};

// Gemini expects alternating turns that start with the user.
const toGeminiHistory = (history: ChatTurn[]): Content[] => {
  const contents: Content[] = [];
  for (const turn of history) {
    if (!turn.content.trim()) continue;
    const role = turn.role === 'user' ? 'user' : 'model';
    if (contents.length === 0 && role === 'model') continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts!.push({ text: turn.content });
    } else {
      contents.push({ role, parts: [{ text: turn.content }] });
    }
  }
  if (contents.length && contents[contents.length - 1].role === 'user') contents.pop();
  return contents;
};

const analyzeWithGemini = async (
  prompt: string,
  image: string | undefined,
  location: string | undefined,
  language: string,
  history: ChatTurn[],
): Promise<{ text: string; sources: GroundingSource[] }> => {
  const parts: any[] = [];
  if (image) {
    const [header, data] = image.split(",");
    const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    parts.push({ inlineData: { mimeType, data } });
  }
  parts.push({
    text: `City Context: ${location || "Unknown"}.
User Language: ${language}.
Query: ${prompt || "Please analyze this crop photo."}`,
  });

  const response = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: [...toGeminiHistory(history), { role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Empty response from Gemini");
  return { text, sources: extractSources(response) };
};

const dashboardWithGemini = async (city: string) => {
  const prompt = `Use Google Search to find today's mandi (APMC / Agmarknet) modal prices for the 3 most traded crops in ${city}, India, and the current weather in ${city}.
Return ONLY a valid JSON object, no other text:
{
  "weather": { "temp": "e.g. 32°C", "condition": "Hindi + English, e.g. धूप (Sunny)", "humidity": "e.g. 45%" },
  "mandi": [ { "crop": "Hindi + English, e.g. गेहूं (Wheat)", "price": "per quintal, amount only, e.g. ₹2,450", "trend": "up | down | stable" } ]
}`;

  const response = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  let text = response.text || "{}";
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    text = fenced[1];
  } else {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) text = text.substring(first, last + 1);
  }
  const data = JSON.parse(text);
  return { ...data, sources: extractSources(response) };
};

export const analyzeCrop = async (
  prompt: string,
  image?: string,
  location?: string,
  language: string = 'Hindi',
  history: ChatTurn[] = []
): Promise<{ text: string; sources: GroundingSource[] }> => {
  if (useDirectGemini) {
    const result = await analyzeWithGemini(prompt, image, location, language, history);
    return { ...result, text: toPlainText(result.text) };
  }
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image, location, language }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to analyze crop");
  }
  const result = await res.json();
  return { ...result, text: toPlainText(result.text || "") };
};

export const getDashboardData = async (city: string) => {
  if (useDirectGemini) {
    return dashboardWithGemini(city);
  }
  const res = await fetch(`${API_BASE}/api/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch dashboard data");
  }
  return res.json();
};
