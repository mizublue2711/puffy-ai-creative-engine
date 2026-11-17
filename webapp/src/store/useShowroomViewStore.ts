import { create } from 'zustand';
import type { ShowroomTab } from '../components/showroom/ShowroomHeader';

export type ShowroomView = ShowroomTab;
export type ShowroomDoor = 'meadow' | 'bedroom' | 'indoor-lab' | 'studio';

interface ShowroomViewState {
  activeView: ShowroomTab;
  setActiveView: (view: ShowroomTab) => void;
  activeDoor: ShowroomDoor;
  setActiveDoor: (door: ShowroomDoor) => void;
  doorTrigger: { door: ShowroomDoor; timestamp: number } | null;
  selectDoor: (door: ShowroomDoor) => void;
}

export const useShowroomViewStore = create<ShowroomViewState>((set) => ({
  activeView: 'interactive',
  setActiveView: (activeView) => set({ activeView }),
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
