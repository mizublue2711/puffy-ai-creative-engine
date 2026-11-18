import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { BEDROOM_ROOMS, type BedroomRoomConfig } from '../../../../config/bedroomRooms.config.ts';
import {
  BEDROOM_STYLE_PRESETS,
  disposeComponent,
  registerBedroomComponent,
  type BedroomStyle,
} from '../../bedroom/BedroomRegistry.ts';
import { createHardwoodFloor } from '../../bedroom/components/HardwoodFloor.tsx';
import { createPlushAreaRug } from '../../bedroom/components/PlushAreaRug.tsx';
import { createRoomBoundary } from '../../bedroom/components/RoomBoundary.tsx';
import { createWindowCurtainWall } from '../../bedroom/components/WindowCurtainWall.tsx';
import { createBedsideArtBook } from '../../bedroom/components/BedsideArtBook.tsx';
import { createCourtyardWall } from '../../bedroom/components/courtyard/CourtyardWall.tsx';
import { createKaresansuiSandBed } from '../../bedroom/components/courtyard/KaresansuiSandBed.tsx';
import { createFlushZenGardenRig } from '../../bedroom/components/courtyard/FlushZenGardenRig.tsx';
import { createZenMoonMirror } from '../../bedroom/components/courtyard/ZenMoonMirror.tsx';
import { createTrailingVinesRig } from '../../bedroom/components/courtyard/TrailingVinesRig.tsx';
import {
  getWallArtTexturePath,
  loadWallArtTexture,
} from '../../bedroom/BedroomSanctuaryScene.tsx';
import { useBedroomConfigStore } from '../../../../store/useBedroomConfigStore.ts';

export interface ClassicBedroomModuleOptions {
  config?: BedroomRoomConfig;
  initialStyle?: BedroomStyle;
  mattressWidth?: number;
  mattressLength?: number;
}

export interface ClassicBedroomInstance {
  group: THREE.Group;
  config: BedroomRoomConfig;
  setStyle: (style: BedroomStyle, duration?: number) => void;
  syncToggles: (activeItems: Record<string, boolean>) => void;
  dispose: () => void;
}

/**
 * Classic Legacy Procedural Bedroom Architecture Module (LEGO Block)
 * - Restored from git history as an interchangeable room environment
 * - Features procedural hardwood floor, plush area rug, boundary walls, floor-to-ceiling curtain wall,
 *   3-layer framed gallery wall art, bedside artbook, and Japanese courtyard garden
 */
export function createClassicBedroomModule(
  options: ClassicBedroomModuleOptions = {},
): ClassicBedroomInstance {
  const config = options.config ?? BEDROOM_ROOMS.classic;
  const initialStyle = options.initialStyle ?? 'nordic-coastal';
  const mattressW = options.mattressWidth ?? 2.15;
  const mattressL = options.mattressLength ?? 2.55;

  const group = new THREE.Group();
  group.name = `BedroomModule_${config.id}`;

  let disposed = false;
  let bedsideTable: THREE.Group | null = null;
  const bedsideTableMaterials: THREE.MeshStandardMaterial[] = [];
  let currentStyle = initialStyle;

  const applyBedsideTableStyle = (style: BedroomStyle, duration: number) => {
    let woodColorHex = '#C2B29D';
    if (style.includes('modern') || style === 'urban-loft') woodColorHex = '#2A2825';
    if (style.includes('mid-century')) woodColorHex = '#4A3728';
    const targetColor = new THREE.Color(woodColorHex);

    bedsideTableMaterials.forEach((material) => {
      gsap.to(material.color, {
        r: targetColor.r,
        g: targetColor.g,
        b: targetColor.b,
        duration,
        ease: 'power2.out',
      });
    });
  };

  const disposeBedsideTableResources = (table: THREE.Group) => {
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    table.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
        disposedGeometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        if (!material || disposedMaterials.has(material)) return;
        disposedMaterials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
            disposedTextures.add(value);
            value.dispose();
          }
        });
        material.dispose();
      });
    });
  };

  const tableUrl = '/assets/furniture/bedside_table%20(1)/scene.gltf';
  new GLTFLoader().load(
    tableUrl,
    (gltf) => {
      const table = gltf.scene;
      if (disposed) {
        disposeBedsideTableResources(table);
        return;
      }

      const bbox = new THREE.Box3().setFromObject(table);
      const size = bbox.getSize(new THREE.Vector3());
      if (size.y > 0) {
        const targetHeight = 1.25;
        const scaleFactor = targetHeight / size.y;
        table.scale.setScalar(scaleFactor);
      }

      bbox.setFromObject(table);
      table.position.set(-1.95, -bbox.min.y, -1.70);
      table.rotation.y = 0;

      table.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!mesh.material) return;

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((material) => material.clone());
          bedsideTableMaterials.push(
            ...mesh.material.filter(
              (material): material is THREE.MeshStandardMaterial =>
                material instanceof THREE.MeshStandardMaterial,
            ),
          );
        } else {
          mesh.material = mesh.material.clone();
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            bedsideTableMaterials.push(mesh.material);
          }
        }
      });

      bedsideTable = table;
      group.add(table);
      applyBedsideTableStyle(currentStyle, 0);
    },
    undefined,
    (error) => {
      console.error(`[ClassicBedroomModule] Failed to load bedside table "${tableUrl}":`, error);
    },
  );

  // 1. Hardwood Floor (y = 0, x = [-3.80, +3.60], slab depth 7.20m centered z = +1.30)
  const floor = createHardwoodFloor({ width: 7.40, length: 7.20 });
  floor.group.position.set(-0.10, 0, 1.30);
  group.add(floor.group);

  // 2. Natural Textured Jute Area Rug (10mm slab, y = 0.005m)
  const rug = createPlushAreaRug({
    width: Math.max(3.20, mattressW + 1.20),
    length: Math.max(3.60, mattressL + 1.40),
    thickness: 0.010,
    centerZ: 0.35,
  });
  group.add(rug.group);

  // 3. Room Boundary (7.00m deep: z = -2.20 .. +4.80, ceiling slab, 15mm Negative Shadow Reveal)
  const backWallZ = -2.20;
  const roomBoundary = createRoomBoundary({
    width: 7.40,
    centerX: -0.10,
    wallHeight: 3.90,
    wallZ: backWallZ,
    roomLength: 7.00,
  });
  group.add(roomBoundary.group);

  // 4. Panoramic Glass Facade (x = -3.80m, z = -2.00 .. +4.50, 6.50m) + continuous S-Fold Voile
  const windowCurtain = createWindowCurtainWall({
    wallX: -3.80,
    startZ: -2.00,
    totalLength: 6.50,
    ceilingHeight: 3.90,
  });
  group.add(windowCurtain.group);

  // 5. Gallery Wall Art (Elevated on Back Wall: Width 1.6m, Height 1.05m, Passe-Partout)
  const wallArtGroup = new THREE.Group();
  wallArtGroup.name = 'SanctuaryGalleryWallArt';
  wallArtGroup.position.set(0, 2.50, -1.85);

  const artFrameGeo = new THREE.BoxGeometry(1.64, 1.09, 0.03);
  const artFrameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a1816'),
    roughness: 0.75,
    metalness: 0.1,
    depthTest: true,
  });
  const artFrameMesh = new THREE.Mesh(artFrameGeo, artFrameMat);
  artFrameMesh.name = 'SanctuaryWallArt_Frame';
  artFrameMesh.castShadow = true;
  artFrameMesh.receiveShadow = true;
  wallArtGroup.add(artFrameMesh);

  const artMatGeo = new THREE.PlaneGeometry(1.60, 1.05);
  const artMatBoardMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F9F9F7'),
    roughness: 0.95,
    depthTest: true,
  });
  const artMatBoardMesh = new THREE.Mesh(artMatGeo, artMatBoardMat);
  artMatBoardMesh.name = 'SanctuaryWallArt_MatBoard';
  artMatBoardMesh.position.set(0, 0, 0.016);
  artMatBoardMesh.receiveShadow = true;
  wallArtGroup.add(artMatBoardMesh);

  const initialArtEnv = useBedroomConfigStore.getState().activeEnvironment || initialStyle;
  const initialArtPath = getWallArtTexturePath(initialArtEnv);

  const artCanvasGeo = new THREE.PlaneGeometry(1.30, 0.75);
  const artCanvasMat = new THREE.MeshStandardMaterial({
    roughness: 0.80,
    metalness: 0.0,
    depthTest: true,
  });

  const activeArtTex = loadWallArtTexture(initialArtPath, () => {
    artCanvasMat.map = activeArtTex;
    activeArtTex.needsUpdate = true;
    artCanvasMat.needsUpdate = true;
  });
  artCanvasMat.map = activeArtTex;
  activeArtTex.needsUpdate = true;
  artCanvasMat.needsUpdate = true;

  const artCanvasMesh = new THREE.Mesh(artCanvasGeo, artCanvasMat);
  artCanvasMesh.name = 'SanctuaryWallArt_Canvas';
  artCanvasMesh.position.set(0, 0, 0.018);
  artCanvasMesh.receiveShadow = true;
  wallArtGroup.add(artCanvasMesh);

  group.add(wallArtGroup);

  const updateWallArtTexture = (envOrStyle?: string | null) => {
    const nextPath = getWallArtTexturePath(envOrStyle);
    const nextTex = loadWallArtTexture(nextPath, () => {
      artCanvasMat.map = nextTex;
      nextTex.needsUpdate = true;
      artCanvasMat.needsUpdate = true;
    });
    artCanvasMat.map = nextTex;
    nextTex.needsUpdate = true;
    artCanvasMat.needsUpdate = true;
  };

  registerBedroomComponent({
    id: 'framed-canvas-art',
    name: 'Framed Architectural Canvas Art',
    category: 'decor',
    dimensions: { width: 1.64, height: 1.09, depth: 0.03 },
    defaultTransform: {
      position: [0, 2.50, -1.85],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['art-frame', 'passe-partout', 'canvas-print'],
    disposableMeshes: [artFrameMesh, artMatBoardMesh, artCanvasMesh],
  });

  // 6. Bedside Art Book
  const bedsideBook = createBedsideArtBook({
    sideX: mattressW / 2 + 0.38,
    shelfY: 0.42,
    wallZ: backWallZ,
  });
  group.add(bedsideBook.group);

  // 7. Outdoor Karesansui Zen Courtyard & Moon Mirror
  const courtyardZone = new THREE.Group();
  courtyardZone.name = 'CourtyardSanctuaryZone';
  const courtyardWall = createCourtyardWall();
  courtyardZone.add(courtyardWall.group);

  let zenCourtyardGroup: THREE.Group | null = null;
  let karesansuiSandBed: ReturnType<typeof createKaresansuiSandBed> | null = null;
  let flushZenGardenRig: ReturnType<typeof createFlushZenGardenRig> | null = null;
  let zenMoonMirror: ReturnType<typeof createZenMoonMirror> | null = null;

  const mountZenCourtyard = () => {
    if (zenCourtyardGroup) return;
    zenCourtyardGroup = new THREE.Group();
    zenCourtyardGroup.name = 'ZenCourtyardSanctuary';
    karesansuiSandBed = createKaresansuiSandBed();
    flushZenGardenRig = createFlushZenGardenRig();
    zenMoonMirror = createZenMoonMirror();
    zenCourtyardGroup.add(karesansuiSandBed.group);
    zenCourtyardGroup.add(flushZenGardenRig.group);
    zenCourtyardGroup.add(zenMoonMirror.group);
    courtyardZone.add(zenCourtyardGroup);
  };

  const unmountZenCourtyard = () => {
    if (!zenCourtyardGroup) return;
    courtyardZone.remove(zenCourtyardGroup);
    zenCourtyardGroup.clear();
    karesansuiSandBed?.dispose();
    flushZenGardenRig?.dispose();
    zenMoonMirror?.dispose();
    karesansuiSandBed = null;
    flushZenGardenRig = null;
    zenMoonMirror = null;
    zenCourtyardGroup = null;
  };

  const trailingVinesRig = createTrailingVinesRig();
  courtyardZone.add(trailingVinesRig.group);
  group.add(courtyardZone);

  const setStyle = (style: BedroomStyle, duration = 0.5) => {
    currentStyle = style;
    const preset = BEDROOM_STYLE_PRESETS[style] ?? BEDROOM_STYLE_PRESETS['nordic-coastal'];
    roomBoundary.applyStyle(preset, duration);
    floor.applyStyle(preset, duration);
    rug.applyStyle(preset, duration);
    updateWallArtTexture(style);
    bedsideBook.applyStyle(preset, duration);
    applyBedsideTableStyle(style, duration);
  };

  const syncToggles = (activeItems: Record<string, boolean>) => {
    if (activeItems['zen-courtyard-sanctuary'] ?? true) {
      mountZenCourtyard();
    } else {
      unmountZenCourtyard();
    }
  };

  const dispose = () => {
    disposed = true;
    if (bedsideTable) {
      gsap.killTweensOf(bedsideTableMaterials.map((material) => material.color));
      group.remove(bedsideTable);
      disposeBedsideTableResources(bedsideTable);
      bedsideTable = null;
      bedsideTableMaterials.length = 0;
    }
    disposeComponent('hardwood-floor');
    disposeComponent('plush-wool-rug');
    disposeComponent('room-boundary');
    disposeComponent('window-curtain-wall');
    disposeComponent('framed-canvas-art');
    artFrameGeo.dispose();
    artFrameMat.dispose();
    artMatGeo.dispose();
    artMatBoardMat.dispose();
    artCanvasGeo.dispose();
    artCanvasMat.dispose();
    disposeComponent('bedside-art-book');
    disposeComponent('courtyard-wall');
    courtyardWall.dispose();
    unmountZenCourtyard();
    trailingVinesRig.dispose();
    group.clear();
  };

  return {
    group,
    config,
    setStyle,
    syncToggles,
    dispose,
  };
}
