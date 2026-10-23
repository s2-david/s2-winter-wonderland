# Decisions

Decisions already made, newest first. Check here before reopening a settled question. When you make a new decision, add an entry in the same PR: the date, what was decided, and why.

## 2026-10-22: Tree variety from a few shapes, not one model per tree

Trees come in four shapes (`fir`, `spruce` tall and narrow, `bush` short and wide, `spire` slim), each built once in code and merged into one vertex-coloured mesh: 2 draw calls per shape including shadows. Each tree is further varied by its own width, height and a random turn, and some stand in clusters. Their snow follows the houses' Blender style: roughened, with uneven dripping edges, small lumps over the edges and a drift at the foot. All randomness is seeded, so the planet looks the same on every visit.

## 2026-10-22: Repeated props are instanced behind placeable anchors

Trees and path dots are drawn with one `InstancedMesh` per part (6 for trees, 1 for path dots) instead of one mesh per part per tree, which took the wide planet view from about 280 draw calls to 55. `makeTree()` and `makePathDot()` still return an object that `place()` / `placeBlocked()` position, so village code and collision blockers did not change: the object is an empty anchor whose pose is copied into the instances when it is added to the world. Each instanced mesh is culled as a whole, so off-screen trees now cost triangles in the close view (about 15k instead of 12k), which is well inside the budget. Anchors are placed once; moving or removing one later does not update its instances.

## 2026-10-22: Blender models are scripted and baked for the web

The first authored model (the red Scandinavian house) is built by a Python script in `art/blender/` rather than by hand, so changes are reviewable and repeatable. The web export merges the model into one mesh, bakes procedural colour and ambient occlusion into one texture, and keeps windows as emissive materials: 3 draw calls and no lights. Sun shadows are not baked because the planet rotates under a fixed sun. Glow on the snow is faked with an additive decal instead of a point light. Mesh compression (Draco or meshopt) is not set up yet.

## 2026-10-22: Shared context lives in the repo

`CLAUDE.md`, `docs/` and `.claude/` are committed so every teammate's Claude session starts from the same project knowledge. Personal preferences go in `CLAUDE.local.md` (git-ignored). Each story gets its own branch, PR and Claude session.

## 2026-10-22: Vercel builds from source; `dist/` is not committed

Vercel runs `npm run build` on every push. `main` deploys to production; other branches get preview links. Committing build output caused noise in every commit and would not scale to large 3D assets.

## 2026-10-22: Tuning panel visible to everyone (temporary)

While the scene is being tuned, `SHOW_TUNER` in `src/config.js` is `true`, so the panel shows on the live site. Set it to `false` once tuning settles; the panel will then only appear with `?debug`.

## 2026-10-22: Arrow keys only on desktop

Arrow keys walk and steer, E is the action key, scroll zooms, Z toggles zoom. WASD was removed to keep the controls and instructions simple.

## 2026-10-22: Icon-only controls and instruction cards

Sound, Zoom and Tune are round icon buttons. Instruction cards use icons and a few words: arrow keys / "Press E for actions" / "Scroll to zoom" on desktop; "Drag to walk" / "Pinch to zoom" / "Tap for actions" on phones.

## 2026-10-22: Lucide for icons

Icons come from Lucide (ISC license), pasted as inline SVG with a credit comment. Keeps the icon style consistent.

## 2026-10-22: Mobile controls

On touch devices: an on-screen joystick (chosen over tap-to-walk because it matches the keyboard controls), a contextual action button that appears near interactive objects, and pinch to zoom.

## 2026-10-22: Vite + vanilla Three.js

The prototype was restructured into a Vite project with small modules. Three.js is an npm dependency pinned at `0.161.0`. No UI framework for now.

## Planned: art direction and scaling approach

Move toward a smooth, detailed stylized diorama look using baked lighting and authored glTF models, with villages loaded by distance. See `docs/roadmap.md`.
