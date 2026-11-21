import {
  ALLEY_PALETTE,
  APPROACH_MAX_Y,
  APPROACH_MIN_Y,
  BALL_MAX_X,
  FOUL_LINE_Y,
  LANE_ARROWS_Y,
  LANE_HALF_WIDTH,
  PIN_DECK_BACK_Y,
  PIN_DECK_FRONT_Y,
} from './catalog.js';

const CONFETTI_COLORS = ['#ff6b57', '#ffd166', '#4ecdc4', '#5c9eff', '#b388ff', '#7ae582'];

export function createConfettiSystem() {
  return { particles: [] };
}

export function spawnConfetti(system, count = 42, originX = 0.5, originY = 0.32) {
  if (!system) return;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const speed = 120 + Math.random() * 280;
    system.particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      size: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      age: 0,
      life: 1.5 + Math.random() * 0.9,
      initialized: false,
    });
  }
}

export function stepConfetti(system, dt, width, height) {
  if (!system || !system.particles.length) return;
  const clamped = Math.min(Math.max(dt, 0), 0.05);
  for (const p of system.particles) {
    if (!p.initialized) {
      p.x *= width;
      p.y *= height;
      p.initialized = true;
    }
    p.age += clamped;
    p.vy += 480 * clamped;
    p.x += p.vx * clamped;
    p.y += p.vy * clamped;
    p.rot += p.vrot * clamped;
  }
  system.particles = system.particles.filter((p) => p.age < p.life);
}

const PERSPECTIVE_POWER = 1.48;

/**
 * Computes responsive 2.5D trapezoid geometry for the bowling alley.
 */
export function getLaneGeometry(width, height) {
  const isPortrait = width <= 640;
  // Leave room for the 2x5 portrait scoreboard or 1x10 desktop bar
  const topMargin = isPortrait
    ? Math.max(166, Math.min(188, height * 0.215))
    : Math.max(92, Math.min(120, height * 0.14));
  const bottomMargin = Math.max(12, height * 0.018);
  const topY = topMargin;
  const bottomY = height - bottomMargin;
  const centerX = width / 2;

  const maxBottomHalfW = isPortrait
    ? Math.min(width * 0.46, (bottomY - topY) * 0.48)
    : Math.min(width * 0.42, (bottomY - topY) * 0.44);
  const bottomHalfW = Math.max(115, maxBottomHalfW);
  // Narrower far end creates stronger depth perspective so the lane looks longer
  const topHalfW = bottomHalfW * (isPortrait ? 0.37 : 0.35);

  return {
    width,
    height,
    centerX,
    topY,
    bottomY,
    topHalfW,
    bottomHalfW,
    yMin: PIN_DECK_BACK_Y,
    yMax: APPROACH_MAX_Y,
  };
}

/**
 * Maps logical lane coordinates (x in [-1, 1], y in [0, APPROACH_MAX_Y])
 * to screen coordinates (sx, sy) and local perspective scale.
 */
export function laneToScreen(x, y, geo) {
  const tLinear = (y - geo.yMin) / (geo.yMax - geo.yMin);
  // Perspective curve elongates the mid-lane and foreshortens the far pin deck
  const t = Math.pow(Math.max(0, Math.min(1.15, tLinear)), PERSPECTIVE_POWER);
  const sy = geo.topY + t * (geo.bottomY - geo.topY);
  const halfW = geo.topHalfW + t * (geo.bottomHalfW - geo.topHalfW);
  const sx = geo.centerX + (x / LANE_HALF_WIDTH) * halfW;
  const scale = halfW / LANE_HALF_WIDTH;
  return { sx, sy, scale, halfW, t };
}

/**
 * Inverse projection from screen coordinates to logical lane coordinates,
 * clamped to the draggable Approach Zone (strictly behind the foul line).
 */
export function screenToApproach(sx, sy, geo) {
  const tRaw = (sy - geo.topY) / Math.max(1, geo.bottomY - geo.topY);
  const tClamped = Math.max(0.01, Math.min(1, tRaw));
  const tLinear = Math.pow(tClamped, 1 / PERSPECTIVE_POWER);
  const yRaw = geo.yMin + tLinear * (geo.yMax - geo.yMin);
  const y = Math.max(APPROACH_MIN_Y, Math.min(APPROACH_MAX_Y, yRaw));

  const p = laneToScreen(0, y, geo);
  const xRaw = ((sx - geo.centerX) / Math.max(1, p.halfW)) * LANE_HALF_WIDTH;
  const x = Math.max(-BALL_MAX_X, Math.min(BALL_MAX_X, xRaw));
  return { x, y };
}

function drawBackdrop(ctx, geo) {
  const grad = ctx.createLinearGradient(0, 0, 0, geo.height);
  grad.addColorStop(0, ALLEY_PALETTE.backdropTop);
  grad.addColorStop(0.55, ALLEY_PALETTE.backdropMid);
  grad.addColorStop(1, '#1d2236');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, geo.width, geo.height);

  // Warm overhead alley glow
  const glow = ctx.createRadialGradient(
    geo.centerX,
    geo.topY + 40,
    10,
    geo.centerX,
    geo.topY + 90,
    geo.bottomHalfW * 1.45,
  );
  glow.addColorStop(0, 'rgba(255, 224, 150, 0.22)');
  glow.addColorStop(1, 'rgba(255, 224, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, geo.width, geo.height);

  // Pinsetter hood / pit arch at the far end
  const backL = laneToScreen(-1.18, PIN_DECK_BACK_Y, geo);
  const backR = laneToScreen(1.18, PIN_DECK_BACK_Y, geo);
  const hoodH = Math.max(36, geo.topHalfW * 0.42);

  ctx.fillStyle = '#181c2b';
  ctx.beginPath();
  ctx.roundRect(backL.sx - 8, backL.sy - hoodH, backR.sx - backL.sx + 16, hoodH + 14, [18, 18, 4, 4]);
  ctx.fill();

  // Warm neon accent bar on the pinsetter hood
  ctx.strokeStyle = '#ff9d7a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(backL.sx + 10, backL.sy - hoodH + 12);
  ctx.lineTo(backR.sx - 10, backL.sy - hoodH + 12);
  ctx.stroke();
}

function drawLaneSurface(ctx, geo, state) {
  const pTopL = laneToScreen(-LANE_HALF_WIDTH, PIN_DECK_BACK_Y, geo);
  const pTopR = laneToScreen(LANE_HALF_WIDTH, PIN_DECK_BACK_Y, geo);
  const pFoulL = laneToScreen(-LANE_HALF_WIDTH, FOUL_LINE_Y, geo);
  const pFoulR = laneToScreen(LANE_HALF_WIDTH, FOUL_LINE_Y, geo);
  const pBotL = laneToScreen(-LANE_HALF_WIDTH, APPROACH_MAX_Y, geo);
  const pBotR = laneToScreen(LANE_HALF_WIDTH, APPROACH_MAX_Y, geo);

  // Outer gutter channels
  const gTopL = laneToScreen(-1.16, PIN_DECK_BACK_Y, geo);
  const gTopR = laneToScreen(1.16, PIN_DECK_BACK_Y, geo);
  const gFoulL = laneToScreen(-1.16, FOUL_LINE_Y, geo);
  const gFoulR = laneToScreen(1.16, FOUL_LINE_Y, geo);

  ctx.fillStyle = ALLEY_PALETTE.gutterBg;
  ctx.beginPath();
  ctx.moveTo(gTopL.sx, gTopL.sy);
  ctx.lineTo(gTopR.sx, gTopR.sy);
  ctx.lineTo(gFoulR.sx, gFoulR.sy);
  ctx.lineTo(gFoulL.sx, gFoulL.sy);
  ctx.closePath();
  ctx.fill();

  // Main wooden lane (from pin deck to foul line)
  const woodGrad = ctx.createLinearGradient(0, pTopL.sy, 0, pFoulL.sy);
  woodGrad.addColorStop(0, ALLEY_PALETTE.woodDark);
  woodGrad.addColorStop(0.25, ALLEY_PALETTE.woodMid);
  woodGrad.addColorStop(1, ALLEY_PALETTE.woodLight);

  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.moveTo(pTopL.sx, pTopL.sy);
  ctx.lineTo(pTopR.sx, pTopR.sy);
  ctx.lineTo(pFoulR.sx, pFoulR.sy);
  ctx.lineTo(pFoulL.sx, pFoulL.sy);
  ctx.closePath();
  ctx.fill();

  // Approach Zone (behind foul line, visually distinct warm deck)
  const appGrad = ctx.createLinearGradient(0, pFoulL.sy, 0, pBotL.sy);
  appGrad.addColorStop(0, ALLEY_PALETTE.approachLight);
  appGrad.addColorStop(1, ALLEY_PALETTE.approachDark);

  ctx.fillStyle = appGrad;
  ctx.beginPath();
  ctx.moveTo(gFoulL.sx, gFoulL.sy);
  ctx.lineTo(gFoulR.sx, gFoulR.sy);
  ctx.lineTo(pBotR.sx + (pBotR.sx - geo.centerX) * 0.16, pBotR.sy);
  ctx.lineTo(pBotL.sx - (geo.centerX - pBotL.sx) * 0.16, pBotL.sy);
  ctx.closePath();
  ctx.fill();

  // Subtle wood plank seams running down the lane
  ctx.strokeStyle = ALLEY_PALETTE.woodSeam;
  ctx.lineWidth = 1.25;
  const plankCount = 12;
  for (let i = 1; i < plankCount; i++) {
    const lx = -LANE_HALF_WIDTH + (i / plankCount) * (LANE_HALF_WIDTH * 2);
    const a = laneToScreen(lx, PIN_DECK_BACK_Y, geo);
    const b = laneToScreen(lx, APPROACH_MAX_Y, geo);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }

  // Subtle pin deck highlight
  const pdFrontL = laneToScreen(-LANE_HALF_WIDTH, PIN_DECK_FRONT_Y, geo);
  const pdFrontR = laneToScreen(LANE_HALF_WIDTH, PIN_DECK_FRONT_Y, geo);
  ctx.fillStyle = 'rgba(255, 250, 235, 0.18)';
  ctx.beginPath();
  ctx.moveTo(pTopL.sx, pTopL.sy);
  ctx.lineTo(pTopR.sx, pTopR.sy);
  ctx.lineTo(pdFrontR.sx, pdFrontR.sy);
  ctx.lineTo(pdFrontL.sx, pdFrontL.sy);
  ctx.closePath();
  ctx.fill();

  // Classic 7 bowling arrows
  ctx.fillStyle = ALLEY_PALETTE.arrowFill;
  for (let i = -3; i <= 3; i++) {
    const ax = i * 0.24;
    const ay = LANE_ARROWS_Y - (3 - Math.abs(i)) * 0.11;
    const tip = laneToScreen(ax, ay - 0.16, geo);
    const left = laneToScreen(ax - 0.045, ay + 0.05, geo);
    const right = laneToScreen(ax + 0.045, ay + 0.05, geo);
    ctx.beginPath();
    ctx.moveTo(tip.sx, tip.sy);
    ctx.lineTo(right.sx, right.sy);
    ctx.lineTo(left.sx, left.sy);
    ctx.closePath();
    ctx.fill();
  }

  // Bright Foul / Lane Line separating the lane from the Approach Zone
  ctx.save();
  ctx.strokeStyle = ALLEY_PALETTE.foulLineGlow;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(gFoulL.sx, gFoulL.sy);
  ctx.lineTo(gFoulR.sx, gFoulR.sy);
  ctx.stroke();

  ctx.strokeStyle = ALLEY_PALETTE.foulLine;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(gFoulL.sx, gFoulL.sy);
  ctx.lineTo(gFoulR.sx, gFoulR.sy);
  ctx.stroke();
  ctx.restore();

  // Soft hint inside the approach zone when aiming on frame 1 roll 1
  if (state.phase === 'playing' && state.rollPhase === 'aiming' && state.currentFrame === 0 && state.currentRoll === 0) {
    const hintPos = laneToScreen(0, APPROACH_MAX_Y - 0.16, geo);
    ctx.save();
    ctx.font = '700 13px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(92, 54, 24, 0.65)';
    ctx.fillText('DRAG HERE & FLICK UP TO ROLL!', hintPos.sx, hintPos.sy);
    ctx.restore();
  }
}

function drawBumperRail(ctx, geo, side, bumperState) {
  const isLeft = side === 'left';
  const sign = isLeft ? -1 : 1;
  const hitTimer = bumperState ? bumperState.hitTimer : 0;
  const hitY = bumperState ? bumperState.hitY : FOUL_LINE_Y * 0.5;
  const hitGlow = Math.max(0, Math.min(1, hitTimer / 0.38));

  const segments = 24;
  const outerOffset = 0.14;

  // Build cushioned bumper polygon with slight squish bulge near hitY when hit
  const innerPts = [];
  const outerPts = [];
  for (let i = 0; i <= segments; i++) {
    const y = PIN_DECK_BACK_Y + (i / segments) * (FOUL_LINE_Y - PIN_DECK_BACK_Y);
    let squish = 0;
    if (hitGlow > 0) {
      const dist = Math.abs(y - hitY);
      if (dist < 0.9) {
        const wave = Math.cos((dist / 0.9) * (Math.PI / 2));
        squish = wave * hitGlow * 0.085 * Math.sin(hitGlow * Math.PI * 3);
      }
    }
    const innerX = sign * (LANE_HALF_WIDTH + squish);
    const outerX = sign * (LANE_HALF_WIDTH + outerOffset + squish * 0.5);
    innerPts.push(laneToScreen(innerX, y, geo));
    outerPts.push(laneToScreen(outerX, y, geo));
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(innerPts[0].sx, innerPts[0].sy);
  for (let i = 1; i <= segments; i++) ctx.lineTo(innerPts[i].sx, innerPts[i].sy);
  for (let i = segments; i >= 0; i--) ctx.lineTo(outerPts[i].sx, outerPts[i].sy);
  ctx.closePath();

  ctx.fillStyle = hitGlow > 0.2 ? ALLEY_PALETTE.bumperGlow : ALLEY_PALETTE.bumperBase;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glowing impact ring on bumper hit
  if (hitGlow > 0) {
    const impact = laneToScreen(sign * LANE_HALF_WIDTH, hitY, geo);
    ctx.beginPath();
    ctx.arc(impact.sx, impact.sy, (16 + (1 - hitGlow) * 26) * (impact.scale / 160 + 0.5), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 232, 102, ${hitGlow * 0.9})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPin(ctx, pin, geo) {
  if (pin.cleared) return;
  const p = laneToScreen(pin.x, pin.y, geo);
  const r = Math.max(4.5, pin.radius * p.scale * 1.12);
  const h = r * 4.55;

  ctx.save();
  ctx.translate(p.sx, p.sy);

  // Ground shadow
  ctx.fillStyle = 'rgba(35, 24, 15, 0.26)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.22, r * 0.95, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tilt/tumble transform when knocked down
  if (!pin.standing || pin.falling) {
    const fall = Math.max(0, Math.min(1, pin.fallProgress || 0));
    const sideSign = pin.angle < -0.05 ? -1 : pin.angle > 0.05 ? 1 : (pin.id % 2 === 0 ? 1 : -1);
    const tilt = sideSign * fall * 1.38 + Math.max(-0.6, Math.min(0.6, pin.angle * 0.25)) * fall;
    ctx.rotate(tilt);
    ctx.globalAlpha = Math.max(0.35, 1 - fall * 0.22);
  }

  // Traditional 10-pin bowling pin silhouette:
  // narrow flat base -> full rounded belly -> slender neck -> distinct round head
  ctx.beginPath();
  ctx.moveTo(-r * 0.44, 0);
  // Left base up to widest belly (~33% height)
  ctx.bezierCurveTo(-r * 0.88, -h * 0.14, -r * 0.96, -h * 0.34, -r * 0.72, -h * 0.50);
  // Taper inward to slender neck (~69% height)
  ctx.bezierCurveTo(-r * 0.48, -h * 0.62, -r * 0.27, -h * 0.66, -r * 0.27, -h * 0.74);
  // Flare out into classic round pin head (~86% height) and crown (100%)
  ctx.bezierCurveTo(-r * 0.27, -h * 0.81, -r * 0.43, -h * 0.85, -r * 0.42, -h * 0.91);
  ctx.bezierCurveTo(-r * 0.40, -h * 0.98, -r * 0.20, -h, 0, -h);
  ctx.bezierCurveTo(r * 0.20, -h, r * 0.40, -h * 0.98, r * 0.42, -h * 0.91);
  ctx.bezierCurveTo(r * 0.43, -h * 0.85, r * 0.27, -h * 0.81, r * 0.27, -h * 0.74);
  // Right slender neck down to belly and base
  ctx.bezierCurveTo(r * 0.27, -h * 0.66, r * 0.48, -h * 0.62, r * 0.72, -h * 0.50);
  ctx.bezierCurveTo(r * 0.96, -h * 0.34, r * 0.88, -h * 0.14, r * 0.44, 0);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(-r * 0.9, 0, r * 0.9, 0);
  bodyGrad.addColorStop(0, '#f4efe4');
  bodyGrad.addColorStop(0.28, ALLEY_PALETTE.pinBody);
  bodyGrad.addColorStop(0.68, '#f7f3ea');
  bodyGrad.addColorStop(1, '#d8d0c1');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Clip stripes & glossy highlight cleanly inside the pin silhouette
  ctx.save();
  ctx.clip();

  // Two traditional curved red neck bands
  ctx.strokeStyle = ALLEY_PALETTE.pinStripe;
  ctx.lineWidth = Math.max(1.5, h * 0.045);
  for (const bandY of [-h * 0.68, -h * 0.755]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, bandY - r * 0.04);
    ctx.quadraticCurveTo(0, bandY + r * 0.12, r * 0.5, bandY - r * 0.04);
    ctx.stroke();
  }

  // Subtle lacquered specular highlight along left side of belly & head
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -h * 0.33, r * 0.16, h * 0.16, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-r * 0.14, -h * 0.90, r * 0.09, h * 0.045, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Crisp subtle outer contour
  ctx.strokeStyle = 'rgba(72, 56, 40, 0.32)';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();

  ctx.restore();
}

function drawBall(ctx, ball, geo) {
  if (!ball.active) return;
  const p = laneToScreen(ball.x, ball.y, geo);
  const r = Math.max(10, ball.radius * p.scale);

  ctx.save();
  ctx.translate(p.sx, p.sy);

  // Soft shadow on the lane
  ctx.fillStyle = 'rgba(20, 16, 12, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.98, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball sphere (classic yellow bowling ball)
  const grad = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.12, 0, 0, r);
  grad.addColorStop(0, ALLEY_PALETTE.ballSwirl);
  grad.addColorStop(0.55, ALLEY_PALETTE.ballPrimary);
  grad.addColorStop(1, ALLEY_PALETTE.ballDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, -r * 0.35, r, 0, Math.PI * 2);
  ctx.fill();

  // Rotating 3 finger holes (visual roll feedback)
  const spin = ball.spinAngle || 0;
  const holeOffsetY = Math.sin(spin) * r * 0.36;
  const holeScale = Math.cos(spin);
  if (holeScale > -0.25) {
    ctx.save();
    ctx.translate(0, -r * 0.35 + holeOffsetY);
    ctx.globalAlpha = Math.max(0.2, Math.min(1, (holeScale + 0.25) * 0.95));
    ctx.fillStyle = ALLEY_PALETTE.ballHole;
    const hr = Math.max(2, r * 0.13);
    for (const [hx, hy] of [
      [-r * 0.18, -r * 0.16],
      [r * 0.16, -r * 0.12],
      [0, r * 0.15],
    ]) {
      ctx.beginPath();
      ctx.arc(hx, hy * Math.max(0.35, Math.abs(holeScale)), hr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Glossy specular highlight
  ctx.fillStyle = ALLEY_PALETTE.ballHighlight;
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.72, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAimGuide(ctx, state, geo, dragGuide) {
  if (!dragGuide || !dragGuide.active || state.phase !== 'playing' || state.rollPhase !== 'aiming') return;
  const { ball } = state;
  const vx = dragGuide.aimVx || 0;
  const vy = dragGuide.aimVy || -5.5;
  const speed = Math.hypot(vx, vy) || 1;
  const dx = vx / speed;
  const dy = Math.min(-0.4, vy / speed);

  // Dotted trajectory preview (including 1 bumper bounce!)
  let cx = ball.x;
  let cy = ball.y;
  let dirX = dx;
  const dirY = dy;
  const stepDist = 0.32;

  ctx.save();
  for (let i = 1; i <= 14; i++) {
    cx += dirX * stepDist;
    cy += dirY * stepDist;
    if (cx < -BALL_MAX_X) {
      cx = -BALL_MAX_X + (-BALL_MAX_X - cx);
      dirX = -dirX;
    } else if (cx > BALL_MAX_X) {
      cx = BALL_MAX_X - (cx - BALL_MAX_X);
      dirX = -dirX;
    }
    if (cy < 1.2) break;
    const pt = laneToScreen(cx, cy, geo);
    const alpha = Math.max(0.15, 0.85 - i * 0.05);
    const dotR = Math.max(2.5, (7.5 - i * 0.28) * (pt.scale / 180 + 0.45));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPopupsAndConfetti(ctx, state, geo, confetti) {
  if (state.popups && state.popups.length) {
    for (const pop of state.popups) {
      const pt = laneToScreen(pop.x, pop.y, geo);
      const alpha = Math.max(0, 1 - pop.age / 1.1);
      const rise = pop.age * 46;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 22px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeText(pop.text, pt.sx, pt.sy - rise);
      ctx.fillStyle = pop.accent || '#ff6b57';
      ctx.fillText(pop.text, pt.sx, pt.sy - rise);
      ctx.restore();
    }
  }

  if (confetti && confetti.particles.length) {
    for (const p of confetti.particles) {
      if (!p.initialized) continue;
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
      ctx.restore();
    }
  }
}

export function renderGame(ctx, state, width, height, dragGuide = null, confetti = null) {
  ctx.clearRect(0, 0, width, height);
  const geo = getLaneGeometry(width, height);

  drawBackdrop(ctx, geo);
  drawLaneSurface(ctx, geo, state);
  drawBumperRail(ctx, geo, 'left', state.bumpers?.left);
  drawBumperRail(ctx, geo, 'right', state.bumpers?.right);
  drawAimGuide(ctx, state, geo, dragGuide);

  // Depth-sort pins + ball back-to-front (smaller y = farther away)
  const drawables = [];
  for (const pin of state.pins) {
    if (!pin.cleared) drawables.push({ kind: 'pin', y: pin.y, item: pin });
  }
  if (state.ball && state.ball.active) {
    drawables.push({ kind: 'ball', y: state.ball.y, item: state.ball });
  }
  drawables.sort((a, b) => a.y - b.y);

  for (const d of drawables) {
    if (d.kind === 'pin') drawPin(ctx, d.item, geo);
    else drawBall(ctx, d.item, geo);
  }

  drawPopupsAndConfetti(ctx, state, geo, confetti);
}
