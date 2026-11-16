import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBedroomSanctuaryScene } from '../components/canvas/bedroom/BedroomSanctuaryScene.tsx';
import { BEDROOM_REGISTRY } from '../components/canvas/bedroom/BedroomRegistry.ts';
import { FloatingWoolPad } from '../components/canvas/puffy-hero-3d/FloatingWoolPad.ts';

async function initKaresansuiSnapshot() {
  const width = 1920;
  const height = 1080;

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
    sunLightIntensity: 2.2,
    initialStyle: 'japandi',
  });
  sanctuary.dockMattress(mattressDockGroup);
  scene.add(sanctuary.group);
  scene.add(mattressDockGroup);

  // Camera 1: Inside bedroom looking through sheer curtain toward sand ripples & moon mirror
  const camBedroom = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
  camBedroom.position.set(0.60, 1.45, 2.20);
  camBedroom.lookAt(-5.10, 1.05, -1.20);
  camBedroom.updateMatrixWorld();

  // Warm up shaders & render
  renderer.render(scene, camBedroom);
  renderer.render(scene, camBedroom);
  const bedroomDataURL = renderer.domElement.toDataURL('image/png');

  // Camera 2: Inside courtyard looking down the full axis toward Moon Mirror
  const camCourtyard = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camCourtyard.position.set(-4.85, 1.38, 4.35);
  camCourtyard.lookAt(-5.15, 0.95, -2.40);
  camCourtyard.updateMatrixWorld();

  renderer.render(scene, camCourtyard);
  renderer.render(scene, camCourtyard);
  const courtyardDataURL = renderer.domElement.toDataURL('image/png');

  // Telemetry verification
  const zenGroup = scene.getObjectByName('ZenCourtyardSanctuary');
  let potCount = 0;
  let meshCount = 0;
  if (zenGroup) {
    zenGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        meshCount++;
      }
      if (obj.name.toLowerCase().includes('pot')) {
        potCount++;
      }
    });
  }

  await fetch('/save-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bedroomDataURL,
      courtyardDataURL,
      zenGroupPresent: Boolean(zenGroup),
      potCount,
      meshCount,
      registeredSandBed: Boolean(BEDROOM_REGISTRY['karesansui-sand-bed']),
      registeredGardenRig: Boolean(BEDROOM_REGISTRY['flush-zen-garden-rig']),
      registeredMoonMirror: Boolean(BEDROOM_REGISTRY['zen-moon-mirror']),
    }),
  });
}

initKaresansuiSnapshot();
