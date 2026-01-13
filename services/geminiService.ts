
import { GoogleGenAI, Type } from "@google/genai";
import { SlideElement, ElementType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    backgroundColor: {
      type: Type.STRING,
      description: "Primary hex color of the slide background (e.g., #F9F9F9).",
    },
    elements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Element type: 'text' or 'image'.",
          },
          content: {
            type: Type.STRING,
            description: "OCR text for 'text' type. Description for 'image' type.",
          },
          x: { type: Type.NUMBER, description: "X pos (0-100)" },
          y: { type: Type.NUMBER, description: "Y pos (0-100)" },
          width: { type: Type.NUMBER, description: "Width (0-100)" },
          height: { type: Type.NUMBER, description: "Height (0-100)" },
          fontSize: {
            type: Type.NUMBER,
            description: "Font size in pt. (Body: 9-11pt, Title: 24-28pt, Stats: 32-40pt).",
          },
          fontColor: { type: Type.STRING, description: "Hex color." },
          isBold: { type: Type.BOOLEAN },
          textAlign: { type: Type.STRING, description: "left, center, or right." }
        },
        required: ["type", "content", "x", "y", "width", "height"],
      },
    },
  },
  required: ["backgroundColor", "elements"],
};

export const analyzeSlideImage = async (base64Image: string): Promise<{ backgroundColor: string, elements: SlideElement[] }> => {
  try {
    const model = 'gemini-3-flash-preview';
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1],
            },
          },
          {
            text: `You are a Slide Restoration Expert. Your mission is to reconstruct this slide as an editable PPTX while perfectly preserving graphics and erasing text.
            
            STRICT GRAPHIC INTEGRITY RULES:
            1. COHESIVE ASSETS: Do NOT break icons or diagrams into fragments. If you see a funnel with circles around it, or a timeline with multiple nodes, capture the WHOLE group as a SINGLE 'image' element.
            2. NO CROPPED TEXT: Ensure 'image' elements focus on graphics. If text is nearby, it's okay to include a bit of margin; we will use "Koutu" (background removal) to clean it up.
            3. FULL OCR: Detect every text block. We will replace them with editable boxes.
            4. BACKGROUND: Identify the background color accurately.
            5. FONT SIZES: Be conservative. For Chinese text, use smaller pt sizes (e.g., 9pt for body, 24pt for titles) to ensure fit.
            
            Return a JSON with 'backgroundColor' and 'elements'.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 4096 }
      },
    });

    const text = response.text;
    if (!text) return { backgroundColor: '#FFFFFF', elements: [] };
    const jsonStr = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
