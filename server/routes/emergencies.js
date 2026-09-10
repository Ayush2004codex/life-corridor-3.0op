import express from 'express';
import Emergency from '../models/Emergency.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import twilio from 'twilio';
dotenv.config();

let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch(e) {
  console.log("Twilio init failed, using mock mode");
}

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_TRIAGE || 'dummy_key' });

// AI Triage endpoint
router.post('/triage', async (req, res) => {
  try {
    const { symptoms, vitals } = req.body;
    if (!symptoms && !vitals) return res.status(400).json({ message: 'Symptoms or vitals required' });

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
    
    res.json({
      message: 'AI Triage completed',
      data: aiResponse,
    });
  } catch (error) {
    console.error('Groq AI Error:', error);
    res.status(500).json({ message: 'AI Triage failed' });
  }
});

// Emergency Alerts endpoint (Twilio SMS / WhatsApp)
router.post('/alerts', async (req, res) => {
  try {
    const { hospital, eta, trackLink, status } = req.body;
    const targetNumber = process.env.TARGET_PHONE_NUMBER;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    
    const timeNow = new Date().toLocaleTimeString();
    let messageBody = `🚨 GREEN CORRIDOR ACTIVATED: An ambulance is en route to ${hospital || 'Hospital'}. ETA: ${eta || 'N/A'}. Track live: ${trackLink || 'http://localhost:3000'} [${timeNow}]`;
    
    if (status === 'arrived') {
      messageBody = `✅ AMBULANCE ARRIVED: The ambulance has safely arrived at ${hospital || 'Hospital'} and the patient is being transferred. [${timeNow}]`;
    }

    if (twilioClient && targetNumber && twilioNumber) {
       // Send Standard SMS
       await twilioClient.messages.create({
         body: messageBody,
         from: twilioNumber,
         to: targetNumber
       });
       
       // Send WhatsApp if enabled
       if (process.env.TWILIO_WHATSAPP_NUMBER) {
         await twilioClient.messages.create({
           from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
           to: `whatsapp:${targetNumber}`,
           contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
           contentVariables: JSON.stringify({
             "1": status === 'arrived' 
                  ? `ambulance arrived at ${hospital || 'Hospital'}` 
                  : `ambulance to ${hospital || 'Hospital'}`,
             "2": timeNow
           })
         });
       }
       console.log("✅ Twilio alerts sent successfully to", targetNumber);
    } else {
       console.log("📞 [MOCK TWILIO ALERT] Would send SMS to", targetNumber || 'MockNumber', ":", messageBody);
    }
    
    res.json({ message: 'Alerts dispatched successfully' });
  } catch (error) {
    console.error('Twilio Error:', error);
    res.status(500).json({ message: 'Failed to send alerts' });
  }
});

// Create emergency request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, priority, patientName, pickupLocation, destinationHospital } = req.body;

    const emergency = new Emergency({
      type,
      priority,
      patientName,
      pickupLocation,
      destinationHospital,
      requestTime: new Date(),
    });

    await emergency.save();

    res.status(201).json({
      message: 'Emergency request created successfully',
      data: emergency,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all emergencies (filtered by role)
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = {};

    // Drivers see only their own emergencies
    if (req.user.role === 'driver') {
      query.driver = req.user.userId;
    }

    const emergencies = await Emergency.find(query)
      .populate('ambulance', 'registrationNumber')
      .populate('hospital', 'name address')
      .populate('driver', 'name phone')
      .populate('destinationHospital', 'name address')
      .sort({ requestTime: -1 });

    res.json({
      message: 'Emergencies retrieved successfully',
      data: emergencies,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get emergency by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('ambulance')
      .populate('hospital', 'name address location')
      .populate('driver', 'name phone')
      .populate('destinationHospital', 'name address location beds');

    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    res.json({
      message: 'Emergency retrieved successfully',
      data: emergency,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update emergency status
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['requested', 'accepted', 'en-route', 'arrived', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateData = { status };

    // Auto-populate time fields based on status
    if (status === 'accepted') {
      updateData.acceptedTime = new Date();
    } else if (status === 'en-route') {
      updateData.pickupTime = new Date();
    } else if (status === 'arrived') {
      updateData.arrivalTime = new Date();
    } else if (status === 'completed') {
      updateData.completionTime = new Date();
    }

    const emergency = await Emergency.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    res.json({
      message: 'Emergency status updated successfully',
      data: emergency,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Driver accept emergency
router.put('/:id/accept', authMiddleware, roleMiddleware(['driver']), async (req, res) => {
  try {
    const { ambulanceId } = req.body;

    const emergency = await Emergency.findByIdAndUpdate(
      req.params.id,
      {
        status: 'accepted',
        driver: req.user.userId,
        ambulance: ambulanceId,
        acceptedTime: new Date(),
      },
      { new: true }
    );

    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    res.json({
      message: 'Emergency accepted successfully',
      data: emergency,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
