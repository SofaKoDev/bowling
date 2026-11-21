# Spec-Kit Contract — Bouncy Bowling

This file defines the exact shared interface between:
- **Track A (Codex):** `src/engine.js` and `tests/engine.test.js`
- **Track B (Antigravity):** `src/render.js`, `src/audio.js`, `src/main.js`, `src/styles.css`

All shared geometry & tuning constants live in `src/catalog.js`.

---

## Coordinate System (`src/catalog.js`)
- `x ∈ [-1.0, +1.0]` (`LANE_HALF_WIDTH = 1.0`), with bumpers at `x = -1.0` and `x = +1.0`.
- `y = 0.0` at the back of the pin deck; `y` increases toward the player at the bottom.
- `FOUL_LINE_Y = 6.0`.
- Draggable Approach Zone: `y ∈ [APPROACH_MIN_Y (6.275), APPROACH_MAX_Y (7.55)]`.
- Rolling forward toward the pins means **negative `vy`** (`vy < 0`).

---

## Required Exports from `src/engine.js`

### `createGame({ seed = 20261121 } = {})`
Returns a fresh `state` object:
```js
{
  phase: 'ready',          // 'ready' | 'playing' | 'paused' | 'finished'
  rollPhase: 'aiming',     // 'aiming' | 'rolling' | 'settling' | 'resetting'
  seed,
  elapsed: 0,
  ball: {
    x: 0,
    y: APPROACH_START_Y,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    spinAngle: 0,          // visual rotation angle (radians)
    rollDistance: 0,       // cumulative distance rolled
    active: true,
  },
  pins: [
    // 10 items initialized from PIN_LAYOUT:
    {
      id: 1,               // 1..10
      row: 0,              // 0..3
      col: 0,
      x: 0,
      y: 1.55,
      vx: 0,
      vy: 0,
      radius: PIN_RADIUS,
      standing: true,
      falling: false,
      fallProgress: 0,     // 0 (upright) -> 1 (flat on lane)
      angle: 0,            // tumble direction / visual rotation
      spinVel: 0,
      cleared: false,      // true once removed after roll 1 of a frame
    }
  ],
  bumpers: {
    left: { hitTimer: 0, hitY: FOUL_LINE_Y * 0.5 },
    right: { hitTimer: 0, hitY: FOUL_LINE_Y * 0.5 },
  },
  frames: [
    // 10 items (indices 0..9):
    {
      rolls: [],           // array of pin counts knocked on each roll in this frame
      cumulativeScore: null, // number once frame score is finalized, else null
      isStrike: false,
      isSpare: false,
    }
  ],
  currentFrame: 0,         // 0..9
  currentRoll: 0,          // 0..2 (2 only possible in frame index 9)
  totalScore: 0,
  standingAtRollStart: 10,
  settleTimer: 0,
  resetTimer: 0,
  banner: null,            // { text: string, subtext?: string, age: number } | null
  popups: [],              // Array<{ x, y, text, age, accent? }>
}
```

### `startGame(state)`
- Transitions `state.phase` from `'ready'` (or `'finished'`) to `'playing'`.

### `togglePause(state)`
- Toggles `state.phase` between `'playing'` and `'paused'`.

### `moveBallInApproach(state, x, y)`
- Only acts when `state.phase === 'playing'` and `state.rollPhase === 'aiming'`.
- Clamps `x` to `[-BALL_MAX_X, +BALL_MAX_X]`.
- Clamps `y` to `[APPROACH_MIN_Y, APPROACH_MAX_Y]` so the ball **never** crosses the foul/lane line while aiming.

### `launchBall(state, vx, vy)`
- Only acts when `state.phase === 'playing'` and `state.rollPhase === 'aiming'`. Returns `boolean` (`true` if launched).
- **4-Year-Old Forgiveness Rules:**
  - Must always launch forward (`vy < 0`). If `vy >= 0` or input magnitude is tiny, treat as straight forward at `DEFAULT_LAUNCH_SPEED`.
  - Clamp speed to `[MIN_LAUNCH_SPEED, MAX_LAUNCH_SPEED]`.
  - Clamp launch angle relative to straight ahead (`-y`) to `[-MAX_LAUNCH_ANGLE_RAD, +MAX_LAUNCH_ANGLE_RAD]`.
- Sets `state.rollPhase = 'rolling'`, `state.standingAtRollStart` to current standing pin count, and clears `state.banner`.

### `stepGame(state, dt)`
- Clamps `dt` (e.g., `Math.min(Math.max(dt, 0), 0.05)`).
- Does nothing (returns empty event object) if `state.phase !== 'playing'`.
- Returns:
```js
{
  bumperHits: [],    // Array<{ side: 'left' | 'right', y: number, intensity: number }>
  pinHits: [],       // Array<{ pinId: number, x: number, y: number, intensity: number }>
  pinsKnocked: [],   // Array<number> (pin IDs that transitioned to falling this step)
  rollComplete: null, // { frameIndex, rollIndex, pinsThisRoll, isStrike, isSpare } | null
  frameComplete: null, // { frameIndex } | null
  gameComplete: null,  // { totalScore } | null
}
```
- **Physics expectations (Kid-Generous Arcade Feel):**
  - Sub-step movement (e.g. 4 sub-steps per frame) so fast balls never tunnel through pins or bumpers.
  - Bouncy gutters: when `ball.x - ball.radius < -LANE_HALF_WIDTH` or `ball.x + ball.radius > LANE_HALF_WIDTH`, clamp `ball.x`, reflect `ball.vx = -ball.vx * BUMPER_RESTITUTION`, enforce `ball.vy <= -MIN_FORWARD_SPEED`, set `state.bumpers[side].hitTimer = 0.38` and `hitY = ball.y`, and push to `bumperHits`.
  - Generous ball-to-pin and pin-to-pin elastic circle collisions (using `PIN_COLLISION_BOOST` and `PIN_KNOCKDOWN_SPEED` from `src/catalog.js`) so strikes and chain-reaction scatters happen often for a 4-year-old; any standing pin whose speed exceeds `PIN_KNOCKDOWN_SPEED` (or is directly hit) becomes `standing = false`, `falling = true`, increments `fallProgress` to `1`, and pushes its `id` to `pinsKnocked`.
  - Auto-reset pacing (~1.2s total): when the ball passes `PIN_DECK_BACK_Y - BALL_RADIUS` (enters the pit), deactivate ball and transition to `'settling'` (`SETTLE_DURATION`), then score the roll, transition to `'resetting'` (`RESET_DURATION`), and automatically prepare the next roll/frame (or finish the game after Frame 10) with no extra tap required.
- **10-Frame Ruleset:**
  - Standard 10-frame bowling scoring (strikes, spares, 10th-frame bonus rolls).
  - Update `frames[i].cumulativeScore` whenever a frame's bonus rolls are complete, and keep `state.totalScore` synced to the latest score.
  - On Strike/Spare/Good roll, populate `state.banner = { text, subtext, age: 0 }`.
  - When Frame 10 finishes, set `state.phase = 'finished'` and emit `gameComplete: { totalScore: state.totalScore }`.
