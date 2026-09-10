"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Plane, Line, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Activity, AlertTriangle, ShieldAlert, Cpu, Zap, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Simulation Constants ---
const HIGHWAY_Z = 0;
const JUNCTIONS = [-20, 0, 20]; // X positions of the 3 cross roads
const ROAD_WIDTH = 4;
const CAR_SPEED = 0.15;
const AMBULANCE_SPEED = 0.35;
const SPAWN_RATE = 0.03;

// --- Vehicle Component ---
const Vehicle = ({ id, position, color, isAmbulance = false, direction, activeEmergency, positionsRef }: any) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const [active, setActive] = useState(true);

  useFrame((state) => {
    if (!active || !meshRef.current) return;
    
    let speed = isAmbulance ? AMBULANCE_SPEED : CAR_SPEED;
    
    // Traffic logic
    const x = meshRef.current.position.x;
    const z = meshRef.current.position.z;
    
    // Stop cross traffic (moving on Z axis) if emergency is active
    if (!isAmbulance && (direction === 'N' || direction === 'S')) {
      // Approaching highway (Z=0)
      const distToHighway = Math.abs(z);
      if (activeEmergency && distToHighway < 8 && distToHighway > 3) {
        speed = 0; // BRAKE!
      }
    }

    if (direction === 'E') meshRef.current.position.x += speed;
    if (direction === 'W') meshRef.current.position.x -= speed;
    if (direction === 'N') meshRef.current.position.z -= speed;
    if (direction === 'S') meshRef.current.position.z += speed;

    if (isAmbulance && flashRef.current) {
      flashRef.current.color.setHex(state.clock.elapsedTime % 0.4 < 0.2 ? 0xff0000 : 0x0000ff);
    }

    // Update global positions ref for heatmap
    if (positionsRef && positionsRef.current) {
      positionsRef.current[id] = { x: meshRef.current.position.x, z: meshRef.current.position.z };
    }

    // Despawn
    if (Math.abs(meshRef.current.position.x) > 40 || Math.abs(meshRef.current.position.z) > 40) {
      setActive(false);
      if (positionsRef && positionsRef.current) delete positionsRef.current[id];
    }
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={direction === 'E' || direction === 'W' ? [1.5, 0.8, 0.8] : [0.8, 0.8, 1.5]} />
      <meshStandardMaterial color={isAmbulance ? '#ffffff' : color} emissive={isAmbulance ? '#ffffff' : '#000000'} emissiveIntensity={isAmbulance ? 0.5 : 0} />
      {isAmbulance && <pointLight ref={flashRef} position={[0, 1, 0]} intensity={5} distance={15} color="#ff0000" />}
    </mesh>
  );
};

// --- Heatmap Overlay Component ---
const HeatmapOverlay = ({ vehiclePositionsRef }: any) => {
  const meshRefs = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    if (!vehiclePositionsRef.current) return;
    const positions = Object.values(vehiclePositionsRef.current) as {x: number, z: number}[];
    
    JUNCTIONS.forEach((jx, idx) => {
      let count = 0;
      positions.forEach(p => {
        const dx = p.x - jx;
        const dz = p.z;
        if (Math.sqrt(dx*dx + dz*dz) < 12) count++;
      });
      
      // Determine heatmap color based on congestion
      let targetColor = new THREE.Color('#00ff66'); // Green: smooth
      if (count > 4) targetColor = new THREE.Color('#ff0000'); // Red: heavy
      else if (count >= 2) targetColor = new THREE.Color('#ffaa00'); // Yellow: medium
      
      const mesh = meshRefs.current[idx];
      if (mesh && mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.lerp(targetColor, 0.05);
        // Pulse effect
        mat.opacity = 0.2 + Math.sin(state.clock.elapsedTime * 3 + idx) * 0.05;
      }
    });
  });

  return (
    <group position={[0, 0.05, 0]}>
      {JUNCTIONS.map((x, i) => (
        <Plane 
          key={i} 
          ref={(el) => { if(el) meshRefs.current[i] = el as THREE.Mesh; }}
          args={[20, 20]} 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[x, 0, 0]}
        >
          {/* Circle radial gradient effect using a texture would be better, but basic material with Additive works for neon glow */}
          <meshBasicMaterial transparent opacity={0.2} color="#00ff66" blending={THREE.AdditiveBlending} depthWrite={false} />
        </Plane>
      ))}
    </group>
  );
};

// --- Smart City Scene ---
const SmartCityGrid = ({ activeEmergency, vehicles, setVehicles }: any) => {
  const positionsRef = useRef<{ [key: string]: { x: number, z: number } }>({});
  
  useFrame(() => {
    if (Math.random() < SPAWN_RATE) {
      const dirs = ['E', 'W', 'N', 'S'];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      
      let pos: [number, number, number] = [0, 0.4, 0];
      let color = new THREE.Color().setHSL(Math.random(), 0.8, 0.4);
      
      if (dir === 'E') pos = [-35, 0.4, 1];
      if (dir === 'W') pos = [35, 0.4, -1];
      
      if (dir === 'N' || dir === 'S') {
        const juncX = JUNCTIONS[Math.floor(Math.random() * JUNCTIONS.length)];
        if (dir === 'N') pos = [juncX + 1, 0.4, 35];
        if (dir === 'S') pos = [juncX - 1, 0.4, -35];
      }

      setVehicles((prev: any) => [...prev, { id: Math.random(), pos, color, dir, isAmb: false }]);
    }
  });

  return (
    <group>
      {/* Ground */}
      <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#050a14" />
      </Plane>

      {/* Grid Lines */}
      <gridHelper args={[100, 100, '#0a192f', '#0a192f']} position={[0, 0.01, 0]} />

      {/* Main Highway (East-West) */}
      <Plane args={[100, ROAD_WIDTH]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color="#111827" />
      </Plane>
      {/* Highway Glow during Emergency */}
      {activeEmergency && (
        <Plane args={[100, ROAD_WIDTH]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <meshBasicMaterial color="#00ff66" transparent opacity={0.15} />
        </Plane>
      )}

      {/* 3 Cross Junctions (North-South) */}
      {JUNCTIONS.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <Plane args={[ROAD_WIDTH, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
            <meshStandardMaterial color="#111827" />
          </Plane>
          
          {/* Traffic Lights at Corners */}
          <Sphere position={[-2.5, 2, -2.5]} args={[0.3, 16, 16]}>
            <meshBasicMaterial color={activeEmergency ? "#ff0000" : "#00ff66"} />
          </Sphere>
          <Sphere position={[2.5, 2, 2.5]} args={[0.3, 16, 16]}>
            <meshBasicMaterial color={activeEmergency ? "#ff0000" : "#00ff66"} />
          </Sphere>
        </group>
      ))}

      {/* Heatmap Layer */}
      <HeatmapOverlay vehiclePositionsRef={positionsRef} />

      {/* Render Vehicles */}
      {vehicles.map((v: any) => (
        <Vehicle key={v.id} id={v.id} positionsRef={positionsRef} position={v.pos} color={v.color} direction={v.dir} isAmbulance={v.isAmb} activeEmergency={activeEmergency} />
      ))}
    </group>
  );
};

// --- Compact Emergency Status (Reads from localStorage) ---
const CompactEmergencyStatus = () => {
  const [vitals, setVitals] = useState<any>({ state: 'Monitoring', bpm: '--', eta: '--' });

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const v = JSON.parse(localStorage.getItem('medical_vitals') || 'null');
        if (v) setVitals(v);
      } catch(e){}
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isCrit = vitals.state === 'Critical';

  return (
    <div className={`backdrop-blur-md border p-4 rounded-xl flex flex-col items-center min-w-[150px] ${isCrit ? 'bg-red-900/40 border-red-500/50 animate-pulse' : 'bg-slate-900/80 border-slate-700/50'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Activity size={16} className={isCrit ? 'text-red-400' : 'text-emerald-400'} />
        <span className="text-xs font-bold tracking-widest text-slate-300">AMB-007</span>
      </div>
      <div className={`text-lg font-black ${isCrit ? 'text-red-400' : 'text-emerald-400'}`}>{vitals.state.toUpperCase()}</div>
      <div className="text-[10px] text-slate-400 tracking-wider mt-1">{vitals.bpm} BPM | ETA: {vitals.eta}</div>
    </div>
  );
};


export default function SmartJunctionDashboard({ isBackground = false }: { isBackground?: boolean }) {
  const [emergency, setEmergency] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>(['[SYSTEM] Smart Grid initialized.']);
  const [isWidget, setIsWidget] = useState(isBackground);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('widget') === 'true') {
        setIsWidget(true);
      }
    }
  }, []);

  const triggerCorridor = () => {
    setEmergency(true);
    setLogs(prev => ['[AI-CORE] EMERGENCY DETECTED. Locking down all junctions.', ...prev]);
    
    // Spawn Ambulance
    setTimeout(() => {
      setVehicles(prev => [...prev, { id: 'amb-' + Date.now(), pos: [-35, 0.4, 1], color: '#fff', dir: 'E', isAmb: true }]);
      setLogs(prev => ['[AI-CORE] Ambulance AMB-7 entered highway.', ...prev]);
    }, 1000);

    // Auto turn off
    setTimeout(() => {
      setEmergency(false);
      setLogs(prev => ['[AI-CORE] Ambulance cleared grid. Restoring normal traffic.', ...prev]);
    }, 12000);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'TRIGGER_CORRIDOR') {
        setEmergency((prev) => {
          if (!prev) setTimeout(triggerCorridor, 0);
          return true;
        });
      }
    };
    
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'GLOBAL_TRIGGER_CORRIDOR' && event.newValue) {
        setEmergency((prev) => {
          if (!prev) setTimeout(triggerCorridor, 0);
          return true;
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return (
    <div className={`w-screen h-screen ${isWidget ? 'bg-transparent' : 'bg-[#020617]'} text-slate-200 overflow-hidden relative font-sans`}>
      
      {/* 3D CANVAS */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 25, 25], fov: 45 }}>
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
          <SmartCityGrid activeEmergency={emergency} vehicles={vehicles} setVehicles={setVehicles} />
          <OrbitControls enableZoom={true} maxPolarAngle={Math.PI / 2.2} />
        </Canvas>
      </div>

      {/* DASHBOARD UI OVERLAY */}
      {!isWidget && (
        <div className="absolute inset-0 z-10 pointer-events-none p-6 flex flex-col justify-between">
        
        {/* TOP BAR */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 rounded-2xl shadow-2xl flex items-center gap-4">
            <a href="/driver" className="mr-2 p-2 hover:bg-slate-800 rounded-lg transition-colors" title="Back to Driver Dashboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-white"><path d="m15 18-6-6 6-6"/></svg>
            </a>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${emergency ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-emerald-500/20 text-emerald-500'}`}>
              <ShieldAlert size={28} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-wider bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                SMART JUNCTION CONTROL
              </h1>
              <div className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${emergency ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                {emergency ? 'EMERGENCY OVERRIDE ACTIVE' : 'AI MONITORING ACTIVE'}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {/* NEW COMPACT EMERGENCY STATUS FROM LOCALSTORAGE */}
            <CompactEmergencyStatus />
            
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl flex flex-col items-center min-w-[120px]">
              <Cpu size={20} className="text-cyan-400 mb-2" />
              <div className="text-2xl font-bold">{vehicles.length}</div>
              <div className="text-[10px] text-slate-400 tracking-wider">ACTIVE ENTITIES</div>
            </div>
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl flex flex-col items-center min-w-[120px]">
              <Activity size={20} className="text-emerald-400 mb-2" />
              <div className="text-2xl font-bold">98%</div>
              <div className="text-[10px] text-slate-400 tracking-wider">FLOW EFFICIENCY</div>
            </div>
          </div>
        </header>

        {/* BOTTOM SECTION */}
        <div className="flex justify-between items-end pointer-events-auto">
          
          {/* AI LOGS */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 rounded-2xl w-96 h-64 flex flex-col">
            <div className="text-xs font-bold tracking-widest text-cyan-400 mb-4 flex items-center gap-2">
              <Zap size={14} /> AI DECISION LOG
            </div>
            <div className="flex-1 overflow-hidden flex flex-col gap-2">
              <AnimatePresence>
                {logs.slice(0, 6).map((log, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: i === 0 ? 1 : 0.5, x: 0 }}
                    key={log + i} 
                    className={`text-xs font-mono p-2 rounded-md ${log.includes('EMERGENCY') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-800/50 text-slate-300'}`}
                  >
                    {log}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <button 
            onClick={triggerCorridor}
            disabled={emergency}
            className={`px-12 py-6 rounded-2xl font-black tracking-widest text-lg transition-all duration-300 flex items-center gap-4 ${
              emergency 
              ? 'bg-red-500 text-white shadow-[0_0_50px_rgba(239,68,68,0.5)] scale-105'
              : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)]'
            }`}
          >
            <Radio size={24} className={emergency ? 'animate-ping' : ''} />
            {emergency ? 'CORRIDOR SECURED' : 'INITIATE GREEN CORRIDOR'}
          </button>

          {/* JUNCTION STATUS */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 rounded-2xl w-80">
            <div className="text-xs font-bold tracking-widest text-emerald-400 mb-4">JUNCTION LOCKDOWN STATUS</div>
            
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                  <div className="text-sm font-medium">Junction 0{j}</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${emergency ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`}></div>
                    <span className={`text-xs font-bold ${emergency ? 'text-red-400' : 'text-emerald-400'}`}>
                      {emergency ? 'CROSS-TRAFFIC HALTED' : 'NORMAL FLOW'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* SCREEN FLASH OVERLAY */}
        {emergency && (
          <div className="fixed inset-0 pointer-events-none bg-red-500/10 animate-pulse mix-blend-screen z-[-1]"></div>
        )}
        </div>
      )}
    </div>
  );
}
