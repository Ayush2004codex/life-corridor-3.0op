import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_TRIAGE || 'dummy_key' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symptoms, vitals } = body;
    
    if (!symptoms && !vitals) {
      return NextResponse.json({ message: 'Symptoms or vitals required' }, { status: 400 });
    }

    const prompt = `You are an expert AI emergency medical dispatcher. 
Patient Symptoms: "${symptoms || 'None reported'}"
Patient Vitals: "${vitals || 'None reported'}"
Determine the emergency 'severity' (must be exactly one of: 'Code Green', 'Code Yellow', 'Code Red', 'Code Blue').
Determine the hospital preparation required (e.g., 'Cath Lab', 'Trauma Team', 'Stroke Protocol').
Provide a list of 'requiredEquipment' (max 3 items). 
Return ONLY a valid JSON object in this exact format: {"severity": "Code Red", "hospitalPrep": "Cath Lab", "requiredEquipment": ["Defibrillator", "Oxygen"]}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-20b',
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const aiResponse = JSON.parse(completion.choices[0]?.message?.content || '{}');
    
    return NextResponse.json({
      message: 'AI Triage completed',
      data: aiResponse,
    });
  } catch (error) {
    console.error('Groq AI Error:', error);
    return NextResponse.json({ message: 'AI Triage failed' }, { status: 500 });
  }
}
