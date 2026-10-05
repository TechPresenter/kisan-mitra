import express from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { registerAiGenerate } from "./server/ai-generate";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "15mb" }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "sk-ant...",
});

const ANTHROPIC_MODEL = "claude-opus-5-5";
// Server-side retry on this model if the primary declines a request for policy reasons
const ANTHROPIC_FALLBACK_MODEL = "claude-opus-4-8";

const SYSTEM_INSTRUCTION = `
You are "Kisan Mitra," an advanced agricultural expert and advisor for Indian farmers.

Rules:
1. Language: Answer in the user's chosen language.
2. Image Analysis: Identify the crop disease in the photo and give organic/chemical solutions.
3. Response Structure:
   - 🌿 Identification: Exact name of the disease or pest.
   - 💊 Solution: Both Organic and Chemical methods.
   - 🛡️ Prevention: Future prevention methods.
   - 📈 Mandi Tip: Current market trends.
4. Data freshness: Advise accurately based on common knowledge.
5. Safety: Warn to follow government laws for chemicals.
`;

// Helper to extract text from Anthropic response content blocks
function extractAnthropicText(content: any[]): string {
  if (!Array.isArray(content)) return "";
  const textBlock = content.find((block) => block.type === "text");
  if (textBlock && typeof textBlock.text === "string") {
    return textBlock.text;
  }
  if (content[0] && typeof content[0].text === "string") {
    return content[0].text;
  }
  return "";
}

// Helper to call Anthropic; throws so callers can fall back to Gemini
async function callAnthropicMessages(params: {
  system?: string;
  messages: any[];
  max_tokens: number;
  effort: "low" | "medium" | "high";
}) {
  const msg = await anthropic.beta.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: params.max_tokens,
    system: params.system,
    messages: params.messages,
    output_config: { effort: params.effort },
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: ANTHROPIC_FALLBACK_MODEL }],
  });
  if (msg.stop_reason === "refusal") {
    throw new Error(`Anthropic declined the request (${msg.stop_details?.category ?? "unknown"})`);
  }
  return { msg, modelUsed: msg.model };
}

// Fallback to Gemini if Anthropic fails or is unavailable
async function callGeminiAnalyze(
  prompt: string,
  image?: string,
  location?: string,
  language: string = "Hindi"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  if (image) {
    const partsArr = image.split(",");
    const mimeMatch = partsArr[0]?.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    parts.push({
      inlineData: {
        mimeType,
        data: partsArr[1],
      },
    });
  }

  const fullPrompt = `City Context: ${location || "Unknown"}.
User Language: ${language}.
Query: ${prompt}`;
  parts.push({ text: fullPrompt });

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  return response.text || "फसल सलाह उपलब्ध है। कृपया अपनी फसल की नियमित निगरानी रखें।";
}

async function callGeminiDashboard(city: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Get real-time plausible Mandi rates for top 3 crops and current weather for ${city}. Return ONLY a valid JSON object with the following structure:
{
  "weather": {
    "temp": "string (e.g., 32°C)",
    "condition": "string (e.g., धूप / Sunny)",
    "humidity": "string (e.g., 45%)"
  },
  "mandi": [
    {
      "crop": "string",
      "price": "string",
      "trend": "up, down, or stable"
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

function getFallbackDashboardData(city: string) {
  return {
    weather: {
      temp: "32°C",
      condition: "धूप खिली है (Sunny)",
      humidity: "48%",
    },
    mandi: [
      { crop: "गेहूं (Wheat)", price: "₹2,480/क्विंटल", trend: "up" },
      { crop: "टमाटर (Tomato)", price: "₹1,350/क्विंटल", trend: "down" },
      { crop: "चावल / धान (Paddy)", price: "₹3,150/क्विंटल", trend: "stable" },
    ],
    sources: [],
  };
}

// Generic provider-agnostic endpoint used by the app (services/ai backend provider)
registerAiGenerate(app, anthropic);

app.post("/api/analyze", async (req, res) => {
  const { prompt, image, location, language } = req.body;

  // 1. Try Anthropic first
  try {
    const messages: any[] = [];
    const content: any[] = [];
    if (image) {
      const parts = image.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      let mediaType = "image/jpeg";
      if (mimeMatch && mimeMatch[1]) {
        mediaType = mimeMatch[1];
      }
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as any,
          data: parts[1],
        },
      });
    }

    const fullPrompt = `City Context: ${location || "Unknown"}.
User Language: ${language || "Hindi"}.
Query: ${prompt}`;

    content.push({ type: "text", text: fullPrompt });
    messages.push({ role: "user", content });

    const { msg } = await callAnthropicMessages({
      system: SYSTEM_INSTRUCTION,
      messages,
      max_tokens: 16000,
      effort: "medium",
    });

    return res.json({
      text: extractAnthropicText(msg.content),
      sources: [],
    });
  } catch (anthropicError: any) {
    console.warn("Anthropic Analyze failed, falling back to Gemini:", anthropicError?.message);

    // 2. Try Gemini fallback
    try {
      const text = await callGeminiAnalyze(prompt, image, location, language);
      return res.json({ text, sources: [] });
    } catch (geminiError: any) {
      console.error("Both Anthropic and Gemini failed:", geminiError);
      return res.json({
        text: `🌿 **फसल विशेषज्ञ सलाह (Kisan Mitra)**:
आपकी फसल संबंधी प्रश्न प्राप्त हुआ। 
- **सुझाव**: खेत में जल निकास का उचित प्रबंध रखें और कीटनाशक का प्रयोग कृषि वैज्ञानिक की सलाह पर ही करें।
- **सुरक्षा**: रासायनिक कीटनाशक छिड़कते समय मास्क और दस्ताने पहनें।`,
        sources: [],
      });
    }
  }
});

app.post("/api/dashboard", async (req, res) => {
  const { city } = req.body;

  // 1. Try Anthropic
  try {
    const prompt = `Get real-time plausible Mandi rates for top 3 crops and current weather for ${city}. Return ONLY a valid JSON object with the following structure:
{
  "weather": {
    "temp": "string (e.g., 32°C)",
    "condition": "string (e.g., Sunny)",
    "humidity": "string (e.g., 45%)"
  },
  "mandi": [
    {
      "crop": "string",
      "price": "string",
      "trend": "up, down, or stable"
    }
  ]
}`;

    const { msg } = await callAnthropicMessages({
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8000,
      effort: "low",
    });

    let text = extractAnthropicText(msg.content) || "{}";
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      text = jsonMatch[1];
    } else {
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
      }
    }
    const data = JSON.parse(text);
    return res.json({ ...data, sources: [] });
  } catch (anthropicError: any) {
    console.warn("Anthropic Dashboard failed, falling back to Gemini:", anthropicError?.message);

    // 2. Try Gemini
    try {
      const data = await callGeminiDashboard(city);
      if (data && data.weather && data.mandi) {
        return res.json({ ...data, sources: [] });
      }
    } catch (geminiError: any) {
      console.warn("Gemini dashboard fallback failed:", geminiError?.message);
    }

    // 3. Resilient regional fallback
    return res.json(getFallbackDashboardData(city));
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/{*splat}", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

