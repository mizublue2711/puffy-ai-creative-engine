import { useEffect, useRef, useState } from 'react';
import { ACTIVE_BRAND } from '../../config/brand.config';
import { compositeLogoOntoScene } from '../../services/compositeStudioShot.ts';
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
    backgroundImage,
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
  const hasMatchingStudioCapture = Boolean(
    studioPassA && studioPassB && backgroundImage === studioPassA,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [studioPrompt, setStudioPrompt] = useState('luxury master bedroom penthouse, soft sunrise lighting, photorealistic');
  const [isGeneratingShot, setIsGeneratingShot] = useState(false);
  const [generationStage, setGenerationStage] = useState<'idle' | 'generating_context' | 'compositing_logo'>('idle');
  const [compositeResult, setCompositeResult] = useState<string | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);

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
    let cancelled = false;
    const { w, h } = SIZES[aspectRatio];
    const activeBackground = compositeResult ?? backgroundImage;

    (async () => {
      const [bg, logo] = await Promise.all([
        activeBackground ? loadImage(activeBackground).catch(() => null) : Promise.resolve(null),
        showLogo ? loadImage(ACTIVE_BRAND.logoUrl).catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const u = Math.min(w, h) / 1080; // scale unit

      // Background: cover-fit photo or warm linen placeholder
      ctx.fillStyle = palette.warmLinen;
      ctx.fillRect(0, 0, w, h);
      if (bg) {
        const s = Math.max(w / bg.width, h / bg.height);
        const dw = bg.width * s;
        const dh = bg.height * s;
        ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = palette.navyInk;
        ctx.font = `400 ${28 * u}px ${typography.body}`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.5;
        ctx.fillText('Take a 3D snapshot or upload a photo', w / 2, h / 2);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
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
      if (logo) {
        const lw = 190 * u;
        const lh = (logo.height / logo.width) * lw;
        ctx.drawImage(logo, pad, pad, lw, lh);
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
    })();

    return () => {
      cancelled = true;
    };
  }, [backgroundImage, compositeResult, aspectRatio, headline, subtext, selectedBadge, showLogo, fontsReady]);

  const handleStudioGenerate = async () => {
    if (!studioPassA || !studioPassB) {
      setStudioError('Capture a two-pass studio scene before compositing the logo matte.');
      return;
    }

    setIsGeneratingShot(true);
    setGenerationStage('compositing_logo');
    setStudioError(null);
    try {
      const finalUrl = await compositeLogoOntoScene(studioPassA, studioPassB);
      setCompositeResult(finalUrl);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : 'Failed to composite the studio capture.');
    } finally {
      setIsGeneratingShot(false);
      setGenerationStage('idle');
    }
  };

  const exportBanner = (type: 'image/png' | 'image/webp') => {
    if (compositeResult) {
      const exportComposite = async () => {
        try {
          const response = await fetch(compositeResult);
          const sourceBlob = await response.blob();
          const sourceUrl = URL.createObjectURL(sourceBlob);
          const image = await loadImage(sourceUrl);
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d')?.drawImage(image, 0, 0);
          URL.revokeObjectURL(sourceUrl);

          const outputBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => blob ? resolve(blob) : reject(new Error('Failed to encode studio composite')),
              type,
              0.95,
            );
          });
          const url = URL.createObjectURL(outputBlob);
          const a = document.createElement('a');
          a.download = `puffy-studio-composite-${image.naturalWidth}x${image.naturalHeight}-${Date.now()}.${type === 'image/png' ? 'png' : 'webp'}`;
          a.href = url;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (error) {
          setStudioError(error instanceof Error ? error.message : 'Failed to export the studio composite.');
        }
      };
      void exportComposite();
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
            placeholder="Mô tả bối cảnh phòng ngủ AI mong muốn (ánh sáng, nội thất, phong cách)..."
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
          {studioPassA ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%' }}>
              <img
                src={compositeResult || studioPassA}
                alt="Captured studio scene preview"
                style={{
                  objectFit: 'contain',
                  maxWidth: '100%',
                  maxHeight: 'calc(100vh - 220px)',
                  width: 'auto',
                  height: 'auto',
                  borderRadius: 18,
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.32)',
                }}
              />
              {compositeResult && (
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    bottom: 12,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(18, 20, 26, 0.82)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  ✓ LOGO MATTE COMPOSITED
                </span>
              )}
            </div>
          ) : (
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
          )}
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
