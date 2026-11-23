/**
 * Track A (Codex) owns this file — see SPECKIT_CONTRACT.md for the full specification.
 */
import {
  APPROACH_MAX_Y,
  APPROACH_MIN_Y,
  APPROACH_START_Y,
  BALL_MAX_X,
  BALL_RADIUS,
  BALL_FRICTION,
  BUMPER_RESTITUTION,
  DEFAULT_LAUNCH_SPEED,
  FOUL_LINE_Y,
  LANE_HALF_WIDTH,
  MAX_LAUNCH_ANGLE_RAD,
  MAX_LAUNCH_SPEED,
  MIN_FORWARD_SPEED,
  MIN_LAUNCH_SPEED,
  PIN_COLLISION_BOOST,
  PIN_DECK_BACK_Y,
  PIN_FRICTION,
  PIN_KNOCKDOWN_SPEED,
  PIN_LAYOUT,
  PIN_RADIUS,
  RESET_DURATION,
  SETTLE_DURATION,
  TOTAL_FRAMES,
} from './catalog.js';

const MAX_STEP = 0.05;
const SUBSTEP = MAX_STEP / 4;
const FALL_DURATION = 0.32;
const TINY_LAUNCH_SPEED = 0.1;
const PIN_BUMPER_RESTITUTION = 0.65;
const BANNER_DURATION = 1.6;
const TURKEY_BANNER_DURATION = 2.4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createBall() {
  return {
    x: 0,
    y: APPROACH_START_Y,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    spinAngle: 0,
    rollDistance: 0,
    active: true,
  };
}

function createPinRack() {
  return PIN_LAYOUT.map((p) => ({
    id: p.id,
    row: p.row,
    col: p.col,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    radius: PIN_RADIUS,
    standing: true,
    falling: false,
    fallProgress: 0,
    angle: 0,
    spinVel: 0,
    cleared: false,
  }));
}

export function createGame({ seed = 20261121 } = {}) {
  return {
    phase: 'ready',
    rollPhase: 'aiming',
    seed,
    elapsed: 0,
    ball: createBall(),
    pins: createPinRack(),
    bumpers: {
      left: { hitTimer: 0, hitY: FOUL_LINE_Y * 0.5 },
      right: { hitTimer: 0, hitY: FOUL_LINE_Y * 0.5 },
    },
    frames: Array.from({ length: TOTAL_FRAMES }, () => ({
      rolls: [],
      cumulativeScore: null,
      isStrike: false,
      isSpare: false,
    })),
    currentFrame: 0,
    currentRoll: 0,
    totalScore: 0,
    strikeStreak: 0,
    standingAtRollStart: 10,
    settleTimer: 0,
    resetTimer: 0,
    banner: null,
  };
}

export function startGame(state) {
  if (state.phase === 'finished') Object.assign(state, createGame({ seed: state.seed }));
  if (state.phase === 'ready') state.phase = 'playing';
}

export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
}

export function moveBallInApproach(state, x, y) {
  if (state.phase !== 'playing' || state.rollPhase !== 'aiming') return;
  if (!Number.isNaN(Number(x))) state.ball.x = clamp(x, -BALL_MAX_X, BALL_MAX_X);
  if (!Number.isNaN(Number(y))) state.ball.y = clamp(y, APPROACH_MIN_Y, APPROACH_MAX_Y);
}

export function launchBall(state, vx, vy) {
  if (state.phase !== 'playing' || state.rollPhase !== 'aiming') return false;
  const inputSpeed = Math.hypot(vx, vy);
  const useDefault = vy >= 0 || !Number.isFinite(inputSpeed) || inputSpeed < TINY_LAUNCH_SPEED;
  const speed = useDefault ? DEFAULT_LAUNCH_SPEED : clamp(inputSpeed, MIN_LAUNCH_SPEED, MAX_LAUNCH_SPEED);
  const angle = useDefault ? 0 : clamp(Math.atan2(vx, -vy), -MAX_LAUNCH_ANGLE_RAD, MAX_LAUNCH_ANGLE_RAD);
  state.ball.vx = speed * Math.sin(angle);
  state.ball.vy = -speed * Math.cos(angle);
  state.standingAtRollStart = countStanding(state);
  state.banner = null;
  state.rollPhase = 'rolling';
  return true;
}

function countStanding(state) {
  return state.pins.filter((pin) => pin.standing && !pin.cleared).length;
}

function moveBall(state, dt, events) {
  const { ball } = state;
  const drag = Math.exp(-BALL_FRICTION * dt);
  ball.vx *= drag;
  ball.vy = Math.min(ball.vy * drag, -MIN_FORWARD_SPEED);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const distance = Math.hypot(ball.vx, ball.vy) * dt;
  ball.rollDistance += distance;
  ball.spinAngle += distance / ball.radius;

  const limit = LANE_HALF_WIDTH - ball.radius;
  if (Math.abs(ball.x) <= limit) return;
  const side = ball.x < 0 ? 'left' : 'right';
  const intensity = Math.min(1, Math.abs(ball.vx) / MAX_LAUNCH_SPEED);
  ball.x = clamp(ball.x, -limit, limit);
  ball.vx *= -BUMPER_RESTITUTION;
  Object.assign(state.bumpers[side], { hitTimer: 0.38, hitY: ball.y });
  events.bumperHits.push({ side, y: ball.y, intensity });
}

function knockPin(pin, events) {
  if (!pin.standing) return;
  pin.standing = false;
  pin.falling = true;
  pin.angle = Math.atan2(pin.vx, -pin.vy);
  pin.spinVel = clamp(pin.vx * 4, -12, 12);
  events.pinsKnocked.push(pin.id);
}

function collide(first, second, firstIsBall, events) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const radius = first.radius + second.radius;
  const distance = Math.hypot(dx, dy);
  if (distance > radius) return;

  const nx = distance === 0 ? 0 : dx / distance;
  const ny = distance === 0 ? -1 : dy / distance;
  // Use a heavier ball, and transfer most of the impact to the pins.
  const inverseMass = firstIsBall ? 0.2 : 1;
  const separation = (radius - distance) / (inverseMass + 1);
  if (!firstIsBall) {
    first.x -= nx * separation;
    first.y -= ny * separation;
  }
  const push = firstIsBall ? radius - distance : separation;
  second.x += nx * push;
  second.y += ny * push;

  const closingSpeed = (first.vx - second.vx) * nx + (first.vy - second.vy) * ny;
  if (closingSpeed <= 0) return;
  const impulse = 2 * closingSpeed / (inverseMass + 1);
  first.vx -= nx * impulse * inverseMass;
  first.vy -= ny * impulse * inverseMass;
  second.vx += nx * impulse * PIN_COLLISION_BOOST;
  second.vy += ny * impulse * PIN_COLLISION_BOOST;

  events.pinHits.push({
    pinId: second.id,
    x: second.x,
    y: second.y,
    intensity: Math.min(1, closingSpeed / MAX_LAUNCH_SPEED),
  });
  if (firstIsBall) {
    first.vy = Math.min(first.vy, -MIN_FORWARD_SPEED);
  } else if (Math.hypot(first.vx, first.vy) >= PIN_KNOCKDOWN_SPEED) {
    knockPin(first, events);
  }
  if (firstIsBall || Math.hypot(second.vx, second.vy) >= PIN_KNOCKDOWN_SPEED) {
    knockPin(second, events);
  }
}

function containPin(pin, events) {
  const limit = LANE_HALF_WIDTH - pin.radius;
  if (Math.abs(pin.x) > limit) {
    const side = Math.sign(pin.x);
    pin.x = side * limit;
    if (pin.vx * side > 0) pin.vx *= -PIN_BUMPER_RESTITUTION;
  }
  if (pin.y < PIN_DECK_BACK_Y - pin.radius) {
    knockPin(pin, events);
    pin.cleared = true;
    pin.vx = 0;
    pin.vy = 0;
    pin.spinVel = 0;
  }
}

function movePins(state, dt, events) {
  const pins = state.pins.filter((pin) => !pin.cleared);
  const drag = Math.exp(-PIN_FRICTION * dt);
  for (const pin of pins) {
    pin.x += pin.vx * dt;
    pin.y += pin.vy * dt;
    pin.vx *= drag;
    pin.vy *= drag;
    if (pin.falling) {
      pin.fallProgress = Math.min(1, pin.fallProgress + dt / FALL_DURATION);
      pin.angle += pin.spinVel * dt;
      pin.spinVel *= drag;
    }
    containPin(pin, events);
  }
  for (let i = 0; i < pins.length; i++) {
    if (pins[i].cleared) continue;
    if (state.ball.active) collide(state.ball, pins[i], true, events);
    for (let j = i + 1; j < pins.length; j++) {
      if (!pins[j].cleared && (!pins[i].standing || !pins[j].standing)) {
        collide(pins[i], pins[j], false, events);
      }
    }
  }
  for (const pin of pins) {
    if (!pin.cleared) containPin(pin, events);
  }
}

function updateScores(state) {
  let total = 0;
  for (const [index, frame] of state.frames.entries()) {
    const { rolls, isStrike, isSpare } = frame;
    const lastFrame = index === TOTAL_FRAMES - 1;
    if (lastFrame) {
      if (rolls.length < (isStrike || isSpare ? 3 : 2)) break;
      total += rolls.reduce((sum, pins) => sum + pins, 0);
    } else if (isStrike || isSpare) {
      const bonusCount = isStrike ? 2 : 1;
      const bonusRolls = state.frames.slice(index + 1).flatMap((next) => next.rolls).slice(0, bonusCount);
      if (bonusRolls.length < bonusCount) break;
      total += 10 + bonusRolls.reduce((sum, pins) => sum + pins, 0);
    } else {
      if (rolls.length < 2) break;
      total += rolls[0] + rolls[1];
    }
    frame.cumulativeScore = total;
  }
  state.totalScore = total;
}

function scoreRoll(state, events) {
  const { currentFrame: frameIndex, currentRoll: rollIndex, standingAtRollStart } = state;
  const frame = state.frames[frameIndex];
  const pinsThisRoll = standingAtRollStart - countStanding(state);
  const previousRoll = frame.rolls.at(-1);
  const freshRack = rollIndex === 0 || previousRoll === 10 || (rollIndex === 2 && frame.isSpare);
  const isStrike = freshRack && pinsThisRoll === 10;
  const isSpare = !freshRack && countStanding(state) === 0;
  const nextStreak = isStrike ? (state.strikeStreak || 0) + 1 : 0;
  const isTurkey = isStrike && nextStreak === 3;
  state.strikeStreak = isTurkey ? 0 : nextStreak;
  frame.rolls.push(pinsThisRoll);
  if (rollIndex === 0) frame.isStrike = isStrike;
  if (rollIndex === 1 && !frame.isStrike) frame.isSpare = isSpare;
  updateScores(state);
  events.rollComplete = {
    frameIndex,
    rollIndex,
    pinsThisRoll,
    isStrike,
    isSpare,
    isTurkey,
    strikeStreak: nextStreak,
  };
  state.banner = {
    text: isTurkey ? 'TURKEY!' : isStrike ? 'Strike!' : isSpare ? 'Spare!' : pinsThisRoll ? 'Nice roll!' : 'Keep rolling!',
    subtext: isTurkey
      ? `${nextStreak} strikes in a row!`
      : pinsThisRoll === 1
        ? '1 pin down'
        : `${pinsThisRoll} pins down`,
    kind: isTurkey ? 'turkey' : isStrike ? 'strike' : isSpare ? 'spare' : 'roll',
    age: 0,
  };
  state.rollPhase = 'resetting';
  state.resetTimer = RESET_DURATION;
}

function prepareNextRoll(state, events) {
  const { currentFrame: frameIndex, currentRoll: rollIndex } = state;
  const frame = state.frames[frameIndex];
  const lastFrame = frameIndex === TOTAL_FRAMES - 1;
  const rollsNeeded = lastFrame ? (frame.isStrike || frame.isSpare ? 3 : 2) : (frame.isStrike ? 1 : 2);
  const frameDone = frame.rolls.length === rollsNeeded;
  if (frameDone) {
    events.frameComplete = { frameIndex };
    if (lastFrame) {
      state.phase = 'finished';
      state.banner = { text: 'Great game!', subtext: `Score: ${state.totalScore}`, age: 0 };
      events.gameComplete = { totalScore: state.totalScore };
      return;
    }
    state.currentFrame++;
    state.currentRoll = 0;
  } else {
    state.currentRoll++;
  }

  // Fill balls use the remaining pins unless the previous roll cleared the rack.
  if (frameDone || countStanding(state) === 0) {
    state.pins = createPinRack();
  } else {
    for (const pin of state.pins) {
      pin.cleared = !pin.standing;
      pin.vx = 0;
      pin.vy = 0;
    }
  }
  state.ball = createBall();
  state.standingAtRollStart = countStanding(state);
  state.rollPhase = 'aiming';
}

export function stepGame(state, dt) {
  const events = {
    bumperHits: [],
    pinHits: [],
    pinsKnocked: [],
    rollComplete: null,
    frameComplete: null,
    gameComplete: null,
  };
  if (state.phase !== 'playing') return events;
  let remaining = clamp(dt, 0, MAX_STEP);
  while (remaining > 1e-9 && state.phase === 'playing') {
    const timer = state.rollPhase === 'settling' ? 'settleTimer'
      : state.rollPhase === 'resetting' ? 'resetTimer' : null;
    const step = Math.min(remaining, SUBSTEP, timer ? state[timer] : Infinity);
    remaining -= step;
    state.elapsed += step;
    if (state.banner) {
      state.banner.age += step;
      const maxAge = state.banner.kind === 'turkey' ? TURKEY_BANNER_DURATION : BANNER_DURATION;
      if (state.banner.age >= maxAge) state.banner = null;
    }
    for (const bumper of Object.values(state.bumpers)) {
      bumper.hitTimer = Math.max(0, bumper.hitTimer - step);
    }

    if (state.rollPhase === 'rolling') {
      moveBall(state, step, events);
      movePins(state, step, events);
      if (state.ball.y < PIN_DECK_BACK_Y - state.ball.radius) {
        state.ball.active = false;
        state.rollPhase = 'settling';
        state.settleTimer = SETTLE_DURATION;
      }
    } else if (timer) {
      if (timer === 'settleTimer') movePins(state, step, events);
      state[timer] = Math.max(0, state[timer] - step);
      if (state[timer] < 1e-9) {
        state[timer] = 0;
        if (timer === 'settleTimer') scoreRoll(state, events);
        else prepareNextRoll(state, events);
      }
    }
  }
  return events;
}
