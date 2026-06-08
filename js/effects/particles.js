/**
 * Hero 粒子背景效果
 * 性能优化：FPS 限制器 + 页面不可见时暂停
 */

(function () {
  'use strict';

  var canvas, ctx, W, H;
  var particles = [];
  var mouse = { x: null, y: null };
  var isActive = true;
  var rafId = null;

  // FPS 限制器配置
  var TARGET_FPS = 30;
  var frameInterval = 1000 / TARGET_FPS;
  var lastFrameTime = 0;

  function resize() {
    var hero = document.getElementById('home');
    if (!hero || !canvas) return;
    W = canvas.width = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }

  function createParticles() {
    particles = [];
    if (!W || !H) return;
    var count = Math.min(80, Math.floor((W * H) / 12000));
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        color: Math.random() > 0.5 ? 'rgba(0,240,255,' : 'rgba(157,141,245,'
      });
    }
  }

  function draw(currentTime) {
    rafId = requestAnimationFrame(draw);

    // FPS 限制器
    if (currentTime - lastFrameTime < frameInterval) return;
    lastFrameTime = currentTime;

    if (!isActive || !ctx) return;
    ctx.clearRect(0, 0, W, H);

    var i, j, p, dx, dy, dist;

    // 更新并绘制粒子
    for (i = 0; i < particles.length; i++) {
      p = particles[i];

      // 鼠标交互：轻微磁吸
      if (mouse.x !== null) {
        dx = mouse.x - p.x;
        dy = mouse.y - p.y;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += dx * 0.00005;
          p.vy += dy * 0.00005;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      // 边界反弹
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      // 速度衰减
      p.vx *= 0.99;
      p.vy *= 0.99;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color + (0.3 + Math.random() * 0.2) + ')';
      ctx.fill();
    }

    // 连线（双层循环优化：减少重复计算）
    for (i = 0; i < particles.length; i++) {
      for (j = i + 1; j < particles.length; j++) {
        dx = particles[i].x - particles[j].x;
        dy = particles[i].y - particles[j].y;
        dist = dx * dx + dy * dy; // 避免 sqrt，比较平方
        if (dist < 22500) { // 150^2
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(0,240,255,' + (0.08 * (1 - Math.sqrt(dist) / 150)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function init() {
    canvas = document.getElementById('heroParticles');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resize();
    createParticles();
    rafId = requestAnimationFrame(draw);

    window.addEventListener('resize', function () {
      resize();
      createParticles();
    });

    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    canvas.addEventListener('mouseleave', function () {
      mouse.x = null;
      mouse.y = null;
    });

    // 页面不可见时暂停，节省 CPU/GPU
    document.addEventListener('visibilitychange', function () {
      isActive = !document.hidden;
      if (isActive && !rafId) {
        rafId = requestAnimationFrame(draw);
      }
    });
  }

  window.initParticles = init;
})();
