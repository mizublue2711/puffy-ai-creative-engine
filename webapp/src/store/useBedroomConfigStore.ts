import { create } from 'zustand';
import {
  BEDROOM_CONFIGURABLE_ITEMS,
  type BedroomDockCategory,
} from '../components/canvas/bedroom/BedroomRegistry.ts';

export type PillowCountOption = 0 | 2 | 4;

export interface BedroomConfigState {
  // Dynamic toggles dictionary: [itemId: string]: boolean
  activeItems: Record<string, boolean>;
  pillowCount: PillowCountOption;
  activeCategory: BedroomDockCategory;
  isDockExpanded: boolean;

  // Actions
  toggleItem: (itemId: string) => void;
  setItemActive: (itemId: string, active: boolean) => void;
  setPillowCount: (count: PillowCountOption) => void;
  setActiveCategory: (cat: BedroomDockCategory) => void;
  toggleDockExpanded: () => void;
  setDockExpanded: (expanded: boolean) => void;
}

export const useBedroomConfigStore = create<BedroomConfigState>((set) => ({
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
