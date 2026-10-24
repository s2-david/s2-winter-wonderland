# Decisions

Decisions already made, newest first. Check here before reopening a settled question. When you make a new decision, add an entry in the same PR: the date, what was decided, and why.

## 2026-10-24: Villages draw a lighter far-off version at the planet's edge

Orbiting put both villages on screen at 419k–488k triangles. Now each village has a far-off version, swapped in by `farVersion(group, degrees)` in `planet.js` once its spot is that far round from the view (`viewFrom`), with 1° of margin so a view resting on the switch doesn't flicker. The switch depends on the angle only, not on zoom: past those angles the close camera sees at most a steeple over the horizon, so close up and from the plaza nothing changes.

- **Gingerbread Land, from 60°.** Icing was 156k of its 207k triangles. The Blender export now adds `<House>_IcingFar`, `_CandyFar` and `_GumdropFar` meshes for each house design, decimated to 20–35% with their UVs kept, so they use the same baked texture. The far version draws those in place of the full trim, keeps dough, frosting and windows, and casts no shadows. Trees and candy fixtures stay full: simplifying the trees' scalloped icing took their white outlines away, which showed. Tried at 10%: icing dots disappeared and more pixels changed, for 15k triangles less. The GLB grew from 1.68 to 1.96 MB.
- **Winter village, from 43°.** Same houses, no shadows. Zoomed out, the houses' shadows change no pixels even 30° round, but they cost an 86k-triangle shadow pass.
- **No visible pop.** Measured by rendering the same view with each version. Without post-processing, at Gingerbread Land's 60° switch, 7 of ~99k village pixels change by more than 32 levels (of 255), and no 4×4-pixel block's average changes by more than 16. With post-processing on (bloom, tilt-shift), 235 of ~113k pixels change by more than 32 levels, along thin icing lines, but only 3 of ~7.6k blocks change by more than 16; side by side they look the same. Removing the winter shadows changes no pixels at all.
- **Result, dragging round in 5° steps (wide view, shadow pass included, `renderer.info` after one `renderer.render`):** 197k at the winter village, 252k–266k at 35–40°, 261k with 100 draw calls from 45° to 120°, then 310k–313k at Gingerbread Land. The orbit peak is now Gingerbread Land's own wide view, which was already 313k. A whole frame through the post-processing composer adds 23–28 draw calls (bloom draws the glowing windows again, plus the full-screen passes) and at most 1.7k triangles: 128 calls and 263k from 45° to 120°, 116 calls and 314k at Gingerbread Land's wide view.

## 2026-10-24: Dragging the zoomed-out planet orbits the camera, not the world

Zoomed out (past `ZOOM.orbit`), dragging with the mouse turns the planet to look it over; an arrow key, the joystick or zooming back in eases the view home to the explorer. The camera circles the planet's centre and the lights turn with it, rather than the `world` group rotating, because `world`'s rotation *is* the explorer's position: turning it would move the explorer and change the time of day. Turning the lights too keeps the side being looked at lit like the front. Horizon culling (`updateHorizon`) measures from the spot the camera is centred over (`viewFrom`), so orbiting round to another village shows it; time of day still follows the explorer, so a village seen from orbit keeps the explorer's light. Mouse only for now; one-finger drag on touch is open.

Known costs of orbiting, measured 2026-10-24 by dragging round from the winter village to Gingerbread Land in 5° steps (wide view, shadow pass included):

- **Triangle peak** (since fixed: with the far-off versions in the entry above, the orbit stays at 261k between the villages and peaks at Gingerbread Land's own 313k). Before them, from about 45° to 125° round, both villages were drawn in full, at 419k–488k triangles and 108–114 draw calls, over the 300k starting target (draw calls stay under 150). Outside that range it matches the existing views: 197k at the winter village, 310k at Gingerbread Land. It's desktop only, since orbiting needs a mouse. Through most of that range both villages really are on screen, one at each edge, so no horizon rule can avoid it: a per-part check against the true horizon was tried and drew both from 30° to 140°. Gingerbread Land drew all ~290k of its triangles even when only a few hundred pixels of it showed at the edge. Splitting villages into separately culled sections was ruled out, because it would push draw calls past 150 when standing in Gingerbread Land.
- **Edge pop-in.** The horizon check is still the original 90° + `reach` from the view. Zoomed out, the camera sees about 73° round the planet, but tall parts (roofs, the steeple) peek over the edge from further than 90° + `reach`. So a village is hidden while a sliver of it is still visible: up to 515 pixels of Gingerbread Land at 40° and 867 of the winter village at 130° (on a 2710×2800-pixel canvas). Normal play is unaffected, because the close camera sees much less of the planet. Kept because the exact per-part check removed the pop-in but drew both villages over a wider range.

## 2026-10-24: Post-processing for a miniature-diorama look

The scene now renders through the pmndrs `postprocessing` library (`src/post.js`) with one merged effect pass: a tilt-shift blur outside a band across the middle of the screen, bloom, tone mapping and a soft vignette. Bloom is selective: only objects passed to `glow()` (window panes, the bell) bloom, so sunlit snow on the day side never does. Bloom and vignette have night and `day*` strengths blended like the lights. Version 6.37.8 is pinned because it's the last release whose peer range covers three 0.161; three was not upgraded.

- Tone mapping moves from the materials into the effect pass, because three.js only tone-maps when rendering straight to the screen. The window panes' `toneMapped: false` no longer applies, so they go through ACES like everything else; bloom brings back their glow.
- The additive glow decals (light on the snow and halos around windows) now blend in linear light, which made them much stronger, so they are turned down while the pass is on (`glowDecal()`).
- The canvas's own MSAA doesn't apply to an offscreen buffer, so the composer's buffer gets 4× MSAA instead. SMAA wasn't needed.
- Tilt-shift is the screen-space kind, not depth of field: it needs no depth reads, costs about 5 draw calls, and reads as a miniature from any camera.
- Cost: about 23 extra draw calls (28 with tilt-shift) and 1–2 ms per frame at 2048×1536 on an M-series Mac. The busiest view (Gingerbread Land, wide) goes from 92 to 116 draw calls, under the 150 budget. The bundle grows about 18 kB gzipped.
- `tuning.postQuality` switches levels: touch devices start without tilt-shift, and 0 turns the pass off and renders exactly as before. It hasn't been measured on a real phone yet.

## 2026-10-24: Each village has its own material language

The winter village is paper: the paper grain shader on everything. Gingerbread Land is baked ginger dough, smooth glossy piped icing and shiny candy, and skips the grain. Each village should look as good as it can within the budget, so its materials are made for it rather than shared. For Gingerbread Land:

- The GLB holds one mesh per kind of surface (dough, frosting, icing, candy, gumdrop, window glass), each with its own material in `src/world/gingerbreadLook.js`: dough with a slight egg-wash sheen, glossy icing and frosting, clear-glazed hard candy (`MeshPhysicalMaterial` clearcoat), gumdrops with a little light glowing through, candy-glass windows lit from inside.
- Shiny surfaces need something to reflect, so the village has its own daytime sky reflection: a gradient sky with two soft light panels, built once with `PMREMGenerator`. It's on those materials only, not `scene.environment`, so the paper village is untouched.
- Icing is smooth round tubes now, not hand-wobbly or four-sided. Only the dough casts shadows; icing and candy are about one shadow-map pixel wide. That made the village cheaper than before (281k triangles in the wide view instead of 299k) despite the smoother icing.
- Dough and frosting get their own detailed texture sheet instead of sharing one with thousands of icing pieces, so walls have several times the texture detail.
- Fine dough detail (air pores and crumb) is drawn in the shader, in each model's own space, like the paper grain: crisp up close where the texture runs out of pixels, no download, fading out once smaller than a pixel. Walls are no longer randomly wobbled, because the wobble folded each flat wall along its triangles and the baked edge-browning picked up the folds as dark bands.
- Thick icing lines (frames, seams, ridges) use 12-sided tubes and drips are rounded beads; thin lines stay 8-sided. Windows are candy glass with a deep colour at the frame and a warm glow in the middle.
- Tone mapping stays ACES for the whole planet: AgX looked flatter on the candy and would also change the paper village. `lookdev.html` has controls to compare them.

With the rounder icing, Gingerbread Land is 289k triangles close up and 314k in the wide view, just over the 300k starting target. That target was set before the target devices were known (an iPhone 16 and a Windows laptop); raising it to about 500k is proposed but not yet measured on those devices.

`lookdev.html` shows any model under the game's lights for judging all this, on desktop or a phone. Target devices are an iPhone 16 and a Windows laptop (likely integrated graphics); the triangle budget should be revisited once measured on both.

## 2026-10-23: Gingerbread Land on the sunny side, and villages hidden over the horizon

The second village, Gingerbread Land, is centred at lat 0, lon 180, straight opposite the winter village, so it is always in full daylight. It is its own module (`src/world/gingerbread.js`), loaded by `main.js` as a separate chunk after the winter village is up, with its own GLB from `art/blender/gingerbread.py`. Houses stand in two rings around a steeple, facing it: the inner ring 17° (about 3 units) out, so the plaza inside is open to walk around, and the outer ring at 29°. Four paths lead in from north, south, east and west, kept clear for the explorer (candy canes line them, 0.56 units either side). Each house design is one instanced body plus one instanced roof frosting tinted per house, so the village is about 15 draw calls.

Instanced meshes are culled only as a whole, so a village behind the planet was still drawn, and drawn again in the shadow pass. `horizonGroup(lat, lon, reach)` in `planet.js` returns a group that `updateHorizon()` hides each frame while its spot is more than 90° + `reach` from the explorer. Both villages' houses use it; trees and cobbles, which spread across the planet in shared instanced meshes, don't. That keeps each village's view within the triangle budget: 198k at the winter village (unchanged) and about 275k close / 300k wide at Gingerbread Land. To get there, small candy pieces cast no shadow and the outer ring is four houses (the icing and shadow choices changed on 2026-10-24, above).

## 2026-10-23: Cobblestone road, laid on the snow's slope

The road's stepping-stone dots became about 330 cobblestones in staggered rows, thinning out at the ends and edges. They are one instanced flat-shaded stone (one draw call, about 12k triangles), each tinted, sized and turned on its own through a new `color` option on `instanced()`. Cobbles go down with `placeOnSnow()` in `planet.js`, which tilts each one to the snow surface under it and sinks it slightly; `place()` stands objects straight out from the planet's centre, which left one edge of a flat stone hanging off a drift's side. Turn speed now defaults to 0.5.

## 2026-10-23: Pillowy snow instead of a faceted planet

The ground is a finely divided sphere with smooth shading, raised into soft drifts: about 70 broad mounds with 220 smaller ones on top, seeded so the planet is the same on every visit. `snowHeight()` in `src/world/planet.js` gives the height anywhere, so the explorer rides over the drifts, and landmarks are still raycast onto the real surface. The faint faceted ice shell was removed because the drifts would poke through it. The ground went from under 1k to about 20k triangles, one draw call, which is the price of round drifts.

## 2026-10-23: Time of day follows where you are on the planet

There is no clock. The village is always at night, and walking toward the far side of the planet brings up the day, blending each light value from its night tuning to its day tuning. The lights already move with the explorer rather than the planet, so this costs nothing extra and keeps the village's lit windows at their best. Future villages get their time of day from where they sit on the planet.

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

Trees and path dots (now cobblestones) are drawn with one `InstancedMesh` per part (6 for trees, 1 for path dots) instead of one mesh per part per tree, which took the wide planet view from about 280 draw calls to 55. `makeTree()` and `makePathDot()` still return an object that `place()` / `placeBlocked()` position, so village code and collision blockers did not change: the object is an empty anchor whose pose is copied into the instances when it is added to the world. Each instanced mesh is culled as a whole, so off-screen trees now cost triangles in the close view (about 15k instead of 12k), which is well inside the budget. Anchors are placed once; moving or removing one later does not update its instances.

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
