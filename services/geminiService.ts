
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents: any[] = [];
  
  if (image) {
    contents.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: image.split(',')[1],
      },
    });
  }
  
  const fullPrompt = `City Context: ${location || 'Unknown'}. 
  User Language: ${language}.
  Query: ${prompt}`;

  contents.push({ text: fullPrompt });

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: contents },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
    },
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Get real-time Mandi rates for top 3 crops and current weather for ${city}. Return JSON format.`,
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          weather: {
            type: Type.OBJECT,
            properties: {
              temp: { type: Type.STRING },
              condition: { type: Type.STRING },
              humidity: { type: Type.STRING }
            },
            required: ["temp", "condition", "humidity"]
          },
          mandi: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                crop: { type: Type.STRING },
                price: { type: Type.STRING },
                trend: { type: Type.STRING, description: "up, down, or stable" }
              },
              required: ["crop", "price", "trend"]
            }
          }
        },
        required: ["weather", "mandi"]
      }
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
    const data = JSON.parse(response.text || "{}");
    return { ...data, sources };
  } catch (e) {
    return null;
  }
};
