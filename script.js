document.addEventListener("DOMContentLoaded", () => {
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

  let running = false;
  let score = 0;
  let buoysCollected = 0;
  let hull = 100;
  let frame = 0;
  let boostTimer = 0;

  const keys = { up: false, down: false };

  const boat = {
    x: 190,
    y: 265,
    vy: 0,
    minY: 215,
    maxY: 395,
    tilt: 0
  };

  let smokeParticles = [];
  let collectibles = [];
  let rocks = [];
  let seagulls = [
    { x: 640, y: 110, speed: 1.1, flap: 0 },
    { x: 820, y: 145, speed: 1.4, flap: 1.5 }
  ];
  let comicCallouts = [];

  function addCallout(text, x, y, color = "#FFD23F") {
    comicCallouts.push({ text, x, y, color, life: 45 });
  }

  function resetGame() {
    score = 0;
    buoysCollected = 0;
    hull = 100;
    frame = 0;
    boostTimer = 0;
    boat.y = 270;
    boat.vy = 0;
    smokeParticles = [];
    collectibles = [];
    rocks = [];
    comicCallouts = [];
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = Math.floor(score);
    buoyEl.textContent = buoysCollected;
    hullEl.textContent = `${Math.max(0, hull)}%`;
  }

  function triggerBoost() {
    if (!running) return;
    if (boostTimer <= 0) {
      boostTimer = 75;
      addCallout("TOOT! CHUG-CHUG!", boat.x + 50, boat.y - 75, "#FFD23F");
    }
  }

  // Keyboard Listeners
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") keys.up = true;
    if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") keys.down = true;
    if (e.code === "Space") {
      e.preventDefault();
      triggerBoost();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") keys.up = false;
    if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") keys.down = false;
  });

  // Touch / Mouse Controls
  function bindHold(btn, prop) {
    if (!btn) return;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      keys[prop] = true;
    });
    const release = () => { keys[prop] = false; };
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  }

  bindHold(btnUp, "up");
  bindHold(btnDown, "down");
  if (btnHorn) btnHorn.addEventListener("click", triggerBoost);

  // Comic Drawing Helpers
  function drawSkyAndHalftone() {
    const grad = ctx.createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, "#1D3B42");
    grad.addColorStop(1, "#2A7B76");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 260);

    // Comic Halftone Dots
    ctx.fillStyle = "rgba(18, 18, 24, 0.22)";
    for (let x = 16; x < canvas.width; x += 26) {
      for (let y = 16; y < 220; y += 26) {
        ctx.beginPath();
        ctx.arc(x + ((y / 26) % 2) * 13, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSeagulls() {
    seagulls.forEach((g) => {
      g.x -= g.speed + (boostTimer > 0 ? 1.5 : 0);
      g.flap += 0.14;
      if (g.x < -40) {
        g.x = canvas.width + 40;
        g.y = 70 + Math.random() * 100;
      }

      const wingY = Math.sin(g.flap) * 7;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.strokeStyle = "#121218";
      ctx.lineWidth = 3.5;
      ctx.fillStyle = "#FFF8E7";

      ctx.beginPath();
      ctx.moveTo(-14, wingY);
      ctx.quadraticCurveTo(-4, -8, 0, 0);
      ctx.quadraticCurveTo(4, -8, 14, wingY);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawWaterBack() {
    ctx.fillStyle = "#1E6F73";
    ctx.fillRect(0, 235, canvas.width, 245);

    ctx.strokeStyle = "#121218";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 235);
    for (let x = 0; x <= canvas.width; x += 30) {
      const wave = Math.sin((x + frame * 3) * 0.03) * 6;
      ctx.lineTo(x, 235 + wave);
    }
    ctx.stroke();
  }

  function drawTugboat(x, y, tilt) {
    ctx.save();
    ctx.translate(x, y);
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

    // Wheelhouse Cabin (Warm Wood Comic Style)
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

    // Bow Number "1"
    ctx.fillStyle = "#FFF8E7";
    ctx.font = "900 18px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("1", 52, 8);

    // Side Lifebuoy (White & Red)
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
    if (frame % (boostTimer > 0 ? 4 : 9) === 0) {
      smokeParticles.push({
        x: boat.x - 46,
        y: boat.y - 92,
        r: 10 + Math.random() * 6,
        vx: -2.2 - Math.random(),
        vy: -1.2 - Math.random() * 0.6,
        alpha: 0.9
      });
    }

    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const p = smokeParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.r += 0.35;
      p.alpha -= 0.015;

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
    const speedMult = boostTimer > 0 ? 1.65 : 1;
    if (frame % 75 === 0) {
      collectibles.push({
        x: canvas.width + 30,
        y: 235 + Math.random() * 165,
        r: 18,
        speed: (4.2 + Math.random() * 1.5) * speedMult
      });
    }
    if (frame % 110 === 0) {
      rocks.push({
        x: canvas.width + 40,
        y: 240 + Math.random() * 165,
        r: 22,
        speed: (4.8 + Math.random() * 1.8) * speedMult
      });
    }
  }

  function updateAndDrawEntities() {
    // Lifebuoy Pickups
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i];
      c.x -= c.speed;

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = "#FFF8E7";
      ctx.strokeStyle = "#121218";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#EE4266";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const dx = c.x - boat.x;
      const dy = c.y - boat.y;
      if (Math.hypot(dx, dy) < c.r + 52) {
        buoysCollected += 1;
        score += 50;
        addCallout("+50 RESCUE!", c.x, c.y - 20, "#3BCEAC");
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
      if (Math.hypot(dx, dy) < r.r + 42) {
        if (boostTimer > 0) {
          score += 30;
          addCallout("SMASH! +30", r.x, r.y - 25, "#FFD23F");
        } else {
          hull -= 25;
          addCallout("CLANG! -25%", boat.x + 20, boat.y - 45, "#EE4266");
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
    overlayDesc.textContent = `Final Score: ${Math.floor(score)} | Lifebuoys Rescued: ${buoysCollected}. Ready for another voyage?`;
    startBtn.textContent = "SAIL AGAIN ▶";
    overlay.classList.remove("hidden");
  }

  function loop() {
    if (!running) return;
    frame += 1;
    if (boostTimer > 0) boostTimer -= 1;

    score += boostTimer > 0 ? 0.35 : 0.12;
    if (frame % 10 === 0) updateHud();

    // Boat vertical steering + wave bobbing
    if (keys.up) boat.vy -= 0.55;
    if (keys.down) boat.vy += 0.55;
    boat.vy *= 0.88;
    boat.y += boat.vy;

    if (boat.y < boat.minY) { boat.y = boat.minY; boat.vy = 0; }
    if (boat.y > boat.maxY) { boat.y = boat.maxY; boat.vy = 0; }

    const bobY = Math.sin(frame * 0.08) * 4;
    boat.tilt = boat.vy * 0.025 + Math.cos(frame * 0.08) * 0.03;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSkyAndHalftone();
    drawSeagulls();
    drawWaterBack();
    updateAndDrawSmoke();
    drawTugboat(boat.x, boat.y + bobY, boat.tilt);
    spawnEntities();
    updateAndDrawEntities();
    drawCallouts();

    requestAnimationFrame(loop);
  }

  // Initial Preview Frame
  drawSkyAndHalftone();
  drawSeagulls();
  drawWaterBack();
  drawTugboat(boat.x, boat.y, -0.02);

  startBtn.addEventListener("click", () => {
    resetGame();
    overlay.classList.add("hidden");
    running = true;
    loop();
  });
});
