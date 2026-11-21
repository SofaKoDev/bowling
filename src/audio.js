let ctx = null;
let lastPinHitAt = 0;
let lastBumperAt = 0;

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) ctx = new AudioCtx();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function playRollStart(enabled = true) {
  if (!enabled) return;
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Ignore audio errors on restricted devices
  }
}

export function playBumperBounce(intensity = 1, enabled = true) {
  if (!enabled) return;
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;
    if (now - lastBumperAt < 0.08) return;
    lastBumperAt = now;

    // Playful rubbery cartoon "boing!"
    const clamped = Math.max(0.4, Math.min(1.4, intensity));
    const osc = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    const gain = ac.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(420 * clamped, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(270, now + 0.24);

    lfo.type = 'sine';
    lfo.frequency.value = 28;
    lfoGain.gain.setValueAtTime(26, now);
    lfoGain.gain.exponentialRampToValueAtTime(4, now + 0.24);
    lfo.connect(lfoGain).connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.16 * Math.min(1.2, clamped), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.28);
    lfo.stop(now + 0.28);
  } catch {
    // Ignore audio errors
  }
}

export function playPinHit(intensity = 1, enabled = true) {
  if (!enabled) return;
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;
    if (now - lastPinHitAt < 0.028) return;
    lastPinHitAt = now;

    const power = Math.max(0.35, Math.min(1.3, intensity));
    const pitch = 780 + Math.random() * 440;

    // Woody clack tone
    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.56, now + 0.075);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, now);
    filter.Q.value = 2.1;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.13 * power, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Ignore audio errors
  }
}

function playNotes(notes, enabled = true, step = 0.08, type = 'sine', volume = 0.12) {
  if (!enabled) return;
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t = now + i * step;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    // Ignore audio errors
  }
}

export function playSpare(enabled = true) {
  playNotes([440, 554.37, 659.25], enabled, 0.075, 'triangle', 0.12);
}

export function playStrike(enabled = true) {
  playNotes([523.25, 659.25, 783.99, 1046.5], enabled, 0.07, 'triangle', 0.14);
}

export function playTurkey(enabled = true) {
  if (!enabled) return;
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;
    // Playful cartoon turkey "gobble-gobble-gobble!" warble
    for (let i = 0; i < 4; i++) {
      const start = now + i * 0.09;
      const osc = ac.createOscillator();
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      const gain = ac.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(360 + (i % 2) * 55, start);
      osc.frequency.exponentialRampToValueAtTime(240, start + 0.08);

      lfo.type = 'sine';
      lfo.frequency.value = 34;
      lfoGain.gain.value = 42;
      lfo.connect(lfoGain).connect(osc.frequency);

      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 980;
      filter.Q.value = 2.4;

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.085);

      osc.connect(filter).connect(gain).connect(ac.destination);
      osc.start(start);
      lfo.start(start);
      osc.stop(start + 0.09);
      lfo.stop(start + 0.09);
    }
    // Followed by celebratory brassy fanfare
    playNotes([523.25, 659.25, 783.99, 1046.5, 1318.5], enabled, 0.075, 'triangle', 0.14);
  } catch {
    // Ignore audio errors
  }
}

export function playGameFinish(enabled = true) {
  playNotes([523.25, 659.25, 783.99, 659.25, 1046.5], enabled, 0.09, 'sine', 0.14);
}
