export interface StudioContextPreset {
  id: string;
  label: string;
  prompt: string;
  negativePrompt?: string;
}

export interface StudioPromptInputProps {
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
  progressStage?: 'capturing_3d' | 'generating_context' | 'compositing_logo' | 'idle';
  presets?: StudioContextPreset[];
}

export const DEFAULT_STUDIO_PRESETS: StudioContextPreset[] = [
  {
    id: 'penthouse_sunset',
    label: 'Manhattan Penthouse',
    prompt:
      'Luxurious modern master bedroom in a high-floor Manhattan penthouse at golden hour sunset, floor-to-ceiling glass windows overlooking skyscrapers, warm ambient architectural lighting, high-end interior photography, 8k, photorealistic',
  },
  {
    id: 'japandi_zen',
    label: 'Japandi Sanctuary',
    prompt:
      'Serene Japandi style bedroom, light oak wood slatted walls, soft morning sunlight casting linear shadows, bonsai tree on floating console, minimalist aesthetic, wabi-sabi vibe, photorealistic',
  },
  {
    id: 'santorini_villa',
    label: 'Santorini Coast',
    prompt:
      'Whitewashed luxury villa bedroom in Santorini Greece, arched window with Mediterranean sea view, breezy linen curtains, gentle sea breeze light, luxury travel magazine aesthetic',
  },
];
