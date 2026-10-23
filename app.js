import { DEFAULTS, normalizeSettings, formatTime, Session } from './session.js';
import { researchHTML } from './research.js';

const $ = (selector) => document.querySelector(selector);
const views = { home: $('#home-view'), setup: $('#setup-view'), session: $('#session-view') };
const labels = { x1: 'VOR X1', x2: 'VOR X2', combined: 'Combined session' };
let mode = 'x1';
let settings = { ...DEFAULTS };
let session = null;
let frame = 0;
let lastTime = 0;
let renderedKey = '';
let previousFocus = null;
let endRequested = false;

$('#research-content').innerHTML = researchHTML;

function announce(message) { $('#announcement').textContent = message; }
function focusHeading(view) {
  const heading = views[view].querySelector('h1, h2');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}
function showView(view) {
  for (const [key, element] of Object.entries(views)) element.hidden = key !== view;
  document.body.classList.toggle('session-active', view === 'session');
  if (view !== 'session') document.body.classList.remove('x2-vertical-active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  focusHeading(view);
}
function optionList(values, value, suffix = '') {
  return values.map((item) => `<option value="${item}" ${item === value ? 'selected' : ''}>${item}${suffix}</option>`).join('');
}
function readSettings() {
  const form = $('#setup-form');
  if (form) settings = normalizeSettings(Object.fromEntries(new FormData(form)));
}
function showSetup(selected = mode) {
  stopLoop(); session = null; mode = selected; endRequested = false;
  const includesX2 = mode !== 'x1';
  views.setup.innerHTML = `
    <button class="back-button text-button" data-action="home">← All exercises</button>
    <div class="setup-header"><h1 id="setup-title">${labels[mode]}<span class="muted-period">.</span></h1></div>
    <form id="setup-form" class="setup-layout">
      <div class="settings-grid">
        <div class="field"><label for="duration">Time per set</label><select id="duration" name="duration">${optionList([15, 30, 45, 60], settings.duration, ' seconds')}</select></div>
        <div class="field"><label for="sets">Sets per direction${mode === 'combined' ? ', per type' : ''}</label><select id="sets" name="sets">${optionList([1, 2, 3, 4], settings.sets)}</select></div>
        <div class="field"><label for="rest">Rest between sets</label><select id="rest" name="rest">${optionList([10, 15, 30, 45, 60], settings.rest, ' seconds')}</select></div>
        <div class="field"><label for="size">Target size</label><select id="size" name="size">${[36,48,64].map((v,i)=>`<option value="${v}" ${v === settings.size ? 'selected' : ''}>${['Small','Medium','Large'][i]}</option>`).join('')}</select></div>
      </div>
      <button class="primary-button start-button" type="submit">Begin session <span aria-hidden="true">→</span></button>
      ${includesX2 ? `<details class="advanced-settings"><summary>Moving target settings</summary><div class="settings-grid"><div class="field"><label for="cycle">One full back-and-forth</label><select id="cycle" name="cycle">${optionList([1,1.5,2,3,4,6,8], settings.cycle, ' seconds')}</select></div><div class="field"><label for="travel">Travel range</label><select id="travel" name="travel">${optionList([30,60,90,100], settings.travel, '%')}</select></div></div></details>` : ''}
    </form>`;
  showView('setup');
  $('#setup-form').addEventListener('change', readSettings);
  $('#setup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    readSettings();
    startSession();
  });
}

function instructions(set) {
  const horizontal = set.direction === 'horizontal';
  if (set.exercise === 'x1') return `Keep the E clear. Gently ${horizontal ? 'turn your head side to side' : 'nod your head up and down'}.`;
  return `Keep the E clear. Move your head opposite to the target: ${horizontal ? 'target right, head left' : 'target up, head down'}.`;
}

function startSession() {
  session = new Session(mode, settings); renderedKey = ''; endRequested = false;
  views.session.innerHTML = `<div class="session-top"><div class="session-label"><h1 id="session-title">${labels[mode]}</h1></div><div class="session-actions"><button class="text-button" data-action="fullscreen" id="fullscreen-button">Expand view</button><button class="text-button" data-action="end">End session ×</button></div></div><div class="session-progress" role="progressbar" aria-label="Exercise time completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><div class="session-stage" id="session-stage"></div><div id="session-bottom" class="session-bottom"></div><div id="session-controls" class="session-controls"></div>`;
  renderSession(); showView('session'); lastTime = performance.now(); frame = requestAnimationFrame(tick);
}
function stopLoop() { cancelAnimationFrame(frame); frame = 0; }
function tick(now) {
  if (!session) return;
  const elapsed = Math.max(0, (now - lastTime) / 1000); lastTime = now;
  // A sleeping device or a stalled browser must never silently finish a set.
  if (elapsed > 2 && session.phase !== 'complete') {
    session.pause(); announce('Session paused after an interruption. Resume when ready.');
  } else session.advance(elapsed);
  renderSession(); updateTarget();
  if (session.phase !== 'complete') frame = requestAnimationFrame(tick);
}
function phaseMarkup() {
  const set = session.current;
  const next = session.next;
  const axis = set.direction === 'horizontal' ? 'Side to side' : 'Up and down';
  if (endRequested) return `<div class="phase-content paused-card"><span class="phase-eyebrow">TAKE THE TIME YOU NEED</span><h2>Finish here?</h2><p class="phase-copy">You can end your practice at any time.</p><div class="button-row"><button class="primary-button" data-action="confirm-end">End &amp; return home</button><button class="secondary-button" data-action="cancel-end">Keep practicing</button></div></div>`;
  if (session.paused) return `<div class="phase-content paused-card"><span class="phase-icon" aria-hidden="true">∥</span><span class="phase-eyebrow">NO RUSH</span><h2>Take a moment.</h2><p class="phase-copy">Your session is paused. Continue only when you’re comfortable and symptoms have settled.</p><button class="primary-button" data-action="pause">Resume session →</button></div>`;
  if (session.phase === 'instruction') return `<div class="phase-content"><span class="phase-icon" aria-hidden="true">${set.direction === 'horizontal' ? '↔' : '↕'}</span><span class="phase-eyebrow">${session.index > 0 ? 'UP NEXT' : 'LET’S BEGIN'} · ${labels[set.exercise]} · ${set.direction.toUpperCase()}</span><h2>${axis}.</h2><p class="phase-copy">${instructions(set)}</p><p class="preparation-note">Screen at eye level · about 3 feet (1 metre) away.</p><span class="countdown-label">Starting in <span data-timer></span>s</span></div>`;
  if (session.phase === 'ready' || session.phase === 'resume') return `<div class="phase-content"><span class="phase-eyebrow">${session.phase === 'resume' ? 'EASE BACK IN' : `${labels[set.exercise]} · ${set.direction.toUpperCase()}`}</span><h2 class="ready-title">Find your focus.</h2><div class="countdown" data-timer></div><p class="phase-copy">${set.exercise === 'x1' ? 'Eyes on the E. Your head moves; the target stays still.' : 'Eyes on the E. Your head moves opposite to the target.'}</p></div>`;
  if (session.phase === 'work') return `<div class="target-field${set.exercise === 'x2' ? ' x2-target-field' : ''}" aria-label="Exercise target"><div class="gaze-target" id="gaze-target" style="--target-size:${settings.size}px"><span>E</span></div></div>`;
  if (session.phase === 'rest') return `<div class="phase-content rest-card"><span class="phase-icon rest-icon" aria-hidden="true">⌁</span><span class="phase-eyebrow">SET ${session.completedSets} COMPLETE</span><h2>A little breathing room.</h2><p class="phase-copy">Rest your head and eyes.</p><div class="countdown" data-timer></div><span class="countdown-label">seconds · next set starts automatically</span><div class="rest-actions"><button class="secondary-button" data-action="extend">+ 30 seconds</button><button class="primary-button" data-action="skip-break">Skip break →</button></div><p class="up-next">Next: ${labels[next.exercise]} · ${next.direction}${next.direction !== set.direction ? ' · Now moving up and down' : ''}</p></div>`;
  return `<div class="phase-content completion-card"><span class="phase-icon completion-icon" aria-hidden="true">✓</span><span class="phase-eyebrow">SESSION COMPLETE</span><h2>A moment well spent.</h2><p class="phase-copy">Your practice is complete. Take a moment before getting up.</p><div class="completion-stats"><div><strong>${formatTime(session.activeSeconds)}</strong><span>active practice</span></div><div><strong>${session.completedSets}</strong><span>sets completed</span></div></div><div class="button-row"><button class="primary-button" data-action="home">Return home →</button><button class="secondary-button" data-action="again">Try again</button></div><p class="completion-note">Repeat only as directed by your clinician.</p></div>`;
}

function renderSession() {
  if (!session) return;
  const key = `${session.phase}:${session.index}:${session.paused}:${endRequested}`;
  if (key !== renderedKey) {
    const wasWithinStage = $('#session-stage').contains(document.activeElement);
    const focusedAction = $('#session-controls').contains(document.activeElement) ? document.activeElement.dataset.action : null;
    renderedKey = key;
    document.body.classList.toggle('x2-vertical-active', session.phase === 'work' && !session.paused && !endRequested && session.current.exercise === 'x2' && session.current.direction === 'vertical');
    $('#session-stage').innerHTML = phaseMarkup();
    $('#session-stage').className = `session-stage phase-${session.phase}${session.paused ? ' is-paused' : ''}`;
    const complete = session.phase === 'complete';
    $('#session-bottom').hidden = complete || endRequested || ['instruction', 'ready'].includes(session.phase);
    $('#session-controls').hidden = complete || endRequested;
    $('.session-actions').hidden = complete;
    const resting = session.paused || session.phase === 'rest';
    const cue = resting ? 'Rest your head and eyes' : `Move your head ${session.current.direction === 'horizontal' ? 'side to side' : 'up and down'}`;
    const cueDetail = resting ? 'Pause or add time if you need a longer break.' : session.current.exercise === 'x1' ? 'Keep your eyes on the E.' : 'Move opposite to the target. Keep the E clear.';
    $('#session-bottom').innerHTML = `<div class="session-instruction"><span class="eyebrow">${labels[session.current.exercise]} · ${session.current.direction.toUpperCase()} · SET ${session.index + 1} OF ${session.plan.length}</span><strong id="movement-cue">${cue}</strong><p>${cueDetail}</p></div><div class="session-timer"><span class="time" id="work-time"></span><span class="time-label">${session.phase === 'work' || session.phase === 'resume' ? 'left in this set' : 'per set'}</span></div>`;
    $('#session-controls').innerHTML = `<button class="secondary-button pause-button" data-action="pause">${session.paused ? 'Resume session' : 'Pause session'}</button><span class="keyboard-hint">Space to pause · Esc to stop</span>`;
    const message = session.paused ? 'Session paused.' : session.phase === 'work' ? `${labels[session.current.exercise]}, ${session.current.direction}. Start set ${session.index + 1}. ${instructions(session.current)}` : session.phase === 'rest' ? 'Set complete. Rest. The next set will start automatically.' : complete ? 'Session complete.' : `${session.phase === 'instruction' ? 'Next exercise' : 'Get ready'}: ${labels[session.current.exercise]}, ${session.current.direction}.`;
    announce(message);
    if (wasWithinStage || complete) {
      const focusTarget = $('#session-stage').querySelector('h2, button');
      if (focusTarget) { focusTarget.tabIndex = -1; focusTarget.focus({ preventScroll: true }); }
    } else if (focusedAction) {
      const replacement = [...views.session.querySelectorAll('[data-action]')].find((button) => button.dataset.action === focusedAction && !button.hidden);
      replacement?.focus({ preventScroll: true });
    }
  }
  const countdown = $('[data-timer]');
  if (countdown) countdown.textContent = Math.ceil(session.remaining);
  const time = $('#work-time');
  if (time) time.textContent = formatTime(['work','resume'].includes(session.phase) ? (session.phase === 'resume' ? session.resumeRemaining : session.remaining) : settings.duration);
  const progress = $('.session-progress');
  progress.setAttribute('aria-valuenow', Math.round(session.progress * 100));
  progress.querySelector('span').style.width = `${session.progress * 100}%`;
}
function updateTarget() {
  const target = $('#gaze-target');
  if (!target || session.paused || session.phase !== 'work') return;
  let offset = 0;
  if (session.current.exercise === 'x2') {
    const field = $('.target-field');
    const available = (session.current.direction === 'horizontal' ? field.clientWidth : field.clientHeight) / 2 - settings.size / 2 - 16;
    const amplitude = Math.max(0, available) * settings.travel / 100;
    offset = Math.sin(session.workElapsed * Math.PI * 2 / settings.cycle) * amplitude;
  }
  target.style.transform = `translate(calc(-50% + ${session.current.direction === 'horizontal' ? offset : 0}px), calc(-50% + ${session.current.direction === 'vertical' ? offset : 0}px))`;
}
function pauseToggle() {
  if (!session || session.phase === 'complete' || endRequested) return;
  session.paused ? session.resume() : session.pause();
  lastTime = performance.now(); renderSession();
}
function goHome() {
  stopLoop(); session = null; endRequested = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  showView('home');
}
function requestEnd() {
  if (!session) return;
  session.pause(); endRequested = true; renderSession();
  const heading = $('#session-stage h2');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
function openInfo() {
  if ($('#info-dialog').open) return;
  previousFocus = document.activeElement;
  if (session && session.phase !== 'complete') { session.pause(); renderSession(); }
  $('#info-dialog').showModal();
}
function closeInfo() { $('#info-dialog').close(); }
$('#info-dialog').addEventListener('close', () => {
  if (previousFocus?.isConnected) previousFocus.focus();
});
$('#info-dialog').addEventListener('click', (event) => {
  if (event.target === $('#info-dialog')) {
    const r = $('#info-dialog').getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeInfo();
  }
});

document.addEventListener('click', async (event) => {
  const modeButton = event.target.closest('[data-mode]');
  if (modeButton) { showSetup(modeButton.dataset.mode); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'info') openInfo();
  if (action === 'close-info') closeInfo();
  if (action === 'home' || action === 'confirm-end') goHome();
  if (action === 'again') showSetup();
  if (action === 'pause') pauseToggle();
  if (action === 'extend' && session) { session.extendRest(); renderSession(); announce('Added 30 seconds of rest.'); }
  if (action === 'skip-break' && session) { session.skipRest(); lastTime = performance.now(); renderSession(); }
  if (action === 'end' && session) requestEnd();
  if (action === 'cancel-end') { endRequested = false; renderSession(); }
  if (action === 'fullscreen') {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { announce('Full screen is unavailable in this browser. You can keep practicing in this view.'); }
  }
});
$('.wordmark').addEventListener('click', (event) => {
  event.preventDefault();
  if (session && session.phase !== 'complete') {
    requestEnd();
  } else goHome();
});
document.addEventListener('fullscreenchange', () => {
  const button = $('#fullscreen-button');
  if (button) button.textContent = document.fullscreenElement ? 'Exit full screen' : 'Expand view';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session && session.phase !== 'complete') {
    session.pause(); renderSession();
  }
  lastTime = performance.now();
});
document.addEventListener('keydown', (event) => {
  if ($('#info-dialog').open || !session || session.phase === 'complete') return;
  if (event.key === 'Escape') {
    requestEnd();
  }
  if (event.code === 'Space' && !event.repeat && !event.target.closest('button, input, select, summary, a')) {
    event.preventDefault(); pauseToggle();
  }
});
