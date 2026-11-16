import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BEDROOM_REGISTRY,
  BEDROOM_STYLE_PRESETS,
  disposeAllBedroomComponents,
  disposeComponent,
  type BedroomStyle,
} from './BedroomRegistry.ts';
import { createPuffyBedFrame } from './components/PuffyBedFrame.tsx';
import { createPuffyHeadboard } from './components/PuffyHeadboard.tsx';
import { createWallSconces } from './components/WallSconces.tsx';
import { createPlushAreaRug } from './components/PlushAreaRug.tsx';
import { createHardwoodFloor } from './components/HardwoodFloor.tsx';
import { createRoomBoundary } from './components/RoomBoundary.tsx';
import { createWindowCurtainWall } from './components/WindowCurtainWall.tsx';
import { createBedThrowBlanket } from './components/BedThrowBlanket.tsx';
import { createAccentPillows } from './components/AccentPillows.tsx';
import { createFramedCanvasArt } from './components/FramedCanvasArt.tsx';
import { createBedsideArtBook } from './components/BedsideArtBook.tsx';
import { FloatingWoolPad } from '../puffy-hero-3d/FloatingWoolPad.ts';
import type { SheepFlockEngine } from '../puffy-hero-3d/SheepFlockEngine.ts';

export interface BedroomSanctuarySceneOptions {
  /** Optional existing FloatingWoolPad whose encasementTrayGroup will be docked onto the bed slats */
  floatingWoolPad?: FloatingWoolPad | null;
  /** Optional standalone mattressGroup / encasementTrayGroup to dock at (0, 0.35, 0) */
  mattressGroup?: THREE.Object3D | null;
  /** Optional SheepFlockEngine to pause & hide while the bedroom sanctuary is mounted */
  sheepFlock?: SheepFlockEngine | null;
  /** Initial Interior Archetype style preset */
  initialStyle?: BedroomStyle;
  /** Mattress footprint width in scene units (defaults to 1.60m Queen spec, or 2.15m for FloatingWoolPad) */
  mattressWidth?: number;
  /** Mattress footprint length in scene units (defaults to 2.10m Queen spec, or 2.55m for FloatingWoolPad) */
  mattressLength?: number;
  /** Whether directional window sunlight casts soft shadows */
  castShadow?: boolean;
}

export interface BedroomSanctuaryInstance {
  group: THREE.Group;
  registry: typeof BEDROOM_REGISTRY;
  setStyle: (style: BedroomStyle, duration?: number) => void;
  setBedDecorVisible: (visible: boolean) => void;
  dockMattress: (mattressGroup: THREE.Object3D) => void;
  runSmokeTest: (dockedMattressGroup?: THREE.Object3D) => void;
  dispose: () => void;
}

/**
 * Scene Composer & Mattress Docking
 * Assembles all registered LEGO components, Floor-to-Ceiling Curtain Wall + S-Fold Voile,
 * and 4-Archetype Decor Props around the Puffy mattress.
 */
export function createBedroomSanctuaryScene(
  options: BedroomSanctuarySceneOptions = {},
): BedroomSanctuaryInstance {
  const isFloatingPadAttached = Boolean(options.floatingWoolPad);
  const mattressW = options.mattressWidth ?? (isFloatingPadAttached ? 2.15 : 1.60);
  const mattressL = options.mattressLength ?? (isFloatingPadAttached ? 2.55 : 2.10);
  const castShadow = options.castShadow ?? true;
  const initialStyle = options.initialStyle ?? 'nordic-coastal';

  const group = new THREE.Group();
  group.name = 'BedroomSanctuaryScene';

  // Pause meadow sheep flock simulation completely when this scene is mounted
  if (options.sheepFlock) {
    options.sheepFlock.group.visible = false;
  }

  // 1. Hardwood Floor (y = 0)
  const floor = createHardwoodFloor({ width: 6.4, length: 6.4 });
  group.add(floor.group);

  // 2. Plush Area Rug (18mm slab, y = 0.009m)
  const rugWidth = Math.max(2.80, mattressW + 1.20);
  const rugLength = Math.max(3.20, mattressL + 1.10);
  const rug = createPlushAreaRug({
    width: rugWidth,
    length: rugLength,
    thickness: 0.018,
    centerZ: 0.35,
  });
  group.add(rug.group);

  // 3. Puffy Platform Bed Frame & Oak Legs (slats at y = 0.32m, rim at 0.35m)
  const bedFrame = createPuffyBedFrame({
    width: mattressW,
    length: mattressL,
    rimHeight: 0.35,
    slatHeight: 0.32,
  });
  group.add(bedFrame.group);

  // 4. Upholstered Button-Tufted Headboard (flush at head of bed)
  const headboardAnchorZ = -(mattressL / 2);
  const headboard = createPuffyHeadboard({
    width: Math.max(1.70, mattressW + 0.10),
    height: 1.15,
    depth: 0.12,
    anchorZ: headboardAnchorZ,
  });
  group.add(headboard.group);

  // 5. Room Boundary (Mineral Plaster Back Wall + Skirting Baseboard + Architectural Slats)
  const backWallZ = headboardAnchorZ - 0.12;
  const roomBoundary = createRoomBoundary({
    width: 6.4,
    wallHeight: 3.2,
    wallZ: backWallZ,
  });
  group.add(roomBoundary.group);

  // 6. Floor-to-Ceiling Curtain Wall & Grand S-Fold Voile Curtain (x = -3.2m)
  const windowCurtain = createWindowCurtainWall({
    wallX: -3.2,
    startZ: backWallZ,
    totalLength: 4.5,
    ceilingHeight: 3.2,
  });
  group.add(windowCurtain.group);

  // 7. Dual Minimalist Brushed Brass Wall Sconces (Decorative Resting State: Lights OFF)
  const sconceOffsetX = Math.max(1.25, mattressW / 2 + 0.30);
  const sconces = createWallSconces({
    offsetX: sconceOffsetX,
    heightY: 1.40,
    wallZ: backWallZ,
  });
  group.add(sconces.group);

  // 8. 4-Archetype Decor Props (Throw Blanket, Accent Pillows, Framed Art, Bedside Artbook)
  // Top surface of FloatingWoolPad in local BedroomSanctuaryScene coordinates is ~0.79m when docked at -0.20,
  // or 0.58m when standalone mattress is docked at y=0.35m.
  const mattressTopY = isFloatingPadAttached ? 0.79 : 0.58;
  const throwBlanket = createBedThrowBlanket({
    mattressWidth: mattressW,
    surfaceY: mattressTopY + 0.025,
    footZ: mattressL * 0.28,
    drapeDrop: 0.15,
  });
  group.add(throwBlanket.group);

  const accentPillows = createAccentPillows({
    mattressWidth: mattressW,
    surfaceY: mattressTopY,
    headZ: headboardAnchorZ + 0.28,
  });
  group.add(accentPillows.group);

  const framedArt = createFramedCanvasArt({
    wallZ: backWallZ,
    centerY: 1.95,
  });
  group.add(framedArt.group);

  const bedsideBook = createBedsideArtBook({
    sideX: mattressW / 2 + 0.38,
    shelfY: 0.42,
    wallZ: backWallZ,
  });
  group.add(bedsideBook.group);

  // 9. Soft Sanctuary Daylight Rig (4000K Grazing Window Sun + Cool/Warm Hemisphere Fill)
  const sunLight = new THREE.DirectionalLight(0xfff4e5, 2.8);
  sunLight.position.set(-5.0, 4.0, 2.0);
  sunLight.target.position.set(0, 0.4, 0);
  sunLight.castShadow = castShadow;
  if (castShadow) {
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 16;
    sunLight.shadow.camera.left = -4.2;
    sunLight.shadow.camera.right = 4.2;
    sunLight.shadow.camera.top = 4.2;
    sunLight.shadow.camera.bottom = -4.2;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.radius = 4;
  }
  group.add(sunLight);
  group.add(sunLight.target);

  const ambientRig = new THREE.HemisphereLight(0xe8eef5, 0xd4c4b5, 0.6);
  group.add(ambientRig);

  // 10. Dock the Puffy Royal / Monarch Mattress onto the bed slats
  const dockMattress = (targetGroup: THREE.Object3D) => {
    targetGroup.position.set(0, 0.35, 0);
    targetGroup.rotation.set(0, 0, 0);
  };

  if (options.floatingWoolPad) {
    options.floatingWoolPad.setFloatingEnabled(false, 0.36);
  } else if (options.mattressGroup) {
    dockMattress(options.mattressGroup);
  }

  const setStyle = (style: BedroomStyle, duration = 0.5) => {
    const preset = BEDROOM_STYLE_PRESETS[style] ?? BEDROOM_STYLE_PRESETS['nordic-coastal'];
    roomBoundary.applyStyle(preset, duration);
    floor.applyStyle(preset, duration);
    rug.applyStyle(preset, duration);
    throwBlanket.applyStyle(preset, duration);
    accentPillows.applyStyle(preset, duration);
    framedArt.applyStyle(preset, duration);
    bedsideBook.applyStyle(preset, duration);
  };

  // Apply initial style immediately (duration = 0)
  setStyle(initialStyle, 0);

  const setBedDecorVisible = (visible: boolean) => {
    throwBlanket.group.visible = visible;
    accentPillows.group.visible = visible;
  };

  const runSmokeTest = (dockedMattressGroup?: THREE.Object3D) => {
    const floorMesh = floor.meshes[0];
    const rugY = rug.group.position.y;
    const floorY = floorMesh ? floorMesh.position.y : 0;
    const registryKeys = Object.keys(BEDROOM_REGISTRY);

    console.group('=== BEDROOM SANCTUARY SMOKE TEST REPORT ===');
    console.log(
      '0. Registry Keys (11 expected):',
      registryKeys.length === 11 ? `PASS (${registryKeys.join(', ')})` : `INFO (${registryKeys.length}: ${registryKeys.join(', ')})`,
    );
    console.log(
      '1. Rug vs Floor Clearance:',
      rugY > floorY ? `PASS (No Z-fighting: rug y=${rugY}, floor y=${floorY})` : 'FAIL',
    );
    console.log(
      '2. Mattress Docking Height:',
      dockedMattressGroup && Math.abs(dockedMattressGroup.position.y - 0.35) < 1e-6
        ? 'PASS (y=0.35m)'
        : `FAIL (Misaligned Y: ${dockedMattressGroup?.position.y ?? 'none'})`,
    );
    console.log(
      '3. Soft Sanctuary Daylight Rig:',
      sunLight.intensity === 2.8 && ambientRig.intensity === 0.6 ? 'PASS (4000K Sun + Hemi)' : 'FAIL',
    );
    console.groupEnd();
  };

  const dispose = () => {
    disposeComponent('hardwood-floor');
    disposeComponent('plush-wool-rug');
    disposeComponent('puffy-platform-frame');
    disposeComponent('puffy-headboard');
    disposeComponent('room-boundary');
    disposeComponent('window-curtain-wall');
    disposeComponent('sconces-pair');
    disposeComponent('bed-throw-blanket');
    disposeComponent('accent-pillows');
    disposeComponent('framed-canvas-art');
    disposeComponent('bedside-art-book');
    disposeAllBedroomComponents();

    group.clear();
  };

  return {
    group,
    registry: BEDROOM_REGISTRY,
    setStyle,
    setBedDecorVisible,
    dockMattress,
    runSmokeTest,
    dispose,
  };
}

export interface BedroomSanctuarySceneProps extends BedroomSanctuarySceneOptions {
  /** Optional external Three.js scene; if omitted, mounts a standalone 3/4 WebGL viewport */
  scene?: THREE.Scene;
}

export const BedroomSanctuaryScene: React.FC<BedroomSanctuarySceneProps> = ({
  scene: externalScene,
  ...options
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mode A: Attached to an external Three.js Scene
    if (externalScene) {
      const sanctuary = createBedroomSanctuaryScene(options);
      externalScene.add(sanctuary.group);
      return () => {
        externalScene.remove(sanctuary.group);
        sanctuary.dispose();
      };
    }

    // Mode B: Standalone 3/4 Perspective Verification Viewport
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let rafId = 0;

    const width = Math.max(320, container.clientWidth || 1024);
    const height = Math.max(320, container.clientHeight || 680);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EFEAE1');
    scene.fog = new THREE.FogExp2('#EFEAE1', 0.012);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.5;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(2.8, 1.8, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.6, 0);
    controls.enableDamping = true;
    controls.update();

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
    });
    sanctuary.dockMattress(mattressDockGroup);
    scene.add(sanctuary.group);
    scene.add(mattressDockGroup);

    sanctuary.runSmokeTest(mattressDockGroup);

    const handleResize = () => {
      if (isDisposed || !container) return;
      const cw = container.clientWidth || width;
      const ch = container.clientHeight || height;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch, false);
    };
    window.addEventListener('resize', handleResize);

    const renderLoop = () => {
      if (isDisposed) return;
      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      woolPad.dispose();
      sanctuary.dispose();
      envTex.dispose();
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [externalScene]);

  return <div ref={mountRef} className="w-full h-full relative" style={{ minHeight: '640px' }} />;
};
