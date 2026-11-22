document.addEventListener("DOMContentLoaded", () => {
  const appShell = document.getElementById("app-shell");
  const stageContainer = document.getElementById("stage-container");
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayDesc = document.getElementById("overlay-desc");
  const startBtn = document.getElementById("start-btn");

  const scoreEl = document.getElementById("score-val");
  const buoyEl = document.getElementById("buoy-val");
  const hullEl = document.getElementById("hull-val");

  const btnUp = document.getElementById("btn-up");
  const btnDown = document.getElementById("btn-down");
  const btnHorn = document.getElementById("btn-horn");
  const fullscreenBtn = document.getElementById("fullscreen-btn");

  const infoBtn = document.getElementById("info-btn");
  const infoModal = document.getElementById("info-modal");
  const closeInfoBtn = document.getElementById("close-info-btn");

  // Dynamic Viewport Sizing
  let viewW = 960;
  let viewH = 540;
  let dpr = 1;

  function getWaterlineY() {
    return Math.round(viewH * 0.44);
  }

  function resizeCanvas() {
    const rect = stageContainer.getBoundingClientRect();
    viewW = Math.max(300, Math.floor(rect.width));
    viewH = Math.max(260, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Keep boat positioned proportionally across mobile portrait, landscape, and PC
    boat.x = viewW < 600 ? Math.max(95, viewW * 0.24) : Math.min(230, viewW * 0.22);
    const minY = getWaterlineY() + 18;
    const maxY = viewH - 42;
    if (boat.y < minY) boat.y = minY;
    if (boat.y > maxY) boat.y = maxY;
  }

  let running = false;
  let score = 0;
  let buoysCollected = 0;
  let hull = 100;
  let frame = 0;
  let boostTimer = 0;

  const keys = { up: false, down: false };
  let pointerActive = false;
  let pointerTargetY = null;

  const boat = {
    x: 180,
    y: 300,
    vy: 0,
    tilt: 0
  };

  let smokeParticles = [];
  let collectibles = [];
  let rocks = [];
  let seagulls = [
    { x: 520, y: 95, speed: 1.2, flap: 0 },
    { x: 780, y: 130, speed: 1.5, flap: 1.6 }
  ];
  let comicCallouts = [];

  resizeCanvas();
  boat.y = getWaterlineY() + (viewH - getWaterlineY()) * 0.35;
  window.addEventListener("resize", resizeCanvas);

  // Fullscreen Toggle for Mobile & PC
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await appShell.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (err) {
        // Fallback if browser blocks fullscreen API
        window.scrollTo(0, 1);
      }
      setTimeout(resizeCanvas, 120);
    });
  }

  // Info Modal
  if (infoBtn && infoModal && closeInfoBtn) {
    infoBtn.addEventListener("click", () => infoModal.classList.remove("hidden"));
    closeInfoBtn.addEventListener("click", () => infoModal.classList.add("hidden"));
    infoModal.addEventListener("click", (e) => {
      if (e.target === infoModal) infoModal.classList.add("hidden");
    });
  }

  function addCallout(text, x, y, color = "#FFD23F") {
    comicCallouts.push({ text, x, y, color, life: 48 });
  }

  function updateHud() {
    scoreEl.textContent = Math.floor(score);
    buoyEl.textContent = buoysCollected;
    hullEl.textContent = `${Math.max(0, hull)}%`;
  }

  function resetGame() {
    score = 0;
    buoysCollected = 0;
    hull = 100;
    frame = 0;
    boostTimer = 0;
    boat.y = getWaterlineY() + (viewH - getWaterlineY()) * 0.35;
    boat.vy = 0;
    pointerActive = false;
    pointerTargetY = null;
    smokeParticles = [];
    collectibles = [];
    rocks = [];
    comicCallouts = [];
    updateHud();
  }

  function triggerBoost() {
    if (!running) return;
    if (boostTimer <= 0) {
      boostTimer = 80;
      addCallout("TOOT! CHUG-CHUG!", boat.x + 25, boat.y - 75, "#FFD23F");
    }
  }

  // Keyboard Controls (PC)
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
      keys.up = true;
      pointerActive = false;
    }
    if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
      keys.down = true;
      pointerActive = false;
    }
    if (e.code === "Space") {
      e.preventDefault();
      triggerBoost();
    }
    if (e.key.toLowerCase() === "f" && fullscreenBtn) {
      fullscreenBtn.click();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") keys.up = false;
    if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") keys.down = false;
  });

  // Direct Touch / Drag Steering on Canvas (Mobile + Mouse)
  function updatePointerPos(clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerTargetY = clientY - rect.top;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!running) return;
    pointerActive = true;
    updatePointerPos(e.clientY);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!running || !pointerActive) return;
    updatePointerPos(e.clientY);
  });

  window.addEventListener("pointerup", () => {
    pointerActive = false;
  });

  // Hold Buttons (Mobile Ergonomic Pad)
  function bindHold(btn, prop) {
    if (!btn) return;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      keys[prop] = true;
      pointerActive = false;
    });
    const release = () => { keys[prop] = false; };
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  }

  bindHold(btnUp, "up");
  bindHold(btnDown, "down");
  if (btnHorn) {
    btnHorn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      triggerBoost();
    });
  }

  // Responsive Boat Scale
  function getBoatScale() {
    return viewW < 520 ? 0.78 : viewW > 1200 ? 1.15 : 0.96;
  }

  // Render Sky & Halftone
  function drawSkyAndHalftone() {
    const waterY = getWaterlineY();
    const grad = ctx.createLinearGradient(0, 0, 0, waterY + 25);
    grad.addColorStop(0, "#1A373E");
    grad.addColorStop(1, "#2A7B76");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, waterY + 25);

    // Comic Halftone Pattern
    ctx.fillStyle = "rgba(18, 18, 24, 0.2)";
    const step = 28;
    for (let x = 14; x < viewW; x += step) {
      for (let y = 14; y < waterY - 12; y += step) {
        ctx.beginPath();
        ctx.arc(x + ((y / step) % 2) * (step / 2), y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSeagulls() {
    const waterY = getWaterlineY();
    seagulls.forEach((g) => {
      g.x -= g.speed + (boostTimer > 0 ? 1.8 : 0);
      g.flap += 0.14;
      if (g.x < -40) {
        g.x = viewW + 40;
        g.y = Math.max(36, waterY * (0.22 + Math.random() * 0.45));
      }

      const wingY = Math.sin(g.flap) * 7;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.strokeStyle = "#121218";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-14, wingY);
      ctx.quadraticCurveTo(-4, -8, 0, 0);
      ctx.quadraticCurveTo(4, -8, 14, wingY);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawWater() {
    const waterY = getWaterlineY();
    ctx.fillStyle = "#1E6F73";
    ctx.fillRect(0, waterY, viewW, viewH - waterY);

    // Subtle Comic Wave Lines
    ctx.strokeStyle = "rgba(255, 248, 231, 0.22)";
    ctx.lineWidth = 2.5;
    for (let row = 1; row <= 3; row++) {
      const rowY = waterY + ((viewH - waterY) * row) / 4;
      ctx.beginPath();
      for (let x = 0; x <= viewW; x += 40) {
        const wy = rowY + Math.sin((x + frame * (2.5 + row * 0.5)) * 0.025) * 4;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // Bold Horizon Ink Wave
    ctx.strokeStyle = "#121218";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (let x = 0; x <= viewW; x += 28) {
      const wave = Math.sin((x + frame * 3.2) * 0.03) * 5;
      ctx.lineTo(x, waterY + wave);
    }
    ctx.stroke();
  }

  function drawTugboat(x, y, tilt) {
    const scale = getBoatScale();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(tilt);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#121218";
    ctx.lineWidth = 4.5;

    // Red Pennant Flag on Stern
    const waveFlag = Math.sin(frame * 0.18) * 5;
    ctx.beginPath();
    ctx.moveTo(-78, -22);
    ctx.lineTo(-84, -64);
    ctx.stroke();

    ctx.fillStyle = "#EE4266";
    ctx.beginPath();
    ctx.moveTo(-84, -62);
    ctx.quadraticCurveTo(-112, -70 + waveFlag, -138, -56 - waveFlag);
    ctx.lineTo(-132, -46);
    ctx.quadraticCurveTo(-108, -54 + waveFlag, -84, -46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Main Smokestack (Black & Red)
    ctx.fillStyle = "#262833";
    ctx.beginPath();
    ctx.moveTo(-54, -22);
    ctx.lineTo(-60, -88);
    ctx.lineTo(-32, -88);
    ctx.lineTo(-28, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#D64045";
    ctx.fillRect(-58, -82, 26, 22);
    ctx.strokeRect(-58, -82, 26, 22);

    // Wheelhouse Cabin
    ctx.fillStyle = "#D98A3C";
    ctx.beginPath();
    ctx.moveTo(-24, -18);
    ctx.lineTo(-16, -68);
    ctx.lineTo(42, -68);
    ctx.lineTo(48, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Upper Bridge
    ctx.fillStyle = "#E8A95B";
    ctx.beginPath();
    ctx.moveTo(-10, -68);
    ctx.lineTo(-4, -102);
    ctx.lineTo(36, -102);
    ctx.lineTo(40, -68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cabin Windows
    ctx.fillStyle = "#1A2634";
    ctx.fillRect(4, -93, 24, 15);
    ctx.strokeRect(4, -93, 24, 15);
    ctx.fillRect(8, -54, 28, 16);
    ctx.strokeRect(8, -54, 28, 16);

    // Hull Body
    ctx.fillStyle = "#4A2C1D";
    ctx.beginPath();
    ctx.moveTo(-82, -20);
    ctx.lineTo(86, -24);
    ctx.lineTo(66, 24);
    ctx.lineTo(-64, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Deck Trim
    ctx.fillStyle = "#F4C97A";
    ctx.fillRect(-84, -25, 172, 8);
    ctx.strokeRect(-84, -25, 172, 8);

    // Bow Number 1
    ctx.fillStyle = "#FFF8E7";
    ctx.font = "900 18px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("1", 52, 8);

    // Side Lifebuoy
    ctx.fillStyle = "#FFF8E7";
    ctx.beginPath();
    ctx.arc(8, -2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#EE4266";
    ctx.beginPath();
    ctx.arc(8, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Waterline Foam Slash
    ctx.strokeStyle = "#FFF8E7";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-76, 22);
    ctx.lineTo(74, 22);
    ctx.stroke();

    ctx.restore();
  }

  function updateAndDrawSmoke() {
    const scale = getBoatScale();
    if (frame % (boostTimer > 0 ? 4 : 9) === 0) {
      smokeParticles.push({
        x: boat.x - 46 * scale,
        y: boat.y - 92 * scale,
        r: (10 + Math.random() * 6) * scale,
        vx: -2.2 - Math.random(),
        vy: -1.1 - Math.random() * 0.6,
        alpha: 0.9
      });
    }

    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const p = smokeParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.r += 0.35;
      p.alpha -= 0.016;

      if (p.alpha <= 0) {
        smokeParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = "#3A474E";
      ctx.strokeStyle = "#121218";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function spawnEntities() {
    const waterY = getWaterlineY();
    const playableH = Math.max(80, viewH - waterY - 45);
    const baseSpeed = Math.max(4.2, viewW * 0.0052);
    const speedMult = boostTimer > 0 ? 1.65 : 1;

    if (frame % 72 === 0) {
      const isStar = Math.random() < 0.28;
      collectibles.push({
        type: isStar ? "star" : "buoy",
        x: viewW + 35,
        y: waterY + 22 + Math.random() * playableH,
        r: 18,
        speed: baseSpeed * speedMult
      });
    }

    if (frame % 105 === 0) {
      rocks.push({
        x: viewW + 40,
        y: waterY + 24 + Math.random() * playableH,
        r: 22,
        speed: (baseSpeed * 1.12) * speedMult
      });
    }
  }

  function drawStarShape(cx, cy, spikes, outerR, innerR) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
  }

  function updateAndDrawEntities() {
    const scale = getBoatScale();

    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i];
      c.x -= c.speed;

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.strokeStyle = "#121218";
      ctx.lineWidth = 4;

      if (c.type === "star") {
        ctx.fillStyle = "#FFD23F";
        drawStarShape(0, 0, 5, 20, 9);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = "#FFF8E7";
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#EE4266";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      const dx = c.x - boat.x;
      const dy = c.y - boat.y;
      if (Math.hypot(dx, dy) < c.r + 52 * scale) {
        if (c.type === "star") {
          score += 100;
          addCallout("+100 STAR!", c.x, c.y - 20, "#FFD23F");
        } else {
          buoysCollected += 1;
          score += 50;
          addCallout("+50 RESCUE!", c.x, c.y - 20, "#3BCEAC");
        }
        collectibles.splice(i, 1);
        updateHud();
        continue;
      }

      if (c.x < -50) collectibles.splice(i, 1);
    }

    // Sea Rocks
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i];
      r.x -= r.speed;

      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.fillStyle = "#2E353B";
      ctx.strokeStyle = "#121218";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-24, 14);
      ctx.lineTo(-14, -18);
      ctx.lineTo(6, -24);
      ctx.lineTo(24, -6);
      ctx.lineTo(26, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const dx = r.x - boat.x;
      const dy = r.y - boat.y;
      if (Math.hypot(dx, dy) < r.r + 42 * scale) {
        if (boostTimer > 0) {
          score += 30;
          addCallout("SMASH! +30", r.x, r.y - 24, "#FFD23F");
        } else {
          hull -= 25;
          addCallout("CLANG! -25%", boat.x + 15, boat.y - 45, "#EE4266");
        }
        rocks.splice(i, 1);
        updateHud();

        if (hull <= 0) {
          endGame();
          return;
        }
        continue;
      }

      if (r.x < -50) rocks.splice(i, 1);
    }
  }

  function drawCallouts() {
    for (let i = comicCallouts.length - 1; i >= 0; i--) {
      const item = comicCallouts[i];
      item.y -= 0.9;
      item.life -= 1;
      if (item.life <= 0) {
        comicCallouts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.font = "900 24px 'Bangers', cursive";
      ctx.fillStyle = item.color;
      ctx.strokeStyle = "#121218";
      ctx.lineWidth = 4;
      ctx.strokeText(item.text, item.x, item.y);
      ctx.fillText(item.text, item.x, item.y);
      ctx.restore();
    }
  }

  function endGame() {
    running = false;
    overlayTitle.textContent = "SHIPWRECKED!";
    overlayDesc.textContent = `Score: ${Math.floor(score)} | Lifebuoys Rescued: ${buoysCollected}. Ready for another voyage?`;
    startBtn.textContent = "SAIL AGAIN ▶";
    overlay.classList.remove("hidden");
  }

  function loop() {
    if (!running) return;
    frame += 1;
    if (boostTimer > 0) boostTimer -= 1;

    score += boostTimer > 0 ? 0.35 : 0.14;
    if (frame % 10 === 0) updateHud();

    const minY = getWaterlineY() + 18;
    const maxY = viewH - 36;

    if (pointerActive && pointerTargetY !== null) {
      const clampedTarget = Math.max(minY, Math.min(maxY, pointerTargetY));
      const diff = clampedTarget - boat.y;
      boat.vy = diff * 0.14;
    } else {
      if (keys.up) boat.vy -= 0.65;
      if (keys.down) boat.vy += 0.65;
      boat.vy *= 0.88;
    }

    boat.y += boat.vy;
    if (boat.y < minY) { boat.y = minY; boat.vy = 0; }
    if (boat.y > maxY) { boat.y = maxY; boat.vy = 0; }

    const bobY = Math.sin(frame * 0.08) * 4;
    boat.tilt = boat.vy * 0.022 + Math.cos(frame * 0.08) * 0.03;

    ctx.clearRect(0, 0, viewW, viewH);
    drawSkyAndHalftone();
    drawSeagulls();
    drawWater();
    updateAndDrawSmoke();
    drawTugboat(boat.x, boat.y + bobY, boat.tilt);
    spawnEntities();
    updateAndDrawEntities();
    drawCallouts();

    requestAnimationFrame(loop);
  }

  // Initial Preview Scene
  function drawPreview() {
    ctx.clearRect(0, 0, viewW, viewH);
    drawSkyAndHalftone();
    drawSeagulls();
    drawWater();
    drawTugboat(boat.x, boat.y, -0.02);
  }

  drawPreview();
  window.addEventListener("resize", () => {
    if (!running) drawPreview();
  });

  startBtn.addEventListener("click", () => {
    resizeCanvas();
    resetGame();
    overlay.classList.add("hidden");
    running = true;
    loop();
  });
});
