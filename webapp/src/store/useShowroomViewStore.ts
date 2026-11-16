import { create } from 'zustand';
import type { ShowroomTab } from '../components/showroom/ShowroomHeader';

export type ShowroomView = ShowroomTab;

interface ShowroomViewState {
  activeView: ShowroomTab;
  setActiveView: (view: ShowroomTab) => void;
}

export const useShowroomViewStore = create<ShowroomViewState>((set) => ({
  activeView: 'interactive',
  setActiveView: (activeView) => set({ activeView }),
}));
