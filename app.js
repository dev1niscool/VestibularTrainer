import { DEFAULTS, normalizeSettings, createPlan, formatTime, Session } from './session.js';
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
function planSummary() {
  const plan = createPlan(mode, settings);
  $('#summary-active').textContent = formatTime(plan.length * settings.duration);
  $('#summary-sets').textContent = plan.length;
  $('#summary-rest').textContent = `${settings.rest}s`;
  $('#plan-preview').textContent = mode === 'combined'
    ? `${settings.sets} × X1 + ${settings.sets} × X2 horizontally, then the same vertically. ${settings.duration} seconds per set.`
    : `${settings.sets} horizontal sets, then ${settings.sets} vertical sets. ${settings.duration} seconds per set.`;
}
function showSetup(selected = mode) {
  stopLoop(); session = null; mode = selected; endRequested = false;
  const includesX2 = mode !== 'x1';
  views.setup.innerHTML = `
    <button class="back-button text-button" data-action="home">← All exercises</button>
    <div class="setup-header"><span class="eyebrow">A LITTLE PREPARATION</span><h1 id="setup-title">${labels[mode]}<span class="muted-period">.</span></h1><p>${includesX2 ? 'A moving-target progression, guided by your clinician.' : 'A still target. Small head movements. A clear focus.'}</p></div>
    <form id="setup-form" class="setup-layout">
      <div class="setup-main">
        <div class="setup-steps">
          <div class="setup-step"><span class="step-number">01</span><div><h3>Make yourself comfortable</h3><p>Sit in a stable chair. Keep the screen still at eye level, about 3 feet (1 metre) away, or at the distance your clinician prescribed. Wear your usual glasses.</p></div></div>
          <div class="setup-step"><span class="step-number">02</span><div><h3>Keep the letter clear</h3><p>${mode === 'x1' ? 'Look at the E in the target. Turn your head gently side to side, then later nod up and down, without moving your body. The target stays still.' : mode === 'x2' ? 'Keep looking at the E. Move your head in the opposite direction to the moving target: target right, head left; target up, head down. Do not just follow it with your eyes.' : 'For X1, move your head while the E stays still. For X2, keep the moving E clear while your head moves in the opposite direction. We’ll explain each change.'} Use small, smooth movements within a comfortable neck range.</p></div></div>
          <div class="setup-step"><span class="step-number">03</span><div><h3>Let comfort set the pace</h3><p>${mode === 'x1' ? 'Use the head speed your clinician prescribed, keeping the E in focus.' : 'Match the target only at a pace that keeps the E clear. Adjust its speed and travel below before starting.'} If the E blurs, slow down or pause. Rest until symptoms settle before continuing.</p></div></div>
        </div>
        ${includesX2 ? '<div class="x2-note"><strong>X2 is a progression.</strong> Use it only when a vestibular clinician has recommended it. This screen cannot measure your head movement or verify technique.</div>' : ''}
        <div class="safety-note"><strong>Listen to your body.</strong> Mild, brief dizziness can occur. Stop for neck pain, severe symptoms, or symptoms that do not settle. Contact your clinician if symptoms persist more than 20 minutes. <button type="button" class="inline-link" data-action="info">Read safety guidance</button></div>
      </div>
      <div class="settings-card"><div class="settings-heading"><span class="eyebrow">MAKE IT YOURS</span><h2>Your session</h2></div>
        <p class="settings-description">Example settings. Match these to your clinician’s plan.</p>
        <div class="settings-grid">
          <div class="field"><label for="duration">Time per set</label><select id="duration" name="duration">${optionList([15, 30, 45, 60], settings.duration, ' seconds')}</select></div>
          <div class="field"><label for="sets">Sets per direction${mode === 'combined' ? ', per type' : ''}</label><select id="sets" name="sets">${optionList([1, 2, 3, 4], settings.sets)}</select></div>
          <div class="field"><label for="rest">Rest between sets</label><select id="rest" name="rest">${optionList([15, 30, 45, 60], settings.rest, ' seconds')}</select></div>
          <div class="field"><label for="size">Target size</label><select id="size" name="size">${[36,48,64].map((v,i)=>`<option value="${v}" ${v === settings.size ? 'selected' : ''}>${['Small','Medium','Large'][i]}</option>`).join('')}</select></div>
        </div>
        ${includesX2 ? `<details class="advanced-settings" open><summary>Moving target settings</summary><div class="settings-grid"><div class="field"><label for="cycle">One full back-and-forth</label><select id="cycle" name="cycle">${optionList([3,4,6,8], settings.cycle, ' seconds')}</select></div><div class="field"><label for="travel">Travel from centre</label><select id="travel" name="travel">${optionList([30,60,90], settings.travel, ' screen pixels')}</select></div></div><p>Display settings, not a measured head speed or clinical prescription. Physical travel varies by screen and zoom. Target motion is essential to X2.</p></details>` : ''}
        <div class="session-summary"><div class="summary-stat"><strong id="summary-active"></strong><span>active time</span></div><div class="summary-stat"><strong id="summary-sets"></strong><span>total sets</span></div><div class="summary-stat"><strong id="summary-rest"></strong><span>rest minimum</span></div></div>
        <p class="plan-preview" id="plan-preview"></p>
        <p class="rest-note">Breaks and instructions are extra. Each break waits for you to continue.</p>
        <label class="confirmation"><input type="checkbox" id="clinician-confirmation" required><span>A clinician has recommended ${includesX2 ? 'these exercises, including X2,' : 'this exercise'} for me.</span></label>
        <button class="primary-button start-button" type="submit">Begin session <span aria-hidden="true">→</span></button>
      </div>
    </form>
    <p class="setup-bottom-note">There is no single research-established X1/X2 set split. <button class="inline-link" data-action="info">See the evidence</button></p>`;
  planSummary();
  showView('setup');
  $('#setup-form').addEventListener('change', () => { readSettings(); planSummary(); });
  $('#setup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!$('#clinician-confirmation').checked) return;
    readSettings();
    startSession();
  });
}

function instructions(set) {
  const horizontal = set.direction === 'horizontal';
  const direction = horizontal ? 'side to side' : 'up and down';
  if (set.exercise === 'x1') return `Keep the E clear and still. Move your head ${direction} with small, smooth ${horizontal ? 'turns' : 'nods'}. Keep your body still.`;
  return `Keep the moving E clear. Move your head in the opposite direction: ${horizontal ? 'target right → head left; target left → head right' : 'target up → head down; target down → head up'}. Keep movements small.`;
}
function startSession() {
  session = new Session(mode, settings); renderedKey = ''; endRequested = false;
  views.session.innerHTML = `<div class="session-top"><div class="session-label"><span class="eyebrow">YOUR PRACTICE</span><h1 id="session-title">${labels[mode]}</h1></div><div class="session-actions"><button class="text-button" data-action="fullscreen" id="fullscreen-button">Expand view</button><button class="text-button" data-action="end">End session ×</button></div></div><div class="session-progress" role="progressbar" aria-label="Exercise time completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><div class="session-stage" id="session-stage"></div><div id="session-bottom" class="session-bottom"></div><div id="session-controls" class="session-controls"></div>`;
  renderSession(); showView('session'); lastTime = performance.now(); frame = requestAnimationFrame(tick);
}
function stopLoop() { cancelAnimationFrame(frame); frame = 0; }
function tick(now) {
  if (!session) return;
  const elapsed = Math.max(0, (now - lastTime) / 1000); lastTime = now;
  // A sleeping device or a stalled browser must never silently finish a set.
  if (elapsed > 2 && !['complete', 'recovery'].includes(session.phase)) {
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
  if (session.phase === 'instruction') return `<div class="phase-content"><span class="phase-icon" aria-hidden="true">${set.direction === 'horizontal' ? '↔' : '↕'}</span><span class="phase-eyebrow">${session.index > 0 ? 'UP NEXT' : 'LET’S BEGIN'} · ${labels[set.exercise]} · ${set.direction.toUpperCase()}</span><h2>${axis}.</h2><p class="phase-copy">${instructions(set)}</p><p class="preparation-note">Sit about 3 feet (1 metre) from the screen. Keep the E at eye level.</p><span class="countdown-label">Get ready in <span data-timer></span>s</span></div>`;
  if (session.phase === 'ready' || session.phase === 'resume') return `<div class="phase-content"><span class="phase-eyebrow">${session.phase === 'resume' ? 'EASE BACK IN' : `${labels[set.exercise]} · ${set.direction.toUpperCase()}`}</span><h2 class="ready-title">Find your focus.</h2><div class="countdown" data-timer></div><p class="phase-copy">${set.exercise === 'x1' ? 'Eyes on the E. Your head moves; the target stays still.' : 'Eyes on the E. Your head moves opposite to the target.'}</p></div>`;
  if (session.phase === 'work') return `<div class="target-field" aria-label="Exercise target"><div class="gaze-target" id="gaze-target" style="--target-size:${settings.size}px"><span>E</span></div></div>`;
  if (session.phase === 'rest' || session.phase === 'recovery') return `<div class="phase-content rest-card"><span class="phase-icon rest-icon" aria-hidden="true">⌁</span><span class="phase-eyebrow">SET ${session.completedSets} COMPLETE</span><h2>A little breathing room.</h2><p class="phase-copy">Let your head and eyes rest. Wait for symptoms to settle.</p>${session.phase === 'rest' ? '<div class="countdown" data-timer></div><span class="countdown-label">seconds of rest · take longer if you need</span><div class="rest-actions"><button class="secondary-button" data-action="extend">+ 30 seconds</button></div>' : '<p class="recovery-ready">The timer is done. There’s no rush.</p><button class="primary-button" data-action="continue">I’m ready to continue →</button>'}<p class="up-next">Next: ${labels[next.exercise]} · ${next.direction}${next.direction !== set.direction ? ' · Now moving up and down' : ''}</p></div>`;
  return `<div class="phase-content completion-card"><span class="phase-icon completion-icon" aria-hidden="true">✓</span><span class="phase-eyebrow">SESSION COMPLETE</span><h2>A moment well spent.</h2><p class="phase-copy">Your practice is complete. Take a moment before getting up.</p><div class="completion-stats"><div><strong>${formatTime(session.activeSeconds)}</strong><span>active practice</span></div><div><strong>${session.completedSets}</strong><span>sets completed</span></div></div><div class="button-row"><button class="primary-button" data-action="home">Return home →</button><button class="secondary-button" data-action="again">Try again</button></div><p class="completion-note">Repeat only as directed by your clinician.</p></div>`;
}

function renderSession() {
  if (!session) return;
  const key = `${session.phase}:${session.index}:${session.paused}:${endRequested}`;
  if (key !== renderedKey) {
    const wasWithinStage = $('#session-stage').contains(document.activeElement);
    const focusedAction = $('#session-controls').contains(document.activeElement) ? document.activeElement.dataset.action : null;
    renderedKey = key;
    $('#session-stage').innerHTML = phaseMarkup();
    $('#session-stage').className = `session-stage phase-${session.phase}${session.paused ? ' is-paused' : ''}`;
    const complete = session.phase === 'complete';
    $('#session-bottom').hidden = complete || endRequested;
    $('#session-controls').hidden = complete || endRequested;
    $('.session-actions').hidden = complete;
    const resting = session.paused || ['rest', 'recovery'].includes(session.phase);
    const cue = resting ? 'Rest your head and eyes. Continue only when symptoms settle.' : session.current.exercise === 'x1' ? `Keep the E clear. Move your head ${session.current.direction === 'horizontal' ? 'left and right' : 'up and down'}.` : 'Keep the E clear. Move your head opposite to the target.';
    $('#session-bottom').innerHTML = `<div class="session-instruction"><span class="eyebrow">${labels[session.current.exercise]} · ${session.current.direction.toUpperCase()} · SET ${session.index + 1} OF ${session.plan.length}</span><p>${cue}</p></div><div class="session-timer"><span class="time" id="work-time"></span><span class="time-label">${session.phase === 'work' || session.phase === 'resume' ? 'left in this set' : 'per set'}</span></div>`;
    $('#session-controls').innerHTML = `<button class="secondary-button pause-button" data-action="pause" ${session.phase === 'recovery' ? 'hidden' : ''}>${session.paused ? 'Resume session' : 'Pause session'}</button><span class="keyboard-hint">Space to pause · Esc to stop</span>`;
    const message = session.paused ? 'Session paused.' : session.phase === 'work' ? `${labels[session.current.exercise]}, ${session.current.direction}. Start set ${session.index + 1}. ${instructions(session.current)}` : session.phase === 'rest' ? 'Set complete. Rest until symptoms settle.' : session.phase === 'recovery' ? 'Rest timer complete. Continue when ready.' : complete ? 'Session complete.' : `${session.phase === 'instruction' ? 'Next exercise' : 'Get ready'}: ${labels[session.current.exercise]}, ${session.current.direction}.`;
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
    const amplitude = Math.max(0, Math.min(settings.travel, available));
    offset = Math.sin(session.workElapsed * Math.PI * 2 / settings.cycle) * amplitude;
  }
  target.style.transform = `translate(calc(-50% + ${session.current.direction === 'horizontal' ? offset : 0}px), calc(-50% + ${session.current.direction === 'vertical' ? offset : 0}px))`;
}
function pauseToggle() {
  if (!session || session.phase === 'complete' || (session.phase === 'recovery' && !session.paused) || endRequested) return;
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
  if (action === 'continue' && session) { session.continueAfterRest(); lastTime = performance.now(); renderSession(); }
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
