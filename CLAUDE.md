# Winter Wonderland Planet

A Three.js web experience: a small snowy planet the visitor explores by walking an explorer across it, with interactive villages. Live at https://s2-winter-wonderland-dist.vercel.app. Several people work on this repo at once, each on their own branch.

This file is the shared context for everyone's Claude sessions. Keep it accurate: when a convention or decision changes, update this file (and `docs/decisions.md`) in the same PR.

## Commands

```sh
npm install
npm run dev       # http://localhost:5173 with hot reload
npm run build     # production build into dist/ (also run by Vercel)
npm run preview   # serve the production build locally
```

Node 20.19+ (Vite 8). There are no tests yet; verify changes in the browser (see "Checking your work").

## Workflow

- One story = one ticket, one branch, one PR. Branch from an up-to-date `main` with a short kebab-case name (`candy-land-village`, `fix-bell-range`).
- Never push to `main` directly. Open a PR into `main`; merging deploys to production.
- Vercel builds every push from source. Every branch gets a preview deployment linked from the PR checks (previews require a Vercel login or a share link).
- `dist/` is build output and is not committed.
- Keep PRs small and merge often. Bring `main` into long-running branches regularly; `src/config.js` and `src/styles.css` are the files most likely to conflict.
- Fill in the PR template, including how the change was tested on desktop and phone.
- Start a new Claude session for each story. Personal preferences (your GitHub account, writing style) go in `CLAUDE.local.md`, which is git-ignored.

## Hosting

- GitHub: `s2-david/s2-winter-wonderland`
- Vercel: team `s2-950a`, project `s2-winter-wonderland-dist`. Framework preset Vite, root directory `./`, output `dist`. `main` is production.

## Architecture

Vanilla Three.js (pinned to `0.161.0`) bundled with Vite. No UI framework. See the layout in `README.md`.

- The explorer (`src/player.js`) stays fixed at the top of the planet. Walking and steering rotate the `world` group (`src/world/planet.js`) beneath them, so "forward" is always screen-up.
- Objects go on the planet with `place()` / `placeBlocked()` in `planet.js`, using latitude/longitude. `placeBlocked` also registers a collision radius.
- Input: keyboard and the on-screen joystick both feed `moveIntent()` in `src/input.js`. Arrow keys move; E is the action key; Z toggles zoom. WASD is intentionally not supported. Zoomed out, a mouse drag orbits the camera (and the `lights` group in `stage.js`) around the planet; `src/cameraRig.js` eases it back when the explorer moves.
- Tunable values live in `tuning` in `src/config.js`. The tuning panel (`src/debug/tuner.js`) shows for everyone while `SHOW_TUNER` is `true`; otherwise only with `?debug`. Its "Copy values" button produces JSON to paste back into `tuning` as new defaults.
- Touch UI: `body.touch` is set on touch devices (`src/ui/touch.js`). Use `.touch-only` / `.keys-only` for content that differs between phone and desktop.
- Each village has its own material language: the winter village is paper, Gingerbread Land is baked dough, icing and candy. In the winter village every lit `MeshStandardMaterial` gets a paper grain from `src/grain.js` (the `grain*` values in `tuning`). Sun, sky fill, shadow blur, exposure and tone mapping are also in `tuning`, applied by `applyLightTuning()` in `src/stage.js`. `main.js` adds it to everything under `world` at startup; anything added later (for example a loaded GLB) must call `addGrain()` on itself. Emissive materials are skipped.
- Time of day follows position: the village is at night and the far side of the planet is in daylight. `src/daylight.js` measures how far the explorer has walked from the village and blends each light value from its night tuning to its `day*` tuning, between `dawnStart` and `dawnEnd` degrees.
- Every frame is drawn by `renderFrame()` in `src/post.js`, through a pmndrs `postprocessing` composer (pinned to 6.37.8, the last release that supports three 0.161) with one effect pass: tilt-shift, bloom, tone mapping and a vignette. Tone mapping happens in that pass, since three.js skips it when rendering into a buffer. Only objects passed to `glow()` bloom (window panes, the bell); additive glow decals must be registered with `glowDecal()` so they're turned down while the pass is on. `tuning.postQuality` is 0 (off, plain `renderer.render`), 1 (no tilt-shift, the default on touch devices) or 2 (everything).
- Authored models are built in Blender from scripts in `art/blender/` and exported as Draco-compressed GLB into `src/world/models/`, with colour and ambient occlusion baked into one shared texture and glow kept as emissive materials (no lights). Import them with `?url` so Vite hashes them. See `art/blender/README.md`.
- Houses come from a few Blender designs (`houses.glb`). `src/world/houses.js` draws every copy of a design with instancing and tints walls and window light per house; `village.js` lists which design goes where. Prefer a new colour or prop over a new design, and a new design over a one-off model.
- Gingerbread Land, the second village, is on the sunny far side (lat 0, lon 180). Its models come from `art/blender/gingerbread.py` (`gingerbread.glb`), and `src/world/gingerbread.js` lays it out; `main.js` loads that module as its own chunk. Roof frosting is baked white and tinted per house. `src/world/gingerbreadLook.js` gives each kind of surface (dough, frosting, icing, candy, gumdrop, window glass) its own material, with a daytime sky reflection so candy and icing shine; it doesn't use the paper grain.
- `lookdev.html` (`src/lookdev.js`) shows one model at a time under the game's own lights, to judge shading and texture. It's built too, so it can be opened on a phone from a Vercel preview.
- Village houses go in a `horizonGroup()` (`planet.js`), hidden while the village is over the horizon, because instanced meshes are only culled as a whole. Put a new village's meshes in one too. `farVersion()` adds a lighter copy drawn instead once the village is far round from the view: Gingerbread Land's uses simplified icing exported as `<House>_<Kind>Far`, the winter village's drops shadows.
- The planned structure for multiple villages (each village as its own lazily loaded module, loaded by distance) is in `docs/roadmap.md`.

## Conventions

- Match the surrounding code: small modules, plain functions, short comments that explain *why*.
- Icons are Lucide (https://lucide.dev), pasted as inline SVG with a `<!-- Lucide "name" icon (ISC license, lucide.dev) -->` comment. Take paths from the `lucide-static` package, don't redraw them.
- Icon-only buttons need an `aria-label` and a `title` tooltip.
- Every UI change must work at phone size (375×812, touch) and on desktop.
- Colors and spacing follow the existing values in `src/styles.css`; reuse them rather than introducing new ones.

## Performance budget

The planet will grow to 5–6 detailed villages, so keep an eye on cost from the start. Starting targets, measured at the busiest view:

- Draw calls per frame: under 150
- Triangles per frame: under 300k
- Frame rate: 60 fps on desktop, 30+ fps on a mid-range phone

Current baseline (measured 2026-10-24 with `renderer.info` after one `renderer.render`, shadow pass included): at the winter village, 63 draw calls and 197k triangles (close and wide); at Gingerbread Land, 84 draw calls and 289k triangles close, 92 and 313k wide, just over the 300k starting target in the wide view (see `docs/decisions.md`, 2026-10-24). Orbiting the zoomed-out view in 5° steps peaks at Gingerbread Land's own 313k: between the villages each draws its lighter far-off version (`farVersion()` in `planet.js`), 261k and 100 draw calls from 45° to 120° round. A whole frame through the post-processing composer (`renderFrame()` in `src/post.js`) adds 23–28 draw calls and under 2k triangles, so 128 draw calls at most. A new village should get a far-off version too. Only the dough casts shadows there; icing and candy are too thin for the shadow map to show. The smooth snow ground is about 20k of those triangles. Trees, road cobblestones and houses are instanced. To measure Gingerbread Land, first turn the planet so it faces the camera (`world.quaternion.set(0, 1, 0, 0)`), then call `updateDaylight()` and `updateHorizon()` before rendering. Import those modules by the URL the page loaded (`performance.getEntriesByType('resource')`), not a plain path: after a hot reload a plain import gets a second copy of the module.

Post-processing (2026-10-24) adds about 23 draw calls without tilt-shift and 28 with it, plus about 1–2 ms per frame at 2048×1536 on an M-series Mac: 63 → 91 at the winter village and 92 → 116 at Gingerbread Land (wide view). Triangles barely change.

To measure, run this in the dev server's console, with the camera at (0, 4.7, 34) looking at the origin for the wide view, or at (0, 4.5, 12.2) looking at (0, -2, 9.8) for the close view. The composer renders several passes, so turn off `info.autoReset` to count them all:

```js
const { camera, renderer } = await import('/src/stage.js');
const { renderFrame } = await import('/src/post.js');
camera.position.set(0, 4.7, 34); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
renderer.info.autoReset = false; renderer.info.reset();
renderFrame(0.016); renderer.info.render; // { calls, triangles, ... }
renderer.info.autoReset = true;
```

- Share materials and geometry between repeated objects; use instancing for anything that repeats a lot (trees, rocks, lamps). `instanced(model, capacity)` in `src/world/props.js` turns a model group into a factory of anchors that `place()` / `placeBlocked()` position as usual, drawn with one `InstancedMesh` per part. Merging a model's parts into one geometry with vertex colours (as the trees do) makes it a single draw call.
- Avoid adding real-time point lights. Each one is computed for every pixel. Prefer emissive materials or baked lighting.
- Dispose of geometry, materials and textures when removing objects.

## Checking your work

- Run `npm run dev` and check the change on desktop and at phone size with touch (browser dev tools, or the Claude browser pane's mobile viewport).
- Watch the browser console for errors.
- After pushing, open the Vercel preview from the PR and try it on a real phone for anything touch-related.

## Docs

- `docs/roadmap.md`: where the project is going and the plan for scaling to multiple villages.
- `docs/decisions.md`: decisions already made and why. Check it before reopening a settled question; add to it when you make a new one.
