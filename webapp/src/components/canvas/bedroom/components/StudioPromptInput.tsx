import React from 'react';
import type { StudioPromptInputProps } from '../../../../types/studioPrompt.types.ts';
import { DEFAULT_STUDIO_PRESETS } from '../../../../types/studioPrompt.types.ts';

const capsuleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  maxWidth: 760,
  minHeight: 44,
  padding: 6,
  overflow: 'hidden',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 9999,
  backgroundColor: 'rgba(18, 20, 26, 0.82)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
  color: '#fff',
  fontFamily: 'Inter, "SF Pro Display", system-ui, sans-serif',
};

const presetTrackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: '0 1 auto',
  minWidth: 0,
  overflowX: 'auto',
  scrollbarWidth: 'none',
};

const inputStyle: React.CSSProperties = {
  flex: '1 1 180px',
  minWidth: 100,
  height: 30,
  padding: '0 10px',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: 9999,
  outline: 'none',
  backgroundColor: 'rgba(0, 0, 0, 0.40)',
  color: '#fff',
  fontSize: 11,
};

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  minHeight: 26,
  padding: '2px 10px',
  border: 'none',
  borderRadius: 9999,
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const progressLabels = {
  capturing_3d: 'Capturing 3D',
  generating_context: 'Generating',
  compositing_logo: 'Compositing',
  idle: 'Generate Shot',
} as const;

export const StudioPromptInput: React.FC<StudioPromptInputProps> = ({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  progressStage = 'idle',
  presets = DEFAULT_STUDIO_PRESETS,
}) => (
  <div style={capsuleStyle} role="group" aria-label="AI studio shot controls">
    <div style={presetTrackStyle} role="group" aria-label="Prompt presets">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPromptChange(preset.prompt);
          }}
          title={preset.prompt}
          style={{
            ...buttonStyle,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.78)',
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
    <input
      type="text"
      value={prompt}
      onChange={(event) => onPromptChange(event.target.value)}
      placeholder="Describe the room..."
      aria-label="Describe the room context"
      disabled={isGenerating}
      style={inputStyle}
    />
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        return onGenerate();
      }}
      disabled={isGenerating || !prompt.trim()}
      aria-busy={isGenerating}
      style={{
        ...buttonStyle,
        minHeight: 30,
        padding: '0 14px',
        fontWeight: 600,
        backgroundColor: isGenerating ? 'rgba(255, 255, 255, 0.20)' : '#fff',
        color: isGenerating ? 'rgba(255, 255, 255, 0.50)' : '#000',
        cursor: isGenerating || !prompt.trim() ? 'not-allowed' : 'pointer',
      }}
    >
      {isGenerating ? `${progressLabels[progressStage]}...` : 'Generate Shot'}
    </button>
  </div>
);
