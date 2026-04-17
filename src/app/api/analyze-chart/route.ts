import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    const prompt = `
You are a specialized data visualization expert and data extractor.
Your task is to analyze the provided image of a chart and extract its underlying data points accurately.
A key focus is on correcting deceptive charts (especially those that do not start their y-axis at 0).

Please return the extracted data strictly as a JSON object with the following schema:
{
  "chartType": "bar" | "line" | "other",
  "title": "string",
  "xLabel": "string",
  "yLabel": "string",
  "dataPoints": [
    { "label": "string", "value": "number" }
  ],
  "confidence": "number (0 to 1, representing your confidence in the extraction accuracy)"
}

Ensure the output is ONLY valid JSON. No markdown formatting or explanation.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            mimeType,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('Empty response from Gemini');
    }

    return NextResponse.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error('Error analyzing chart:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze chart' }, { status: 500 });
  }
}
