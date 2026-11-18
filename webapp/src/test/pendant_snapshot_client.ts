import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBedroomSanctuaryScene } from '../components/canvas/bedroom/BedroomSanctuaryScene.tsx';
import { FloatingWoolPad } from '../components/canvas/puffy-hero-3d/FloatingWoolPad.ts';

async function initPendantSnapshot() {
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

  // I. CAMERA & FRAMING RIG (HEADLESS / TEST VIEW)
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  camera.position.set(0.75, 1.35, 0.45);
  camera.lookAt(1.42, 1.28, -0.70);
  camera.updateMatrixWorld();

  // Mount Sanctuary & Puffy Bed
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const woolPad = new FloatingWoolPad(maxAniso);
  woolPad.setFloatingEnabled(false, 0.238);
  woolPad.update(0, 0.016);

  const mattressDockGroup = new THREE.Group();
  mattressDockGroup.name = 'DockedPuffyMattressGroup';
  mattressDockGroup.add(woolPad.group);

  // II. LIGHTING & ENVIRONMENT TUNING:
  // soft grazing window light = 2.0 (1.8 - 2.2 range)
  const sanctuary = createBedroomSanctuaryScene({
    mattressWidth: 2.15,
    mattressLength: 2.55,
    castShadow: true,
    sunLightIntensity: 2.0,
    initialStyle: 'japandi',
  });
  sanctuary.dockMattress(mattressDockGroup);
  scene.add(sanctuary.group);

  // Warm up and render frames for shader compilation and shadow maps
  for (let i = 0; i < 5; i++) {
    renderer.render(scene, camera);
  }

  // III. TELEMETRY & SNAPSHOT CAPTURE SCRIPT
  console.group('=== PENDANT CLUSTER TELEMETRY ===');
  const cluster = scene.getObjectByName('ModernPendantCluster');
  let polyCount = 0;
  let ceilingAnchorY: number | null = null;
  if (cluster) {
    cluster.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        polyCount += (child as THREE.Mesh).geometry.attributes.position.count;
      }
    });
    ceilingAnchorY = cluster.position.y;
    console.log('Pendant Cluster Polycount:', polyCount);
    console.log('Ceiling Anchor Y:', cluster.position.y);
  } else {
    console.warn('Pendant cluster mesh not found in scene graph!');
  }
  console.groupEnd();

  // Export Snapshot Canvas to PNG
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');

  // Transmit payload to snapshot server
  try {
    await fetch('/save-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataURL,
        polyCount,
        ceilingAnchorY,
        width,
        height,
      }),
    });
  } catch (err) {
    console.error('Failed to send snapshot to server:', err);
  }
}

initPendantSnapshot();
