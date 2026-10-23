# Decisions

Decisions already made, newest first. Check here before reopening a settled question. When you make a new decision, add an entry in the same PR: the date, what was decided, and why.

## 2026-10-23: Pillowy snow instead of a faceted planet

The ground is a finely divided sphere with smooth shading, raised into soft drifts: about 70 broad mounds with 220 smaller ones on top, seeded so the planet is the same on every visit. `snowHeight()` in `src/world/planet.js` gives the height anywhere, so the explorer rides over the drifts, and landmarks are still raycast onto the real surface. The faint faceted ice shell was removed because the drifts would poke through it. The ground went from under 1k to about 20k triangles, one draw call, which is the price of round drifts.

## 2026-10-22: The village is a square around the bell, entered by the road

Houses stand in two rings around the bell, facing it, with trees around the edge. One road crosses the square north to south, and the explorer starts on it at the square's north edge, facing the bell. That keeps the third-person camera, which sits behind the explorer, over open road at the start instead of inside a roof. Anything new in the village should keep the road and the camera's view behind the start point clear.

## 2026-10-22: Houses are a few instanced designs, varied by colour and light

Rather than one unique model per house, a handful of Blender designs (cottage, townhouse, cabin, A-frame) share one baked texture and are drawn with instancing. Each house picks a design, a wall colour (walls are baked near-white and tinted at runtime) and how lit its windows are. Seven detailed houses cost fewer draw calls than the old primitive houses, replace six point lights with none, and download as one ~770 kB file (Draco meshes, WebP texture). Character should come from silhouettes, colours, lit windows and props before adding new designs.

## 2026-10-22: Paper and lighting look set from the tuning panel (being evaluated)

Grain and lighting are all tuning values, so the style can be changed without code. The defaults were dialled in by hand in the tuning panel: soft paper grain with some blotches and relief, a low, dim sun from behind, a strong moon, little sky fill, and ACES tone mapping. Live ambient occlusion was left out because it's too costly on phones; bake it into models instead.

## 2026-10-22: Paper grain across the whole scene

To move toward a handmade paper-model look, every lit surface gets a procedural kraft-paper grain (blotchy tone, fine fibres) in its shader instead of baked textures. One shader patch keeps the scene consistent, adds no downloads or draw calls, and is pinned to the planet so it doesn't swim as the planet turns. Fine detail fades out with distance to avoid shimmer. The strength is a tuning slider (default 1.5, 0 turns it off) while the look is being decided. The Blender house was simplified to match: thin crisp roof snow, no icicles or snow lumps.

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
