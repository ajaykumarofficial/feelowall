import React, { useEffect, useRef } from 'react';

export const AmbientEffects = ({ type = 'none' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!type || type === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse positions for interactive parallax
    const mouse = { x: width / 2, y: height / 2, targetX: width / 2, targetY: height / 2 };
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Effect specific initializations
    const particles = [];
    const particleCount = type === 'rain' ? 80 : type === 'snow' ? 60 : type === 'starfield' ? 100 : 50;

    if (type === 'rain') {
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height - height,
          length: Math.random() * 20 + 10,
          speed: Math.random() * 8 + 6,
          opacity: Math.random() * 0.3 + 0.1
        });
      }
    } else if (type === 'snow') {
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 3 + 1,
          d: Math.random() * particleCount, // density
          speed: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.2
        });
      }
    } else if (type === 'starfield') {
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width - width / 2,
          y: Math.random() * height - height / 2,
          z: Math.random() * width,
          r: Math.random() * 1.5 + 0.5
        });
      }
    } else if (type === 'parallax') {
      // Interactive floating mesh
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          baseX: 0,
          baseY: 0,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          r: Math.random() * 4 + 2,
          color: `rgba(255, 255, 255, ${Math.random() * 0.3 + 0.1})`
        });
        particles[i].baseX = particles[i].x;
        particles[i].baseY = particles[i].y;
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Interpolate mouse coordinates
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      if (type === 'rain') {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 1, p.y + p.length);
          ctx.stroke();

          // update
          p.y += p.speed;
          p.x += 0.5; // slight wind
          if (p.y > height) {
            p.y = -20;
            p.x = Math.random() * width;
          }
        }
      } else if (type === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.fill();

          // update
          p.y += p.speed;
          p.x += Math.sin(p.y / 30) * 0.5; // sway
          if (p.y > height) {
            p.y = -10;
            p.x = Math.random() * width;
          }
        }
      } else if (type === 'starfield') {
        ctx.fillStyle = '#ffffff';
        const cx = width / 2;
        const cy = height / 2;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.z -= 2; // Move closer
          if (p.z <= 0) {
            p.z = width;
            p.x = Math.random() * width - cx;
            p.y = Math.random() * height - cy;
          }

          const k = 128.0 / p.z;
          const px = p.x * k + cx;
          const py = p.y * k + cy;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const size = (1 - p.z / width) * 4;
            ctx.beginPath();
            ctx.arc(px, py, size > 0 ? size : 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (type === 'parallax') {
        // Particles drift based on mouse coordinates relative to center
        const dx = (mouse.x - width / 2) * 0.05;
        const dy = (mouse.y - height / 2) * 0.05;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          
          // Draw connecting lines if close
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (dist < 80) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - dist / 80) * 0.05})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();

          // update position with random velocity + mouse parallax offset
          p.baseX += p.vx;
          p.baseY += p.vy;

          if (p.baseX < 0 || p.baseX > width) p.vx *= -1;
          if (p.baseY < 0 || p.baseY > height) p.vy *= -1;

          // Parallax shift
          p.x = p.baseX + dx;
          p.y = p.baseY + dy;
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [type]);

  if (!type || type === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  );
};

export default AmbientEffects;
