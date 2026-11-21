/**
 * Shared lane geometry, physics constants, pin rack layout, and classic alley palette.
 * Both Track A (src/engine.js) and Track B (src/render.js, src/main.js) import from here.
 */

export const TOTAL_FRAMES = 10;

// Logical 2D lane coordinate system:
//   x in [-LANE_HALF_WIDTH, +LANE_HALF_WIDTH]  (0 is lane center)
//   y = 0 at back of pin deck, increasing toward the player at the bottom.
export const LANE_HALF_WIDTH = 1.0;
export const PIN_DECK_BACK_Y = 0.0;
export const PIN_DECK_FRONT_Y = 1.95;
export const LANE_ARROWS_Y = 4.55;
export const FOUL_LINE_Y = 6.0;

export const BALL_RADIUS = 0.195;
export const PIN_RADIUS = 0.088;

// Draggable Approach Zone (strictly behind the foul/lane line)
export const APPROACH_MIN_Y = FOUL_LINE_Y + BALL_RADIUS + 0.08; // 6.275
export const APPROACH_MAX_Y = 7.55;
export const APPROACH_START_Y = 7.05;
export const BALL_MAX_X = LANE_HALF_WIDTH - BALL_RADIUS;

// Forgiving 4-year-old kid-generous arcade launch & bumper physics tuning
export const MIN_LAUNCH_SPEED = 5.0;
export const MAX_LAUNCH_SPEED = 9.6;
export const DEFAULT_LAUNCH_SPEED = 6.8;
export const MIN_FORWARD_SPEED = 3.0; // Ball always moves toward pins (vy <= -MIN_FORWARD_SPEED)
export const MAX_LAUNCH_ANGLE_RAD = (32 * Math.PI) / 180; // ±32° forward cone
export const BUMPER_RESTITUTION = 0.92;
export const PIN_KNOCKDOWN_SPEED = 0.52; // Generous knockdown threshold for lively strikes
export const PIN_COLLISION_BOOST = 1.28; // Lively pin-to-pin chain-reaction scatter
export const BALL_FRICTION = 0.14; // gentle wood drag while keeping forward floor
export const PIN_FRICTION = 2.2;
export const SETTLE_DURATION = 0.55; // seconds after ball enters pit
export const RESET_DURATION = 0.65; // seconds before auto-resetting for next roll (~1.2s total beat)

// Standard 10-pin triangle rack (Pin 1 in front, Pins 7-10 in back row)
export const HEAD_PIN_Y = 1.55;
const PIN_ROW_DY = 0.30;
const PIN_COL_DX = 0.42;

export const PIN_LAYOUT = (() => {
  const pins = [];
  let id = 1;
  for (let row = 0; row < 4; row++) {
    const count = row + 1;
    const y = HEAD_PIN_Y - row * PIN_ROW_DY;
    const startX = -((count - 1) * PIN_COL_DX) / 2;
    for (let col = 0; col < count; col++) {
      pins.push({
        id,
        row,
        col,
        x: Number((startX + col * PIN_COL_DX).toFixed(4)),
        y: Number(y.toFixed(4)),
      });
      id++;
    }
  }
  return pins;
})();

export const ALLEY_PALETTE = {
  backdropTop: '#242b42',
  backdropMid: '#313a59',
  backdropBottom: '#1d2236',
  woodLight: '#f3d29b',
  woodMid: '#e6be7c',
  woodDark: '#d8a862',
  woodSeam: 'rgba(138, 86, 36, 0.18)',
  approachLight: '#e8c48e',
  approachDark: '#d9ae72',
  foulLine: '#e8524a',
  foulLineGlow: 'rgba(232, 82, 74, 0.35)',
  gutterBg: '#394159',
  bumperBase: '#ff6b57',
  bumperHighlight: '#ff9d7a',
  bumperGlow: '#ffe066',
  bumperHitRing: '255, 232, 102',
  arrowFill: '#9b5d2b',
  ballPrimary: '#f5c430',
  ballSwirl: '#ffe47a',
  ballDark: '#c98e14',
  ballHighlight: 'rgba(255, 255, 255, 0.62)',
  ballHole: '#3b2b12',
  pinBody: '#fffdf8',
  pinShade: '#e5dfd3',
  pinStripe: '#e64949',
  hoodFill: '#181c2b',
  hoodAccent: '#ff9d7a',
  hintText: 'rgba(92, 54, 24, 0.65)',
  confetti: ['#ff6b57', '#ffd166', '#4ecdc4', '#5c9eff', '#b388ff', '#7ae582'],
};

export const COSMIC_PALETTE = {
  backdropTop: '#060318',
  backdropMid: '#120833',
  backdropBottom: '#1b0c46',
  woodLight: '#281863',
  woodMid: '#1c1049',
  woodDark: '#120a33',
  woodSeam: 'rgba(0, 245, 255, 0.22)',
  approachLight: '#231355',
  approachDark: '#130935',
  foulLine: '#ff2bd6',
  foulLineGlow: 'rgba(255, 43, 214, 0.55)',
  gutterBg: '#0b0520',
  bumperBase: '#ff2bd6',
  bumperHighlight: '#ff85ec',
  bumperGlow: '#00f5ff',
  bumperHitRing: '0, 245, 255',
  arrowFill: '#00f5ff',
  arrowGlow: 'rgba(0, 245, 255, 0.78)',
  ballPrimary: '#00c8ff',
  ballSwirl: '#a8fffd',
  ballDark: '#5b1cff',
  ballHighlight: 'rgba(255, 255, 255, 0.85)',
  ballHole: '#140836',
  ballAura: 'rgba(0, 245, 255, 0.45)',
  pinBody: '#f4fcff',
  pinShade: '#b8d8ff',
  pinStripe: '#ff2bd6',
  pinAura: 'rgba(0, 245, 255, 0.45)',
  hoodFill: '#0b0522',
  hoodAccent: '#00f5ff',
  hoodAccent2: '#ff2bd6',
  hintText: 'rgba(155, 248, 255, 0.85)',
  confetti: ['#00f5ff', '#ff2bd6', '#b8ff3b', '#ffe600', '#a855f7', '#ff6b9d'],
};

export const DEFAULT_SCENE_ID = 'classic';

export const SCENES = {
  classic: {
    id: 'classic',
    name: 'Classic Alley',
    shortName: 'Classic',
    icon: '🎳',
    tagline: 'Warm wood lanes',
    themeColor: '#242b42',
    palette: ALLEY_PALETTE,
  },
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic Alley',
    shortName: 'Cosmic',
    icon: '🌌',
    tagline: 'Neon glow lanes',
    themeColor: '#060318',
    palette: COSMIC_PALETTE,
  },
};

export function getSceneConfig(sceneId) {
  return SCENES[sceneId] || SCENES[DEFAULT_SCENE_ID];
}
