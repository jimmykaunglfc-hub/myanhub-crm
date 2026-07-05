import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Prevent Vercel from timing out on larger image uploads
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

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json", 
      }
    });

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
    If a value is not found, use null or 0. Translate foreign languages to English if necessary, but keep original item names if they are specific products.`;

    const imagePart = {
      inlineData: { data: base64Data, mimeType: mimeType }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    if (!responseText) throw new Error("Gemini returned an empty response.");

    // SAFETY CATCH: Remove markdown backticks if Gemini accidentally includes them
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const structuredData = JSON.parse(cleanedText);
    
    return NextResponse.json({ success: true, data: structuredData });

  } catch (error: any) {
    console.error("Gemini OCR Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}