import { describe, expect, it } from 'vitest';
import {
  APPROACH_MAX_Y, APPROACH_MIN_Y, APPROACH_START_Y, BALL_FRICTION, BALL_MAX_X,
  BUMPER_RESTITUTION, DEFAULT_LAUNCH_SPEED, FOUL_LINE_Y, LANE_HALF_WIDTH, MAX_LAUNCH_ANGLE_RAD,
  MAX_LAUNCH_SPEED, MIN_FORWARD_SPEED, MIN_LAUNCH_SPEED, PIN_DECK_BACK_Y,
  RESET_DURATION, SETTLE_DURATION,
} from '../src/catalog.js';
import {
  createGame, launchBall, moveBallInApproach, startGame, stepGame, togglePause,
} from '../src/engine.js';

function newGame() {
  const state = createGame();
  startGame(state);
  return state;
}

function finishRoll(state) {
  const events = [];
  for (let step = 0; step < 400; step++) {
    events.push(stepGame(state, 0.01));
    if (state.rollPhase === 'aiming' || state.phase === 'finished') return events;
  }
  throw new Error('The roll did not finish');
}

function playRoll(state, count) {
  expect(launchBall(state, 0, -DEFAULT_LAUNCH_SPEED)).toBe(true);
  const standing = state.pins.filter((pin) => pin.standing);
  expect(standing.length).toBeGreaterThanOrEqual(count);
  // Script the pinfall at the pit so scoring and rack handling can be tested independently.
  for (const pin of standing.slice(0, count)) pin.standing = false;
  state.ball.y = PIN_DECK_BACK_Y - state.ball.radius;
  const events = finishRoll(state);
  expect(events.flatMap((event) => event.rollComplete ?? [])).toEqual([
    expect.objectContaining({ pinsThisRoll: count }),
  ]);
  return events;
}

describe('approach and launch', () => {
  it('clamps both axes and keeps the whole ball behind the foul line', () => {
    const state = createGame();
    moveBallInApproach(state, 100, -100);
    expect(state.ball).toMatchObject({ x: 0, y: APPROACH_START_Y });
    expect(launchBall(state, 0, -6)).toBe(false);
    startGame(state);
    moveBallInApproach(state, 100, -100);
    expect(state.ball).toMatchObject({ x: BALL_MAX_X, y: APPROACH_MIN_Y });
    expect(state.ball.y - state.ball.radius).toBeGreaterThan(FOUL_LINE_Y);
    moveBallInApproach(state, -100, 100);
    expect(state.ball).toMatchObject({ x: -BALL_MAX_X, y: APPROACH_MAX_Y });
    launchBall(state, 0, -6);
    moveBallInApproach(state, 0, 0);
    expect(state.ball).toMatchObject({ x: -BALL_MAX_X, y: APPROACH_MAX_Y });
    expect(launchBall(state, 0, -6)).toBe(false);
  });

  it.each([
    [0.01, -0.01, DEFAULT_LAUNCH_SPEED, 0],
    [7, 0, DEFAULT_LAUNCH_SPEED, 0],
    [-7, 2, DEFAULT_LAUNCH_SPEED, 0],
    [0, -1, MIN_LAUNCH_SPEED, 0],
    [99, -1, MAX_LAUNCH_SPEED, MAX_LAUNCH_ANGLE_RAD],
    [-99, -1, MAX_LAUNCH_SPEED, -MAX_LAUNCH_ANGLE_RAD],
  ])('forgives launch input (%s, %s)', (vx, vy, speed, angle) => {
    const state = newGame();
    expect(launchBall(state, vx, vy)).toBe(true);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(speed);
    expect(Math.atan2(state.ball.vx, -state.ball.vy)).toBeCloseTo(angle);
    expect(state.ball.vy).toBeLessThan(0);
    finishRoll(state);
    expect(state.frames[0].rolls).toHaveLength(1);
  });

  it('freezes while paused and clamps oversized time steps', () => {
    const state = newGame();
    launchBall(state, 0, -6);
    togglePause(state);
    const snapshot = structuredClone(state);
    expect(stepGame(state, 10)).toEqual({
      bumperHits: [], pinHits: [], pinsKnocked: [],
      rollComplete: null, frameComplete: null, gameComplete: null,
    });
    expect(state).toEqual(snapshot);
    togglePause(state);
    stepGame(state, -1);
    expect(state.elapsed).toBe(0);
    stepGame(state, 10);
    expect(state.elapsed).toBeCloseTo(0.05);
  });
});

describe('physics and reset', () => {
  it.each([[-1, 'left'], [1, 'right']])('reflects at the %s bumper', (direction, side) => {
    const state = newGame();
    moveBallInApproach(state, direction * BALL_MAX_X, APPROACH_START_Y);
    launchBall(state, direction * 8, -6);
    const incoming = state.ball.vx;
    state.ball.vy = -0.01;
    const events = stepGame(state, 0.01);
    expect(state.ball.x).toBeCloseTo(direction * BALL_MAX_X);
    expect(state.ball.vx).toBeCloseTo(-incoming * Math.exp(-BALL_FRICTION * 0.01) * BUMPER_RESTITUTION);
    expect(state.ball.vy).toBeLessThanOrEqual(-MIN_FORWARD_SPEED);
    expect(state.bumpers[side]).toEqual({ hitTimer: 0.38, hitY: state.ball.y });
    expect(events.bumperHits).toEqual([{ side, y: state.ball.y, intensity: expect.any(Number) }]);
    while (state.ball.active) {
      stepGame(state, 0.05);
      expect(Math.abs(state.ball.x)).toBeLessThanOrEqual(BALL_MAX_X);
      expect(state.ball.vy).toBeLessThanOrEqual(-MIN_FORWARD_SPEED);
    }
    expect(state.bumpers[side].hitTimer).toBe(0);
  });

  it('knocks down the head pin and scatters the whole rack on a straight center roll', () => {
    const state = newGame();
    launchBall(state, 0, 0);
    let hit;
    for (let step = 0; step < 100 && !hit; step++) {
      const events = stepGame(state, 0.01);
      if (events.pinsKnocked.length) hit = events;
    }
    expect(hit.pinsKnocked[0]).toBe(1);
    expect(hit.pinHits[0]).toMatchObject({ pinId: 1, intensity: expect.any(Number) });
    expect(state.pins[0]).toMatchObject({ standing: false, falling: true });
    expect(state.pins[0].fallProgress).toBeLessThan(1);
    const events = finishRoll(state);
    expect(events.flatMap((event) => event.rollComplete ?? [])).toEqual([
      expect.objectContaining({ pinsThisRoll: 10, isStrike: true }),
    ]);
    expect(state.pins.every((pin) => pin.standing)).toBe(true);
  });

  it('lets a moving pin knock down another during settling', () => {
    const state = newGame();
    launchBall(state, 0, -6);
    state.ball.y = -1;
    stepGame(state, 0.01);
    Object.assign(state.pins[0], { x: 0, y: 1.5, vy: -5, standing: false, falling: true });
    Object.assign(state.pins[1], { x: 0, y: 1.25 });
    const events = stepGame(state, 0.03);
    expect(state.ball.active).toBe(false);
    expect(events.pinsKnocked).toContain(2);
    expect(events.pinHits).toContainEqual(expect.objectContaining({ pinId: 2 }));
    for (let step = 0; step < 7; step++) stepGame(state, 0.05);
    expect(state.pins[1].fallProgress).toBe(1);
  });

  it.each([-1, 1])('reflects a moving pin off the %s side bumper', (direction) => {
    const state = newGame();
    launchBall(state, 0, -6);
    const pin = state.pins[0];
    const limit = LANE_HALF_WIDTH - pin.radius;
    Object.assign(pin, { x: direction * limit, vx: direction * 4, standing: false, falling: true });

    stepGame(state, 0.01);

    expect(pin.x).toBeCloseTo(direction * limit);
    expect(pin.vx * direction).toBeLessThan(0);
    expect(Math.abs(pin.vx)).toBeLessThan(4);
    stepGame(state, 0.01);
    expect(Math.abs(pin.x)).toBeLessThan(limit);
  });

  it('clears a knocked pin at the pit and still counts it toward the roll', () => {
    const state = newGame();
    launchBall(state, 0, -6);
    const pin = state.pins[0];
    Object.assign(pin, {
      y: PIN_DECK_BACK_Y - pin.radius,
      vx: 1,
      vy: -2,
      standing: false,
      falling: true,
    });
    state.ball.y = PIN_DECK_BACK_Y - state.ball.radius;

    expect(stepGame(state, 0.01).pinsKnocked).toEqual([]);
    expect(pin).toMatchObject({ cleared: true, standing: false, vx: 0, vy: 0 });
    const events = finishRoll(state);
    expect(events.flatMap((event) => event.rollComplete ?? [])).toEqual([
      expect.objectContaining({ pinsThisRoll: 1 }),
    ]);
    expect(state.standingAtRollStart).toBe(9);
  });

  it('triggers TURKEY every 3rd consecutive strike and resets on Turkey or non-strike', () => {
    const state = newGame();
    let events = playRoll(state, 10);
    expect(events.flatMap((e) => e.rollComplete ?? [])[0]).toMatchObject({
      isStrike: true, isTurkey: false, strikeStreak: 1,
    });
    expect(state.banner?.text).toBe('Strike!');

    events = playRoll(state, 10);
    expect(events.flatMap((e) => e.rollComplete ?? [])[0]).toMatchObject({
      isStrike: true, isTurkey: false, strikeStreak: 2,
    });
    expect(state.banner?.text).toBe('Strike!');

    events = playRoll(state, 10);
    expect(events.flatMap((e) => e.rollComplete ?? [])[0]).toMatchObject({
      isStrike: true, isTurkey: true, strikeStreak: 3,
    });
    expect(state.strikeStreak).toBe(0);
    expect(state.banner).toMatchObject({
      text: 'TURKEY!',
      subtext: '3 strikes in a row!',
      kind: 'turkey',
    });

    // 4th and 5th consecutive strikes show normal Strike! banners
    events = playRoll(state, 10);
    expect(events.flatMap((e) => e.rollComplete ?? [])[0]).toMatchObject({
      isStrike: true, isTurkey: false, strikeStreak: 1,
    });
    expect(state.banner?.text).toBe('Strike!');

    events = playRoll(state, 10);
    expect(events.flatMap((e) => e.rollComplete ?? [])[0]).toMatchObject({
      isStrike: true, isTurkey: false, strikeStreak: 2,
    });
    expect(state.banner?.text).toBe('Strike!');

    // 6th consecutive strike triggers a fresh TURKEY!
    events = playRoll(state, 10);
    expect(events.flatMap((e) => e.rollComplete ?? [])[0]).toMatchObject({
      isStrike: true, isTurkey: true, strikeStreak: 3,
    });
    expect(state.strikeStreak).toBe(0);
    expect(state.banner).toMatchObject({
      text: 'TURKEY!',
      subtext: '3 strikes in a row!',
      kind: 'turkey',
    });

    // Non-strike resets streak cleanly
    events = playRoll(state, 10);
    expect(state.strikeStreak).toBe(1);
    events = playRoll(state, 4);
    expect(events.flatMap((e) => e.rollComplete ?? [])[0]).toMatchObject({
      isStrike: false, isTurkey: false, strikeStreak: 0,
    });
    expect(state.strikeStreak).toBe(0);
  });

  it('expires the roll banner while aiming without another launch', () => {
    const state = newGame();
    playRoll(state, 1);
    expect(state.rollPhase).toBe('aiming');
    expect(state.banner?.text).toBe('Nice roll!');
    for (let step = 0; step < 18; step++) stepGame(state, 0.05);
    expect(state.banner?.age).toBeLessThan(1.6);
    stepGame(state, 0.05);
    stepGame(state, 0.05);
    expect(state.banner).toBeNull();
  });

  it('settles, scores, then resets on schedule and preserves standing pins', () => {
    const state = newGame();
    launchBall(state, 0, -6);
    state.ball.y = -1;
    state.pins[0].standing = false;
    stepGame(state, 0.0125);
    expect(state).toMatchObject({ rollPhase: 'settling', settleTimer: SETTLE_DURATION });
    expect(state.ball.active).toBe(false);
    for (let elapsed = 0; elapsed < SETTLE_DURATION - 0.05 - 1e-9; elapsed += 0.05) {
      expect(stepGame(state, 0.05).rollComplete).toBeNull();
    }
    expect(stepGame(state, 0.05).rollComplete).toMatchObject({ pinsThisRoll: 1 });
    expect(state).toMatchObject({ rollPhase: 'resetting', resetTimer: RESET_DURATION });
    expect(state.banner.text).toBe('Nice roll!');
    for (let elapsed = 0; elapsed < RESET_DURATION - 0.05 - 1e-9; elapsed += 0.05) stepGame(state, 0.05);
    expect(state.rollPhase).toBe('resetting');
    stepGame(state, 0.05);
    expect(state).toMatchObject({ currentFrame: 0, currentRoll: 1, rollPhase: 'aiming' });
    expect(state.ball).toMatchObject({ x: 0, y: APPROACH_START_Y, active: true, rollDistance: 0 });
    expect(state.pins[0].cleared).toBe(true);
    expect(state.pins[1]).toMatchObject({ standing: true, cleared: false });
    expect(playRoll(state, 3).some((event) => event.frameComplete?.frameIndex === 0)).toBe(true);
    expect(state).toMatchObject({ currentFrame: 1, currentRoll: 0, totalScore: 4 });
    expect(state.pins.every((pin) => pin.standing && !pin.cleared)).toBe(true);
  });
});

describe('ten-frame scoring', () => {
  it('finalizes cumulative scores once strike and spare bonuses arrive', () => {
    const state = newGame();
    playRoll(state, 10);
    expect(state.frames[0]).toMatchObject({ isStrike: true, cumulativeScore: null });
    playRoll(state, 0);
    expect(state.frames[0].cumulativeScore).toBeNull();
    const events = playRoll(state, 10);
    expect(events.flatMap((event) => event.rollComplete ?? [])[0]).toMatchObject({
      isStrike: false, isSpare: true,
    });
    expect(state.frames[0].cumulativeScore).toBe(20);
    expect(state.frames[1]).toMatchObject({ isSpare: true, cumulativeScore: null });
    playRoll(state, 3);
    expect(state.frames[1].cumulativeScore).toBe(33);
    playRoll(state, 4);
    expect(state.frames[2].cumulativeScore).toBe(40);
    expect(state.totalScore).toBe(40);
  });

  it.each([
    ['open', [3, 4], [10, 7], 7],
    ['spare', [4, 6, 10], [10, 6, 10], 20],
    ['strike then partial rack', [10, 4, 6], [10, 10, 6], 20],
    ['strike then strike', [10, 10, 7], [10, 10, 10], 27],
  ])('applies tenth-frame rack rules for %s', (_name, rolls, rackSizes, tenth) => {
    const state = newGame();
    for (let frame = 0; frame < 8; frame++) {
      playRoll(state, 0);
      playRoll(state, 0);
    }
    playRoll(state, 10);
    let events;
    for (const [index, pins] of rolls.entries()) {
      expect(state.currentRoll).toBe(index);
      expect(state.pins.filter((pin) => pin.standing)).toHaveLength(rackSizes[index]);
      events = playRoll(state, pins);
      if (index < rolls.length - 1) expect(state.phase).toBe('playing');
    }
    expect(state.frames[9].rolls).toEqual(rolls);
    expect(state.frames[8].cumulativeScore).toBe(10 + rolls[0] + rolls[1]);
    expect(state.totalScore).toBe(state.frames[8].cumulativeScore + tenth);
    expect(events.flatMap((event) => event.gameComplete ?? [])).toEqual([{ totalScore: state.totalScore }]);
  });

  it.each([[10, 12, 300], [0, 20, 0]])('scores a full game of %s-pin rolls', (pins, rolls, totalScore) => {
    const state = newGame();
    const events = [];
    for (let roll = 0; roll < rolls; roll++) events.push(...playRoll(state, pins));
    expect(state).toMatchObject({ phase: 'finished', totalScore });
    expect(state.frames.map((frame) => frame.cumulativeScore)).toEqual(
      Array.from({ length: 10 }, (_, index) => (index + 1) * totalScore / 10),
    );
    expect(events.flatMap((event) => event.frameComplete ?? [])).toHaveLength(10);
    expect(events.flatMap((event) => event.gameComplete ?? [])).toEqual([{ totalScore }]);
    expect(stepGame(state, 0.05).gameComplete).toBeNull();
    startGame(state);
    expect(state).toEqual(newGame());
  });
});
