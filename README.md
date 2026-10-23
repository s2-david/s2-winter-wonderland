# Winter Wonderland Planet

A Three.js experience: a tiny snowy planet, a walkable fixed character viewpoint, globe navigation, atmospheric snow, and a playable village bell.

## Develop

Requires Node 20.19+. Team workflow, conventions and the performance budget are in [CLAUDE.md](CLAUDE.md); plans and past decisions are in [docs/](docs/).

```sh
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

The **Tune scene** panel (sliders icon, top right) adjusts walk/turn speed, hero size, snow, the paper grain and the lighting. While `SHOW_TUNER` is `true` in `src/config.js` it shows for everyone; set it to `false` to show it only with `?debug`. Shipping defaults live in `tuning` in `src/config.js`; the panel's **Copy values** button gives JSON to paste there.

## Project layout

```
index.html            HUD markup; Vite entry
src/
  main.js             wires modules together and runs the frame loop
  config.js           planet radius, zoom limits, bell range, tuning defaults
  stage.js            scene, camera, renderer, lights, resize
  input.js            keyboard + joystick movement intent, one-shot key actions
  player.js           explorer model, steering, walking, collision
  cameraRig.js        zoom (wheel, pinch) and third-person / planet-view framing
  snow.js             falling snow particles
  audio.js            synthesized bell jingle (Web Audio)
  grain.js            kraft-paper grain shader added to every lit surface
  world/
    planet.js         planet mesh, surface placement, collision blockers
    props.js          tree and path-stone builders
    village.js        where everything is placed
    houses.js         instanced Blender house designs, tinted per house
    models/           GLB models exported from art/blender/
    bell.js           bell landmark and its swing
  ui/hud.js           sound/view buttons, bell prompt and button, toast
  ui/touch.js         touch detection and the on-screen joystick
  debug/tuner.js      ?debug tuning panel (loaded only when requested)
  styles.css
public/draco/         Draco decoder for compressed models (copied from three.js)
art/blender/          scripts that build, render and export Blender models (see its README)
```

`dist/` is build output and isn't committed. Vercel runs `npm run build` on every push and deploys the result; `main` goes to production, other branches get preview links.

## Controls

- **Arrow keys**: walk; the globe turns beneath the explorer.
- **Mouse wheel**: zoom between close exploration and the full planet.
- **Z** or **View planet**: toggle a wide planet view.
- **E**: ring the bell when its interaction prompt is visible.

On phones and tablets (or as soon as the screen is touched):

- **Joystick** (bottom left): push up to walk, down to back up, sideways to steer. Speed follows how far it's pushed.
- **Pinch**: zoom in and out.
- **Ring bell**: appears when the explorer is near the bell.

No art, sound, or paid assets are required. The little jingle is synthesized in-browser through the Web Audio API after a user interaction.
