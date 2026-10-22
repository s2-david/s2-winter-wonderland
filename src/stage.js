import * as THREE from 'three';
import { SKY_COLOR } from './config.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.FogExp2(SKY_COLOR, 0.035);

export const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 100);
// At the starting point the planet's local "up" is +Z, not Three's usual +Y.
// Keeping the camera aligned to that normal prevents the third-person view from rolling over the horizon.
camera.up.set(0, 0, 1);

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#b7ddff', '#293756', 2.3));
const sun = new THREE.DirectionalLight('#ffe1a5', 2.6);
sun.position.set(-8, 10, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const moon = new THREE.DirectionalLight('#94bcff', 1.1);
moon.position.set(8, 3, -5);
scene.add(moon);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
