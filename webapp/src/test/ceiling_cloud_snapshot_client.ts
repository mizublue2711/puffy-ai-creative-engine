import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBedroomSanctuaryScene } from '../components/canvas/bedroom/BedroomSanctuaryScene.tsx';
import { BEDROOM_REGISTRY } from '../components/canvas/bedroom/BedroomRegistry.ts';
import { FloatingWoolPad } from '../components/canvas/puffy-hero-3d/FloatingWoolPad.ts';

async function initCeilingCloudSnapshot() {
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

  // Subtle architectural ceiling plane at y = 3.20m for flush-mount & halo verification
  const ceilingGeo = new THREE.PlaneGeometry(6.4, 6.4);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E6E2DA'),
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.FrontSide, // Visible from below when rotated +PI/2 around X
  });
  const ceilingSlab = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceilingSlab.name = 'VerificationCeilingPlane';
  ceilingSlab.position.set(0, 3.20, 0);
  ceilingSlab.rotation.x = Math.PI / 2; // Normal points downward (-Y)
  ceilingSlab.receiveShadow = true;
  scene.add(ceilingSlab);

  // IV. SNAPSHOT TELEMETRY CHECK (Wide-angle upward view framing center cloud + right-side pendant canopy)
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.set(0.0, 1.0, 2.75);
  camera.lookAt(0.25, 3.185, 0.25);
  camera.updateMatrixWorld();

  // Mount Sanctuary & Puffy Bed
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
    sunLightIntensity: 2.0,
    initialStyle: 'japandi',
  });
  sanctuary.dockMattress(mattressDockGroup);
  scene.add(sanctuary.group);

  // Warm up and render frames for shader compilation and transmission pass
  for (let i = 0; i < 5; i++) {
    renderer.render(scene, camera);
  }

  // Telemetry
  const cloudFixture = scene.getObjectByName('PuffyCloudCeilingLight');
  let polyCount = 0;
  let worldPos: { x: number; y: number; z: number } | null = null;
  let bounds: { min: number[]; max: number[]; size: number[] } | null = null;
  if (cloudFixture) {
    cloudFixture.updateWorldMatrix(true, true);
    const wp = cloudFixture.getWorldPosition(new THREE.Vector3());
    worldPos = {
      x: Number(wp.x.toFixed(4)),
      y: Number(wp.y.toFixed(4)),
      z: Number(wp.z.toFixed(4)),
    };
    console.log('Cloud Light World Pos:', wp);

    const box = new THREE.Box3().setFromObject(cloudFixture);
    const size = new THREE.Vector3();
    box.getSize(size);
    bounds = {
      min: [Number(box.min.x.toFixed(4)), Number(box.min.y.toFixed(4)), Number(box.min.z.toFixed(4))],
      max: [Number(box.max.x.toFixed(4)), Number(box.max.y.toFixed(4)), Number(box.max.z.toFixed(4))],
      size: [Number(size.x.toFixed(4)), Number(size.y.toFixed(4)), Number(size.z.toFixed(4))],
    };
    cloudFixture.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        polyCount += (child as THREE.Mesh).geometry.attributes.position.count;
      }
    });
  }

  const registryEntry = BEDROOM_REGISTRY['puffy-cloud-ceiling-light'] ?? null;

  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');

  await fetch('/save-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataURL,
      polyCount,
      worldPos,
      bounds,
      registered: Boolean(registryEntry),
      registryId: registryEntry?.id ?? null,
      width,
      height,
    }),
  });
}

initCeilingCloudSnapshot();
