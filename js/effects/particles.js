/**
 * Hero 文字粒子化效果
 * "潮汐视界"由数百个粒子组成，鼠标靠近时粒子散开，离开后缓慢回归原位
 * 性能优化：FPS 限制器 + 页面不可见时暂停
 */

(function () {
  'use strict';

  var canvas, ctx, W, H;
  var particles = [];
  var mouse = { x: -1000, y: -1000 };
  var isActive = true;
  var rafId = null;

  // 配置
  var TEXT = '潮汐视界';
  var PARTICLE_GAP = 5;
  var MOUSE_RADIUS = 120;
  var REPULSION_FORCE = 3.5;
  var RETURN_SPEED = 0.06;
  var FLOAT_AMPLITUDE = 2.5;
  var FLOAT_SPEED = 0.06;

  // FPS 限制器配置
  var TARGET_FPS = 45;
  var frameInterval = 1000 / TARGET_FPS;
  var lastFrameTime = 0;

  function resize() {
    var hero = document.getElementById('home');
    if (!hero || !canvas) return;
    W = canvas.width = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }

  // 从文字采样粒子位置
  function sampleTextParticles() {
    if (!W || !H) return;

    var offCanvas = document.createElement('canvas');
    var offCtx = offCanvas.getContext('2d');
    offCanvas.width = W;
    offCanvas.height = H;

    var fontSize = Math.min(240, Math.max(80, W / 4.5));
    offCtx.font = 'bold ' + fontSize + 'px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    offCtx.fillStyle = '#fff';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(TEXT, W / 2, H / 2);

    var imageData = offCtx.getImageData(0, 0, W, H);
    var data = imageData.data;
    var points = [];

    for (var y = 0; y < H; y += PARTICLE_GAP) {
      for (var x = 0; x < W; x += PARTICLE_GAP) {
        var i = (y * W + x) * 4;
        if (data[i + 3] > 128) {
          points.push({ x: x, y: y });
        }
      }
    }

    return points;
  }

  function createParticles() {
    var points = sampleTextParticles();
    if (!points || points.length === 0) return;

    particles = [];
    for (var i = 0; i < points.length; i++) {
      var pt = points[i];
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        tx: pt.x,
        ty: pt.y,
        vx: 0,
        vy: 0,
        radius: Math.random() * 1.2 + 0.8,
        color: Math.random() > 0.5 ? 'rgba(0,240,255,' : 'rgba(157,141,245,',
        phase: Math.random() * Math.PI * 2,
        origTx: pt.x,
        origTy: pt.y
      });
    }
  }

  function draw(currentTime) {
    rafId = requestAnimationFrame(draw);

    // FPS 限制器
    if (currentTime - lastFrameTime < frameInterval) return;
    lastFrameTime = currentTime;

    if (!isActive || !ctx || particles.length === 0) return;

    // 半透明拖尾（营造流动感）
    ctx.fillStyle = 'rgba(6,6,10,0.35)';
    ctx.fillRect(0, 0, W, H);

    var i, p, dx, dy, dist, force;
    var time = Date.now() * FLOAT_SPEED;

    for (i = 0; i < particles.length; i++) {
      p = particles[i];

      // ── 1. 自然飘动（正弦波）──
      var floatX = Math.sin(time + p.phase) * FLOAT_AMPLITUDE;
      var floatY = Math.cos(time + p.phase * 0.7) * FLOAT_AMPLITUDE;

      // ── 2. 鼠标排斥力 ──
      dx = p.x - mouse.x;
      dy = p.y - mouse.y;
      dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MOUSE_RADIUS && dist > 0.1) {
        force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
        p.vx += (dx / dist) * force * REPULSION_FORCE;
        p.vy += (dy / dist) * force * REPULSION_FORCE;
      }

      // ── 3. 回归目标位置的弹力 ──
      var targetX = p.origTx + floatX;
      var targetY = p.origTy + floatY;

      p.vx += (targetX - p.x) * RETURN_SPEED;
      p.vy += (targetY - p.y) * RETURN_SPEED;

      // ── 4. 速度衰减（阻尼）──
      p.vx *= 0.88;
      p.vy *= 0.88;

      // ── 5. 更新位置 ──
      p.x += p.vx;
      p.y += p.vy;

      // ── 6. 绘制粒子 ──
      var alpha = 0.5 + Math.sin(time + p.phase) * 0.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color + alpha.toFixed(2) + ')';
      ctx.fill();
    }

    // ── 7. 粒子间连线（近距离时）──
    var j, p2;
    for (i = 0; i < particles.length; i += 2) { // 跳步减少计算量
      p = particles[i];
      for (j = i + 1; j < particles.length; j += 3) {
        p2 = particles[j];
        dx = p.x - p2.x;
        dy = p.y - p2.y;
        dist = dx * dx + dy * dy;
        if (dist < 900) { // 30^2
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = 'rgba(0,240,255,' + (0.06 * (1 - Math.sqrt(dist) / 30)) + ')';
          ctx.lineWidth = 0.4;
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
      mouse.x = -1000;
      mouse.y = -1000;
    });

    // 触摸支持
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var touch = e.touches[0];
      mouse.x = touch.clientX - rect.left;
      mouse.y = touch.clientY - rect.top;
    }, { passive: false });

    canvas.addEventListener('touchend', function () {
      mouse.x = -1000;
      mouse.y = -1000;
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
