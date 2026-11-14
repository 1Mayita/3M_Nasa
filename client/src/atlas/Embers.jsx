// =====================================================================
// Dueño: P3 (Vista)
// Brasas: partículas ámbar que suben despacio, como un video de fondo ligero (sin archivos pesados).
// ~48 partículas en un canvas; se pausa si la pestaña está oculta y no se dibuja con movimiento reducido.
// Decorativo: aria-hidden, sin interacción.
// =====================================================================

import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 48;

function createParticle(width, height, spreadY) {
  return {
    x: Math.random() * width,
    y: spreadY ? Math.random() * height : height + Math.random() * 40,
    radius: 0.8 + Math.random() * 2.2,
    speed: 8 + Math.random() * 22,
    sway: 6 + Math.random() * 18,
    phase: Math.random() * Math.PI * 2,
    life: 0.35 + Math.random() * 0.65
  };
}

export default function Embers() {
  const canvasRef = useRef(null);

  useEffect(function animate() {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const context = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let particles = [];
    let frameId = 0;
    let lastTime = performance.now();

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: PARTICLE_COUNT }, function make() {
        return createParticle(width, height, true);
      });
    }

    function draw(now) {
      const elapsed = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      if (!document.hidden) {
        context.clearRect(0, 0, width, height);
        context.globalCompositeOperation = 'lighter';
        particles.forEach(function step(particle, i) {
          particle.y -= particle.speed * elapsed;
          particle.phase += elapsed * 0.9;
          const x = particle.x + Math.sin(particle.phase) * particle.sway;
          const progress = 1 - Math.max(particle.y, 0) / height;
          const alpha = Math.max(0, Math.sin(Math.min(progress, 1) * Math.PI)) * particle.life * 0.75;
          const gradient = context.createRadialGradient(x, particle.y, 0, x, particle.y, particle.radius * 5);
          gradient.addColorStop(0, 'rgba(255, 190, 92,' + alpha + ')');
          gradient.addColorStop(0.4, 'rgba(224, 122, 47,' + alpha * 0.45 + ')');
          gradient.addColorStop(1, 'rgba(224, 122, 47, 0)');
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(x, particle.y, particle.radius * 5, 0, Math.PI * 2);
          context.fill();
          if (particle.y < -20) {
            particles[i] = createParticle(width, height, false);
          }
        });
      }
      frameId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    frameId = requestAnimationFrame(draw);
    return function cleanup() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas className="embers" ref={canvasRef} aria-hidden="true" />;
}
