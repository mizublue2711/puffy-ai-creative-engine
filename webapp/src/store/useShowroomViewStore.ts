import { create } from 'zustand';

export type ShowroomView = '3d' | '2d' | 'studio';

interface ShowroomViewState {
  activeView: ShowroomView;
  setActiveView: (view: ShowroomView) => void;
}

export const useShowroomViewStore = create<ShowroomViewState>((set) => ({
  activeView: '3d',
  setActiveView: (activeView) => set({ activeView }),
}));
