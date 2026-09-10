import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testGroqFeatures() {
  console.log('--- Testing Groq AI Features Directly ---\n');

  // Test 1: Triage
  console.log('1. AI Triage Test');
  try {
    const prompt = `You are an expert AI emergency medical dispatcher. 
Based on these patient symptoms: "Patient is clutching chest, sweating heavily, and reports left arm numbness."
Determine the emergency 'severity' (must be exactly one of: 'low', 'medium', 'high', 'critical')
and a list of 'requiredEquipment' (max 3 items). 
Return ONLY a valid JSON object in this exact format: {"severity": "critical", "requiredEquipment": ["Defibrillator", "Oxygen"]}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-20b',
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    console.log('✅ Triage Result:');
    console.log(completion.choices[0]?.message?.content, '\n');
  } catch (err) {
    console.error('❌ Triage failed:', err.message);
  }

  // Test 2: Calculate Route
  console.log('2. AI Predictive Routing Test');
  try {
    const prompt = `You are an AI Traffic Optimizer for emergency vehicles.
Start: Salt Lake Sector 5, Kolkata
End: Apollo Hospital, Bypass, Kolkata
Evaluate 3 potential routes based on simulated current real-world traffic data in Kolkata.
Identify a bottleneck on one route, and select the optimal route.
Return ONLY a valid JSON object with: 
- optimalRouteName (String)
- durationMinutes (Number)
- trafficLevel (String: 'low', 'medium', 'high')
- aiReasoning (String, e.g., "Avoided Central Ave due to unexpected heavy congestion")`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-20b',
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    console.log('✅ Routing Result:');
    console.log(completion.choices[0]?.message?.content, '\n');
  } catch (err) {
    console.error('❌ Route failed:', err.message);
  }
}

testGroqFeatures();
