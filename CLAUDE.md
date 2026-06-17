# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (electron-vite + hot reload)
npm run build        # Typecheck + build
npm run lint         # ESLint with cache
npm run format       # Prettier format
npm run typecheck    # Check main/preload (tsconfig.node.json) and renderer (tsconfig.web.json)

npm run build:win    # Windows NSIS installer
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage/snap/deb
```

> **Note from README**: Build requires admin privileges on Windows.

There is no test framework configured in this project.

## Architecture

Electron desktop app for **spectral measurement and hyperspectral image reconstruction**, targeting spectroscopy hardware (X-Rite i1 Pro) and a WSL-hosted deep learning model.

### Process Boundaries

```
Main Process (src/main/)
  ├── index.ts       — App lifecycle, window creation, IPC handlers
  └── spotread.ts    — PTY-based process management + output state machine

Preload (src/preload/index.ts)
  └── Context bridge exposing reconstructionApi and spotreadApi to renderer

Renderer (src/renderer/src/)
  └── React 19 SPA with hash-based routing
```

### IPC APIs (preload → main)

**`spotreadApi`** — Controls ArgyllCMS `spotread.exe` via `node-pty`:

- `start({ argyllBinDir, instrumentPort })` / `calibrate()` / `measure()` / `stop()` / `saveSpectrum()` / `setReference()`
- Listeners: `onState`, `onRaw`, `onMeasurement`
- State machine: `idle → starting → awaitingCalibration → readyToMeasure → measuring`
- Parses XYZ/Lab/spectrum values from console output with regex

**`reconstructionApi`** — Spectral reconstruction via WSL Python model:

- `pickNpyFile()` / `readNpyFile(path)` / `runPredict()`
- `runPredict` spawns: `wsl.exe --distribution Ubuntu /bin/bash -lc 'cd ~/projects/spectral-reconstruction-experimental && mamba run -n night_2 python predict_image.py'`
- Returns path to output `.npy` file

### Renderer Structure (FSD-style)

```
pages/         — Route-level page components
  MeasureModule/       — Spotread session UI + spectrum chart
  ReconstructionPage/  — Reconstruction workflow

widgets/       — Stateful containers composed of features
  sidebar, appLayout, reconstruction-workspace

features/      — Feature modules
  navigation/           — Nav items + routing
  reconstruction/
    run-prediction/     — Trigger model execution
    channel-viewer/     — Visualize spectral bands as images
    pixel-viewer/       — Click image to inspect per-pixel spectrum

shared/        — Framework-agnostic utilities and UI
  config/routes.ts      — Route constants
  lib/npy/loadNpy.ts    — NumPy .npy file loader (wraps npyjs)
  ui/                   — Shared presentational components
```

Routes (`/` redirects to `/spotread`):

- `/spotread` — MeasureModule
- `/spectral-reconstruction` — ReconstructionPage

### Key Technology Notes

- **Path alias**: `@/` → `src/renderer/src/` (configured in `electron.vite.config.ts`)
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts (spectrum visualization)
- **NPY files**: `npyjs` for loading NumPy array data from the model output
- **UI language**: All user-facing text is in Russian (Cyrillic)
- **Code style**: Single quotes, no semicolons, 100-char line width, no trailing commas (Prettier)
