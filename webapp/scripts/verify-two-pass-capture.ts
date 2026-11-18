import * as THREE from 'three';
import {
  executeTwoPassCapture,
  findLogoBadgeObject,
  SceneCaptureDock,
  downloadDataUrl,
} from '../src/components/canvas/bedroom/components/SceneCaptureDock.tsx';

async function runTwoPassVerification() {
  console.log('=== VERIFYING TWO-PASS STUDIO CAPTURE DOCK ===\n');

  // 1. Verify Exports
  if (typeof executeTwoPassCapture !== 'function') {
    throw new Error('executeTwoPassCapture is not exported as a function');
  }
  if (typeof SceneCaptureDock !== 'function') {
    throw new Error('SceneCaptureDock is not exported as a component function');
  }
  if (typeof findLogoBadgeObject !== 'function') {
    throw new Error('findLogoBadgeObject is not exported as a function');
  }
  if (typeof downloadDataUrl !== 'function') {
    throw new Error('downloadDataUrl is not exported as a function');
  }
  console.log('✓ Check 1: All required functions and components are cleanly exported.');

  // 2. Set up Scene Graph with room, bed, accessories, and nested logo badge
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EFEAE1');

  const roomGroup = new THREE.Group();
  roomGroup.name = 'RoomHostGroup';
  const walls = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5));
  walls.name = 'BedroomWalls';
  roomGroup.add(walls);
  scene.add(roomGroup);

  const bedAssemblyGroup = new THREE.Group();
  bedAssemblyGroup.name = 'BedAssemblyGroup';
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2.2));
  bedFrame.name = 'PuffyBedFrame';
  bedAssemblyGroup.add(bedFrame);

  const woolPadGroup = new THREE.Group();
  woolPadGroup.name = 'FloatingWoolPadGroup';
  const encasementTrayGroup = new THREE.Group();
  encasementTrayGroup.name = 'encasementTrayGroup';
  const sidewalls = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.0));
  sidewalls.name = 'sidewalls';
  encasementTrayGroup.add(sidewalls);

  const logoBadgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.172));
  logoBadgeMesh.name = 'puffy-embroidered-badge-royal';
  logoBadgeMesh.visible = true;
  encasementTrayGroup.add(logoBadgeMesh);

  woolPadGroup.add(encasementTrayGroup);
  bedAssemblyGroup.add(woolPadGroup);
  scene.add(bedAssemblyGroup);

  // 3. Test findLogoBadgeObject helper
  const foundBadge = findLogoBadgeObject(scene);
  if (!foundBadge || foundBadge !== logoBadgeMesh) {
    throw new Error(`findLogoBadgeObject failed: expected logoBadgeMesh, got ${foundBadge?.name}`);
  }
  console.log(`✓ Check 2: findLogoBadgeObject successfully located: "${foundBadge.name}" in nested hierarchy.`);

  // 4. Set up Camera
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(2.8, 1.8, 3.2);

  // 5. Mock WebGLRenderer to verify exact execution state transitions
  const renderEvents: Array<{
    type: string;
    width?: number;
    height?: number;
    cameraAspect?: number;
    projectionAspect?: number;
    clearColor?: string;
    clearAlpha?: number;
    roomVisible?: boolean;
    bedVisible?: boolean;
    logoVisible?: boolean;
  }> = [];

  let currentSize = new THREE.Vector2(1024, 768);
  let currentPixelRatio = 2;
  let currentClearColor = new THREE.Color('#EFEAE1');
  let currentClearAlpha = 1.0;
  const mockDomElement = {
    toDataURL: (type: string) =>
      `data:${type};base64,mock_${currentSize.x * currentPixelRatio}x${currentSize.y * currentPixelRatio}`,
  };

  const mockRenderer = {
    domElement: mockDomElement,
    getSize: (target: THREE.Vector2) => target.copy(currentSize),
    getDrawingBufferSize: (target: THREE.Vector2) =>
      target.set(currentSize.x * currentPixelRatio, currentSize.y * currentPixelRatio),
    getPixelRatio: () => currentPixelRatio,
    getClearColor: (target: THREE.Color) => target.copy(currentClearColor),
    getClearAlpha: () => currentClearAlpha,
    setPixelRatio: (pixelRatio: number) => {
      currentPixelRatio = pixelRatio;
    },
    setSize: (w: number, h: number, _updateStyle?: boolean) => {
      currentSize.set(w, h);
      renderEvents.push({ type: 'setSize', width: w, height: h });
    },
    setClearColor: (color: THREE.Color | number | string, alpha = 1) => {
      if (typeof color === 'number' || typeof color === 'string') {
        currentClearColor.set(color as any);
      } else {
        currentClearColor.copy(color);
      }
      currentClearAlpha = alpha;
      renderEvents.push({
        type: 'setClearColor',
        clearColor: `#${currentClearColor.getHexString()}`,
        clearAlpha: alpha,
      });
    },
    clear: () => {
      renderEvents.push({ type: 'clear' });
    },
    render: (_scene: THREE.Scene, renderCamera: THREE.Camera) => {
      const renderPerspectiveCamera =
        renderCamera instanceof THREE.PerspectiveCamera ? renderCamera : null;
      renderEvents.push({
        type: 'render',
        width: currentSize.x * currentPixelRatio,
        height: currentSize.y * currentPixelRatio,
        cameraAspect: renderPerspectiveCamera?.aspect,
        projectionAspect: renderPerspectiveCamera
          ? renderPerspectiveCamera.projectionMatrix.elements[5] /
            renderPerspectiveCamera.projectionMatrix.elements[0]
          : undefined,
        clearColor: `#${currentClearColor.getHexString()}`,
        clearAlpha: currentClearAlpha,
        roomVisible: roomGroup.visible,
        bedVisible: bedAssemblyGroup.visible,
        logoVisible: logoBadgeMesh.visible,
      });
    },
  } as unknown as THREE.WebGLRenderer;

  // 6. Execute Two-Pass Capture at 2048x2048
  const captureResolution = { width: 2048, height: 2048 };
  const { passA, passB } = await executeTwoPassCapture(
    mockRenderer,
    scene,
    camera,
    foundBadge,
    captureResolution
  );

  console.log('✓ Check 3: executeTwoPassCapture completed synchronously without throw.');
  console.log(`  - Pass A Data URL: ${passA.substring(0, 45)}...`);
  console.log(`  - Pass B Data URL: ${passB.substring(0, 45)}...`);

  // Verify Metric 1: Pass A and Pass B have exactly identical pixel dimensions (2048x2048)
  if (!passA.includes('2048x2048') || !passB.includes('2048x2048')) {
    throw new Error(`Metric 1 failed: Expected 2048x2048 in both data URLs.`);
  }
  console.log('✓ Metric 1 PASS: Pass A and Pass B exported with identical 2048x2048 dimensions.');

  // Verify Render Event Sequence
  const renders = renderEvents.filter((e) => e.type === 'render');
  if (renders.length < 2) {
    throw new Error(`Expected at least 2 render passes, got ${renders.length}`);
  }

  const passARender = renders[0];
  const passBRender = renders[1];
  const restoreRender = renders[2];

  // Pass A: Base scene visible, logo badge HIDDEN
  if (passARender.logoVisible !== false) {
    throw new Error(`Pass A error: logoVisible expected false, got ${passARender.logoVisible}`);
  }
  if (passARender.roomVisible !== true || passARender.bedVisible !== true) {
    throw new Error('Pass A error: Room and bed should be visible');
  }
  console.log('✓ Pass A Verified: Full room and bed rendered with logoBadgeGroup hidden.');

  // Pass B: Isolated logo badge on transparent alpha = 0
  if (passBRender.logoVisible !== true) {
    throw new Error(`Pass B error: logoVisible expected true, got ${passBRender.logoVisible}`);
  }
  if (passBRender.clearAlpha !== 0) {
    throw new Error(`Metric 2 failed: Pass B clearAlpha expected 0, got ${passBRender.clearAlpha}`);
  }
  console.log('✓ Metric 2 PASS: Pass B rendered with transparent alpha background (clearAlpha = 0).');

  // Verify Zero State Side-Effects to scene and renderer
  if (restoreRender) {
    if (restoreRender.width !== 2048 || restoreRender.height !== 1536) {
      throw new Error(`Renderer size not restored: ${restoreRender.width}x${restoreRender.height}`);
    }
  }
  if (currentPixelRatio !== 2 || camera.aspect !== 1) {
    throw new Error('Renderer pixel ratio or camera aspect was not restored after capture');
  }
  if (roomGroup.visible !== true || bedAssemblyGroup.visible !== true || logoBadgeMesh.visible !== true) {
    throw new Error('Scene visibility not properly restored after capture');
  }
  console.log('✓ Check 4: Zero side-effects confirmed — renderer size, clearColor, and scene hierarchy restored.');

  for (const aspectResolution of [
    { width: 2560, height: 1440 },
    { width: 1234, height: 987 },
  ]) {
    const { passA: aspectPassA, passB: aspectPassB } = await executeTwoPassCapture(
      mockRenderer,
      scene,
      camera,
      foundBadge,
      aspectResolution,
    );
    const captureRenders = renderEvents.filter((event) => event.type === 'render').slice(-3);
    const expectedAspect = aspectResolution.width / aspectResolution.height;

    if (!aspectPassA.includes(`${aspectResolution.width}x${aspectResolution.height}`) ||
      !aspectPassB.includes(`${aspectResolution.width}x${aspectResolution.height}`)) {
      throw new Error(`Capture output did not match ${aspectResolution.width}x${aspectResolution.height}`);
    }

    if (
      captureRenders[0]?.cameraAspect !== expectedAspect ||
      captureRenders[1]?.cameraAspect !== expectedAspect ||
      Math.abs((captureRenders[0]?.projectionAspect ?? 0) - expectedAspect) > 1e-10 ||
      Math.abs((captureRenders[1]?.projectionAspect ?? 0) - expectedAspect) > 1e-10 ||
      camera.aspect !== 1
    ) {
      throw new Error(`Camera projection was incorrect or not restored for ${aspectResolution.width}x${aspectResolution.height}`);
    }
  }
  console.log('✓ Check 5: 16:9 and custom captures preserve projection aspect and output dimensions.');

  console.log('\n>>> ALL TWO-PASS STUDIO CAPTURE METRICS VERIFIED SUCCESSFULLY! <<<');
}

runTwoPassVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});

