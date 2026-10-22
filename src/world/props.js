import * as THREE from 'three';

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10 * scale, 0.15 * scale, 0.7 * scale, 6),
    new THREE.MeshStandardMaterial({ color: '#77503a', flatShading: true }),
  );
  trunk.position.y = 0.35 * scale;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const r = (0.55 - i * 0.11) * scale, y = (0.72 + i * 0.33) * scale;
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(r, 0.8 * scale, 7),
      new THREE.MeshStandardMaterial({ color: i === 0 ? '#286a60' : '#377d6d', flatShading: true }),
    );
    crown.position.y = y;
    crown.castShadow = true;
    g.add(crown);
    if (i > 0) {
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.72, 0.18 * scale, 7),
        new THREE.MeshStandardMaterial({ color: '#f5fbff', roughness: 1, flatShading: true }),
      );
      cap.position.y = y + 0.34 * scale;
      g.add(cap);
    }
  }
  return g;
}

export function makeHouse(color) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.95), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  walls.position.y = 0.45;
  walls.castShadow = true;
  g.add(walls);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.93, 0.72, 4), new THREE.MeshStandardMaterial({ color: '#3c4666', flatShading: true }));
  roof.position.y = 1.16;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const snowRoof = new THREE.Mesh(new THREE.ConeGeometry(0.96, 0.18, 4), new THREE.MeshStandardMaterial({ color: '#f8fcff', roughness: 1, flatShading: true }));
  snowRoof.position.y = 1.38;
  snowRoof.rotation.y = Math.PI / 4;
  g.add(snowRoof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.025), new THREE.MeshStandardMaterial({ color: '#623b32' }));
  door.position.set(0, 0.22, 0.488);
  g.add(door);

  const glow = new THREE.PointLight('#ffc464', 1.8, 3.5);
  glow.position.set(0, 0.68, 0.65);
  g.add(glow);

  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: '#ffd56a' }));
  win.position.set(0.33, 0.58, 0.49);
  g.add(win);
  return g;
}

export function makePathDot() {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.035, 8),
    new THREE.MeshStandardMaterial({ color: '#b7d3dd', roughness: 1, flatShading: true }),
  );
}
