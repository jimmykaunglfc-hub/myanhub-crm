import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing from your environment variables.");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeTypeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    // 🚀 THE FIX: We are now using the exact, specialized model your API key is locked to!
    const model = genAI.getGenerativeModel({ model: "gemini-robotics-er-1.5-preview" });

    const prompt = `You are an expert ERP accounting AI. Extract the data from the provided receipt image. 
    Return ONLY a JSON object with this exact structure:
    {
      "storeName": "string",
      "receiptNo": "string",
      "date": "string",
      "currency": "string",
      "tax": number,
      "subtotal": number,
      "total": number,
      "items": [
        { "name": "string", "quantity": number, "unitPrice": number }
      ]
    }
    If a value is not found, use null or 0. Translate foreign languages to English if necessary. Do not include markdown formatting, just the raw JSON.`;

    const imagePart = {
      inlineData: { data: base64Data, mimeType: mimeType }
    };

    try {
      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();
      
      if (!responseText) throw new Error("Gemini returned an empty response.");

      const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const structuredData = JSON.parse(cleanedText);
      
      return NextResponse.json({ success: true, data: structuredData });

    } catch (apiError: any) {
      // Diagnostic tool fallback just in case
      if (apiError.message && apiError.message.includes('404')) {
        const checkResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const checkData = await checkResponse.json();
        
        const availableModels = checkData.models
          ?.map((m: any) => m.name.replace('models/', ''))
          .filter((m: string) => m.includes('gemini') && m.includes('1.5')) || [];

        throw new Error(`Google API Key mismatch. Your specific key only has access to these models: [ ${availableModels.join(', ')} ].`);
      }
      throw apiError;
    }

  } catch (error: any) {
    console.error("Gemini OCR Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}