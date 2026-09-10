import express from 'express';
import Route from '../models/Route.js';
import { authMiddleware } from '../middleware/auth.js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key' });

// Calculate route with AI Predictive Routing
router.post('/calculate', authMiddleware, async (req, res) => {
  try {
    const { emergency, ambulance, startLocation, endLocation } = req.body;

    const prompt = `You are an AI Traffic Optimizer for emergency vehicles.
Start: ${startLocation?.address || 'Current Location'}
End: ${endLocation?.address || 'Hospital'}
Evaluate 3 potential routes based on simulated current real-world traffic data in Kolkata.
Identify a bottleneck on one route, and select the optimal route.
Return ONLY a valid JSON object with: 
- optimalRouteName (String)
- durationMinutes (Number)
- trafficLevel (String: 'low', 'medium', 'high')
- aiReasoning (String, e.g., "Avoided Central Ave due to unexpected heavy congestion")`;

    let aiRouting = {
      optimalRouteName: "Fastest Direct Route",
      durationMinutes: 15,
      trafficLevel: "medium",
      aiReasoning: "AI routing currently unavailable, using default path."
    };

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-20b',
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      aiRouting = JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch (e) {
      console.error('AI Routing failed, using fallback:', e.message);
    }

    const route = new Route({
      emergency,
      ambulance,
      startLocation,
      endLocation,
      distance: Math.random() * 20, // Keep distance random or derived
      duration: aiRouting.durationMinutes || 15,
      eta: new Date(Date.now() + (aiRouting.durationMinutes || 15) * 60000),
      trafficLevel: aiRouting.trafficLevel || 'medium',
      aiReasoning: aiRouting.aiReasoning,
      optimalRouteName: aiRouting.optimalRouteName
    });

    await route.save();

    res.status(201).json({
      message: 'Route calculated successfully via AI',
      data: route,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Dynamic mid-journey recalculation (Predictive Traffic Routing AI)
router.post('/recalculate', authMiddleware, async (req, res) => {
  try {
    const { currentLocation, endLocation, currentRouteId } = req.body;

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
    } catch (e) {
      console.error('AI Recalculation failed, using fallback:', e.message);
    }

    // If we have a current route, we update it, otherwise just return the new data
    if (currentRouteId) {
      await Route.findByIdAndUpdate(currentRouteId, {
        optimalRouteName: aiRouting.optimalRouteName,
        duration: aiRouting.durationMinutes,
        trafficLevel: aiRouting.trafficLevel,
        aiReasoning: aiRouting.aiReasoning,
        eta: new Date(Date.now() + (aiRouting.durationMinutes || 10) * 60000),
      });
    }

    res.status(200).json({
      message: 'Route recalculated successfully via AI',
      data: aiRouting,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get route by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('emergency', 'requestNumber status')
      .populate('ambulance', 'registrationNumber');

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    res.json({
      message: 'Route retrieved successfully',
      data: route,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update route
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { waypoints, trafficLevel, eta } = req.body;

    const route = await Route.findByIdAndUpdate(
      req.params.id,
      {
        waypoints,
        trafficLevel,
        eta,
      },
      { new: true }
    );

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    res.json({
      message: 'Route updated successfully',
      data: route,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
