import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, Session, createPlan, normalizeSettings, formatTime } from '../session.js';

function reachWork(session) {
  assert.ok(['instruction', 'ready'].includes(session.phase));
  session.advance(5);
  assert.equal(session.phase, 'work');
}

function finishSet(session) {
  reachWork(session);
  session.advance(session.remaining);
}

test('standalone presets include both directions and two minutes of active practice', () => {
  for (const mode of ['x1', 'x2']) {
    const session = new Session(mode);
    assert.deepEqual(session.plan.map(({ exercise, direction }) => `${exercise}:${direction}`), [
      `${mode}:horizontal`, `${mode}:horizontal`, `${mode}:vertical`, `${mode}:vertical`,
    ]);
    assert.equal(session.activeTotal, 120);
  }
});

test('combined practice completes horizontal X1 and X2 before vertical practice', () => {
  const session = new Session('combined');
  assert.deepEqual(session.plan.map(({ exercise, direction, repetition }) => `${exercise}:${direction}:${repetition}`), [
    'x1:horizontal:1', 'x1:horizontal:2', 'x2:horizontal:1', 'x2:horizontal:2',
    'x1:vertical:1', 'x1:vertical:2', 'x2:vertical:1', 'x2:vertical:2',
  ]);
  assert.equal(session.activeTotal, 240);
});

test('form strings are accepted and unsupported settings cannot create invalid timers', () => {
  const settings = normalizeSettings({ duration: '60', sets: '4', rest: '-1', cycle: Infinity, travel: '90', size: '64' });
  assert.deepEqual(settings, { duration: 60, sets: 4, rest: DEFAULTS.rest, cycle: DEFAULTS.cycle, travel: 90, size: 64 });
  assert.deepEqual(normalizeSettings({ duration: NaN, sets: 0, rest: null }), DEFAULTS);
  assert.throws(() => createPlan('unknown'), /Unknown practice mode/);
});

test('moving-target settings support faster cycles and proportional full-track travel', () => {
  const session = new Session('x2');
  assert.equal(session.settings.cycle, 2);
  assert.equal(session.settings.travel, 90);
  for (const cycle of [1, 1.5, 2, 3, 4, 6, 8]) {
    assert.equal(normalizeSettings({ cycle: String(cycle) }).cycle, cycle);
  }
  for (const travel of [30, 60, 90, 100]) {
    assert.equal(normalizeSettings({ travel: String(travel) }).travel, travel);
  }
  const invalid = normalizeSettings({ cycle: 0.5, travel: 120 });
  assert.equal(invalid.cycle, 2);
  assert.equal(invalid.travel, 90);
});

test('five seconds of initial instructions lead directly to work without counting as active practice', () => {
  const session = new Session('x1');
  assert.equal(session.remaining, 5);
  session.advance(4);
  assert.equal(session.phase, 'instruction');
  assert.equal(session.remaining, 1);
  assert.equal(session.activeSeconds, 0);
  session.advance(1);
  assert.equal(session.phase, 'work');
  assert.equal(session.activeSeconds, 0);
  assert.equal(session.remaining, 30);
  session.advance(7);
  assert.equal(session.activeSeconds, 7);
  assert.equal(session.remaining, 23);
});

test('pausing freezes all exercise clocks and resuming gives a separate three-second countdown', () => {
  const session = new Session('x2');
  reachWork(session);
  session.advance(8);
  session.pause();
  session.advance(100);
  assert.equal(session.activeSeconds, 8);
  assert.equal(session.workElapsed, 8);
  assert.equal(session.remaining, 22);
  session.resume();
  assert.equal(session.phase, 'resume');
  session.advance(2);
  assert.equal(session.activeSeconds, 8);
  session.pause();
  session.advance(10);
  assert.equal(session.remaining, 1);
  session.resume();
  session.advance(1);
  assert.equal(session.phase, 'work');
  assert.equal(session.remaining, 22);
  assert.equal(session.workElapsed, 8);
  session.advance(2);
  assert.equal(session.workElapsed, 10);
  assert.equal(session.activeSeconds, 10);
});

test('rest can be extended and automatically starts the next set countdown when it finishes', () => {
  const session = new Session('x1');
  finishSet(session);
  assert.equal(session.completedSets, 1);
  assert.equal(session.phase, 'rest');
  session.advance(10);
  session.extendRest();
  assert.equal(session.remaining, 50);
  session.advance(49);
  assert.equal(session.phase, 'rest');
  assert.equal(session.remaining, 1);
  assert.equal(session.index, 0);
  assert.equal(session.activeSeconds, 30);
  session.advance(1);
  assert.equal(session.index, 1);
  assert.equal(session.phase, 'ready');
  assert.equal(session.remaining, 5);
  session.advance(4);
  assert.equal(session.phase, 'ready');
  assert.equal(session.activeSeconds, 30);
  session.advance(1);
  assert.equal(session.phase, 'work');
  assert.equal(session.remaining, 30);
  assert.equal(session.activeSeconds, 30);
  assert.equal(session.workElapsed, 0);
});

test('pausing a rest preserves the chosen rest duration', () => {
  const session = new Session('x1', { rest: 60 });
  finishSet(session);
  session.advance(17);
  session.pause();
  session.advance(100);
  assert.equal(session.remaining, 43);
  session.resume();
  assert.equal(session.phase, 'rest');
  session.advance(43);
  assert.equal(session.phase, 'ready');
  assert.equal(session.index, 1);
  assert.equal(session.remaining, 5);
  assert.equal(session.activeSeconds, 30);
});

test('skipping a break starts the next repeated set countdown without skipping exercise time', () => {
  const session = new Session('x1');
  finishSet(session);
  session.advance(7);
  session.extendRest();
  assert.equal(session.remaining, 53);
  session.skipRest();
  assert.equal(session.index, 1);
  assert.equal(session.current.repetition, 2);
  assert.equal(session.current.direction, 'horizontal');
  assert.equal(session.phase, 'ready');
  assert.equal(session.remaining, 5);
  assert.equal(session.completedSets, 1);
  assert.equal(session.activeSeconds, 30);
  session.skipRest();
  assert.equal(session.index, 1, 'a second skip must not skip the next exercise');
  assert.equal(session.phase, 'ready');
  assert.equal(session.remaining, 5);
  session.advance(5);
  assert.equal(session.phase, 'work');
  assert.equal(session.remaining, 30);
  assert.equal(session.workElapsed, 0);
  assert.equal(session.activeSeconds, 30);
  session.advance(30);
  assert.equal(session.completedSets, 2);
  assert.equal(session.activeSeconds, 60);
});

test('skipping a break retains five-second instructions when exercise or direction changes', () => {
  for (const [mode, exercise, direction] of [
    ['combined', 'x2', 'horizontal'],
    ['x1', 'x1', 'vertical'],
  ]) {
    const session = new Session(mode, { sets: 1 });
    finishSet(session);
    session.skipRest();
    assert.equal(session.index, 1);
    assert.equal(session.current.exercise, exercise);
    assert.equal(session.current.direction, direction);
    assert.equal(session.phase, 'instruction');
    assert.equal(session.remaining, 5);
    assert.equal(session.completedSets, 1);
    assert.equal(session.activeSeconds, 30);
    session.advance(4);
    assert.equal(session.phase, 'instruction');
    session.advance(1);
    assert.equal(session.phase, 'work');
    assert.equal(session.remaining, 30);
    assert.equal(session.activeSeconds, 30);
  }
});

test('skip break does nothing during paused rest or any non-rest phase', () => {
  const session = new Session('x1');
  function assertSkipHasNoEffect() {
    const before = structuredClone({ ...session });
    session.skipRest();
    assert.deepEqual({ ...session }, before);
  }
  assertSkipHasNoEffect(); // Initial instructions.
  reachWork(session);
  session.advance(5);
  assertSkipHasNoEffect(); // Active exercise.
  session.pause();
  assertSkipHasNoEffect();
  session.resume();
  assertSkipHasNoEffect(); // Resume countdown.
  session.advance(3);
  session.advance(25);
  session.pause();
  assert.equal(session.phase, 'rest');
  assertSkipHasNoEffect(); // A paused break stays paused.
  session.resume();
  session.advance(session.remaining);
  assert.equal(session.phase, 'ready');
  assertSkipHasNoEffect();
  while (session.phase !== 'complete') {
    finishSet(session);
    if (session.phase === 'rest') {
      session.advance(session.remaining);
    }
  }
  assertSkipHasNoEffect();
});

test('exercise and direction changes each get exactly five seconds of instructions before work', () => {
  for (const [mode, exercise, direction] of [
    ['combined', 'x2', 'horizontal'],
    ['x1', 'x1', 'vertical'],
  ]) {
    const session = new Session(mode, { sets: 1 });
    finishSet(session);
    session.advance(session.settings.rest);
    assert.equal(session.current.exercise, exercise);
    assert.equal(session.current.direction, direction);
    assert.equal(session.phase, 'instruction');
    assert.equal(session.remaining, 5);
    session.advance(4);
    assert.equal(session.phase, 'instruction');
    assert.equal(session.activeSeconds, 30);
    session.advance(1);
    assert.equal(session.phase, 'work');
    assert.equal(session.remaining, 30);
    assert.equal(session.activeSeconds, 30);
    assert.equal(session.workElapsed, 0);
  }
});

test('a huge time step cannot silently run through multiple sets', () => {
  const session = new Session('combined');
  session.advance(9999);
  assert.equal(session.phase, 'work');
  assert.equal(session.completedSets, 0);
  assert.equal(session.activeSeconds, 0);
  session.advance(9999);
  assert.equal(session.phase, 'rest');
  assert.equal(session.activeSeconds, 30);
  assert.equal(session.completedSets, 1);
  session.advance(9999);
  assert.equal(session.phase, 'ready');
  assert.equal(session.index, 1);
  assert.equal(session.remaining, 5);
  assert.equal(session.activeSeconds, 30);
  assert.equal(session.completedSets, 1);
});

test('invalid elapsed time is ignored', () => {
  const session = new Session('x1');
  reachWork(session);
  for (const value of [NaN, Infinity, -1, 0, undefined]) session.advance(value);
  assert.equal(session.activeSeconds, 0);
  assert.equal(session.remaining, 30);
});

test('completion records exactly the prescribed active time despite fractional animation frames', () => {
  const session = new Session('combined');
  let frames = 0;
  while (session.phase !== 'complete') {
    session.advance(1 / 60);
    assert.ok(++frames < 100_000, 'session must finish');
  }
  assert.equal(session.completedSets, 8);
  assert.equal(session.activeSeconds, 240);
  assert.equal(session.progress, 1);
  assert.equal(formatTime(session.activeSeconds), '4:00');
  session.advance(100);
  session.skipRest();
  session.pause();
  assert.equal(session.phase, 'complete');
  assert.equal(session.paused, false);
  assert.equal(session.completedSets, 8);
});

test('remaining time displays a whole second until that second finishes', () => {
  assert.equal(formatTime(30), '0:30');
  assert.equal(formatTime(29.2), '0:30');
  assert.equal(formatTime(0.2), '0:01');
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(-1), '0:00');
});
