export const DEFAULTS = Object.freeze({ duration: 30, sets: 2, rest: 10, cycle: 2, travel: 90, size: 48 });
const allowed = { duration: [15, 30, 45, 60], sets: [1, 2, 3, 4], rest: [10, 15, 30, 45, 60], cycle: [1, 1.5, 2, 3, 4, 6, 8], travel: [30, 60, 90, 100], size: [36, 48, 64] };

export function normalizeSettings(input = {}) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, allowed[key].includes(Number(input[key])) ? Number(input[key]) : fallback]));
}

export function createPlan(mode, input = {}) {
  if (!['x1', 'x2', 'combined'].includes(mode)) throw new Error('Unknown practice mode');
  const settings = normalizeSettings(input);
  const modes = mode === 'combined' ? ['x1', 'x2'] : [mode];
  const plan = [];
  for (const direction of ['horizontal', 'vertical']) {
    for (const exercise of modes) {
      for (let repetition = 1; repetition <= settings.sets; repetition++) {
        plan.push({ exercise, direction, repetition, duration: settings.duration });
      }
    }
  }
  return plan;
}

export function formatTime(seconds) {
  const rounded = Math.ceil(Math.max(0, seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export class Session {
  constructor(mode, input = {}) {
    this.mode = mode;
    this.settings = normalizeSettings(input);
    this.plan = createPlan(mode, this.settings);
    this.index = 0;
    this.phase = 'instruction';
    this.remaining = 5;
    this.paused = false;
    this.completedSets = 0;
    this.activeSeconds = 0;
    this.workElapsed = 0;
  }
  get current() { return this.plan[this.index]; }
  get next() { return this.plan[this.index + 1]; }
  get activeTotal() { return this.plan.length * this.settings.duration; }
  get progress() { return Math.min(1, this.activeSeconds / this.activeTotal); }
  pause() { if (this.phase !== 'complete') this.paused = true; }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.phase === 'work') {
      this.resumeRemaining = this.remaining;
      this.phase = 'resume';
      this.remaining = 3;
    }
  }
  extendRest() { if (this.phase === 'rest') this.remaining += 30; }
  skipRest() { this.advanceToNextSet(); }
  advanceToNextSet() {
    if (this.phase !== 'rest' || this.paused || !this.next) return;
    const previous = this.current;
    this.index++;
    const changed = previous.exercise !== this.current.exercise || previous.direction !== this.current.direction;
    this.phase = changed ? 'instruction' : 'ready';
    this.remaining = 5;
  }
  advance(seconds) {
    if (this.paused || this.phase === 'complete' || !Number.isFinite(seconds) || seconds <= 0) return;
    const elapsed = Math.min(seconds, this.remaining);
    if (this.phase === 'work') {
      this.activeSeconds += elapsed;
      this.workElapsed += elapsed;
    }
    this.remaining = Math.max(0, this.remaining - elapsed);
    if (this.remaining <= 0) this.transition();
  }
  transition() {
    if (this.phase === 'instruction' || this.phase === 'ready' || this.phase === 'resume') {
      const resuming = this.phase === 'resume';
      this.phase = 'work';
      this.remaining = resuming ? this.resumeRemaining : this.current.duration;
      if (!resuming) this.workElapsed = 0;
    } else if (this.phase === 'work') {
      this.completedSets++;
      this.activeSeconds = this.completedSets * this.settings.duration;
      this.workElapsed = this.current.duration;
      if (!this.next) { this.phase = 'complete'; this.remaining = 0; }
      else { this.phase = 'rest'; this.remaining = this.settings.rest; }
    } else if (this.phase === 'rest') {
      this.advanceToNextSet();
    }
  }
}
