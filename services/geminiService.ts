
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { GroundingSource } from "../types";

const SYSTEM_INSTRUCTION = `
आप "किसान मित्र" (Kisan Mitra) हैं, जो भारतीय किसानों के लिए एक उन्नत कृषि विशेषज्ञ और सलाहकार है। 

नियम:
1. भाषा: उपयोगकर्ता की चुनी हुई भाषा में उत्तर दें। 
2. इमेज एनालिसिस: फोटो में फसल की बीमारी पहचानें और जैविक/रासायनिक समाधान दें।
3. उत्तर की संरचना:
   - 🌿 पहचान: बीमारी का सटीक नाम।
   - 💊 समाधान: जैविक (Organic) और रासायनिक (Chemical) दोनों तरीके।
   - 🛡️ रोकथाम: भविष्य के बचाव के तरीके।
   - 📈 मंडी टिप: वर्तमान बाजार रुझान।
4. गूगल सर्च: मंडी भाव और मौसम के लिए हमेशा ताज़ा डेटा खोजें।
5. सुरक्षा: रसायनों के उपयोग के लिए सरकारी नियमों का पालन करने की चेतावनी दें।
`;

// Analyze crop using text and/or image with search grounding
export const analyzeCrop = async (
  prompt: string,
  image?: string,
  location?: string,
  language: string = 'Hindi'
): Promise<{ text: string; sources: GroundingSource[] }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [];
  
  if (image) {
    const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: image.split(',')[1],
      },
    });
  }
  
  const fullPrompt = `City Context: ${location || 'Unknown'}. 
  User Language: ${language}.
  Query: ${prompt}`;

  parts.push({ text: fullPrompt });

  const config: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
  };

  // Only use googleSearch if no image is provided, as multimodal + search might conflict
  if (!image) {
    config.tools = [{ googleSearch: {} }];
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config,
  });

  const text = response.text || "क्षमा करें, मैं अभी जानकारी प्राप्त नहीं कर पा रहा हूँ।";
  
  const sources: GroundingSource[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title,
          uri: chunk.web.uri,
        });
      }
    });
  }

  return { text, sources };
};

// Fetch real-time dashboard data using search grounding and structured JSON output
export const getDashboardData = async (city: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing");
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Get real-time Mandi rates for top 3 crops and current weather for ${city}. Return ONLY a valid JSON object with the following structure:
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
}`,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });

  // Extract grounding sources as required by guidelines when using googleSearch
  const sources: GroundingSource[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title,
          uri: chunk.web.uri,
        });
      }
    });
  }

  try {
    let text = response.text || "{}";
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      text = jsonMatch[1];
    } else {
      const genericMatch = text.match(/```\n?([\s\S]*?)\n?```/);
      if (genericMatch) {
        text = genericMatch[1];
      } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          text = text.substring(firstBrace, lastBrace + 1);
        }
      }
    }
    const data = JSON.parse(text);
    return { ...data, sources };
  } catch (e) {
    console.error("JSON Parse Error in getDashboardData:", e, response.text);
    return null;
  }
};
