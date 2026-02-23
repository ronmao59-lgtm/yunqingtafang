/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Info, Languages } from 'lucide-react';

// --- Constants ---
const LEVEL_CONFIGS = [
  { target: 350, speedMult: 1.0 },
  { target: 500, speedMult: 1.2 },
  { target: 750, speedMult: 1.4 },
  { target: 1000, speedMult: 1.6 },
  { target: 1250, speedMult: 1.8 },
];
const INITIAL_AMMO = { left: 20, middle: 40, right: 20 };
const EXPLOSION_RADIUS = 40;
const EXPLOSION_DURATION = 60; // frames
const ENEMY_SPEED_BASE = 1.2;
const INTERCEPTOR_SPEED = 7;

type Point = { x: number; y: number };

interface Entity {
  id: number;
  x: number;
  y: number;
}

interface EnemyRocket extends Entity {
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
  startX: number;
  startY: number;
}

interface InterceptorMissile extends Entity {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  progress: number;
}

interface Explosion extends Entity {
  radius: number;
  timer: number;
}

interface City extends Entity {
  active: boolean;
}

interface Battery extends Entity {
  active: boolean;
  ammo: number;
  maxAmmo: number;
}

// --- Translations ---
const translations = {
  zh: {
    title: "云钦新星防御",
    score: "得分",
    ammo: "弹药",
    win: "防守成功！",
    lose: "防线崩溃！",
    restart: "再玩一次",
    start: "开始游戏",
    instructions: "点击屏幕发射拦截导弹。保护城市和炮台！",
    target: "目标分数",
    level: "关卡",
    nextLevel: "进入下一关",
    left: "左",
    middle: "中",
    right: "右",
  },
  en: {
    title: "Yunqin Nova Defense",
    score: "Score",
    ammo: "Ammo",
    win: "Mission Success!",
    lose: "Defense Collapsed!",
    restart: "Play Again",
    start: "Start Game",
    instructions: "Click screen to fire interceptors. Protect cities and batteries!",
    target: "Target Score",
    level: "Level",
    nextLevel: "Next Level",
    left: "L",
    middle: "M",
    right: "R",
  }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'win' | 'lose' | 'level_complete'>('menu');
  const gameStateRef = useRef<'menu' | 'playing' | 'win' | 'lose' | 'level_complete'>('menu');
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [level, setLevel] = useState(0); // 0 to 4
  const levelRef = useRef(0);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [victoryParticles, setVictoryParticles] = useState<{x: number, y: number, color: string}[]>([]);
  const t = translations[lang];

  const currentTarget = LEVEL_CONFIGS[level].target;

  // Sync refs with state for the game loop
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { levelRef.current = level; }, [level]);

  // Game Refs for the loop
  const requestRef = useRef<number>(null);
  const enemiesRef = useRef<EnemyRocket[]>([]);
  const interceptorsRef = useRef<InterceptorMissile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const victoryExplosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const batteriesRef = useRef<Battery[]>([]);
  const lastTimeRef = useRef<number>(0);
  const nextEnemyTimeRef = useRef<number>(0);

  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  // Initialize Game Objects
  const initGame = useCallback((isNewLevel: boolean = false) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // 6 Cities
    const newCities: City[] = [];
    const citySpacing = width / 9;
    for (let i = 0; i < 6; i++) {
      const x = (i < 3 ? citySpacing * (i + 1.5) : citySpacing * (i + 2.5));
      newCities.push({ id: i, x, y: height - 40, active: true });
    }
    citiesRef.current = newCities;
    setCities([...newCities]);

    // 3 Batteries
    const newBatteries: Battery[] = [
      { id: 0, x: citySpacing * 0.8, y: height - 50, active: true, ammo: INITIAL_AMMO.left, maxAmmo: INITIAL_AMMO.left },
      { id: 1, x: width / 2, y: height - 50, active: true, ammo: INITIAL_AMMO.middle, maxAmmo: INITIAL_AMMO.middle },
      { id: 2, x: width - citySpacing * 0.8, y: height - 50, active: true, ammo: INITIAL_AMMO.right, maxAmmo: INITIAL_AMMO.right },
    ];
    batteriesRef.current = newBatteries;
    setBatteries([...newBatteries]);

    enemiesRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    victoryExplosionsRef.current = [];
    if (!isNewLevel) {
      setScore(0);
      scoreRef.current = 0;
      setLevel(0);
      levelRef.current = 0;
    }
    nextEnemyTimeRef.current = 0;
  }, []);

  const spawnEnemy = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Target any active city or battery
    const targets = [...citiesRef.current.filter(c => c.active), ...batteriesRef.current.filter(b => b.active)];
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    const startX = Math.random() * width;
    
    enemiesRef.current.push({
      id: Date.now() + Math.random(),
      startX,
      startY: -20,
      x: startX,
      y: -20,
      targetX: target.x,
      targetY: target.y,
      speed: (ENEMY_SPEED_BASE + (scoreRef.current / 500)) * LEVEL_CONFIGS[levelRef.current].speedMult,
      progress: 0,
    });
  }, []);

  const fireInterceptor = (targetX: number, targetY: number) => {
    if (gameState !== 'playing') return;

    // Find closest active battery with ammo
    const availableBatteries = batteriesRef.current
      .filter(b => b.active && b.ammo > 0)
      .sort((a, b) => {
        const distA = Math.hypot(a.x - targetX, a.y - targetY);
        const distB = Math.hypot(b.x - targetX, b.y - targetY);
        return distA - distB;
      });

    if (availableBatteries.length > 0) {
      const battery = availableBatteries[0];
      battery.ammo -= 1;
      setBatteries([...batteriesRef.current]);
      
      interceptorsRef.current.push({
        id: Date.now() + Math.random(),
        startX: battery.x,
        startY: battery.y,
        x: battery.x,
        y: battery.y,
        targetX,
        targetY,
        progress: 0,
      });
    }
  };

  const update = (time: number) => {
    if (gameStateRef.current !== 'playing') {
      // Still need to draw if we are in win/lose/level_complete states to show effects
      if (gameStateRef.current !== 'menu') {
        draw();
        requestRef.current = requestAnimationFrame(update);
      }
      return;
    }
    
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Spawn enemies
    if (time > nextEnemyTimeRef.current) {
      spawnEnemy();
      nextEnemyTimeRef.current = time + Math.max(500, 2000 - (score * 1.5));
    }

    // Update Enemies
    let stateChanged = false;
    enemiesRef.current.forEach((enemy, index) => {
      const dist = Math.hypot(enemy.targetX - enemy.startX, enemy.targetY - enemy.startY);
      enemy.progress += (enemy.speed / dist) * (deltaTime / 16);
      
      enemy.x = enemy.startX + (enemy.targetX - enemy.startX) * enemy.progress;
      enemy.y = enemy.startY + (enemy.targetY - enemy.startY) * enemy.progress;

      // Check if hit target
      if (enemy.progress >= 1) {
        // Impact!
        explosionsRef.current.push({ id: Date.now(), x: enemy.x, y: enemy.y, radius: 30, timer: 0 });
        
        // Damage city or battery
        citiesRef.current.forEach(c => {
          if (c.active && Math.hypot(c.x - enemy.x, c.y - enemy.y) < 30) {
            c.active = false;
            stateChanged = true;
          }
        });
        batteriesRef.current.forEach(b => {
          if (b.active && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 30) {
            b.active = false;
            stateChanged = true;
          }
        });

        enemiesRef.current.splice(index, 1);
      }
    });

    if (stateChanged) {
      setCities([...citiesRef.current]);
      setBatteries([...batteriesRef.current]);
    }

    // Update Interceptors
    interceptorsRef.current.forEach((missile, index) => {
      const dist = Math.hypot(missile.targetX - missile.startX, missile.targetY - missile.startY);
      missile.progress += (INTERCEPTOR_SPEED / dist) * (deltaTime / 16);
      
      missile.x = missile.startX + (missile.targetX - missile.startX) * missile.progress;
      missile.y = missile.startY + (missile.targetY - missile.startY) * missile.progress;

      if (missile.progress >= 1) {
        explosionsRef.current.push({ id: Date.now(), x: missile.targetX, y: missile.targetY, radius: EXPLOSION_RADIUS, timer: 0 });
        interceptorsRef.current.splice(index, 1);
      }
    });

    // Update Explosions & Collision
    explosionsRef.current.forEach((exp, index) => {
      exp.timer += 1;
      const currentRadius = exp.timer < EXPLOSION_DURATION / 2 
        ? (exp.timer / (EXPLOSION_DURATION / 2)) * exp.radius 
        : (1 - (exp.timer - EXPLOSION_DURATION / 2) / (EXPLOSION_DURATION / 2)) * exp.radius;

      // Check collision with enemies
      enemiesRef.current.forEach((enemy, eIdx) => {
        if (Math.hypot(enemy.x - exp.x, enemy.y - exp.y) < currentRadius) {
          enemiesRef.current.splice(eIdx, 1);
          const newScore = scoreRef.current + 20;
          scoreRef.current = newScore;
          setScore(newScore);
        }
      });

      if (exp.timer >= EXPLOSION_DURATION) {
        explosionsRef.current.splice(index, 1);
      }
    });

    // Update Victory Explosions
    if (gameState === 'win') {
      if (Math.random() < 0.1) {
        victoryExplosionsRef.current.push({
          id: Date.now() + Math.random(),
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          radius: 50 + Math.random() * 50,
          timer: 0
        });
      }
    }

    victoryExplosionsRef.current.forEach((exp, index) => {
      exp.timer += 1;
      if (exp.timer >= EXPLOSION_DURATION) {
        victoryExplosionsRef.current.splice(index, 1);
      }
    });

    // Win/Lose Conditions
    const allAmmoExhausted = batteriesRef.current.every(b => b.ammo === 0 || !b.active);
    const noActiveDefense = interceptorsRef.current.length === 0 && explosionsRef.current.length === 0;

    const currentTargetScore = LEVEL_CONFIGS[levelRef.current].target;

    if (scoreRef.current >= currentTargetScore) {
      if (levelRef.current < LEVEL_CONFIGS.length - 1) {
        setGameState('level_complete');
      } else {
        setGameState('win');
        // Create some initial victory particles
        const particles = [];
        for(let i=0; i<50; i++) {
          particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`
          });
        }
        setVictoryParticles(particles);
      }
    } else if (batteriesRef.current.every(b => !b.active) || (allAmmoExhausted && noActiveDefense)) {
      setGameState('lose');
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // --- Draw Background (Image 1 Style) ---
    // Deep space gradient
    const bgGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
    bgGradient.addColorStop(0, '#0a0e1a');
    bgGradient.addColorStop(0.5, '#050510');
    bgGradient.addColorStop(1, '#000000');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle nebula/glow
    ctx.globalAlpha = 0.2;
    const nebula = ctx.createRadialGradient(width * 0.7, height * 0.3, 0, width * 0.7, height * 0.3, width * 0.5);
    nebula.addColorStop(0, '#1e3a8a');
    nebula.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1.0;

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
      const x = (Math.sin(i * 1234.5) * 0.5 + 0.5) * width;
      const y = (Math.cos(i * 5432.1) * 0.5 + 0.5) * height;
      const size = Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Ground (Space Station Surface)
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, height - 30, width, 30);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.strokeRect(i, height - 30, 40, 30);
    }

    // Draw Cities (Image 3 Style: Capsule Pod)
    citiesRef.current.forEach(city => {
      if (city.active) {
        ctx.save();
        ctx.translate(city.x, city.y);
        
        // Struts/Legs
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(-12, 0, 4, 10);
        ctx.fillRect(8, 0, 4, 10);

        // Capsule Body
        ctx.beginPath();
        ctx.roundRect(-20, -25, 40, 25, 12);
        ctx.fillStyle = '#0ea5e9';
        ctx.globalAlpha = 0.4;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Interior Glow (Yellow)
        const interiorGrad = ctx.createRadialGradient(0, -12, 0, 0, -12, 15);
        interiorGrad.addColorStop(0, 'rgba(253, 224, 71, 0.6)');
        interiorGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = interiorGrad;
        ctx.fillRect(-15, -20, 30, 15);

        // Glowing Ring on top
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -25, 10, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#38bdf8';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Top Antenna
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-2, -32, 4, 7);

        ctx.restore();
      } else {
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(city.x - 15, city.y - 5, 30, 10);
      }
    });

    // Draw Batteries
    batteriesRef.current.forEach((battery, idx) => {
      if (battery.active) {
        ctx.save();
        ctx.translate(battery.x, battery.y);

        if (idx === 1) { // Middle Battery (Image 1 Style: Heavy Cannon)
          // Heavy Base
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.roundRect(-30, -10, 60, 20, 4);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Turret Body
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.roundRect(-20, -35, 40, 25, 4);
          ctx.fill();
          
          // Neon Accents
          ctx.strokeStyle = '#818cf8';
          ctx.strokeRect(-15, -30, 10, 15);

          // Large Barrel
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-8, -55, 16, 25);
          
          // Neon Rings on Barrel
          ctx.strokeStyle = '#a78bfa';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-8, -45); ctx.lineTo(8, -45);
          ctx.moveTo(-8, -50); ctx.lineTo(8, -50);
          ctx.stroke();

        } else { // Side Batteries (Image 2 Style: Dome Turret)
          // Dome Base
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(0, 0, 25, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Sleek Barrel
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-4, -40, 8, 25);
          
          // Blue Glow Accent
          ctx.fillStyle = '#0ea5e9';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#0ea5e9';
          ctx.beginPath();
          ctx.arc(0, -15, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.restore();

        // Ammo indicator
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(battery.ammo.toString(), battery.x, battery.y + 15);
      } else {
        ctx.fillStyle = '#450a0a';
        ctx.beginPath();
        ctx.arc(battery.x, battery.y, 15, Math.PI, 0);
        ctx.fill();
      }
    });

    // Draw Enemy Rockets (Image 3 Style)
    enemiesRef.current.forEach(enemy => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const angle = Math.atan2(enemy.targetY - enemy.startY, enemy.targetX - enemy.startX);
      ctx.rotate(angle + Math.PI / 2);

      // Purple Tail Flame
      const flameGrad = ctx.createLinearGradient(0, 0, 0, 15);
      flameGrad.addColorStop(0, '#a855f7');
      flameGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-5, 5);
      ctx.lineTo(0, 20);
      ctx.lineTo(5, 5);
      ctx.fill();

      // Silver Oval Body
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(0, -5, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Cyan Glowing Stripe
      ctx.fillStyle = '#22d3ee';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#22d3ee';
      ctx.fillRect(-1, -12, 2, 14);
      ctx.shadowBlur = 0;

      ctx.restore();
    });

    // Draw Interceptors (Image 2 Style)
    interceptorsRef.current.forEach(missile => {
      ctx.save();
      ctx.translate(missile.x, missile.y);
      const angle = Math.atan2(missile.targetY - missile.startY, missile.targetX - missile.startX);
      ctx.rotate(angle + Math.PI / 2);

      // Silver Cone Body
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(6, 8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();

      // Red Stripes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-4, -2, 8, 2);
      ctx.fillRect(-5, 3, 10, 2);

      // Blue Neon Outline
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#38bdf8';
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();

      // Target X
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(missile.targetX - 5, missile.targetY - 5);
      ctx.lineTo(missile.targetX + 5, missile.targetY + 5);
      ctx.moveTo(missile.targetX + 5, missile.targetY - 5);
      ctx.lineTo(missile.targetX - 5, missile.targetY + 5);
      ctx.stroke();
    });

    // Draw Explosions (Image 4 Style)
    const drawExplosion = (exp: Explosion, isVictory: boolean = false) => {
      const currentRadius = exp.timer < EXPLOSION_DURATION / 2 
        ? (exp.timer / (EXPLOSION_DURATION / 2)) * exp.radius 
        : (1 - (exp.timer - EXPLOSION_DURATION / 2) / (EXPLOSION_DURATION / 2)) * exp.radius;
      
      ctx.save();
      ctx.translate(exp.x, exp.y);

      // Outer Ring
      ctx.strokeStyle = isVictory ? `hsl(${(exp.id * 137.5) % 360}, 100%, 70%)` : '#d8b4fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius * 1.1, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Starburst
      const points = 12;
      const innerRadius = currentRadius * 0.4;
      const outerRadius = currentRadius;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i * Math.PI) / points;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#f472b6');
      grad.addColorStop(1, '#a855f7');
      ctx.fillStyle = grad;
      ctx.fill();

      // Pixel Particles
      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i * Math.PI * 2) / particleCount + (exp.timer * 0.1);
        const dist = currentRadius * 1.3;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        const colors = ['#ef4444', '#3b82f6', '#fbbf24', '#10b981'];
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }

      ctx.restore();
    };

    explosionsRef.current.forEach(exp => drawExplosion(exp));
    victoryExplosionsRef.current.forEach(exp => drawExplosion(exp, true));
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        initGame();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [initGame]);

  useEffect(() => {
    if (gameState === 'playing' || gameState === 'win') {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing') return;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    fireInterceptor(clientX, clientY);
  };

  const startGame = () => {
    initGame(false);
    setGameState('playing');
  };

  const startNextLevel = () => {
    setLevel(l => l + 1);
    initGame(true);
    setGameState('playing');
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans text-white select-none">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
      />

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-mono tracking-wider">{t.score}: {score}</span>
          </div>
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 mt-1">
            <span className="text-[10px] text-white/60 uppercase tracking-tighter">{t.level} {level + 1}</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-[10px] text-white/40">{t.target}: {currentTarget}</span>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/10"
          >
            <Languages className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ammo Status (Bottom) */}
      <div className="absolute bottom-12 left-0 w-full flex justify-around px-8 pointer-events-none">
        {batteries.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`text-[10px] font-bold ${b.active ? 'text-emerald-400' : 'text-red-500'}`}>
              {i === 0 ? t.left : i === 1 ? t.middle : t.right}
            </div>
            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(b.ammo / b.maxAmmo) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Overlay Menus */}
      <AnimatePresence>
        {gameState !== 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl"
            >
              {gameState === 'menu' && (
                <>
                  <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Shield className="w-10 h-10 text-blue-400" />
                  </div>
                  <h1 className="text-4xl font-bold mb-2 tracking-tight">{t.title}</h1>
                  <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                    {t.instructions}
                  </p>
                  <button
                    onClick={startGame}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Target className="w-5 h-5" />
                    {t.start}
                  </button>
                </>
              )}

              {gameState === 'level_complete' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Trophy className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2 text-emerald-400">{t.level} {level + 1} Complete!</h2>
                  <div className="text-zinc-400 mb-8">{t.score}: {score}</div>
                  <button
                    onClick={startNextLevel}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Target className="w-5 h-5" />
                    {t.nextLevel}
                  </button>
                </motion.div>
              )}

              {gameState === 'win' && (
                <div className="relative">
                  {/* Success Particles/Confetti */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {victoryParticles.map((p, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: p.x - window.innerWidth/2, y: p.y - window.innerHeight/2, opacity: 1, scale: 1 }}
                        animate={{ 
                          y: [null, p.y + 200], 
                          opacity: [1, 0],
                          rotate: [0, 360]
                        }}
                        transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "easeOut" }}
                        className="absolute w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                    ))}
                  </div>

                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                    transition={{ duration: 0.5, times: [0, 0.5, 1] }}
                  >
                    <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                      <Trophy className="w-12 h-12 text-yellow-400" />
                    </div>
                    <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-sm">
                      {t.win}
                    </h2>
                    <div className="text-sm text-yellow-500/60 mb-6 uppercase tracking-widest font-bold">Defense Successful</div>
                    <div className="text-6xl font-mono font-black mb-8 text-white drop-shadow-md">
                      {score}
                    </div>
                    <button
                      onClick={startGame}
                      className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black rounded-2xl font-black transition-all transform hover:scale-[1.05] active:scale-95 flex items-center justify-center gap-2 shadow-xl"
                    >
                      <RotateCcw className="w-5 h-5" />
                      {t.restart}
                    </button>
                  </motion.div>
                </div>
              )}

              {gameState === 'lose' && (
                <>
                  <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Shield className="w-10 h-10 text-red-400" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2 text-red-500">{t.lose}</h2>
                  <div className="text-zinc-400 mb-8">{t.score}: {score}</div>
                  <button
                    onClick={startGame}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    {t.restart}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Hint */}
      <div className="absolute bottom-4 left-0 w-full text-center pointer-events-none opacity-20 text-[10px] uppercase tracking-[0.2em]">
        yq Nova Defense System v1.0
      </div>
    </div>
  );
}
