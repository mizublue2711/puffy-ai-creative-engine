import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createBedroomWalls,
  WALL_ENVIRONMENT_MATERIALS,
  type WallEnvironmentKey,
} from '../components/canvas/bedroom/components/BedroomWalls.tsx';
import { createHardwoodFloor } from '../components/canvas/bedroom/components/HardwoodFloor.tsx';
import {
  BEDROOM_REGISTRY,
  BEDROOM_STYLE_PRESETS,
} from '../components/canvas/bedroom/BedroomRegistry.ts';

async function captureAllWallsSnapshots() {
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
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EFEAE1');
  scene.fog = new THREE.FogExp2('#EFEAE1', 0.012);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  // 1. Unified Floor-to-Ceiling Vertical Timber Slat Walls
  const walls = createBedroomWalls({
    width: 7.40,
    wallHeight: 3.90,
    wallZ: -2.20,
    centerX: -0.10,
    roomLength: 7.00,
  });
  scene.add(walls.group);

  // 2. Hardwood Floor for floor-to-wall contact verification (showing zero horizontal seams)
  const floor = createHardwoodFloor({ width: 7.40, length: 7.20 });
  floor.group.position.set(-0.10, 0, 1.30);
  scene.add(floor.group);

  // 3. Directional grazing sunlight casting soft shadows across the rhythmic slats
  const sunLight = new THREE.DirectionalLight(0xfff6e8, 2.4);
  sunLight.position.set(-5.5, 4.5, 2.0);
  sunLight.target.position.set(0.0, 1.5, -2.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xfff8ee, 0x3a3835, 0.65);
  scene.add(hemiLight);

  scene.updateMatrixWorld(true);

  // Eye-level frontal architectural perspective showing full vertical slats floor-to-ceiling
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 100);
  camera.position.set(0.20, 1.65, 3.80);
  camera.lookAt(0.00, 1.50, -2.20);
  camera.updateMatrixWorld();

  const environments: Array<{
    envKey: WallEnvironmentKey;
    styleKey: keyof typeof BEDROOM_STYLE_PRESETS;
    filename: string;
    description: string;
  }> = [
    {
      envKey: 'mid-century',
      styleKey: 'mid-century',
      filename: 'test_wall_midcentury.png',
      description: 'Vertical Walnut Slats (Warm Sand Walnut / Muted Honey Teak)',
    },
    {
      envKey: 'zen',
      styleKey: 'japandi',
      filename: 'test_wall_zen.png',
      description: 'Light Ash / Bleached Bamboo Slats (Natural Light Ash Slat Plaster)',
    },
    {
      envKey: 'modern',
      styleKey: 'nordic-coastal',
      filename: 'test_wall_modern.png',
      description: 'Warm Greige Limewash Slats (Warm Mineral Greige Limewash Slat)',
    },
  ];

  const results: Record<string, string> = {};

  for (const { envKey, styleKey, filename, description } of environments) {
    walls.setEnvironment(envKey, 0);
    floor.applyStyle(BEDROOM_STYLE_PRESETS[styleKey], 0);

    scene.updateMatrixWorld(true);
    await new Promise((r) => setTimeout(r, 200));

    for (let i = 0; i < 2; i++) {
      renderer.render(scene, camera);
    }

    const dataUrl = renderer.domElement.toDataURL('image/png');
    results[filename] = dataUrl;
    console.log(`[Snapshot Client] Captured ${filename} (${description})`);
  }

  await fetch('/save-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshots: results,
      registryKeys: Object.keys(BEDROOM_REGISTRY),
      wallMaterials: WALL_ENVIRONMENT_MATERIALS,
    }),
  });
}

captureAllWallsSnapshots().catch((err) => {
  console.error('Wall snapshots capture failed:', err);
});
