# Vestibular

A quiet, browser-based guide for clinician-directed VOR X1 and VOR X2 gaze stabilization practice.

**Live site:** https://dev1niscool.github.io/VestibularTrainer/

## What it does

- VOR X1: a stationary letter target with horizontal and vertical head-movement instructions.
- VOR X2: a smoothly moving letter target, with instructions to move the head in the opposite direction.
- Combined session: both exercise types, horizontal first, then vertical.
- Adjustable set duration, repetitions, rest, target size, and X2 display speed/travel.
- A compact settings screen with no confirmation checkbox; X2 target controls are available under a collapsed section.
- Five-second instructions before the first set and each movement change, clear head-direction cues during exercise, extendable rest, and an explicit readiness check between sets.
- Pause/resume, a three-second countdown when resuming an active set, automatic pause when the tab is hidden or the browser stalls, session completion, restart, and return home.
- Keyboard operation, responsive layouts, reduced decorative motion, linked research, and safety information.

The default is **two 30-second sets per direction per exercise type**, with at least 30 seconds of rest between sets. That is 2 minutes of active practice for either standalone exercise, or 4 minutes for a combined session. These are **illustrative settings, not an established clinical prescription**. The app does not recommend X2 or a combined program for everyone. See [RESEARCH.md](RESEARCH.md) for the evidence and its limitations.

The app does not measure head movement, verify technique, diagnose dizziness, or replace a vestibular clinician. A screen-pixel target trajectory is not a calibrated physical or angular motion. This is an educational aid and is not medical advice.

## Local development

No packages, build tool, account, backend, analytics, or external runtime requests are required. Instrument Serif and Geist are served locally from `assets/fonts/`, with their SIL Open Font License files included. Instrument Serif is the display face used by both TrumpRx and David; Geist matches TrumpRx’s supporting typography.

```sh
npm start
# Open http://localhost:4173
```

Use an HTTP server because the app uses JavaScript modules. Node.js 24 is used in CI; Python 3 serves local files. Session state stays in memory and is discarded when the page reloads.

```sh
npm run check
npm test
```

`session.js` contains the independently testable session state machine. `app.js` handles the interface and animation. `research.js` supplies the in-app sources and disclaimer.

## Publishing

The GitHub Actions workflow checks syntax and session behavior, then publishes the static site files and locally hosted fonts to GitHub Pages on pushes to `main`. Set the repository’s Pages build source to **GitHub Actions** in [Settings → Pages](https://github.com/dev1niscool/VestibularTrainer/settings/pages). This one-time setup needs repository administration access. If a run happened before Pages was enabled, rerun it from [Actions](https://github.com/dev1niscool/VestibularTrainer/actions/workflows/pages.yml). No API keys or secrets are needed.

Exercise target movement is intentional and remains active when the device requests reduced motion; decorative animation is removed. Users explicitly choose and begin a moving-target exercise and can pause or stop at any time.
