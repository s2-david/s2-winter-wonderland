import * as THREE from 'three';

// Props that repeat a lot are drawn with one InstancedMesh per part, so every tree (or path dot)
// on the planet shares a handful of draw calls. `instanced(model)` returns a factory that hands out
// empty anchors: place()/placeBlocked() position an anchor as usual (and it still works as a
// collision blocker), and when it is added to the world its pose is copied into each part's instances.
function instanced(model, capacity) {
  const parts = model.children.map(part => {
    part.updateMatrix();
    return part;
  });
  let meshes = null;
  const pose = new THREE.Matrix4(), size = new THREE.Matrix4(), m = new THREE.Matrix4();

  return (scale = 1) => {
    const anchor = new THREE.Object3D();
    anchor.addEventListener('added', function onAdded() {
      anchor.removeEventListener('added', onAdded);
      if (!meshes) {
        meshes = parts.map(part => {
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
          mesh.castShadow = part.castShadow;
          mesh.count = 0;
          anchor.parent.add(mesh);
          return mesh;
        });
      }
      if (meshes[0].count === capacity) throw new Error(`Instanced prop capacity (${capacity}) reached; raise it in props.js`);
      anchor.updateMatrix();
      pose.multiplyMatrices(anchor.matrix, size.makeScale(scale, scale, scale));
      meshes.forEach((mesh, i) => {
        mesh.setMatrixAt(mesh.count++, m.multiplyMatrices(pose, parts[i].matrix));
        mesh.instanceMatrix.needsUpdate = true;
        // Recomputed on the next frustum check, so culling covers every instance.
        mesh.boundingSphere = null;
      });
    });
    return anchor;
  };
}

// A tree at scale 1. Every dimension is proportional to the scale, so instances are scaled copies of it.
function treeModel() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.15, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: '#77503a', flatShading: true }),
  );
  trunk.position.y = 0.35;
  g.add(trunk);
  const tierHeight = 0.8;
  const tiers = [0, 1, 2].map(i => ({ r: 0.55 - i * 0.11, y: 0.72 + i * 0.33 }));
  const crownMats = ['#286a60', '#377d6d'].map(color => new THREE.MeshStandardMaterial({ color, flatShading: true }));
  tiers.forEach(({ r, y }, i) => {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(r, tierHeight, 7), crownMats[i === 0 ? 0 : 1]);
    crown.position.y = y;
    crown.castShadow = true;
    g.add(crown);
  });

  // Snow follows each tier's slope, raised slightly off it, like the roof snow on houses.
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f5fbff', roughness: 1, flatShading: true });
  const snowLift = 0.03;
  // Radius of a tier's surface at height h, pushed out by the snow's thickness.
  const snowRadius = (tier, h) => tier.r * (tier.y + tierHeight / 2 - h) / tierHeight + snowLift;

  // Top tier: a cap over the tip.
  const top = tiers[2], capHeight = 0.3;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(capHeight * top.r / tierHeight, capHeight, 7), snowMat);
  cap.position.y = top.y + tierHeight / 2 + snowLift - capHeight / 2;
  g.add(cap);

  // Middle tier: its upper slope is hidden under the top tier, so snow sits on the band that shows
  // below the top tier's lower edge, tucked a little under that edge.
  const middle = tiers[1];
  const bandTop = top.y - tierHeight / 2 + 0.04, bandBottom = bandTop - 0.16;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(snowRadius(middle, bandTop), snowRadius(middle, bandBottom), bandTop - bandBottom, 7),
    snowMat,
  );
  band.position.y = (bandTop + bandBottom) / 2;
  g.add(band);
  return g;
}

// Room for 5–6 villages' worth of trees.
export const makeTree = instanced(treeModel(), 512);

export function makeHouse(color) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.95), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  walls.position.y = 0.45;
  walls.castShadow = true;
  g.add(walls);

  const roofRadius = 0.93, roofHeight = 0.72, roofY = 1.16;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(roofRadius, roofHeight, 4), new THREE.MeshStandardMaterial({ color: '#3c4666', flatShading: true }));
  roof.position.y = roofY;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  // Snow blankets the upper part of the roof: same slope as the roof, raised slightly off it,
  // so it reads as a layer lying on the roof with a small lip where it ends.
  const snowHeight = 0.42, snowLift = 0.04;
  const snowRoof = new THREE.Mesh(
    new THREE.ConeGeometry(snowHeight * roofRadius / roofHeight, snowHeight, 4),
    new THREE.MeshStandardMaterial({ color: '#f8fcff', roughness: 1, flatShading: true }),
  );
  snowRoof.position.y = roofY + roofHeight / 2 + snowLift - snowHeight / 2;
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

function pathDotModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.035, 8),
    new THREE.MeshStandardMaterial({ color: '#b7d3dd', roughness: 1, flatShading: true }),
  ));
  return g;
}

export const makePathDot = instanced(pathDotModel(), 512);
