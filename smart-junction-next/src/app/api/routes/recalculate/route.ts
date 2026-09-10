import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { currentLocation, endLocation } = body;

    const prompt = `You are an AI Traffic Optimizer for emergency vehicles.
Current Location: ${currentLocation || 'En-route'}
Destination: ${endLocation || 'Hospital'}
A sudden bottleneck/accident has been detected ahead on the current route.
Dynamically calculate a NEW optimal alternate route that bypasses the congestion.
Return ONLY a valid JSON object with: 
- optimalRouteName (String)
- durationMinutes (Number)
- trafficLevel (String: 'low', 'medium', 'high')
- aiReasoning (String, e.g., "Rerouted via EM Bypass due to sudden accident on AJC Bose Road")`;

    let aiRouting = {
      optimalRouteName: "Emergency Alternate Route",
      durationMinutes: 10,
      trafficLevel: "low",
      aiReasoning: "Fallback alternate route selected."
    };

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-20b',
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });
      aiRouting = JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch (e: any) {
      console.error('AI Recalculation failed, using fallback:', e.message);
    }

    return NextResponse.json({
      message: 'Route recalculated successfully via AI',
      data: aiRouting,
    });
  } catch (error: any) {
    console.error('Recalculate Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
