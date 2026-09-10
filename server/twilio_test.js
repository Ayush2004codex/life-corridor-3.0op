import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function testTwilio() {
  console.log('--- Testing Twilio SMS ---');
  try {
    const message = await client.messages.create({
      body: 'sms_internal_alerts',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.TARGET_PHONE_NUMBER
    });
    console.log('✅ SMS successfully queued! SID:', message.sid);
  } catch (error) {
    console.error('❌ SMS failed:', error.message);
  }

  console.log('\n--- Testing Twilio WhatsApp ---');
  try {
    const waMessage = await client.messages.create({
      contentSid: 'HX6a0f411e81d092c214c00d5e2727cc36',
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${process.env.TARGET_PHONE_NUMBER}`
    });
    console.log('✅ WhatsApp successfully queued! SID:', waMessage.sid);
  } catch (error) {
    console.error('❌ WhatsApp failed:', error.message);
  }
}

testTwilio();
