import * as THREE from 'three';

export type BedroomComponentCategory = 'furniture' | 'lighting' | 'flooring' | 'decor';

export type BedroomStyle = 'japandi' | 'nordic-coastal' | 'mid-century' | 'urban-loft';

export interface BedroomStylePreset {
  id: BedroomStyle;
  label: string;
  wall: {
    color: string;
    roughness: number;
    accentSlatColor: string;
    accentSlatVisible: boolean;
    accentSlatMetalness: number;
    baseboardColor: string;
  };
  floor: {
    color: string;
    roughness: number;
    pattern: 'oak' | 'pine' | 'herringbone' | 'smoked-oak';
  };
  rug: {
    bodyColor: string;
    trimColor: string;
    roughness: number;
    sheenColor: string;
    pattern: 'jute' | 'boucle' | 'velvet' | 'flatweave';
  };
  throwBlanket: {
    color: string;
    sheenColor: string;
    roughness: number;
    pattern: 'linen' | 'chunky-knit' | 'cashmere' | 'waffle';
  };
  pillows: {
    primaryColor: string;
    secondaryColor: string;
    pipingColor: string;
    sheenColor: string;
    roughness: number;
  };
  art: {
    frameColor: string;
    frameMetalness: number;
    title: string;
    motif: 'japandi-enso' | 'nordic-diptych' | 'midcentury-bauhaus' | 'urban-concrete';
  };
  book: {
    coverColor: string;
    accentColor: string;
    title: string;
    vesselColor: string;
    vesselMetalness: number;
    vesselRoughness: number;
  };
}

export const BEDROOM_STYLE_ORDER: BedroomStyle[] = [
  'japandi',
  'nordic-coastal',
  'mid-century',
  'urban-loft',
];

export const BEDROOM_STYLE_PRESETS: Record<BedroomStyle, BedroomStylePreset> = {
  japandi: {
    id: 'japandi',
    label: 'Japandi Sanctuary',
    wall: {
      color: '#DEDAD3',
      roughness: 0.94,
      accentSlatColor: '#C8A882',
      accentSlatVisible: true,
      accentSlatMetalness: 0.02,
      baseboardColor: '#E8E4DC',
    },
    floor: {
      color: '#C8A882',
      roughness: 0.48,
      pattern: 'oak',
    },
    rug: {
      bodyColor: '#D5C5AA',
      trimColor: '#3B3D42',
      roughness: 0.96,
      sheenColor: '#EDE4D3',
      pattern: 'jute',
    },
    throwBlanket: {
      color: '#2B3245',
      sheenColor: '#5B6787',
      roughness: 0.92,
      pattern: 'linen',
    },
    pillows: {
      primaryColor: '#EDE8DD',
      secondaryColor: '#2B3245',
      pipingColor: '#3A4258',
      sheenColor: '#FFF7EA',
      roughness: 0.9,
    },
    art: {
      frameColor: '#C8A882',
      frameMetalness: 0.04,
      title: 'Enso Washi',
      motif: 'japandi-enso',
    },
    book: {
      coverColor: '#D8D0C3',
      accentColor: '#2B3245',
      title: 'WABI INSPIRATIONS',
      vesselColor: '#8B7D70',
      vesselMetalness: 0.0,
      vesselRoughness: 0.88,
    },
  },
  'nordic-coastal': {
    id: 'nordic-coastal',
    label: 'Nordic Coastal',
    wall: {
      color: '#F8F7F4',
      roughness: 0.9,
      accentSlatColor: '#F8F7F4',
      accentSlatVisible: false,
      accentSlatMetalness: 0.0,
      baseboardColor: '#FFFFFF',
    },
    floor: {
      color: '#E6DCCF',
      roughness: 0.44,
      pattern: 'pine',
    },
    rug: {
      bodyColor: '#D5CEBF',
      trimColor: '#8E8372',
      roughness: 0.95,
      sheenColor: '#EDE4D3',
      pattern: 'jute',
    },
    throwBlanket: {
      color: '#202436',
      sheenColor: '#4E5B85',
      roughness: 0.92,
      pattern: 'chunky-knit',
    },
    pillows: {
      primaryColor: '#202436',
      secondaryColor: '#262C42',
      pipingColor: '#F4F0E8',
      sheenColor: '#586796',
      roughness: 0.85,
    },
    art: {
      frameColor: '#E5DFD5',
      frameMetalness: 0.02,
      title: 'Coastal Tide',
      motif: 'nordic-diptych',
    },
    book: {
      coverColor: '#202436',
      accentColor: '#EDE8DF',
      title: 'KINFOLK',
      vesselColor: '#F6F4EF',
      vesselMetalness: 0.05,
      vesselRoughness: 0.25,
    },
  },
  'mid-century': {
    id: 'mid-century',
    label: 'Mid-Century',
    wall: {
      color: '#4A3528',
      roughness: 0.56,
      accentSlatColor: '#C5A059',
      accentSlatVisible: true,
      accentSlatMetalness: 0.88,
      baseboardColor: '#3A281E',
    },
    floor: {
      color: '#6A4730',
      roughness: 0.36,
      pattern: 'herringbone',
    },
    rug: {
      bodyColor: '#C5C6C8',
      trimColor: '#8B795E',
      roughness: 0.86,
      sheenColor: '#EAECEF',
      pattern: 'velvet',
    },
    throwBlanket: {
      color: '#1E2538',
      sheenColor: '#506491',
      roughness: 0.78,
      pattern: 'cashmere',
    },
    pillows: {
      primaryColor: '#1E2538',
      secondaryColor: '#242D45',
      pipingColor: '#D4B475',
      sheenColor: '#667BB0',
      roughness: 0.8,
    },
    art: {
      frameColor: '#C5A059',
      frameMetalness: 0.86,
      title: 'Bauhaus Gold',
      motif: 'midcentury-bauhaus',
    },
    book: {
      coverColor: '#2C221E',
      accentColor: '#D4B475',
      title: 'MONOCLE COSY HOMES',
      vesselColor: '#C5A059',
      vesselMetalness: 0.85,
      vesselRoughness: 0.28,
    },
  },
  'urban-loft': {
    id: 'urban-loft',
    label: 'Urban Loft',
    wall: {
      color: '#AEB0B2',
      roughness: 0.94,
      accentSlatColor: '#22252A',
      accentSlatVisible: false,
      accentSlatMetalness: 0.6,
      baseboardColor: '#22252A',
    },
    floor: {
      color: '#6F6A64',
      roughness: 0.45,
      pattern: 'smoked-oak',
    },
    rug: {
      bodyColor: '#3E4147',
      trimColor: '#2B3245',
      roughness: 0.9,
      sheenColor: '#686E7A',
      pattern: 'flatweave',
    },
    throwBlanket: {
      color: '#2E3440',
      sheenColor: '#5B677D',
      roughness: 0.9,
      pattern: 'waffle',
    },
    pillows: {
      primaryColor: '#9A9EA3',
      secondaryColor: '#4C566A',
      pipingColor: '#2E3440',
      sheenColor: '#C4C8CE',
      roughness: 0.88,
    },
    art: {
      frameColor: '#1E2024',
      frameMetalness: 0.72,
      title: 'Concrete Museum',
      motif: 'urban-concrete',
    },
    book: {
      coverColor: '#1B1D21',
      accentColor: '#AEB0B2',
      title: 'ARCHITECTURE NOW!',
      vesselColor: '#2A2D32',
      vesselMetalness: 0.35,
      vesselRoughness: 0.75,
    },
  },
};

export interface BedroomComponentMetadata {
  id: string;
  name: string;
  category: BedroomComponentCategory;
  dimensions: { width: number; height: number; depth: number };
  defaultTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  materialSlots: string[];
  disposableMeshes: THREE.Mesh[];
}

export const BEDROOM_REGISTRY: Record<string, BedroomComponentMetadata> = {};

/**
 * Registers or updates a bedroom LEGO component in the centralized registry.
 */
export function registerBedroomComponent(metadata: BedroomComponentMetadata): BedroomComponentMetadata {
  BEDROOM_REGISTRY[metadata.id] = metadata;
  return metadata;
}

function disposeMaterialAndTextures(material: THREE.Material, disposedTextures: Set<THREE.Texture>): void {
  const matRecord = material as unknown as Record<string, unknown>;
  for (const value of Object.values(matRecord)) {
    if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * Traverses and disposes all geometries, materials, and textures associated with
 * a registered bedroom component, then removes it from `BEDROOM_REGISTRY`.
 */
export function disposeComponent(id: string): void {
  const entry = BEDROOM_REGISTRY[id];
  if (!entry) return;

  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  for (const rootMesh of entry.disposableMeshes) {
    rootMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
          disposedGeometries.add(obj.geometry);
          obj.geometry.dispose();
        }
        if (Array.isArray(obj.material)) {
          for (const mat of obj.material) {
            if (mat && !disposedMaterials.has(mat)) {
              disposedMaterials.add(mat);
              disposeMaterialAndTextures(mat, disposedTextures);
            }
          }
        } else if (obj.material && !disposedMaterials.has(obj.material)) {
          disposedMaterials.add(obj.material);
          disposeMaterialAndTextures(obj.material, disposedTextures);
        }
      }
    });
  }

  entry.disposableMeshes.length = 0;
  delete BEDROOM_REGISTRY[id];
}

/**
 * Disposes every currently registered bedroom component cleanly.
 */
export function disposeAllBedroomComponents(): void {
  const ids = Object.keys(BEDROOM_REGISTRY);
  for (const id of ids) {
    disposeComponent(id);
  }
}
