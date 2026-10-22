# Blender art

`winter_house.py` builds the low-poly winter diorama entirely from code (Blender 5.2), so the look can be tuned in text and reviewed in PRs. Renders and `.blend` files are output and are not committed.

## Render the diorama

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P winter_house.py -- \
    --variant dusk --samples 192 --res 1600 1200 --out renders/winter_house_dusk.png
```

`--variant` is `dusk` (blue hour, window glow) or `day` (golden afternoon). Add `--blend name.blend` to also save the scene for hand editing.

## Export the house for the planet

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P winter_house.py -- \
    --export ../../src/world/models/house.glb
```

This keeps only the red house and turns it into something cheap to draw in the browser:

- All parts are merged into one mesh with bevels applied. Smoke puffs and lights are dropped.
- The procedural materials (board siding, stone, snow, wreath) and ambient occlusion are baked by Cycles into one 1024² texture (`--bake-size` to change), so the body is a single draw call.
- No paper texture is baked in: the planet-wide grain shader (`src/grain.js`) adds it at runtime, so the house matches everything else.
- Windows, curtains and the lantern stay separate as two emissive materials. Their glow comes from emissive colour, not from lights.

The result is about 5,900 triangles and 3 draw calls in a ~550 kB GLB. `src/world/blenderHouse.js` loads and places it.

Baked occlusion is fine because the planet rotates under a fixed sun: directional shadows still come from the live sun. Don't bake the sun into the texture.
