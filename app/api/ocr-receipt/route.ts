import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini SDK. 
// You will need to add GEMINI_API_KEY to your Vercel Environment Variables.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // The frontend sends a Data URL (e.g., "data:image/jpeg;base64,/9j/4AA...").
    // Gemini needs the raw base64 string and the mimeType separated.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeTypeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    // We use gemini-1.5-flash because it is built for fast, multimodal tasks
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json", // Forces Gemini to return strict JSON
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

    // Package the image for Gemini
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };

    // Fire the request to Gemini
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    if (!responseText) throw new Error("Gemini returned an empty response.");

    const structuredData = JSON.parse(responseText);
    
    return NextResponse.json({ success: true, data: structuredData });

  } catch (error: any) {
    console.error("Gemini OCR Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}