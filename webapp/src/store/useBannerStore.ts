import { create } from 'zustand';
import { ACTIVE_BRAND } from '../config/brand.config';

export type AspectRatio = '1:1' | '9:16' | '16:9';
export interface SelectedBadge {
  label: string;
  bg: string;
  text: string;
}

interface BannerState {
  backgroundImage: string | null;
  aspectRatio: AspectRatio;
  headline: string;
  subtext: string;
  selectedBadge: SelectedBadge | null;
  showLogo: boolean;

  setBackgroundImage: (url: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setHeadline: (text: string) => void;
  setSubtext: (text: string) => void;
  setSelectedBadge: (badge: SelectedBadge | null) => void;
  setShowLogo: (show: boolean) => void;
}

export const useBannerStore = create<BannerState>((set) => ({
  backgroundImage: null, // Populated via 3D snapshot or file upload
  aspectRatio: '1:1',
  headline: ACTIVE_BRAND.headlinePresets[0],
  subtext: 'Designed in California · Handcrafted for Deep Restoration',
  selectedBadge: ACTIVE_BRAND.badgePresets[0],
  showLogo: true,

  setBackgroundImage: (url) => set({ backgroundImage: url }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setHeadline: (headline) => set({ headline }),
  setSubtext: (subtext) => set({ subtext }),
  setSelectedBadge: (selectedBadge) => set({ selectedBadge }),
  setShowLogo: (showLogo) => set({ showLogo }),
}));
