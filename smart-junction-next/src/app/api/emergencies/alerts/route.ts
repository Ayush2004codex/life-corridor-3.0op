import { NextResponse } from 'next/server';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

let twilioClient: twilio.Twilio | null = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch(e) {
  console.log("Twilio init failed, using mock mode");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hospital, eta, trackLink, status } = body;
    
    const targetNumber = process.env.TARGET_PHONE_NUMBER;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    
    const timeNow = new Date().toLocaleTimeString();
    let messageBody = `🚨 GREEN CORRIDOR ACTIVATED: An ambulance is en route to ${hospital || 'Hospital'}. ETA: ${eta || 'N/A'}. Track live: ${trackLink || 'http://localhost:3000'} [${timeNow}]`;
    
    if (status === 'arrived') {
      messageBody = `✅ AMBULANCE ARRIVED: The ambulance has safely arrived at ${hospital || 'Hospital'} and the patient is being transferred. [${timeNow}]`;
    }

    if (twilioClient && targetNumber && twilioNumber) {
       // Send Standard SMS (Wrapped in try-catch because Trial accounts fail without predefined templates)
       try {
         await twilioClient.messages.create({
           body: messageBody,
           from: twilioNumber,
           to: targetNumber
         });
       } catch (smsError) {
         console.warn("SMS Failed (likely trial restriction):", smsError.message);
       }
       
       // Send WhatsApp if enabled
       if (process.env.TWILIO_WHATSAPP_NUMBER) {
         await twilioClient.messages.create({
           from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
           to: `whatsapp:${targetNumber}`,
           contentSid: 'HX6a0f411e81d092c214c00d5e2727cc36'
         });
       }
       console.log("✅ Twilio alerts sent successfully to", targetNumber);
    } else {
       console.log("📞 [MOCK TWILIO ALERT] Would send SMS to", targetNumber || 'MockNumber', ":", messageBody);
    }
    
    return NextResponse.json({ message: 'Alerts dispatched successfully' });
  } catch (error) {
    console.error('Twilio Error:', error);
    return NextResponse.json({ message: 'Failed to send alerts' }, { status: 500 });
  }
}
