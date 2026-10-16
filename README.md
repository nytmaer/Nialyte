# Niagara Lite Effect Lab 002 | Installable PWA

## iPhone Home Screen installation

1. Upload the **contents** of this folder to an HTTPS static host such as GitHub Pages or Netlify. (Keep all files together.)
2. Open the hosted URL in **Safari** on iPhone.
3. Tap **Share** → **Add to Home Screen** → **Add**.
4. Launch **Niagara Lite** from your Home Screen. After the first successful online load, the app shell is cached for offline use.

Opening index.html directly from the Files app will not enable service workers or reliable PWA installation. A public HTTPS URL or localhost is needed.

## Features

A browser-based mock of Unreal's Niagara editor. A **system** holds any number of **emitters**, and each emitter has the same stack Niagara uses: Emitter Properties, Emitter Update, Particle Spawn, Particle Update, Event Handlers and Render.

- **Spawning:** Spawn Rate, Spawn Burst Instantaneous (stack several), Spawn Per Unit. Every spawn module has a probability setting, and emitters support interpolated spawning.
- **Emitter state:** Loop Behavior (Infinite / Once / Multiple), Loop Duration, Loop Delay, determinism with a seed, Local Space, Spawn Count Scale and Max Particles. Emitters can be set to Standard or Lightweight (stateless) mode, and Sim Target to CPU or GPU.
- **Particle Spawn:** Initialize Particle, Shape Location (point, sphere, hemisphere, box, cylinder, cone, torus, ring/disc, line, grid), Add Velocity (Linear / In Cone / From Point), Inherit Velocity, Random Color from Gradient, Initial Mesh Orientation, Beam Emitter Setup.
- **Particle Update:** Gravity, Acceleration, Linear, Drag, Wind, Curl Noise, Vortex, Point Attraction, Limit Velocity, Rotate Around Point, Color, Scale Color, Scale Sprite Size (and by speed), Scale Mesh Size (and by speed), Sprite Rotation Rate, Sub UV Animation, Dynamic Material Parameters, Camera Offset, Collision, Kill Particles In Volume, and Generate Location / Death / Collision events.
- **Event Handlers:** let one emitter spawn particles from another emitter's death, collision or location events (fireworks, splashes, trails).
- **Renderers:** Sprite (6 blend modes, alignment, facing, Sub UV flipbooks, sorting, pivot), Ribbon, Mesh (cube, sphere, shard, cone, cylinder, plane; lit or unlit), Light, and Decal. The Component and Volume renderers are export-only.
- **Editing:** curve and gradient editors, enable/disable, reorder, solo, duplicate, and custom texture upload.
- **Presets:** 18 system presets and 14 emitter templates based on Niagara's built-in templates.
- **Export:** effect JSON (`niagara-lite/0.2`), a plain-text Niagara build sheet for rebuilding the effect by hand, flipbook PNGs (any grid, with an alpha-from-luminance option), and 5-second video recording. Saves to an on-device library and autosaves your work. Importing v1 JSON still works.

Units match Unreal: centimetres, Z-up, seconds and degrees. Code lives in `js/`: `core.js` holds the module registry, `presets.js` the presets, `sim.js` the CPU simulation, `render.js` the WebGL2 renderer, `textures.js` the procedural textures, and `app.js` the UI.

## UEFN handoff

Import the 1024×1024 4×4 PNG atlas into UEFN and configure a flipbook-capable sprite material (4 columns, 4 rows). The JSON and build sheet describe how to build the effect; they are not native Niagara assets. Rebuild the stack in UEFN's Niagara editor (some nodes aren't available there), or use the flipbook PNG with a SubUV material. Validate available UEFN Python scripting before automating Niagara construction.

## Repo layout

- Root: the installable PWA (`index.html`, `manifest.webmanifest`, `sw.js`, icons). Serve the root over HTTPS, e.g. GitHub Pages from `main` / root.
- `standalone/`: the original Effect Lab 001 single-file version (v1, three presets). Open `standalone/index.html` directly; no server needed.
