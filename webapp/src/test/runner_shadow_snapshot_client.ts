import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBedroomSanctuaryScene } from '../components/canvas/bedroom/BedroomSanctuaryScene.tsx';
import { BEDROOM_REGISTRY } from '../components/canvas/bedroom/BedroomRegistry.ts';
import { FloatingWoolPad } from '../components/canvas/puffy-hero-3d/FloatingWoolPad.ts';

async function initRunnerShadowSnapshots() {
  const width = 1600;
  const height = 1000;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EFEAE1');
  scene.fog = new THREE.FogExp2('#EFEAE1', 0.012);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const woolPad = new FloatingWoolPad(maxAniso);
  woolPad.setFloatingEnabled(false, 0.238);
  woolPad.update(0, 0.016);

  const mattressDockGroup = new THREE.Group();
  mattressDockGroup.name = 'DockedPuffyMattressGroup';
  mattressDockGroup.add(woolPad.group);

  const sanctuary = createBedroomSanctuaryScene({
    mattressWidth: 2.15,
    mattressLength: 2.55,
    castShadow: true,
    sunLightIntensity: 2.6,
    initialStyle: 'nordic-coastal',
  });
  sanctuary.dockMattress(mattressDockGroup);
  scene.add(sanctuary.group);
  scene.add(mattressDockGroup);

  // Measure world bounds of throw blanket
  scene.updateMatrixWorld(true);
  const throwObj = scene.getObjectByName('BedThrowBlanket');
  const throwBox = throwObj ? new THREE.Box3().setFromObject(throwObj) : null;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 100);

  // Snapshot A: Tight Zoom on bed runner contact line across mattress crown + waterfall edge
  camera.position.set(1.72, 0.72, 1.38);
  camera.lookAt(0.05, 0.55, 0.71);
  camera.updateMatrixWorld();

  for (let i = 0; i < 6; i++) {
    renderer.render(scene, camera);
  }
  const snapshotA = renderer.domElement.toDataURL('image/png');

  // Snapshot B: Full Bed 3/4 View confirming diagonal directional shadows on white rug & oak legs
  camera.fov = 50;
  camera.updateProjectionMatrix();
  camera.position.set(2.8, 1.8, 3.2);
  camera.lookAt(0, 0.45, 0.1);
  camera.updateMatrixWorld();

  for (let i = 0; i < 4; i++) {
    renderer.render(scene, camera);
  }
  const snapshotB = renderer.domElement.toDataURL('image/png');

  await fetch('/save-snapshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshotA,
      snapshotB,
      throwBounds: throwBox
        ? { min: throwBox.min.toArray(), max: throwBox.max.toArray() }
        : null,
      registryKeys: Object.keys(BEDROOM_REGISTRY),
      runnerRegistry: BEDROOM_REGISTRY['bed-throw-blanket'] ?? null,
    }),
  });
}

initRunnerShadowSnapshots().catch((err) => {
  console.error('Snapshot render failed:', err);
});
