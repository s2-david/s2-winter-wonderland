# Blender art

`winter_house.py` builds the low-poly winter diorama entirely from code (Blender 5.2), so the look can be tuned in text and reviewed in PRs. Shapes are deliberately a little irregular (lumpy roof snow, slightly off-square walls and frames, a leaning brick chimney) so the house reads as hand-made rather than machine-perfect. Snow is smooth-shaded (`soft()`) so drifts look rounded, while walls and trim keep their crisp flat facets. Renders and `.blend` files are output and are not committed.

## Render the diorama

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P winter_house.py -- \
    --variant dusk --samples 192 --res 1600 1200 --out renders/winter_house_dusk.png
```

`--variant` is `dusk` (blue hour, window glow) or `day` (golden afternoon). Add `--closeup` to frame the red house instead of the whole tile, `--lineup` to render every house design side by side, and `--blend name.blend` to also save the scene for hand editing.

## House designs

`DESIGNS` in `winter_house.py` holds one recipe per house design for `house()`: size, roof pitch, windows, door, chimney or stovepipe, porch, lean-to, shutters and bushes. There are four: **Cottage** (the red Scandinavian house), **Townhouse** (tall, two storeys, shutters), **Cabin** (long and low, porch) and **Aframe** (steep roof, lean-to woodshed). To add one, add a recipe, check it with `--lineup`, re-export, then give it a collision radius in `src/world/houses.js`.

## Export the houses for the planet

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P winter_house.py -- \
    --export ../../src/world/models/houses.glb
```

Every design goes into one GLB, built to be cheap in the browser:

- Each design is merged into a few meshes with bevels applied: `<Design>_Body`, `<Design>_Walls` and `<Design>_Glow`. Smoke puffs and lights are dropped.
- The procedural materials (board siding, brick chimney, stone, snow, bushes, wreath) and ambient occlusion of all designs are baked by Cycles into **one shared 2048² texture** (`--bake-size` to change).
- Walls are baked near-white so the browser can tint them per house. That's how one design comes in several colours.
- No paper texture is baked in: the planet-wide grain shader (`src/grain.js`) adds it at runtime, so the houses match everything else.
- Windows, curtains and lanterns are two emissive materials. Their glow comes from colour, not from lights, and the browser dims them per house for houses with nobody home.
- Each pane is marked with an empty named `Halo_<Design>`, scaled to the pane. The browser hangs a soft additive glow on these.
- Meshes are Draco-compressed and the texture is WebP. The Draco decoder lives in `public/draco/` (copied from `three/examples/jsm/libs/draco/gltf/`).

The four designs total about 30,000 triangles in a ~770 kB GLB. `src/world/houses.js` draws every copy of a design with instancing, so the whole village costs about 17 draw calls however many houses stand on the planet. `src/world/village.js` lists the houses: design, wall colour, how lit the windows are, and position.

## Gingerbread Land

`gingerbread.py` builds the second village's models the same way: five gingerbread house designs (**Cottage**, **Townhouse**, **Hall**, **Tower**, **Steeple**), two gingerbread trees and candy fixtures (candy cane, lollipop, gumdrops). Everything is procedural: mottled gingerbread with browned edges and air pits, piped icing tubes, dripping eaves, fish-scale roof frosting, gumdrops, peppermints and hard-candy windows.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P gingerbread.py -- --scene diorama --samples 160
/Applications/Blender.app/Contents/MacOS/Blender -b -P gingerbread.py -- --export ../../src/world/models/gingerbread.glb
```

`--scene` is `diorama` (a cluster like a paper-village display), `lineup` or `closeup`. The export differs from the winter houses. Every model is split into one mesh per kind of surface, `<Key>_Dough`, `_Frosting`, `_Icing`, `_Candy`, `_Gumdrop` and `_Glass`, so the browser can shade each its own way (`src/world/gingerbreadLook.js`). Dough, frosting, candy and windows share a detailed 2048² sheet (colour with soft shadow, plus a bump map); icing and gumdrops are plain colours and share a 1024² sheet. Gaps between texture islands are filled with the sheet's average colour so tiny pieces don't darken at a distance. Roof frosting is baked near-white so the browser can tint it per house. Each house design also gets a far-off version of its trim, `<Key>_IcingFar`, `_CandyFar` and `_GumdropFar`, decimated to 20–35% with the same UVs. The village draws these instead of the full trim when it's at the planet's edge, and `lookdev.html` shows them with "Far version". About 87k triangles in total (74k without the far versions), ~2 MB. Check the result in `lookdev.html`.

Baked occlusion is fine because the planet rotates under a fixed sun: directional shadows still come from the live sun. Don't bake the sun into the texture.

## The snowman

`snowman.py` builds the papercraft snowman explorer. It's authored in the game's own Y-up units (the numbers once lived in `src/player.js`), and renders a preview:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P snowman.py -- \
    --samples 128 --out renders/snowman.png --blend snowman.blend
```

Export it for the game with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P snowman.py -- \
    --export ../../src/world/models/snowman.glb
```

It's exported differently from the houses, because it's small (about 100 kB) and animated:

- No texture: each facet's tone and the soft occlusion (in the neck crease and at the base) are baked into vertex colours. `player.js` gives every part one shared matte card material.
- No Draco, which keeps the smile's shape key simple to load.
- `src/player.js` animates the parts by name, so keep these names: `Body`, `Head`, `Arm0`/`Arm1`, `Eye0`/`Eye1`, `Cheek0`/`Cheek1`, and `Smile` with its `Beam` shape key (the deeper smile when the snowman beams).
