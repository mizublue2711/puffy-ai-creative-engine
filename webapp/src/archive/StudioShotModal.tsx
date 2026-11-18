/** @archived Retained for future modal inspector features. Original author: Copilot & Cline */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { compositeLogoOntoScene } from '../services/compositeStudioShot.ts';
import { DEFAULT_STUDIO_PRESETS } from '../types/studioPrompt.types.ts';
import { StudioPromptInput } from '../components/canvas/bedroom/components/StudioPromptInput.tsx';

interface StudioShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  passADataUrl: string | null;
  passBDataUrl: string | null;
  currentViewportResolution: { width: number; height: number };
  initialResolution: { width: number; height: number };
  onCaptureAtResolution: (resolution: { width: number; height: number }) => Promise<{
    passA: string;
    passB: string;
  }>;
}

type ResolutionPresetId = 'viewport' | 'square' | 'banner' | 'story' | 'custom';

const resolutionPresets: { id: Exclude<ResolutionPresetId, 'viewport' | 'custom'>; label: string; width: number; height: number }[] = [
  { id: 'square', label: '1:1 Square (2048×2048)', width: 2048, height: 2048 },
  { id: 'banner', label: '16:9 Banner (2560×1440)', width: 2560, height: 1440 },
  { id: 'story', label: '9:16 Story (1080×1920)', width: 1080, height: 1920 },
];

const getResolutionPreset = (
  resolution: { width: number; height: number },
  viewport: { width: number; height: number },
): ResolutionPresetId => {
  const preset = resolutionPresets.find(
    (option) => option.width === resolution.width && option.height === resolution.height,
  );
  if (preset) return preset.id;
  if (resolution.width === viewport.width && resolution.height === viewport.height) return 'viewport';
  return 'custom';
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  backgroundColor: 'rgba(0, 0, 0, 0.72)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  pointerEvents: 'auto',
};

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  width: '100%',
  maxWidth: 920,
  maxHeight: 'calc(100vh - 32px)',
  overflowY: 'auto',
  padding: 20,
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 24,
  backgroundColor: 'rgba(18, 20, 26, 0.90)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  boxShadow: '0 24px 72px rgba(0, 0, 0, 0.52)',
  color: '#fff',
  fontFamily: 'Inter, "SF Pro Display", system-ui, sans-serif',
};

const pillButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 32,
  padding: '0 14px',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 9999,
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.82)',
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const resolutionTrackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  overflowX: 'auto',
  scrollbarWidth: 'none',
};

const resolutionInputStyle: React.CSSProperties = {
  width: 62,
  height: 26,
  padding: '0 8px',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 9999,
  outline: 'none',
  backgroundColor: 'rgba(0, 0, 0, 0.40)',
  color: '#fff',
  fontSize: 11,
};

export const StudioShotModal: React.FC<StudioShotModalProps> = ({
  isOpen,
  onClose,
  passADataUrl,
  passBDataUrl,
  currentViewportResolution,
  initialResolution,
  onCaptureAtResolution,
}) => {
  const [prompt, setPrompt] = useState(DEFAULT_STUDIO_PRESETS[0].prompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compositeResult, setCompositeResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<ResolutionPresetId>(() =>
    getResolutionPreset(initialResolution, currentViewportResolution),
  );
  const [customWidth, setCustomWidth] = useState(String(initialResolution.width));
  const [customHeight, setCustomHeight] = useState(String(initialResolution.height));
  const [progressStage, setProgressStage] = useState<'capturing_3d' | 'compositing_logo' | 'idle'>('idle');
  const wasOpen = useRef(false);

  useEffect(() => {
    setCompositeResult(null);
    setErrorMessage(null);
  }, [passADataUrl, passBDataUrl]);

  useEffect(() => {
    const justOpened = isOpen && !wasOpen.current;
    wasOpen.current = isOpen;
    if (justOpened) {
      setSelectedResolution(getResolutionPreset(initialResolution, currentViewportResolution));
      setCustomWidth(String(initialResolution.width));
      setCustomHeight(String(initialResolution.height));
    }
  }, [
    isOpen,
    initialResolution.width,
    initialResolution.height,
    currentViewportResolution.width,
    currentViewportResolution.height,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !passADataUrl || !passBDataUrl) return null;

  const selectedWidth =
    selectedResolution === 'viewport'
      ? currentViewportResolution.width
      : selectedResolution === 'custom'
        ? Number(customWidth)
        : resolutionPresets.find((preset) => preset.id === selectedResolution)?.width ?? 2048;
  const selectedHeight =
    selectedResolution === 'viewport'
      ? currentViewportResolution.height
      : selectedResolution === 'custom'
        ? Number(customHeight)
        : resolutionPresets.find((preset) => preset.id === selectedResolution)?.height ?? 2048;

  const handleGenerate = async () => {
    if (
      !Number.isSafeInteger(selectedWidth) ||
      !Number.isSafeInteger(selectedHeight) ||
      selectedWidth < 1 ||
      selectedHeight < 1
    ) {
      setErrorMessage('Enter positive whole-number width and height values.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setCompositeResult(null);

    try {
      setProgressStage('capturing_3d');
      const { passA, passB } = await onCaptureAtResolution({
        width: selectedWidth,
        height: selectedHeight,
      });
      setProgressStage('compositing_logo');
      const finalImage = await compositeLogoOntoScene(passA, passB, selectedWidth, selectedHeight);
      setCompositeResult(finalImage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to composite the studio shot.');
    } finally {
      setIsGenerating(false);
      setProgressStage('idle');
    }
  };

  const handleDownload = () => {
    if (!compositeResult) return;

    const link = document.createElement('a');
    link.download = `puffy_studio_shot_${Date.now()}.png`;
    link.href = compositeResult;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return createPortal(
    <div
      style={overlayStyle}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-shot-modal-title"
        style={panelStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            width: '100%',
            paddingBottom: 12,
            borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
          }}
        >
          <div>
            <div
              style={{
                marginBottom: 4,
                color: 'rgba(255, 255, 255, 0.48)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Studio shot
            </div>
            <h2 id="studio-shot-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              Two-pass scene composer
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close studio shot" style={pillButtonStyle}>
            Close
          </button>
        </header>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            color: 'rgba(255, 255, 255, 0.58)',
            fontSize: 11,
          }}
        >
          <span>Pass A · Room render</span>
          <span aria-hidden="true">/</span>
          <span>Pass B · Logo matte</span>
          <span style={{ marginLeft: 'auto' }}>
            Target: {selectedWidth || '—'} × {selectedHeight || '—'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 180,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 18,
            backgroundColor: 'rgba(0, 0, 0, 0.42)',
          }}
        >
          <img
            src={compositeResult ?? passADataUrl}
            alt={compositeResult ? 'Final high-resolution studio composite' : 'Pass A room capture preview'}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '48vh', objectFit: 'contain' }}
          />
        </div>

        <div style={{ width: '100%' }} role="group" aria-label="Output resolution">
          <div
            style={{
              marginBottom: 6,
              color: 'rgba(255, 255, 255, 0.48)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Resolution
          </div>
          <div style={resolutionTrackStyle}>
            {[
              { id: 'viewport' as const, label: 'Current Viewport' },
              ...resolutionPresets,
              { id: 'custom' as const, label: 'Custom' },
            ].map((preset) => {
              const isSelected = selectedResolution === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isGenerating}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedResolution(preset.id);
                    setErrorMessage(null);
                  }}
                  title={
                    preset.id === 'viewport'
                      ? `${currentViewportResolution.width} × ${currentViewportResolution.height}`
                      : preset.id === 'custom'
                        ? 'Enter custom output dimensions'
                        : `${preset.width} × ${preset.height}`
                  }
                  style={{
                    ...pillButtonStyle,
                    minHeight: 28,
                    padding: '0 11px',
                    borderColor: isSelected ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.12)',
                    backgroundColor: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected ? '#000' : 'rgba(255, 255, 255, 0.72)',
                    fontSize: 10,
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
            {selectedResolution === 'custom' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  W:
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={customWidth}
                    disabled={isGenerating}
                    onChange={(event) => setCustomWidth(event.target.value)}
                    aria-label="Custom output width"
                    style={resolutionInputStyle}
                  />
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  H:
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={customHeight}
                    disabled={isGenerating}
                    onChange={(event) => setCustomHeight(event.target.value)}
                    aria-label="Custom output height"
                    style={resolutionInputStyle}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div style={{ width: '100%' }}>
          <StudioPromptInput
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            progressStage={progressStage}
          />
          <p
            style={{
              margin: '8px 4px 0',
              color: 'rgba(255, 255, 255, 0.48)',
              fontSize: 10,
              lineHeight: 1.5,
            }}
          >
            This preview composites Pass B over Pass A locally. AI scene generation is not connected yet.
          </p>
        </div>

        {errorMessage && (
          <p role="alert" style={{ width: '100%', margin: 0, color: '#ffb4ab', fontSize: 12 }}>
            Compositing failed: {errorMessage}
          </p>
        )}

        <footer
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            width: '100%',
            paddingTop: 12,
            borderTop: '1px solid rgba(255, 255, 255, 0.10)',
          }}
        >
          <button type="button" onClick={onClose} style={pillButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!compositeResult || isGenerating}
            style={{
              ...pillButtonStyle,
              borderColor: 'transparent',
              backgroundColor: compositeResult ? '#fff' : 'rgba(255, 255, 255, 0.16)',
              color: compositeResult ? '#000' : 'rgba(255, 255, 255, 0.48)',
              cursor: compositeResult ? 'pointer' : 'not-allowed',
            }}
          >
            Download composite
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
