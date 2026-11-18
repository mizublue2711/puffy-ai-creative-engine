import * as THREE from 'three';

const bedAssemblyGroup = new THREE.Group();
bedAssemblyGroup.position.set(0, 0.15, -0.45); // Modern room anchor

// 1. Bed Frame: Height 0.38m
const frameGeo = new THREE.BoxGeometry(1.7, 0.38, 2.1);
frameGeo.translate(0, 0.19, 0);
const bedFrame = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial());
bedAssemblyGroup.add(bedFrame);

// 2. Mattress with center origin (thickness 0.28m, halfHeight 0.14m)
const matGeo = new THREE.BoxGeometry(1.6, 0.28, 2.0);
const mattress = new THREE.Mesh(matGeo, new THREE.MeshBasicMaterial());
bedAssemblyGroup.add(mattress);

bedAssemblyGroup.updateMatrixWorld(true);

// 3. Align mattress using Bounding Box Delta
const frameBox = new THREE.Box3().setFromObject(bedFrame);
const targetSlatY = Math.max(0.20, frameBox.max.y - 0.04);
const matBox = new THREE.Box3().setFromObject(mattress);
const currentBottomY = matBox.min.y;
const deltaY = targetSlatY - currentBottomY;
mattress.position.y += deltaY;

bedAssemblyGroup.updateMatrixWorld(true);
mattress.updateMatrixWorld(true);

// 4. Snap Accessories
const pillows = new THREE.Group();
const runner = new THREE.Group();
bedAssemblyGroup.add(pillows);
bedAssemblyGroup.add(runner);

const matWorldBox = new THREE.Box3().setFromObject(mattress);
const topWorldPoint = new THREE.Vector3(0, matWorldBox.max.y, 0);
bedAssemblyGroup.worldToLocal(topWorldPoint);

pillows.position.y = topWorldPoint.y;
runner.position.y = topWorldPoint.y + 0.002;

console.log('--- TEST RESULTS ---');
console.log('Target Slat World Y:', targetSlatY.toFixed(4), '(Expected: 0.4900)');
console.log('Aligned Mattress Bottom World Y:', matWorldBox.min.y.toFixed(4), '(Expected: 0.4900)');
console.log('Mattress Center Local Y:', mattress.position.y.toFixed(4), '(Expected: 0.4800)');
console.log('Mattress Top Local Y:', (mattress.position.y + 0.14).toFixed(4), '(Expected: 0.6200)');
console.log('Pillows Local Y:', pillows.position.y.toFixed(4), '(Expected: 0.6200)');
console.log('Runner Local Y:', runner.position.y.toFixed(4), '(Expected: 0.6220)');

const bottomMatchesSlat = Math.abs(matWorldBox.min.y - targetSlatY) < 0.005;
const centerMatches = Math.abs(mattress.position.y - 0.48) < 0.001;
const pillowsMatch = Math.abs(pillows.position.y - 0.62) < 0.001;

if (bottomMatchesSlat && centerMatches && pillowsMatch) {
  console.log('>>> PASS: MATHEMATICAL ZERO-GAP BOUNDING BOX LOCK CONFIRMED! <<<');
  process.exit(0);
} else {
  console.error('>>> FAIL: MISALIGNED! <<<');
  process.exit(1);
}
