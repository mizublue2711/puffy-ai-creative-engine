import { create } from 'zustand';
import {
  BEDROOM_CONFIGURABLE_ITEMS,
  type BedroomDockCategory,
  type BedroomEnvironmentId,
} from '../components/canvas/bedroom/BedroomRegistry.ts';

export type PillowCountOption = 0 | 2 | 4;
export type MattressVariant = 'cloud' | 'royal' | 'flux';
export type BedFrameVariant = 'kyoto' | 'milan' | 'solace';
export type CuratedSetPreset = 'zen-kyoto' | 'modern-milan' | 'warm-solace';

export interface BedroomConfigState {
  // Room Environment / Space Theme (drives walls, floor, rug, and bed runner palette)
  activeEnvironment: BedroomEnvironmentId;

  // Curated Mattress + Bed Frame Pairings
  activeMattress: MattressVariant;
  activeBedFrame: BedFrameVariant;

  // Dynamic toggles dictionary: [itemId: string]: boolean
  activeItems: Record<string, boolean>;
  pillowCount: PillowCountOption;
  activeCategory: BedroomDockCategory;
  isDockExpanded: boolean;

  // Actions
  setEnvironment: (env: BedroomEnvironmentId) => void;
  applyCuratedSet: (set: CuratedSetPreset) => void;
  setMattress: (m: MattressVariant) => void;
  setBedFrame: (f: BedFrameVariant) => void;
  toggleItem: (itemId: string) => void;
  setItemActive: (itemId: string, active: boolean) => void;
  setPillowCount: (count: PillowCountOption) => void;
  setActiveCategory: (cat: BedroomDockCategory) => void;
  toggleDockExpanded: () => void;
  setDockExpanded: (expanded: boolean) => void;
}

export const useBedroomConfigStore = create<BedroomConfigState>((set) => ({
  activeEnvironment: 'zen-sanctuary',
  activeMattress: 'cloud',
  activeBedFrame: 'kyoto',

  activeItems: {
    'puffy-bed-runner': true,
    'puffy-pillow-pair': true,
    'staggered-pendant-cluster': true,
    'puffy-cloud-ceiling-light': true,
    'zen-courtyard-sanctuary': true,
  },
  pillowCount: 2,
  activeCategory: 'bedding',
  isDockExpanded: true,

  setEnvironment: (activeEnvironment) => set({ activeEnvironment }),

  applyCuratedSet: (preset) => {
    switch (preset) {
      case 'zen-kyoto':
        set({ activeMattress: 'cloud', activeBedFrame: 'kyoto' });
        break;
      case 'modern-milan':
        set({ activeMattress: 'royal', activeBedFrame: 'milan' });
        break;
      case 'warm-solace':
        set({ activeMattress: 'flux', activeBedFrame: 'solace' });
        break;
    }
  },

  setMattress: (activeMattress) => set({ activeMattress }),

  setBedFrame: (activeBedFrame) => set({ activeBedFrame }),

  toggleItem: (id) =>
    set((state) => {
      const registryDefault = BEDROOM_CONFIGURABLE_ITEMS[id]?.defaultState;
      const fallback = typeof registryDefault === 'boolean' ? registryDefault : true;
      const current = state.activeItems[id] ?? fallback;
      return {
        activeItems: { ...state.activeItems, [id]: !current },
      };
    }),

  setItemActive: (id, active) =>
    set((state) => ({
      activeItems: { ...state.activeItems, [id]: active },
    })),

  setPillowCount: (count) =>
    set((state) => ({
      pillowCount: count,
      activeItems: { ...state.activeItems, 'puffy-pillow-pair': count > 0 },
    })),

  setActiveCategory: (activeCategory) => set({ activeCategory }),

  toggleDockExpanded: () =>
    set((state) => ({ isDockExpanded: !state.isDockExpanded })),

  setDockExpanded: (isDockExpanded) => set({ isDockExpanded }),
}));
