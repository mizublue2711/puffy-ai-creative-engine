import * as THREE from 'three';

const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 2.25));
const runner = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.02, 0.45));
mattress.updateMatrixWorld(true);
runner.updateMatrixWorld(true);

const matBox = new THREE.Box3().setFromObject(mattress);
const matW = matBox.max.x - matBox.min.x;
const runBox = new THREE.Box3().setFromObject(runner);
const runNaturalW = runBox.max.x - runBox.min.x;

runner.scale.x = (matW + 0.04) / runNaturalW;
runner.updateMatrixWorld(true);

const updatedRunBox = new THREE.Box3().setFromObject(runner);
const fittedW = updatedRunBox.max.x - updatedRunBox.min.x;
const overhangPerSide = (fittedW - matW) / 2;

console.log('--- RUNNER FIT VERIFICATION ---');
console.log('Mattress Width:', matW.toFixed(3), 'm');
console.log('Fitted Runner Width:', fittedW.toFixed(3), 'm');
console.log('Overhang Per Side:', overhangPerSide.toFixed(3), 'm (Target: ~0.020m)');

if (Math.abs(overhangPerSide - 0.02) < 0.005) {
  console.log('>>> PASS: RUNNER SNUGLY FITS MATTRESS EDGES! <<<');
  process.exit(0);
} else {
  console.error('>>> FAIL: EXCESSIVE OVERHANG PERSISTS! <<<');
  process.exit(1);
}
