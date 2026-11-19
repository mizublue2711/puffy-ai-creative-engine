import { useEffect, useRef, useState } from 'react';
import { ACTIVE_BRAND } from '../../config/brand.config';
import {
  compositeLogoOntoScene,
  DEFAULT_BADGE_TRANSFORM,
  detectOpaqueBounds,
  drawTransformedBadge,
  type BadgeTransform,
  type OpaqueBounds,
} from '../../services/compositeStudioShot.ts';
import { useBannerStore, type AspectRatio } from '../../store/useBannerStore';
import { useShowroomViewStore } from '../../store/useShowroomViewStore.ts';

const SIZES: Record<AspectRatio, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
};

const RATIO_LABELS: Array<{ id: AspectRatio; label: string }> = [
  { id: '1:1', label: '1:1 Square' },
  { id: '9:16', label: '9:16 Story' },
  { id: '16:9', label: '16:9 Desktop' },
];

const AI_SCENE_PRESETS = [
  {
    label: '🏙️ Manhattan Penthouse',
    prompt: 'Luxurious modern master bedroom in a high-floor Manhattan penthouse at golden hour sunset, floor-to-ceiling glass windows overlooking skyscrapers, warm ambient architectural lighting, high-end interior photography, 8k, photorealistic',
  },
  {
    label: '🌿 Japandi Morning',
    prompt: 'Serene Japandi master bedroom, light oak wood slatted walls, soft morning sunlight casting linear shadows, bonsai tree on a floating console, minimalist wabi-sabi aesthetic, photorealistic',
  },
  {
    label: '🌅 Santorini Sunset',
    prompt: 'Whitewashed luxury villa bedroom in Santorini at sunset, arched window with Mediterranean sea view, breezy linen curtains, warm peach evening light, luxury travel magazine aesthetic',
  },
  {
    label: '☁️ Floating Cloud',
    prompt: 'Dreamlike floating bedroom above soft clouds at dawn, ethereal pastel sunrise, weightless sheer curtains, sculptural bed, premium fantasy interior, cinematic photorealistic lighting',
  },
] as const;

const { palette, typography } = ACTIVE_BRAND;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createTrimmedLogoDataUrl(img: HTMLImageElement, bounds: OpaqueBounds): string | null {
  try {
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = bounds.sw;
    croppedCanvas.height = bounds.sh;
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) return null;

    croppedCtx.drawImage(
      img,
      bounds.sx,
      bounds.sy,
      bounds.sw,
      bounds.sh,
      0,
      0,
      bounds.sw,
      bounds.sh,
    );
    return croppedCanvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function BannerStudio() {
  const {
    backgroundImage: uploadedImage,
    aspectRatio,
    headline,
    subtext,
    selectedBadge,
    showLogo,
    setBackgroundImage,
    setAspectRatio,
    setHeadline,
    setSubtext,
    setSelectedBadge,
    setShowLogo,
  } = useBannerStore();
  const studioPassA = useShowroomViewStore((state) => state.studioPassA);
  const studioPassB = useShowroomViewStore((state) => state.studioPassB);
  const activeLogoUrl = studioPassB;
  const [trimmedPassBUrl, setTrimmedPassBUrl] = useState<string | null>(null);
  const previewLogoUrl = trimmedPassBUrl ?? activeLogoUrl;
  const hasMatchingStudioCapture = Boolean(
    studioPassA && studioPassB && uploadedImage === studioPassA,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [studioPrompt, setStudioPrompt] = useState('luxury master bedroom penthouse, soft sunrise lighting, photorealistic');
  const [isGeneratingShot, setIsGeneratingShot] = useState(false);
  const [generationStage, setGenerationStage] = useState<'idle' | 'generating_context' | 'compositing_logo'>('idle');
  const [compositeResult, setCompositeResult] = useState<string | null>(null);
  const [isCompositing, setIsCompositing] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const [badgeTransform, setBadgeTransform] = useState<BadgeTransform>(DEFAULT_BADGE_TRANSFORM);
  const [isFineTuneOpen, setIsFineTuneOpen] = useState(true);
  const [isBadgeComposited, setIsBadgeComposited] = useState(false);
  const [compositeBaseOverride, setCompositeBaseOverride] = useState<string | null>(null);
  const [loadedPassB, setLoadedPassB] = useState<{
    image: HTMLImageElement;
    bounds: OpaqueBounds | null;
  } | null>(null);
  const [loadedBgImage, setLoadedBgImage] = useState<HTMLImageElement | null>(null);
  const [loadedWatermarkImage, setLoadedWatermarkImage] = useState<HTMLImageElement | null>(null);

  const activeBaseSrc = compositeBaseOverride ?? uploadedImage ?? studioPassA;
  const isTransformModified =
    badgeTransform.offsetX !== 0 ||
    badgeTransform.offsetY !== 0 ||
    badgeTransform.scale !== 1 ||
    badgeTransform.rotation !== 0;

  const updateBadgeTransform = (updater: (prev: BadgeTransform) => BadgeTransform) => {
    setBadgeTransform((prev) => {
      const next = updater(prev);
      return {
        offsetX: clampNumber(next.offsetX, -200, 200),
        offsetY: clampNumber(next.offsetY, -200, 200),
        scale: Number(clampNumber(next.scale, 0.5, 2.0).toFixed(2)),
        rotation: Math.round(clampNumber(next.rotation, -30, 30)),
      };
    });
    if (activeLogoUrl && !isBadgeComposited) {
      setIsBadgeComposited(true);
    }
  };

  useEffect(() => {
    if (!studioPassB) {
      setLoadedPassB(null);
      setTrimmedPassBUrl(null);
      return;
    }

    let cancelled = false;
    void loadImage(studioPassB)
      .then((img) => {
        if (cancelled) return;
        const bounds = detectOpaqueBounds(img, 8, 6);
        setLoadedPassB({ image: img, bounds });
        setTrimmedPassBUrl(bounds ? createTrimmedLogoDataUrl(img, bounds) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedPassB(null);
          setTrimmedPassBUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [studioPassB]);

  useEffect(() => {
    if (!activeBaseSrc) {
      setLoadedBgImage(null);
      return;
    }

    let cancelled = false;
    void loadImage(activeBaseSrc)
      .then((img) => {
        if (!cancelled) setLoadedBgImage(img);
      })
      .catch(() => {
        if (!cancelled) setLoadedBgImage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeBaseSrc]);

  useEffect(() => {
    if (!previewLogoUrl) {
      setLoadedWatermarkImage(null);
      return;
    }

    let cancelled = false;
    void loadImage(previewLogoUrl)
      .then((img) => {
        if (!cancelled) setLoadedWatermarkImage(img);
      })
      .catch(() => {
        if (!cancelled) setLoadedWatermarkImage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [previewLogoUrl]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      document.fonts.load("700 64px 'PT Serif'"),
      document.fonts.load("400 32px 'Mukta'"),
      document.fonts.load("700 24px 'Mukta'"),
    ])
      .catch(() => undefined)
      .then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = SIZES[aspectRatio];

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const u = Math.min(w, h) / 1080; // scale unit

    // Background: cover-fit photo or warm linen placeholder
    ctx.fillStyle = palette.warmLinen;
    ctx.fillRect(0, 0, w, h);
    let bgDrawRect: { x: number; y: number; width: number; height: number } | null = null;
    if (loadedBgImage && loadedBgImage.width > 0 && loadedBgImage.height > 0) {
      const s = Math.max(w / loadedBgImage.width, h / loadedBgImage.height);
      const dw = loadedBgImage.width * s;
      const dh = loadedBgImage.height * s;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(loadedBgImage, dx, dy, dw, dh);
      bgDrawRect = { x: dx, y: dy, width: dw, height: dh };
    } else {
      ctx.fillStyle = palette.navyInk;
      ctx.font = `400 ${28 * u}px ${typography.body}`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5;
      ctx.fillText('Take a 3D snapshot or upload a photo', w / 2, h / 2);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // Live transformed 3D mattress badge composite (drawn before vignette & typography)
    if (isBadgeComposited && loadedPassB) {
      const targetRect = bgDrawRect ?? { x: 0, y: 0, width: w, height: h };
      const offsetScale = bgDrawRect ? Math.min(bgDrawRect.width, bgDrawRect.height) / 1080 : u;
      drawTransformedBadge(
        ctx,
        loadedPassB.image,
        targetRect,
        badgeTransform,
        loadedPassB.bounds,
        offsetScale,
      );
    }

    // Bottom vignette for text legibility
    const grad = ctx.createLinearGradient(0, h * 0.4, 0, h);
    grad.addColorStop(0, 'rgba(20,22,34,0)');
    grad.addColorStop(1, 'rgba(20,22,34,0.82)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.4, w, h * 0.6);

    const pad = 30 * u * 2; // 30px clear space (at 2x export density)
    const textW = w - pad * 2;

    // Logo watermark, top-left with clear space
    if (
      showLogo &&
      !isBadgeComposited &&
      loadedWatermarkImage &&
      loadedWatermarkImage.width > 0 &&
      loadedWatermarkImage.height > 0
    ) {
      const maxLogoWidth = Math.min(canvas.width * 0.14, 160);
      const aspect = loadedWatermarkImage.width / loadedWatermarkImage.height;
      const logoWidth = maxLogoWidth;
      const logoHeight = logoWidth / aspect;

      // Draw clean, elegant watermark
      ctx.drawImage(loadedWatermarkImage, 32, 32, logoWidth, logoHeight);
    }

    // Text block anchored to bottom
    const subSize = 34 * u;
    const headSize = (aspectRatio === '16:9' ? 76 : 84) * u;
    ctx.textBaseline = 'alphabetic';

    ctx.font = `400 ${subSize}px ${typography.body}`;
    const subLines = subtext ? wrapLines(ctx, subtext, textW) : [];
    ctx.font = `700 ${headSize}px ${typography.headline}`;
    const headLines = headline ? wrapLines(ctx, headline, textW) : [];

    let y = h - pad;
    ctx.fillStyle = palette.pureWhite;
    ctx.font = `400 ${subSize}px ${typography.body}`;
    for (let i = subLines.length - 1; i >= 0; i--) {
      ctx.fillText(subLines[i], pad, y);
      y -= subSize * 1.35;
    }
    y -= subSize * 0.5;
    ctx.font = `700 ${headSize}px ${typography.headline}`;
    for (let i = headLines.length - 1; i >= 0; i--) {
      ctx.fillText(headLines[i], pad, y);
      y -= headSize * 1.18;
    }

    // Pill badge above headline
    if (selectedBadge) {
      const bSize = 26 * u;
      ctx.font = `700 ${bSize}px ${typography.body}`;
      const padX = 28 * u;
      const bh = bSize * 2.2;
      const tw = ctx.measureText(selectedBadge.label).width + 2 * 0; // letterSpacing handled by uppercase label
      const bw = tw + padX * 2;
      const by = y - bh + headSize * 0.1;
      ctx.fillStyle = selectedBadge.bg;
      roundRect(ctx, pad, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = selectedBadge.text;
      ctx.textBaseline = 'middle';
      ctx.fillText(selectedBadge.label, pad + padX, by + bh / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }, [
    loadedBgImage,
    loadedPassB,
    loadedWatermarkImage,
    isBadgeComposited,
    badgeTransform,
    aspectRatio,
    headline,
    subtext,
    selectedBadge,
    showLogo,
    fontsReady,
  ]);

  const handleStudioGenerate = async () => {
    if (!studioPassA || !studioPassB) {
      setStudioError('Capture a two-pass studio scene before compositing the logo.');
      return;
    }

    setIsGeneratingShot(true);
    setGenerationStage('compositing_logo');
    setStudioError(null);
    try {
      const finalUrl = await compositeLogoOntoScene(
        studioPassA,
        studioPassB,
        2048,
        2048,
        badgeTransform,
      );
      setCompositeBaseOverride(studioPassA);
      setIsBadgeComposited(true);
      setCompositeResult(finalUrl);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : 'Failed to composite the studio capture.');
    } finally {
      setIsGeneratingShot(false);
      setGenerationStage('idle');
    }
  };

  const handleCompositeLogo = async () => {
    const currentBaseImage = uploadedImage || studioPassA;
    if (!currentBaseImage || !activeLogoUrl) {
      alert('Please capture a two-pass studio scene before compositing the logo.');
      return;
    }

    setIsCompositing(true);
    setStudioError(null);
    try {
      const baseImage = await loadImage(currentBaseImage);
      const finalImage = await compositeLogoOntoScene(
        currentBaseImage,
        activeLogoUrl,
        baseImage.naturalWidth,
        baseImage.naturalHeight,
        badgeTransform,
      );
      setCompositeBaseOverride(null);
      setIsBadgeComposited(true);
      setCompositeResult(finalImage);
    } catch (error) {
      console.error('Composite failed:', error);
      setStudioError(error instanceof Error ? error.message : 'Failed to composite the logo badge.');
    } finally {
      setIsCompositing(false);
    }
  };

  const exportBanner = (type: 'image/png' | 'image/webp') => {
    const sourceImage =
      (isBadgeComposited ? activeBaseSrc : null) || compositeResult || uploadedImage || studioPassA;
    if (sourceImage) {
      const exportImage = async () => {
        try {
          const baseImg = await loadImage(sourceImage);
          let imageToExport = baseImg;

          if (isBadgeComposited && activeLogoUrl && activeBaseSrc) {
            const finalDataUrl = await compositeLogoOntoScene(
              activeBaseSrc,
              activeLogoUrl,
              baseImg.naturalWidth,
              baseImg.naturalHeight,
              badgeTransform,
            );
            imageToExport = await loadImage(finalDataUrl);
          }

          const canvas = document.createElement('canvas');
          canvas.width = imageToExport.naturalWidth;
          canvas.height = imageToExport.naturalHeight;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Failed to create export canvas context.');
          context.drawImage(imageToExport, 0, 0);

          const outputBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => blob ? resolve(blob) : reject(new Error('Failed to encode studio image')),
              type,
              0.95,
            );
          });
          const url = URL.createObjectURL(outputBlob);
          const a = document.createElement('a');
          a.download = `puffy-studio-image-${imageToExport.naturalWidth}x${imageToExport.naturalHeight}-${Date.now()}.${type === 'image/png' ? 'png' : 'webp'}`;
          a.href = url;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (error) {
          setStudioError(error instanceof Error ? error.message : 'Failed to export the studio image.');
        }
      };
      void exportImage();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const { w, h } = SIZES[aspectRatio];
        a.download = `puffy-banner-${w}x${h}-${Date.now()}.${type === 'image/png' ? 'png' : 'webp'}`;
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      type,
      0.95
    );
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompositeResult(null);
      setCompositeBaseOverride(null);
      setIsBadgeComposited(false);
      setBadgeTransform(DEFAULT_BADGE_TRANSFORM);
      setStudioError(null);
      setBackgroundImage(URL.createObjectURL(file));
    }
  };

  const { w, h } = SIZES[aspectRatio];
  const label: React.CSSProperties = {
    display: 'block',
    fontFamily: typography.body,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.52)',
    marginBottom: 8,
  };
  const field: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: 10,
    borderRadius: 14,
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(0, 0, 0, 0.34)',
    fontSize: 13,
    color: '#fff',
    resize: 'vertical',
  };
  const pillBtn = (active: boolean, bg?: string, fg?: string): React.CSSProperties => ({
    padding: '2px 10px',
    minHeight: 26,
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: typography.body,
    fontWeight: 600,
    fontSize: 11,
    border: `1px solid ${active ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.12)'}`,
    background: bg ?? (active ? '#fff' : 'rgba(255, 255, 255, 0.06)'),
    color: fg ?? (active ? '#000' : 'rgba(255, 255, 255, 0.66)'),
    outline: 'none',
  });
  const dpadBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 9999,
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: activeLogoUrl ? 'pointer' : 'not-allowed',
    opacity: activeLogoUrl ? 1 : 0.35,
  };

  return (
    <section
      data-testid="banner-studio"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
        gap: 16,
        padding: 16,
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(80, 105, 130, 0.18), transparent 58%), #0b0d12',
        color: '#fff',
        overflow: 'auto',
      }}
    >
      <aside
        style={{
          background: 'rgba(18, 20, 26, 0.90)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: 24,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignSelf: 'start',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.28)',
        }}
      >
        <section
          aria-label="AI studio scene generation"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 14,
            borderRadius: 24,
            border: '1px solid rgba(129, 140, 248, 0.20)',
            background: 'linear-gradient(145deg, rgba(79, 70, 229, 0.16), rgba(18, 20, 26, 0.82))',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: '0 14px 38px rgba(0, 0, 0, 0.24)',
          }}
        >
          <span
            style={{
              fontFamily: typography.body,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(199, 210, 254, 0.82)',
            }}
          >
            ✨ AI Studio Scene Generation
          </span>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AI_SCENE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                style={{ ...pillBtn(studioPrompt === preset.prompt), padding: '4px 10px' }}
                onClick={(event) => {
                  event.stopPropagation();
                  setStudioPrompt(preset.prompt);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={studioPrompt}
            onChange={(event) => setStudioPrompt(event.target.value)}
            placeholder="Describe the desired AI bedroom scene (lighting, furniture, style)..."
            aria-label="AI studio scene prompt"
            style={{
              ...field,
              minHeight: 78,
              borderRadius: 18,
              resize: 'vertical',
              lineHeight: 1.55,
            }}
          />

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleStudioGenerate();
            }}
            disabled={isGeneratingShot || !studioPrompt.trim()}
            aria-busy={isGeneratingShot}
            style={{
              width: '100%',
              minHeight: 38,
              borderRadius: 999,
              border: '1px solid rgba(255, 255, 255, 0.24)',
              background: isGeneratingShot ? 'rgba(255, 255, 255, 0.16)' : '#fff',
              color: isGeneratingShot ? 'rgba(255, 255, 255, 0.62)' : '#111827',
              fontFamily: typography.body,
              fontSize: 12,
              fontWeight: 700,
              cursor: isGeneratingShot ? 'wait' : 'pointer',
              boxShadow: isGeneratingShot ? 'none' : '0 8px 24px rgba(255, 255, 255, 0.10)',
            }}
          >
            {isGeneratingShot
              ? generationStage === 'compositing_logo'
                ? '🪄 Compositing Logo'
                : '🚀 Generating...'
              : '🚀 Generate Studio Shot'}
          </button>
        </section>

        <div>
          <span style={label}>Aspect Ratio</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RATIO_LABELS.map((r) => (
              <button
                key={r.id}
                type="button"
                style={pillBtn(aspectRatio === r.id)}
                onClick={() => setAspectRatio(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <section
          aria-label="Typography and overlay controls"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: 14,
            borderRadius: 24,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(18, 20, 26, 0.72)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          }}
        >
          <span
            style={{
              ...label,
              marginBottom: 0,
              color: 'rgba(255, 255, 255, 0.68)',
            }}
          >
            Typography &amp; Overlay (Optional)
          </span>

          <div>
            <span style={label}>Badge</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ACTIVE_BRAND.badgePresets.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  style={pillBtn(selectedBadge?.label === b.label, b.bg, b.text)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedBadge({ label: b.label, bg: b.bg, text: b.text });
                  }}
                >
                  {b.label}
                </button>
              ))}
              <button
                type="button"
                style={pillBtn(selectedBadge === null)}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedBadge(null);
                }}
              >
                None
              </button>
            </div>
          </div>

          <div>
            <label style={label} htmlFor="banner-headline">Headline</label>
            <select
              aria-label="Headline presets"
              style={{ ...field, marginBottom: 8 }}
              value=""
              onChange={(e) => e.target.value && setHeadline(e.target.value)}
            >
              <option value="">Quick presets…</option>
              {ACTIVE_BRAND.headlinePresets.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <textarea
              id="banner-headline"
              rows={3}
              style={{ ...field, fontFamily: typography.headline, borderRadius: 18 }}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>

          <div>
            <label style={label} htmlFor="banner-subtext">Subtext</label>
            <textarea
              id="banner-subtext"
              rows={2}
              style={{ ...field, fontFamily: typography.body, borderRadius: 18 }}
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
            />
          </div>

          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
            <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
            Puffy Logo (30px clear space)
          </label>

          <div>
            <label style={label} htmlFor="banner-upload">Background photo</label>
            <input id="banner-upload" type="file" accept="image/*" onChange={onUpload} />
          </div>
          <button
            type="button"
            onClick={() => void handleCompositeLogo()}
            disabled={isCompositing || !activeLogoUrl}
            aria-busy={isCompositing}
            style={{
              width: '100%',
              minHeight: 38,
              borderRadius: 999,
              border: '1px solid rgba(255, 255, 255, 0.24)',
              background: isCompositing ? 'rgba(255, 255, 255, 0.16)' : '#fff',
              color: isCompositing ? 'rgba(255, 255, 255, 0.62)' : '#111827',
              fontFamily: typography.body,
              fontSize: 12,
              fontWeight: 700,
              cursor: isCompositing ? 'wait' : 'pointer',
              boxShadow: isCompositing ? 'none' : '0 8px 24px rgba(255, 255, 255, 0.10)',
            }}
          >
            {isCompositing ? 'Compositing logo...' : '✨ Composite Brand Logo'}
          </button>

          <div
            aria-label="Badge fine-tuning controls"
            style={{
              background: 'rgba(18, 20, 26, 0.82)',
              backdropFilter: 'blur(20px) saturate(160%)',
              WebkitBackdropFilter: 'blur(20px) saturate(160%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <button
                type="button"
                aria-expanded={isFineTuneOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFineTuneOpen((prev) => !prev);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 6px',
                  border: 'none',
                  borderRadius: 9999,
                  background: 'transparent',
                  color: 'rgba(255, 255, 255, 0.78)',
                  cursor: 'pointer',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="2" y1="14" x2="6" y2="14" />
                  <line x1="10" y1="8" x2="14" y2="8" />
                  <line x1="18" y1="16" x2="22" y2="16" />
                </svg>
                <span
                  style={{
                    fontFamily: typography.body,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  BADGE FINE-TUNING
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    transform: isFineTuneOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <button
                type="button"
                disabled={!activeLogoUrl}
                onClick={(e) => {
                  e.stopPropagation();
                  setBadgeTransform(DEFAULT_BADGE_TRANSFORM);
                }}
                style={{
                  height: 26,
                  padding: '2px 10px',
                  borderRadius: 9999,
                  border: `1px solid ${isTransformModified ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.14)'}`,
                  background: isTransformModified ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
                  color: isTransformModified ? '#000000' : 'rgba(255, 255, 255, 0.72)',
                  fontFamily: typography.body,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: activeLogoUrl ? 'pointer' : 'not-allowed',
                  opacity: activeLogoUrl ? 1 : 0.4,
                }}
              >
                Reset
              </button>
            </div>

            {isFineTuneOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: typography.body,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'rgba(255, 255, 255, 0.48)',
                    }}
                  >
                    ADJUST BADGE ON MATTRESS
                  </span>
                  <span
                    style={{
                      fontFamily: typography.body,
                      fontSize: 10,
                      color: 'rgba(255, 255, 255, 0.55)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    X {badgeTransform.offsetX}px · Y {badgeTransform.offsetY}px
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.40)',
                    border: '1px solid rgba(255, 255, 255, 0.10)',
                    borderRadius: 24,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    aria-label="Nudge badge left"
                    disabled={!activeLogoUrl}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateBadgeTransform((prev) => ({ ...prev, offsetX: prev.offsetX - 5 }));
                    }}
                    style={dpadBtnStyle}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      type="button"
                      aria-label="Nudge badge up"
                      disabled={!activeLogoUrl}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateBadgeTransform((prev) => ({ ...prev, offsetY: prev.offsetY - 5 }));
                      }}
                      style={dpadBtnStyle}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Nudge badge down"
                      disabled={!activeLogoUrl}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateBadgeTransform((prev) => ({ ...prev, offsetY: prev.offsetY + 5 }));
                      }}
                      style={dpadBtnStyle}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="Nudge badge right"
                    disabled={!activeLogoUrl}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateBadgeTransform((prev) => ({ ...prev, offsetX: prev.offsetX + 5 }));
                    }}
                    style={dpadBtnStyle}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.body,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      SCALE
                    </span>
                    <span
                      style={{
                        fontFamily: typography.body,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Math.round(badgeTransform.scale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Badge scale"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={badgeTransform.scale}
                    disabled={!activeLogoUrl}
                    onChange={(e) => {
                      const scale = parseFloat(e.target.value);
                      updateBadgeTransform((prev) => ({ ...prev, scale }));
                    }}
                    style={{
                      width: '100%',
                      accentColor: '#38BDF8',
                      height: 4,
                      cursor: activeLogoUrl ? 'pointer' : 'not-allowed',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.body,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      ANGLE
                    </span>
                    <span
                      style={{
                        fontFamily: typography.body,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {badgeTransform.rotation}°
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Badge rotation angle"
                    min={-30}
                    max={30}
                    step={1}
                    value={badgeTransform.rotation}
                    disabled={!activeLogoUrl}
                    onChange={(e) => {
                      const rotation = parseInt(e.target.value, 10);
                      updateBadgeTransform((prev) => ({ ...prev, rotation }));
                    }}
                    style={{
                      width: '100%',
                      accentColor: '#38BDF8',
                      height: 4,
                      cursor: activeLogoUrl ? 'pointer' : 'not-allowed',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <section
          aria-label="Mattress logo badge Pass B"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.10)',
            background: 'rgba(0, 0, 0, 0.40)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span
              style={{
                color: '#38BDF8',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              🏷️ ISOLATED LOGO (PASS B)
            </span>
            <span
              style={{
                flexShrink: 0,
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid rgba(16, 185, 129, 0.30)',
                background: 'rgba(16, 185, 129, 0.20)',
                color: '#6EE7B7',
                fontSize: 10,
              }}
            >
              ✓ Ready
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: 112,
              overflow: 'hidden',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.05)',
              backgroundColor: 'rgba(15, 23, 42, 0.80)',
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px)',
              backgroundSize: '12px 12px',
            }}
          >
            <img
              src={previewLogoUrl ?? undefined}
              alt="Isolated brand logo badge, Pass B"
              className="w-full h-full object-contain filter drop-shadow-md"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55))',
              }}
            />
          </div>

          <button
            type="button"
            disabled={!activeLogoUrl}
            onClick={() => {
              if (!activeLogoUrl) return;
              const link = document.createElement('a');
              link.href = activeLogoUrl;
              link.download = 'Puffy_Brand_Badge.png';
              link.click();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 30,
              padding: '4px 12px',
              borderRadius: 10,
              border: '1px solid rgba(14, 165, 233, 0.30)',
              background: 'rgba(14, 165, 233, 0.10)',
              color: '#7DD3FC',
              fontFamily: typography.body,
              fontSize: 11,
              fontWeight: 600,
              cursor: activeLogoUrl ? 'pointer' : 'not-allowed',
              opacity: activeLogoUrl ? 1 : 0.3,
              transition: 'background 0.2s ease',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Logo PNG (Transparent)
          </button>
        </section>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            padding: 14,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 24,
            background: 'rgba(18, 20, 26, 0.72)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: '0 18px 54px rgba(0, 0, 0, 0.30)',
          }}
        >
          <canvas
            ref={canvasRef}
            width={w}
            height={h}
            aria-label="Banner live preview"
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 220px)',
              width: 'auto',
              height: 'auto',
              aspectRatio: `${w} / ${h}`,
              borderRadius: 18,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.32)',
              transition: 'aspect-ratio 0.25s ease',
              background: 'rgba(0, 0, 0, 0.35)',
            }}
          />
        </div>
        <p
          style={{
            width: '100%',
            maxWidth: 760,
            margin: 0,
            color: 'rgba(255, 255, 255, 0.48)',
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          {hasMatchingStudioCapture
            ? 'Two-pass capture ready. This action composites the logo matte locally; AI scene generation is not connected yet.'
            : 'Capture a two-pass scene from the 3D showroom to enable local logo compositing.'}
        </p>
        {studioError && (
          <p role="alert" style={{ width: '100%', maxWidth: 760, margin: 0, color: '#ffb4ab', fontSize: 12 }}>
            {studioError}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => exportBanner('image/png')}
            style={{ ...pillBtn(true), padding: '0 16px', background: '#fff', color: '#000' }}
          >
            Export PNG
          </button>
          <button type="button" onClick={() => exportBanner('image/webp')} style={{ ...pillBtn(false), padding: '0 16px' }}>
            Export WebP
          </button>
        </div>
      </div>
    </section>
  );
}

export default BannerStudio;
