import { create } from 'zustand';
import type { ShowroomTab } from '../components/showroom/ShowroomHeader';

export type ShowroomView = ShowroomTab;
export type ShowroomDoor = 'meadow' | 'bedroom' | 'indoor-lab' | 'studio';

const readStoredStudioPass = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('Unable to read a saved studio pass from localStorage.', error);
    return null;
  }
};

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
  studioPassA: readStoredStudioPass('puffy_studio_passA'),
  studioPassB: readStoredStudioPass('puffy_studio_passB'),
  setStudioPasses: (studioPassA, studioPassB) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('puffy_studio_passA', studioPassA);
        window.localStorage.setItem('puffy_studio_passB', studioPassB);
      }
    } catch (error) {
      console.warn('Unable to persist studio passes to localStorage; retaining them in memory.', error);
    }

    set({ studioPassA, studioPassB });
  },
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
