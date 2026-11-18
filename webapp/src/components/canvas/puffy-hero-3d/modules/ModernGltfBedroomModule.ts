import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { BEDROOM_ROOMS, type BedroomRoomConfig } from '../../../../config/bedroomRooms.config.ts';
import type { BedroomStyle } from '../../bedroom/BedroomRegistry.ts';

const GLTF_STYLE_PRESETS: Record<string, {
  structure: string;
  carpet: string;
  endTables: string;
  chair: string;
  decorAccent: string;
}> = {
  zen: {
    structure: '#BDB4A5',
    carpet: '#E5E2DA',
    endTables: '#C2B29D',
    chair: '#D5CFC5',
    decorAccent: '#4A5B4E',
  },
  'zen-sanctuary': {
    structure: '#BDB4A5',
    carpet: '#E5E2DA',
    endTables: '#C2B29D',
    chair: '#D5CFC5',
    decorAccent: '#4A5B4E',
  },
  modern: {
    structure: '#C8C2B7',
    carpet: '#DCD7CE',
    endTables: '#3A3835',
    chair: '#2E3033',
    decorAccent: '#1C2A3A',
  },
  'modern-sanctuary': {
    structure: '#C8C2B7',
    carpet: '#DCD7CE',
    endTables: '#3A3835',
    chair: '#2E3033',
    decorAccent: '#1C2A3A',
  },
  'mid-century': {
    structure: '#6E5840',
    carpet: '#D4CEBF',
    endTables: '#4A3728',
    chair: '#8C4A2F',
    decorAccent: '#C5A059',
  },
};

const GLTF_ART_PRESETS: Record<string, string> = {
  zen: '/assets/art/japandi-sanctuary.webp',
  'zen-sanctuary': '/assets/art/japandi-sanctuary.webp',
  japandi: '/assets/art/japandi-sanctuary.webp',
  'mid-century': '/assets/art/mid-century.webp',
  modern: '/assets/art/urban-loft.webp',
  'modern-sanctuary': '/assets/art/urban-loft.webp',
  'urban-loft': '/assets/art/urban-loft.webp',
  'nordic-coastal': '/assets/art/nordic-coastal.webp',
};

const GLTF_ART_ROTATIONS: Record<string, number> = {
  zen: Math.PI / 2,
  'zen-sanctuary': Math.PI / 2,
  japandi: Math.PI / 2,
  'nordic-coastal': Math.PI / 2,
  modern: -Math.PI / 2,
  'modern-sanctuary': -Math.PI / 2,
  'urban-loft': -Math.PI / 2,
  'mid-century': -Math.PI / 2,
};

export interface ModernGltfBedroomModuleOptions {
  config?: BedroomRoomConfig;
  castShadow?: boolean;
  onLoaded?: (roomModel: THREE.Group) => void;
  onError?: (err: unknown) => void;
}

export interface ModernGltfBedroomInstance {
  group: THREE.Group;
  config: BedroomRoomConfig;
  isLoaded: boolean;
  setStyle: (style: BedroomStyle, duration?: number) => void;
  dispose: () => void;
}

/**
 * Modern Minimalist Bedroom Architecture & Staging Module (GLTF LEGO Block)
 * - Loads realistic modern bedroom geometry (walls, floor, ceiling, window, carpet, lamps, nightstands, chair)
 * - Decoupled from core Three.js runner via BedroomRoomConfig
 * - Traverses and hides old bed meshes (ModernBedroom_BedFrame_0, ModernBedroom_Duvet_0, ModernBedroom_Pillows_0)
 * - Aligns room footprint to receive docked Puffy mattress assembly between nightstands
 */
export function createModernGltfBedroomModule(
  options: ModernGltfBedroomModuleOptions = {},
): ModernGltfBedroomInstance {
  const config = options.config ?? BEDROOM_ROOMS.modern;
  const castShadow = options.castShadow ?? true;

  const group = new THREE.Group();
  group.name = `BedroomModule_${config.id}`;

  const hideMeshSet = new Set(config.hideMeshes ?? [
    'ModernBedroom_BedFrame_0',
    'ModernBedroom_Duvet_0',
    'ModernBedroom_Pillows_0',
  ]);

  let isLoaded = false;
  let loadedRoomModel: THREE.Group | null = null;

  const boundMeshes: {
    structure?: THREE.MeshStandardMaterial;
    carpet?: THREE.MeshStandardMaterial;
    endTables?: THREE.MeshStandardMaterial;
    chair?: THREE.MeshStandardMaterial;
    decor?: THREE.MeshStandardMaterial;
    painting?: THREE.MeshStandardMaterial;
    lamps?: THREE.MeshStandardMaterial;
  } = {};
  let artRequestId = 0;

  const modelUrl = config.modelPath
    ? encodeURI(config.modelPath)
    : '/assets/bedroom%20model/modern_bedroom/scene.gltf';

  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      const roomModel = gltf.scene;
      roomModel.name = 'ModernBedroom_SceneRoot';

      // 180° rotation to align natural window lighting & nightstand alcove with camera view
      roomModel.rotation.y = Math.PI;

      // Position room relative to the mattress anchor so bed docks cleanly on carpet
      const anchor = config.mattressAnchor.position;
      const anchorY = anchor ? anchor[1] : 0.15;
      const anchorZ = anchor ? anchor[2] : -0.45;
      roomModel.position.set(0, anchorY, 1.288 + anchorZ);

      // Hide isolated old bed meshes while keeping room architecture & decor intact
      roomModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (hideMeshSet.has(mesh.name)) {
            mesh.visible = false;
          } else {
            mesh.visible = true;
            mesh.castShadow = castShadow;
            mesh.receiveShadow = true;

            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map((material) => (material as THREE.Material).clone());
              } else {
                mesh.material = (mesh.material as THREE.Material).clone();
              }

              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              for (const mat of mats) {
                const standardMat = mat as THREE.MeshStandardMaterial;
                if (standardMat.map) {
                  standardMat.map.colorSpace = THREE.SRGBColorSpace;
                  standardMat.map.anisotropy = 8;
                  standardMat.map.needsUpdate = true;
                }
              }

              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mesh.name === 'ModernBedroom_Structure_0') boundMeshes.structure = mat;
              if (mesh.name === 'ModernBedroom_Carpet_0') boundMeshes.carpet = mat;
              if (mesh.name === 'ModernBedroom_EndTables_0') boundMeshes.endTables = mat;
              if (mesh.name === 'ModernBedroom_Chair_0') boundMeshes.chair = mat;
              if (mesh.name === 'ModernBedroom_Meshes_0') boundMeshes.decor = mat;
              if (mesh.name === 'ModernBedroom_Painting_0') boundMeshes.painting = mat;
              if (mesh.name === 'ModernBedroom_EndLamps_0') boundMeshes.lamps = mat;
            }
          }
        }
      });

      loadedRoomModel = roomModel;
      group.add(roomModel);
      isLoaded = true;
      options.onLoaded?.(roomModel);
    },
    undefined,
    (err) => {
      console.error(`[ModernGltfBedroomModule] Failed to load room model "${modelUrl}":`, err);
      options.onError?.(err);
    },
  );

  const setStyle = (style: BedroomStyle, duration = 0.5) => {
    const resolvedKey = (typeof style === 'string' ? style : 'zen').toLowerCase();
    const themeKey =
      resolvedKey === 'japandi' ? 'zen'
        : resolvedKey === 'nordic-coastal' || resolvedKey === 'urban-loft' ? 'modern'
          : resolvedKey;
    const theme = GLTF_STYLE_PRESETS[themeKey] ?? GLTF_STYLE_PRESETS.zen;

    const tweenColor = (mat?: THREE.MeshStandardMaterial, hex?: string) => {
      if (!mat || !hex) return;
      const target = new THREE.Color(hex);
      gsap.to(mat.color, {
        r: target.r,
        g: target.g,
        b: target.b,
        duration,
        ease: 'power2.out',
      });
    };

    if (boundMeshes.painting) {
      const artUrl = GLTF_ART_PRESETS[resolvedKey] ?? GLTF_ART_PRESETS.zen;
      const targetRotation = GLTF_ART_ROTATIONS[resolvedKey] ?? -Math.PI / 2;
      const requestId = ++artRequestId;
      new THREE.TextureLoader().load(
        artUrl,
        (texture) => {
          if (requestId !== artRequestId || !boundMeshes.painting) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.center.set(0.5, 0.5);
          texture.rotation = targetRotation;
          texture.needsUpdate = true;

          const mat = boundMeshes.painting;
          mat.map = texture;
          mat.emissiveMap = null;
          mat.emissive.setHex(0x000000);
          mat.transparent = false;
          mat.opacity = 1;
          mat.roughness = 0.85;
          mat.metalness = 0;
          mat.needsUpdate = true;
        },
        undefined,
        (error) => {
          console.error(`[ModernGltfBedroomModule] Failed to load artwork "${artUrl}":`, error);
        },
      );
    }

    tweenColor(boundMeshes.structure, theme.structure);
    tweenColor(boundMeshes.carpet, theme.carpet);
    tweenColor(boundMeshes.endTables, theme.endTables);
    tweenColor(boundMeshes.chair, theme.chair);
    tweenColor(boundMeshes.decor, theme.decorAccent);

    if (boundMeshes.structure) {
      const emissiveColor = new THREE.Color(theme.structure);
      gsap.to(boundMeshes.structure.emissive, {
        r: emissiveColor.r,
        g: emissiveColor.g,
        b: emissiveColor.b,
        duration,
        ease: 'power2.out',
      });
      gsap.to(boundMeshes.structure, {
        emissiveIntensity: 0.08,
        duration,
        ease: 'power2.out',
      });
    }

    if (boundMeshes.lamps) {
      tweenColor(boundMeshes.lamps, '#FFF9EC');
      const lampEmissive = new THREE.Color('#FFE4B5');
      gsap.to(boundMeshes.lamps.emissive, {
        r: lampEmissive.r,
        g: lampEmissive.g,
        b: lampEmissive.b,
        duration,
        ease: 'power2.out',
      });
      gsap.to(boundMeshes.lamps, {
        emissiveIntensity: 0.45,
        duration,
        ease: 'power2.out',
      });
    }
  };

  const dispose = () => {
    artRequestId += 1;
    if (loadedRoomModel) {
      loadedRoomModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              const sm = m as THREE.MeshStandardMaterial;
              sm.map?.dispose();
              sm.normalMap?.dispose();
              sm.roughnessMap?.dispose();
              sm.metalnessMap?.dispose();
              sm.dispose();
            });
          } else if (mesh.material) {
            const sm = mesh.material as THREE.MeshStandardMaterial;
            sm.map?.dispose();
            sm.normalMap?.dispose();
            sm.roughnessMap?.dispose();
            sm.metalnessMap?.dispose();
            sm.dispose();
          }
        }
      });
      group.remove(loadedRoomModel);
      loadedRoomModel = null;
    }
    group.clear();
  };

  return {
    group,
    config,
    get isLoaded() {
      return isLoaded;
    },
    setStyle,
    dispose,
  };
}
