export interface BedroomRoomConfig {
  id: 'classic' | 'modern';
  label: string;
  type: 'procedural' | 'gltf';
  modelPath?: string;
  hideMeshes?: string[];
  mattressAnchor: {
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
  };
}

export const BEDROOM_ROOMS: Record<string, BedroomRoomConfig> = {
  classic: {
    id: 'classic',
    label: 'Classic Sanctuary',
    type: 'procedural',
    mattressAnchor: {
      position: [0, 0, -1.9],
    },
  },
  modern: {
    id: 'modern',
    label: 'Modern Minimalist',
    type: 'gltf',
    modelPath: '/assets/bedroom model/modern_bedroom/scene.gltf',
    hideMeshes: [
      'ModernBedroom_BedFrame_0',
      'ModernBedroom_Duvet_0',
      'ModernBedroom_Pillows_0',
    ],
    mattressAnchor: {
      position: [0, 0.15, -0.45], // Center on carpet between nightstands
    },
  },
};

export type BedroomRoomId = keyof typeof BEDROOM_ROOMS;

export const DEFAULT_BEDROOM_ROOM_ID: BedroomRoomId = 'modern';
