# Winter Wonderland Planet

A dependency-free Three.js proof of concept: a tiny snowy planet, a walkable fixed character viewpoint, globe navigation, atmospheric snow, and a playable village bell.

## Run locally

Because the app uses ES modules, serve the project rather than opening the HTML file directly:

```sh
cd winter-wonderland-planet
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`.

## Controls

- **WASD / arrow keys** — walk; the globe turns beneath the explorer.
- **Mouse wheel** — zoom between close exploration and the full planet.
- **Z** or **View planet** — toggle a wide planet view.
- **E** — ring the bell when its interaction prompt is visible.

No art, sound, or paid assets are required. The little jingle is synthesized in-browser through the Web Audio API after a user interaction.
