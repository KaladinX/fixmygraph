import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('CRITICAL: GEMINI_API_KEY environment variable is missing.');
    return NextResponse.json(
      { error: 'Server configuration error: Gemini API key is missing. Please check Vercel environment variables.' },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    const prompt = `
You are a deceptive-graph detector and corrector. Analyze the screenshot step-by-step:

1. Chart type: bar/column/line/scatter/etc.?
   - Use "scatter" if the chart is a scatter plot, dot plot, or just isolated points/dots on an axis without connecting lines.
   - Use "line" if there are lines connecting the data points.
   - Use "bar" for bar charts.
   - Use "other" for anything else.
2. Extract exactly: title, y-axis label + units + min/max/tick values, x-axis label + units + min/max/tick values, all data points/labels (estimate positions precisely if needed).
3. Classify variables: Is Y a ratio-scale absolute quantity with natural zero ($ cost, count, etc.)? Is X time/categorical/numeric?
4. Detect deception: Is y-axis truncated (min > 0 and range < ~30-50% of possible scale from zero)? Same for x?
5. Corrected "zeroed" chart plan:
   - Y: If bar or absolute quantity -> set ymin=0 (or tiny negative buffer for padding). Keep nice round max. If neither, use "auto".
   - X: If time/years -> xmin = data minimum (or logical round-down). Else consider zero only if natural. If neither, use "auto".

Be truthful in your analysis: e.g. "Original graph exaggerates the difference visually. Actual savings: $0.085 (8.5¢ or ~8.6%)."

Please return your final extracted data and analysis strictly as a JSON object with the following schema:
{
  "chartType": "bar" | "line" | "scatter" | "other",
  "title": "string",
  "xLabel": "string",
  "yLabel": "string",
  "dataPoints": [
    { "label": "string", "value": "number" }
  ],
  "isXNumeric": boolean (true if X is a continuous numeric scale like $ cost, distance, etc. False if categorical or time/dates),
  "suggestedXMin": number | "auto" (0 if X has a natural zero, else "auto"),
  "suggestedYMin": number | "auto" (0 if Y has a natural zero or is a bar chart, else "auto"),
  "analysis": "string (Your truthful summary of the deception and the real differences)",
  "confidence": number (0 to 1, representing your confidence in the extraction accuracy)
}

Ensure the output is ONLY valid JSON. No markdown formatting or explanation outside of the JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
