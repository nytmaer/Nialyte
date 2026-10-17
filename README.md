# NytLite — Effect Lab

NytLite is a browser-based particle effect editor laid out like Unreal Engine's Niagara. You build effects from **systems**, **emitters** and **modules**, preview them live in 3D, and export what you made.

**Open it:** https://nytmaer.github.io/NytLite/

It runs in a desktop browser with WebGL2 (Chrome, Edge, Firefox or Safari). Nothing to install.

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nytmaer)

---

## Quick start

1. Open the app. It loads the **Boost Burst** preset.
2. Use the **preset menu** (top left, shows the current system name) to load one of the 19 ready-made effects, e.g. **Campfire** or **City Eraser (black hole)**.
3. In the left panel, click an **emitter** to select it, then open any **module** to change its values. The preview updates as you edit.
4. Press **⟲ Restart** to replay the effect from the beginning.

## The viewport

| Action | Mouse | Touch |
|---|---|---|
| Orbit | drag | one-finger drag |
| Pan | right-drag or Shift-drag | two-finger drag |
| Zoom | scroll wheel | pinch |
| Reset camera | double-click or 🎥 | 🎥 |

The bar under the preview has **⏸ / ▶** (pause / play), **⏭** (step one frame) and a **speed** menu (0.1× to 2×). The top-left readout shows the frame rate, particle count and elapsed time.

## How an effect is organised

- **System**: the whole effect. Open the **System** card for warmup time, fixed tick rate, preview speed, overall spawn scale, background, ground and **Component Motion**. Component Motion moves the effect along a path (orbit, back & forth, figure eight, bounce, rising spiral or a straight sweep) so you can see trails and movement-based spawning.
- **Emitters**: the list under **Emitters**. Each row has an on/off checkbox, a live particle count and an **S** (solo) button. Under the list you can **+ Add emitter…** from 14 starting templates, plus **Duplicate**, **↑ ↓** (reorder) and **Delete**.
- **Emitter Properties**: loop behaviour (Infinite / Once / Multiple), loop duration and delay, local or world space, a fixed random seed, max particles and spawn count scale. You can also set the emitter to **Lightweight** mode, which flags any module Unreal's lightweight emitters don't support.
- **Module stacks**, in Niagara's order:
  - **Emitter Update**: spawning (Spawn Rate, Spawn Burst Instantaneous, Spawn Per Unit)
  - **Particle Spawn**: runs once per particle (Initialize Particle, Shape Location, Add Velocity, and more)
  - **Particle Update**: runs every frame (forces, color, size, rotation, flipbook animation, collision, kill volumes, events)
  - **Event Handlers**: spawn particles from another emitter's death, collision or location events
  - **Render**: Sprite, Ribbon, Mesh, Light and Decal renderers

Each module has an on/off checkbox, **↑ ↓** to reorder and **✕** to remove. Add new ones with the **+ Add module…** menu under each stack. Warnings appear above the stacks when something won't work, such as an emitter with nothing spawning or no renderer.

**Editing values:**
- **Numbers:** drag the slider or type a value.
- **Ranges:** min and max per particle.
- **Curves:** click to add a key, drag to move it, double-click to delete it. There's also a **Preset…** menu.
- **Gradients:** **+ stop**, then set each stop's position, color and alpha.
- **Textures:** pick a built-in one, or **⤒ Upload image…** to use your own.

**Units match Unreal:** centimetres, Z-up, seconds and degrees. Colors are a hex color × intensity.

## Saving

- NytLite **autosaves** your current effect in the browser and reopens it next time.
- **Save** stores the effect under a name in the **Library** menu on this device. Pick it from Library to load it, or from the Delete section to remove it.
- Your library lives in this browser only. Use **Export → Effect JSON** to keep a copy or move it to another device.

## Import & export

From the **Export ▾** menu:

- **Effect JSON:** the full effect as a `.nytlite.json` file. Load it back with **Import**.
- **Niagara build sheet (.txt):** every emitter, module and value written out in Niagara's names and order, as a checklist for rebuilding the effect by hand in Unreal.
- **Flipbook PNG…:** renders the effect from the current camera into a sprite sheet. You choose the grid (e.g. 4×4), frame size, duration, start time and background (black, transparent from brightness, or the scene).

**Import** also opens JSON files exported from the original Effect Lab 001.

## Running it yourself

Serve the repo root from any static web server (it's plain HTML, CSS and JavaScript, with no build step), for example:

```
python -m http.server 8000
```

Then open `http://localhost:8000`. The live site is published by GitHub Pages from the `main` branch.

## Repo layout

| Path | What it is |
|---|---|
| `index.html`, `css/app.css` | Page and styles |
| `js/core.js` | Module, emitter and system definitions (parameters and behaviour) |
| `js/presets.js` | System presets and emitter templates |
| `js/sim.js` | Particle simulation |
| `js/render.js` | WebGL2 renderer |
| `js/textures.js` | Built-in procedural textures |
| `js/app.js` | Editor UI, camera, import/export |
| `standalone/` | The original Effect Lab 001 (single file; open `standalone/index.html` directly) |

## Support

If you find this project useful, you can support its development on Ko-fi: **[ko-fi.com/nytmaer](https://ko-fi.com/nytmaer)**
