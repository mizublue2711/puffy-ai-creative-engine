import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBedroomSanctuaryScene } from '../components/canvas/bedroom/BedroomSanctuaryScene.tsx';
import { BEDROOM_REGISTRY } from '../components/canvas/bedroom/BedroomRegistry.ts';
import { FloatingWoolPad } from '../components/canvas/puffy-hero-3d/FloatingWoolPad.ts';

async function initMidCenturyVerticalWallSnapshot() {
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
    initialStyle: 'mid-century',
  });
  sanctuary.dockMattress(mattressDockGroup);
  scene.add(sanctuary.group);

  scene.updateMatrixWorld(true);

  // Eye-level frontal view showing the full floor-to-ceiling vertical timber back wall,
  // pendant light + slats, bed, and the smooth warm limewash plaster right wall
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 100);
  camera.position.set(0.35, 1.55, 4.15);
  camera.lookAt(0.05, 1.45, -2.20);
  camera.updateMatrixWorld();

  await new Promise((r) => setTimeout(r, 600));
  for (let i = 0; i < 2; i++) {
    renderer.render(scene, camera);
  }
  const snapshot = renderer.domElement.toDataURL('image/png');

  await fetch('/save-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshot,
      registryKeys: Object.keys(BEDROOM_REGISTRY),
      headboardWallRegistry: BEDROOM_REGISTRY['mid-century-headboard-wall'] ?? null,
      accentWallRegistry: BEDROOM_REGISTRY['mid-century-accent-wall'] ?? null,
    }),
  });
}

initMidCenturyVerticalWallSnapshot().catch((err) => {
  console.error('Mid-century vertical wall snapshot failed:', err);
});
