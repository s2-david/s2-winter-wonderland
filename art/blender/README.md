# Blender art

`winter_house.py` builds the low-poly winter diorama entirely from code (Blender 5.2), so the look can be tuned in text and reviewed in PRs. Shapes are deliberately a little irregular (lumpy roof snow, slightly off-square walls and frames, a leaning brick chimney) so the house reads as hand-made rather than machine-perfect. Renders and `.blend` files are output and are not committed.

## Render the diorama

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P winter_house.py -- \
    --variant dusk --samples 192 --res 1600 1200 --out renders/winter_house_dusk.png
```

`--variant` is `dusk` (blue hour, window glow) or `day` (golden afternoon). Add `--closeup` to frame the red house instead of the whole tile, and `--blend name.blend` to also save the scene for hand editing.

## Export the house for the planet

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P winter_house.py -- \
    --export ../../src/world/models/house.glb
```

This keeps only the red house and turns it into something cheap to draw in the browser:

- All parts are merged into one mesh with bevels applied. Smoke puffs and lights are dropped.
- The procedural materials (board siding, brick chimney, stone, snow, bushes, wreath) and ambient occlusion are baked by Cycles into one 1024² texture (`--bake-size` to change), so the body is a single draw call.
- No paper texture is baked in: the planet-wide grain shader (`src/grain.js`) adds it at runtime, so the house matches everything else.
- Windows, curtains and the lantern stay separate as two emissive materials. Their glow comes from emissive colour, not from lights.
- Each pane is also marked with an empty named `Halo`, scaled to the pane. The browser hangs a soft additive glow on these (one merged mesh, one draw call).

The result is about 7,400 triangles and 3 draw calls (4 with the halos) in a ~750 kB GLB. Most of the extra triangles are the lumpy roof snow and the bushes. `src/world/blenderHouse.js` loads and places it.

Baked occlusion is fine because the planet rotates under a fixed sun: directional shadows still come from the live sun. Don't bake the sun into the texture.
