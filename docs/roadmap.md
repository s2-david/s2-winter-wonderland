# Roadmap

## Where this is going

The planet grows from one small village into 5–6 themed mini-villages ("Candy Land", "Icy Forest" and other winter-scapes), each with interactive elements, so the whole planet becomes something to explore.

The visual style moves away from the current flat low-poly look toward a smoother, more detailed stylized diorama: rounded edges, soft baked shadows, warm glowing windows, fog and gentle glow. That look comes mostly from lighting, rounded edges and materials, not from a huge polygon count.

The experience has to stay smooth on phones as well as desktops.

## How it scales

The explorer always stands at the top of the planet, so most of the planet is below the horizon at any moment. Only the nearby village or two need to be loaded and drawn.

1. **Each village is its own module.** A village's models and code live in their own folder and download only when needed. Visitors start with the planet and one village; the rest load in the background.
2. **Load by distance, unload over the horizon.** A village starts loading as the explorer heads toward it, so it's ready when it comes into view. Villages behind the planet are hidden; far ones are removed from memory.
3. **Simpler versions at a distance (LOD).** Far-off villages use a simple stand-in model; full detail swaps in up close.
4. **Repeated objects drawn in batches (instancing).** Trees, rocks, candy canes and lamps are drawn once per object type, not once per object.
5. **Baked lighting, few live lights.** Shadows and glows are baked into textures in the 3D tool. At runtime: one sun with a shadow kept close to the explorer, an environment light, emissive windows plus a glow effect.
6. **Quality that adapts to the device.** Phones get lower resolution, fewer shadows and fewer effects; desktops get everything. Resolution drops automatically if the frame rate falls.
7. **Compressed assets.** Models as glTF/GLB with mesh compression (meshopt or Draco) and compressed textures (KTX2).
8. **A shared interaction system.** Each interactive object registers a position, range, prompt and action (the bell is the first). Collision checks only consider the nearby village.

## Phases

1. **Foundations**
   - [x] Vite project with split modules
   - [x] Vercel builds from source
   - [x] Mobile controls
   - [ ] Performance overlay (fps, draw calls, triangles) behind `?debug`
   - [ ] Village module system: load/unload by distance, horizon culling
   - [ ] Shared interaction system (move the bell onto it)
   - [ ] Per-village collision
2. **Prove the look**
   - [x] One detailed asset (a house or rock formation) made in Blender with baked lighting (the red house, baked colour + AO)
   - [ ] Asset pipeline: export glTF, compress, load in the scene (export and load done; compression still to do)
   - [ ] Test on a mid-range phone against the performance budget
3. **Lighting and effects**
   - [ ] Environment lighting, glow effect, fog, tone mapping
   - [ ] Device-based quality levels and dynamic resolution
4. **Villages, one at a time**
   - [ ] Village 1 (current village, rebuilt in the new style)
   - [ ] Candy Land
   - [ ] Icy Forest
   - [ ] …each checked against the performance budget before merging

## Open questions

- Planet size: six villages likely need a larger planet than the current radius of 10.
- Who builds the 3D art, and in which tool. AI 3D generators can give starting models but need cleanup.
- Story tracking: GitHub Issues or Asana.
