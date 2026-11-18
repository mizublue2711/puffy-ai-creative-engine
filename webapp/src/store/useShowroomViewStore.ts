import { create } from 'zustand';
import type { ShowroomTab } from '../components/showroom/ShowroomHeader';

export type ShowroomView = ShowroomTab;
export type ShowroomDoor = 'meadow' | 'bedroom' | 'indoor-lab' | 'studio';

interface ShowroomViewState {
  activeView: ShowroomTab;
  setActiveView: (view: ShowroomTab) => void;
  studioPassA: string | null;
  studioPassB: string | null;
  setStudioPasses: (passA: string, passB: string) => void;
  activeDoor: ShowroomDoor;
  setActiveDoor: (door: ShowroomDoor) => void;
  doorTrigger: { door: ShowroomDoor; timestamp: number } | null;
  selectDoor: (door: ShowroomDoor) => void;
}

export const useShowroomViewStore = create<ShowroomViewState>((set) => ({
  activeView: 'interactive',
  setActiveView: (activeView) => set({ activeView }),
  studioPassA: null,
  studioPassB: null,
  setStudioPasses: (studioPassA, studioPassB) => set({ studioPassA, studioPassB }),
  activeDoor: 'meadow',
  setActiveDoor: (activeDoor) => set({ activeDoor }),
  doorTrigger: null,
  selectDoor: (door: ShowroomDoor) => {
    if (door === 'studio') {
      set({
        activeDoor: 'studio',
        activeView: 'banner-studio',
        doorTrigger: { door, timestamp: Date.now() },
      });
    } else {
      set({
        activeDoor: door,
        activeView: 'interactive',
        doorTrigger: { door, timestamp: Date.now() },
      });
    }
  },
}));
