import * as THREE from 'three';

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10 * scale, 0.15 * scale, 0.7 * scale, 6),
    new THREE.MeshStandardMaterial({ color: '#77503a', flatShading: true }),
  );
  trunk.position.y = 0.35 * scale;
  g.add(trunk);
  const tierHeight = 0.8 * scale;
  const tiers = [0, 1, 2].map(i => ({ r: (0.55 - i * 0.11) * scale, y: (0.72 + i * 0.33) * scale }));
  tiers.forEach(({ r, y }, i) => {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(r, tierHeight, 7),
      new THREE.MeshStandardMaterial({ color: i === 0 ? '#286a60' : '#377d6d', flatShading: true }),
    );
    crown.position.y = y;
    crown.castShadow = true;
    g.add(crown);
  });

  // Snow follows each tier's slope, raised slightly off it, like the roof snow on houses.
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f5fbff', roughness: 1, flatShading: true });
  const snowLift = 0.03 * scale;
  // Radius of a tier's surface at height h, pushed out by the snow's thickness.
  const snowRadius = (tier, h) => tier.r * (tier.y + tierHeight / 2 - h) / tierHeight + snowLift;

  // Top tier: a cap over the tip.
  const top = tiers[2], capHeight = 0.3 * scale;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(capHeight * top.r / tierHeight, capHeight, 7), snowMat);
  cap.position.y = top.y + tierHeight / 2 + snowLift - capHeight / 2;
  g.add(cap);

  // Middle tier: its upper slope is hidden under the top tier, so snow sits on the band that shows
  // below the top tier's lower edge, tucked a little under that edge.
  const middle = tiers[1];
  const bandTop = top.y - tierHeight / 2 + 0.04 * scale, bandBottom = bandTop - 0.16 * scale;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(snowRadius(middle, bandTop), snowRadius(middle, bandBottom), bandTop - bandBottom, 7),
    snowMat,
  );
  band.position.y = (bandTop + bandBottom) / 2;
  g.add(band);
  return g;
}

export function makePathDot() {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.035, 8),
    new THREE.MeshStandardMaterial({ color: '#b7d3dd', roughness: 1, flatShading: true }),
  );
}
