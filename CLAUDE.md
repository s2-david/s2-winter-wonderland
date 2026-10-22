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
- Input: keyboard and the on-screen joystick both feed `moveIntent()` in `src/input.js`. Arrow keys move; E is the action key; Z toggles zoom. WASD is intentionally not supported.
- Tunable values live in `tuning` in `src/config.js`. The tuning panel (`src/debug/tuner.js`) shows for everyone while `SHOW_TUNER` is `true`; otherwise only with `?debug`. Its "Copy values" button produces JSON to paste back into `tuning` as new defaults.
- Touch UI: `body.touch` is set on touch devices (`src/ui/touch.js`). Use `.touch-only` / `.keys-only` for content that differs between phone and desktop.
- Authored models are built in Blender from scripts in `art/blender/` and exported as GLB into `src/world/models/`, with colour and ambient occlusion baked into one texture and glow kept as emissive materials (no lights). Import them with `?url` so Vite hashes them. See `art/blender/README.md`.
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

Current baseline (one village, measured 2026-10-22 with `renderer.info` after one render, shadow pass included): about 46 draw calls and 15k triangles in the close view; about 55 draw calls and 15k triangles in the wide planet view. Trees and path dots are instanced; the houses (one draw call per part, plus a point light each) are now the largest remaining cost.

To measure, run this in the dev server's console, with the camera at (0, 4.7, 34) looking at the origin for the wide view, or at (0, 4.5, 12.2) looking at (0, -2, 9.8) for the close view:

```js
const { scene, camera, renderer } = await import('/src/stage.js');
camera.position.set(0, 4.7, 34); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
renderer.render(scene, camera); renderer.info.render; // { calls, triangles, ... }
```

- Share materials and geometry between repeated objects; use instancing for anything that repeats a lot (trees, rocks, lamps). `instanced(model, capacity)` in `src/world/props.js` turns a model group into a factory of anchors that `place()` / `placeBlocked()` position as usual, drawn with one `InstancedMesh` per part.
- Avoid adding real-time point lights. Each one is computed for every pixel. Prefer emissive materials or baked lighting.
- Dispose of geometry, materials and textures when removing objects.

## Checking your work

- Run `npm run dev` and check the change on desktop and at phone size with touch (browser dev tools, or the Claude browser pane's mobile viewport).
- Watch the browser console for errors.
- After pushing, open the Vercel preview from the PR and try it on a real phone for anything touch-related.

## Docs

- `docs/roadmap.md`: where the project is going and the plan for scaling to multiple villages.
- `docs/decisions.md`: decisions already made and why. Check it before reopening a settled question; add to it when you make a new one.
