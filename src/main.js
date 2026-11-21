import {
  APPROACH_MIN_Y,
  BALL_MAX_X,
  DEFAULT_LAUNCH_SPEED,
  FOUL_LINE_Y,
  TOTAL_FRAMES,
} from './catalog.js';
import {
  createGame,
  startGame,
  togglePause,
  moveBallInApproach,
  launchBall,
  stepGame,
} from './engine.js';
import {
  createConfettiSystem,
  getLaneGeometry,
  laneToScreen,
  renderGame,
  screenToApproach,
  spawnConfetti,
  stepConfetti,
} from './render.js';
import {
  playBumperBounce,
  playGameFinish,
  playPinHit,
  playRollStart,
  playSpare,
  playStrike,
  playTurkey,
} from './audio.js';

const BEST_SCORE_KEY = 'bouncy-bowling-best-v1';
const LEVIS_GAMES_URL = 'https://sofakodev.github.io/levis-games/';
const $ = (sel) => document.querySelector(sel);

function readBest() {
  try {
    const val = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

function writeBest(score) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Ignore storage errors
  }
}

function formatRollSymbol(frame, frameIdx, rollIdx) {
  const val = frame.rolls[rollIdx];
  if (val === undefined) return '';
  if (frameIdx < 9) {
    if (rollIdx === 0 && val === 10) return 'X';
    if (rollIdx === 1 && frame.rolls[0] + val === 10) return '/';
    return val === 0 ? '–' : String(val);
  }
  // 10th frame formatting
  if (val === 10) return 'X';
  if (rollIdx === 1 && frame.rolls[0] < 10 && frame.rolls[0] + val === 10) return '/';
  if (rollIdx === 2 && frame.rolls[1] < 10 && frame.rolls[1] + val === 10 && frame.rolls[0] === 10) return '/';
  return val === 0 ? '–' : String(val);
}

document.querySelector('#app').innerHTML = `
  <main class="bowling-app">
    <canvas id="game-canvas" aria-label="Bouncy Bowling alley"></canvas>

    <header class="hud" id="hud" hidden>
      <div class="scoreboard" id="scoreboard" aria-label="10-frame bowling scoreboard">
        ${Array.from({ length: TOTAL_FRAMES }, (_, i) => `
          <div class="frame-cell" data-frame="${i}">
            <div class="frame-num">${i + 1}</div>
            <div class="frame-rolls" id="frame-rolls-${i}"></div>
            <div class="frame-total" id="frame-total-${i}"></div>
          </div>
        `).join('')}
      </div>
      <div class="hud-actions">
        <a id="btn-home" href="${LEVIS_GAMES_URL}" aria-label="Back to Levi's Games" title="Back to Levi's Games">🏠</a>
        <button id="btn-sound" type="button" aria-pressed="true" aria-label="Toggle sound">🔊</button>
        <button id="btn-pause" type="button" aria-label="Pause">⏸</button>
      </div>
    </header>

    <div id="celebration-banner" class="celebration-banner" role="status" hidden>
      <div id="banner-turkey" class="banner-turkey" aria-hidden="true" hidden>
        <svg viewBox="0 0 180 150" width="150" height="125" xmlns="http://www.w3.org/2000/svg">
          <!-- Colorful fanned tail feathers -->
          <g stroke="#5c2c16" stroke-width="2.5">
            <ellipse cx="90" cy="48" rx="14" ry="40" fill="#f7b731" transform="rotate(-56 90 95)" />
            <ellipse cx="90" cy="44" rx="14" ry="42" fill="#eb3b5a" transform="rotate(-38 90 95)" />
            <ellipse cx="90" cy="42" rx="14" ry="44" fill="#fa8231" transform="rotate(-19 90 95)" />
            <ellipse cx="90" cy="40" rx="15" ry="46" fill="#20bf6b" />
            <ellipse cx="90" cy="42" rx="14" ry="44" fill="#fa8231" transform="rotate(19 90 95)" />
            <ellipse cx="90" cy="44" rx="14" ry="42" fill="#eb3b5a" transform="rotate(38 90 95)" />
            <ellipse cx="90" cy="48" rx="14" ry="40" fill="#f7b731" transform="rotate(56 90 95)" />
          </g>
          <!-- Little orange feet -->
          <path d="M74 126 L68 142 M74 126 L75 143 M74 126 L81 141" stroke="#f79f1f" stroke-width="4.5" stroke-linecap="round" />
          <path d="M106 126 L99 141 M106 126 L105 143 M106 126 L112 142" stroke="#f79f1f" stroke-width="4.5" stroke-linecap="round" />
          <!-- Plump brown turkey body -->
          <ellipse cx="90" cy="98" rx="38" ry="33" fill="#8b4c26" stroke="#5c2c16" stroke-width="3" />
          <ellipse cx="90" cy="105" rx="24" ry="19" fill="#a86438" />
          <!-- Cute wings -->
          <ellipse cx="52" cy="96" rx="12" ry="20" fill="#733c1b" stroke="#5c2c16" stroke-width="2.5" transform="rotate(18 52 96)" />
          <ellipse cx="128" cy="96" rx="12" ry="20" fill="#733c1b" stroke="#5c2c16" stroke-width="2.5" transform="rotate(-18 128 96)" />
          <!-- Head -->
          <circle cx="90" cy="64" r="22" fill="#8b4c26" stroke="#5c2c16" stroke-width="3" />
          <!-- Big friendly eyes -->
          <circle cx="81" cy="60" r="6.5" fill="#fff" />
          <circle cx="99" cy="60" r="6.5" fill="#fff" />
          <circle cx="82.5" cy="60" r="3.4" fill="#1e272e" />
          <circle cx="100.5" cy="60" r="3.4" fill="#1e272e" />
          <circle cx="83.8" cy="58.5" r="1.2" fill="#fff" />
          <circle cx="101.8" cy="58.5" r="1.2" fill="#fff" />
          <!-- Red wattle / snood -->
          <path d="M92 73 C99 76 101 86 94 89 C89 91 87 84 89 77 Z" fill="#eb3b5a" stroke="#9e1b32" stroke-width="1.8" />
          <!-- Yellow beak -->
          <polygon points="83,68 97,68 90,80" fill="#fed330" stroke="#c28e0e" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </div>
      <strong id="banner-title"></strong>
      <small id="banner-sub"></small>
    </div>

    <section id="overlay-start" class="overlay">
      <div class="card">
        <div class="logo-ball" aria-hidden="true"></div>
        <p class="kicker">BOUNCY BUMPER BOWLING</p>
        <h1>Bouncy Bowling</h1>
        <p class="subtitle">10 frames of bouncy-bumper fun! Drag the ball at the bottom and flick up to knock down the pins.</p>
        <div class="stack-buttons">
          <button id="btn-play" class="btn-primary" type="button">Bowl!</button>
          <a class="btn-ghost" href="${LEVIS_GAMES_URL}">← Back to Levi's Games</a>
        </div>
        <p class="controls-hint" id="start-best-hint">Drag in the bottom area (behind the red line) and flick up — or use Left/Right + Space.</p>
      </div>
    </section>

    <section id="overlay-pause" class="overlay" hidden>
      <div class="card">
        <h2>Paused</h2>
        <p class="subtitle">Take a breather — the pins are waiting!</p>
        <div class="stack-buttons">
          <button id="btn-resume" class="btn-primary" type="button">Keep Bowling</button>
          <button id="btn-restart-pause" class="btn-secondary" type="button">New Game</button>
          <a class="btn-ghost" href="${LEVIS_GAMES_URL}">← Back to Levi's Games</a>
        </div>
      </div>
    </section>

    <section id="overlay-finish" class="overlay" hidden>
      <div class="card">
        <p class="kicker" id="finish-kicker">ALL 10 FRAMES DONE!</p>
        <h2 id="finish-title">Great Bowling!</h2>
        <strong id="finish-score" class="big-score">0</strong>
        <p id="finish-summary" class="subtitle"></p>
        <div class="stack-buttons">
          <button id="btn-play-again" class="btn-primary" type="button">Play Again</button>
          <a class="btn-ghost" href="${LEVIS_GAMES_URL}">← Back to Levi's Games</a>
        </div>
      </div>
    </section>
  </main>
`;

const canvas = $('#game-canvas');
const ctx = canvas.getContext('2d');

let state = createGame();
const confetti = createConfettiSystem();
let soundEnabled = true;
let width = window.innerWidth;
let height = window.innerHeight;
let lastTime = 0;
let rafId = 0;

// Approach-zone pointer drag & flick state
const drag = {
  active: false,
  pointerId: null,
  samples: [], // { x, y, sx, sy, t }
  aimVx: 0,
  aimVy: -DEFAULT_LAUNCH_SPEED,
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderGame(ctx, state, width, height, drag, confetti);
}

window.addEventListener('resize', resize);

function computeFlickVelocity() {
  const samples = drag.samples;
  if (samples.length < 2) {
    return { shouldLaunch: false, vx: 0, vy: -DEFAULT_LAUNCH_SPEED };
  }
  const latest = samples[samples.length - 1];
  // Look back ~110ms for a smooth, responsive flick vector
  let ref = samples[0];
  for (let i = samples.length - 2; i >= 0; i--) {
    ref = samples[i];
    if (latest.t - ref.t >= 0.08) break;
  }
  const dt = Math.max(0.016, latest.t - ref.t);
  const dx = latest.x - ref.x;
  const dy = latest.y - ref.y;
  const screenUpwardPx = ref.sy - latest.sy;

  // Scale logical approach drag velocity into satisfying lane launch velocity
  const rawVx = (dx / dt) * 1.15;
  const rawVy = (dy / dt) * 1.35;

  // Only launch if the player intentionally flicked/pushed upward.
  // Lifting a finger after sideways repositioning leaves the ball right there!
  const isUpwardFlick = rawVy < -1.15 && screenUpwardPx > 14;
  return {
    shouldLaunch: isUpwardFlick,
    vx: rawVx,
    vy: isUpwardFlick ? rawVy : -DEFAULT_LAUNCH_SPEED,
  };
}

function triggerLaunch(vx, vy) {
  const launched = launchBall(state, vx, vy);
  if (launched) {
    playRollStart(soundEnabled);
  }
  drag.active = false;
  drag.pointerId = null;
  drag.samples = [];
}

function isInApproachScreenZone(sy, geo) {
  const foulScreenY = laneToScreen(0, FOUL_LINE_Y, geo).sy;
  // Generous touch area starting slightly above the foul line so kids never miss the grab
  return sy >= foulScreenY - 32;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.phase !== 'playing' || state.rollPhase !== 'aiming') return;
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const geo = getLaneGeometry(width, height);
  if (!isInApproachScreenZone(sy, geo)) return;

  canvas.setPointerCapture(e.pointerId);
  const pos = screenToApproach(sx, sy, geo);
  moveBallInApproach(state, pos.x, pos.y);

  drag.active = true;
  drag.pointerId = e.pointerId;
  drag.samples = [{ x: pos.x, y: pos.y, sx, sy, t: performance.now() / 1000 }];
  drag.aimVx = 0;
  drag.aimVy = -DEFAULT_LAUNCH_SPEED;
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag.active || e.pointerId !== drag.pointerId) return;
  if (state.phase !== 'playing' || state.rollPhase !== 'aiming') return;

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const geo = getLaneGeometry(width, height);
  const pos = screenToApproach(sx, sy, geo);

  // Ball stays strictly behind the lane/foul line while dragging
  moveBallInApproach(state, pos.x, pos.y);

  const now = performance.now() / 1000;
  drag.samples.push({ x: pos.x, y: pos.y, sx, sy, t: now });
  if (drag.samples.length > 10) drag.samples.shift();

  const vel = computeFlickVelocity();
  drag.aimVx = vel.vx;
  drag.aimVy = vel.vy;

  // If the player pushes swiftly right up to the foul line, auto-launch cleanly
  const foulScreenY = laneToScreen(0, FOUL_LINE_Y, geo).sy;
  if (sy <= foulScreenY + 4 && vel.vy < -2.2 && pos.y <= APPROACH_MIN_Y + 0.05) {
    triggerLaunch(vel.vx, vel.vy);
  }
});

function handlePointerEnd(e) {
  if (!drag.active || e.pointerId !== drag.pointerId) return;
  const vel = computeFlickVelocity();
  if (vel.shouldLaunch) {
    triggerLaunch(vel.vx, vel.vy);
  } else {
    // Repositioned without flicking up -> keep ball where they placed it!
    drag.active = false;
    drag.pointerId = null;
    drag.samples = [];
  }
}

canvas.addEventListener('pointerup', handlePointerEnd);
canvas.addEventListener('pointercancel', () => {
  drag.active = false;
  drag.pointerId = null;
  drag.samples = [];
});

// Keyboard fallback for desktop testing
window.addEventListener('keydown', (e) => {
  if (state.phase !== 'playing' || state.rollPhase !== 'aiming') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    moveBallInApproach(state, Math.max(-BALL_MAX_X, state.ball.x - 0.14), state.ball.y);
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    moveBallInApproach(state, Math.min(BALL_MAX_X, state.ball.x + 0.14), state.ball.y);
  } else if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    triggerLaunch(0, -DEFAULT_LAUNCH_SPEED);
  }
});

function syncUi() {
  const best = readBest();
  if (best > 0) {
    $('#start-best-hint').textContent = `Best Score: ${best} · Drag at the bottom & flick up to roll!`;
  }

  $('#hud').hidden = state.phase === 'ready';
  $('#overlay-start').hidden = state.phase !== 'ready';
  $('#overlay-pause').hidden = state.phase !== 'paused';
  $('#overlay-finish').hidden = state.phase !== 'finished';

  // Sync 10-frame scoreboard
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const frame = state.frames[i];
    const cell = document.querySelector(`.frame-cell[data-frame="${i}"]`);
    if (cell) {
      cell.classList.toggle('active', state.phase === 'playing' && i === state.currentFrame);
    }
    const rollsEl = $(`#frame-rolls-${i}`);
    if (rollsEl && frame) {
      const slots = i === 9 ? 3 : 2;
      let html = '';
      for (let r = 0; r < slots; r++) {
        const sym = formatRollSymbol(frame, i, r);
        const cls = sym === 'X' ? ' class="strike"' : sym === '/' ? ' class="spare"' : '';
        html += `<span${cls}>${sym}</span>`;
      }
      rollsEl.innerHTML = html;
    }
    const totalEl = $(`#frame-total-${i}`);
    if (totalEl && frame) {
      totalEl.textContent = frame.cumulativeScore !== null ? String(frame.cumulativeScore) : '';
    }
  }

  // Sync celebration banner (including big TURKEY! on 3+ strikes in a row)
  const bannerEl = $('#celebration-banner');
  const turkeyEl = $('#banner-turkey');
  if (state.banner) {
    const isTurkey = state.banner.kind === 'turkey';
    bannerEl.hidden = false;
    bannerEl.classList.toggle('is-turkey', isTurkey);
    if (turkeyEl) turkeyEl.hidden = !isTurkey;
    $('#banner-title').textContent = state.banner.text;
    $('#banner-sub').textContent = state.banner.subtext || '';
  } else {
    bannerEl.hidden = true;
    bannerEl.classList.remove('is-turkey');
    if (turkeyEl) turkeyEl.hidden = true;
  }

  if (state.phase === 'finished') {
    let isNewBest = false;
    if (state.totalScore > best) {
      writeBest(state.totalScore);
      isNewBest = true;
    }
    $('#finish-kicker').textContent = isNewBest ? 'NEW HIGH SCORE!' : 'ALL 10 FRAMES DONE!';
    $('#finish-title').textContent = state.totalScore >= 150 ? 'Bowling Superstar!' : 'Great Bowling!';
    $('#finish-score').textContent = String(state.totalScore);
    $('#finish-summary').textContent = `You bowled all 10 frames and scored ${state.totalScore} points!`;
  }
}

function scheduleLoop() {
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  lastTime = 0;
}

function loop(now) {
  rafId = 0;
  const dt = lastTime ? (now - lastTime) / 1000 : 0.016;
  lastTime = now;

  if (state.phase === 'playing') {
    const events = stepGame(state, dt);

    if (events.bumperHits?.length) {
      const strongest = Math.max(...events.bumperHits.map((b) => b.intensity || 1));
      playBumperBounce(strongest, soundEnabled);
    }
    if (events.pinHits?.length) {
      const strongest = Math.max(...events.pinHits.map((p) => p.intensity || 1));
      playPinHit(strongest, soundEnabled);
    }
    if (events.rollComplete) {
      if (events.rollComplete.isTurkey) {
        playTurkey(soundEnabled);
        spawnConfetti(confetti, 90, 0.5, 0.28);
      } else if (events.rollComplete.isStrike) {
        playStrike(soundEnabled);
        spawnConfetti(confetti, 55, 0.5, 0.28);
      } else if (events.rollComplete.isSpare) {
        playSpare(soundEnabled);
        spawnConfetti(confetti, 36, 0.5, 0.3);
      }
    }
    if (events.gameComplete) {
      playGameFinish(soundEnabled);
      spawnConfetti(confetti, 70, 0.5, 0.32);
    }
    syncUi();
  }

  stepConfetti(confetti, dt, width, height);
  renderGame(ctx, state, width, height, drag, confetti);

  if (state.phase === 'playing' || confetti.particles.length > 0) {
    scheduleLoop();
  } else {
    lastTime = 0;
  }
}

function beginNewGame() {
  state = createGame({ seed: Math.floor(Math.random() * 1_000_000) });
  startGame(state);
  drag.active = false;
  drag.samples = [];
  syncUi();
  scheduleLoop();
}

$('#btn-play').onclick = beginNewGame;
$('#btn-play-again').onclick = beginNewGame;
$('#btn-restart-pause').onclick = beginNewGame;

$('#btn-pause').onclick = () => {
  togglePause(state);
  syncUi();
  if (state.phase === 'playing') scheduleLoop();
  else stopLoop();
};

$('#btn-resume').onclick = () => {
  if (state.phase === 'paused') togglePause(state);
  syncUi();
  scheduleLoop();
};

$('#btn-sound').onclick = () => {
  soundEnabled = !soundEnabled;
  $('#btn-sound').textContent = soundEnabled ? '🔊' : '🔇';
  $('#btn-sound').setAttribute('aria-pressed', String(soundEnabled));
};

resize();
syncUi();
