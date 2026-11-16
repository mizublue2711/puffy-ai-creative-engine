import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {HeroCloudletGuide} from '../components/canvas/puffy-hero-3d/HeroCloudletGuide.ts';

function runCloudletPreview(): void {
  const width = window.innerWidth || 1440;
  const height = window.innerHeight || 900;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(width, height, false);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100vw';
  renderer.domElement.style.height = '100vh';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EBF1F5');

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.75;
  pmrem.dispose();

  const ambientLight = new THREE.AmbientLight('#FFFFFF', 0.35);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight('#FFF8E7', 1.4);
  sunLight.position.set(2.5, 3.5, 3.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight('#D6E8FF', 0.65);
  rimLight.position.set(-2.5, 1.8, -2.5);
  scene.add(rimLight);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 50);
  camera.position.set(0.0, 0.06, 1.65);
  camera.lookAt(0, 0, 0);

  const cloudlet = new HeroCloudletGuide();
  scene.add(cloudlet.group);

  // Measure authentic physical dimensions at rest
  const bbox = new THREE.Box3().setFromObject(cloudlet.mesh);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  // GPU Pre-warm upfront
  renderer.compile(scene, camera);

  const clock = new THREE.Clock();
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let measuredFps = 0;

  const telemetryEl = document.getElementById('telemetry');

  function animate(): void {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    cloudlet.update(elapsed);
    renderer.render(scene, camera);

    frameCount += 1;
    const now = performance.now();
    const dtMs = now - fpsWindowStart;
    if (dtMs >= 500) {
      measuredFps = Math.round((frameCount * 1000) / dtMs);
      frameCount = 0;
      fpsWindowStart = now;
      if (telemetryEl) {
        telemetryEl.textContent =
          `hero_cloudlet_guide_v1 | ` +
          `${size.x.toFixed(3)}m × ${size.y.toFixed(3)}m × ${size.z.toFixed(3)}m | ` +
          `${measuredFps} FPS`;
      }
      (window as unknown as Record<string, unknown>).__CLOUDLET_AUDIT__ = {
        dimensionsMeters: {
          width: Number(size.x.toFixed(4)),
          height: Number(size.y.toFixed(4)),
          depth: Number(size.z.toFixed(4)),
        },
        fps: measuredFps,
        position: cloudlet.mesh.position.toArray(),
        scale: cloudlet.mesh.scale.toArray(),
      };
    }
  }

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });

  animate();
}

runCloudletPreview();
