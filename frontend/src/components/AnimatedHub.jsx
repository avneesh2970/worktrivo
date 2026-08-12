import React, { useEffect, useRef, useState } from 'react';

const AnimatedHub = () => {
  const canvasRef = useRef(null);
  const [taskCount, setTaskCount] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let balls = [];
    let particles = [];

    // Resize canvas to fill container
    const handleResize = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const ballRadius = 35;
    const ballColor = '#dc9750';
    const ballSpeed = 3.5;

    // Ball Class
    class Ball {
      constructor(label) {
        this.x = -ballRadius * 2;
        // Random vertical placement with padding
        this.y = Math.random() * (canvas.height - ballRadius * 4) + ballRadius * 2;
        this.radius = ballRadius;
        this.label = label;
        this.color = ballColor;
        this.speed = ballSpeed;
      }

      update() {
        this.x += this.speed;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = 'rgba(220, 151, 80, 0.4)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0; // Reset shadow

        // Text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.x, this.y);
      }
    }

    // Particle/Sparkle Class
    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 4 + 2;
        // Random explosion velocities
        this.vx = (Math.random() - 0.7) * 8; // Slight left/right spread
        this.vy = (Math.random() - 0.5) * 8;
        this.color = ballColor;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.015;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(this.alpha, 0);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
      }
    }

    // Spawn ball every 2.5 seconds
    let currentTask = 1;
    const spawnInterval = setInterval(() => {
      balls.push(new Ball(`Task ${currentTask}`));
      currentTask += 1;
      setTaskCount(currentTask);
    }, 2500);

    // Initial ball
    balls.push(new Ball(`Task ${currentTask}`));
    currentTask += 1;

    // Main animation loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update & draw balls
      for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        ball.update();
        ball.draw();

        // Check if reached right border
        if (ball.x + ball.radius >= canvas.width - 10) {
          // Burst into sparkles/particles
          for (let p = 0; p < 25; p++) {
            particles.push(new Particle(ball.x, ball.y));
          }
          balls.splice(i, 1);
        }
      }

      // Update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update();
        particle.draw();

        if (particle.alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      clearInterval(spawnInterval);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden">
      

      {/* Canvas container */}
      <div className="w-full h-full relative">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
};

export default AnimatedHub;