import { useEffect, useRef, useState } from 'react';
import { ACTIVE_BRAND } from '../../config/brand.config';
import { useBannerStore, type AspectRatio } from '../../store/useBannerStore';

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

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

    (async () => {
      const [bg, logo] = await Promise.all([
        backgroundImage ? loadImage(backgroundImage).catch(() => null) : Promise.resolve(null),
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
  }, [backgroundImage, aspectRatio, headline, subtext, selectedBadge, showLogo, fontsReady]);

  const exportBanner = (type: 'image/png' | 'image/webp') => {
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
    if (file) setBackgroundImage(URL.createObjectURL(file));
  };

  const { w, h } = SIZES[aspectRatio];
  const label: React.CSSProperties = {
    display: 'block',
    fontFamily: typography.body,
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: palette.navyInk,
    marginBottom: 8,
  };
  const field: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${palette.warmLinen}`,
    fontSize: 16,
    color: palette.onyxBlack,
    resize: 'vertical',
  };
  const pillBtn = (active: boolean, bg?: string, fg?: string): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: typography.body,
    fontWeight: 600,
    fontSize: 13,
    border: active ? `2px solid ${palette.oceanTeal}` : `1px solid ${palette.warmLinen}`,
    background: bg ?? (active ? palette.navyInk : palette.pureWhite),
    color: fg ?? (active ? palette.pureWhite : palette.navyInk),
    outline: active ? `2px solid ${palette.pureWhite}` : 'none',
  });

  return (
    <section
      data-testid="banner-studio"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 380px) 1fr',
        gap: 24,
        padding: 24,
        height: '100%',
        boxSizing: 'border-box',
        background: palette.warmLinen,
        overflow: 'auto',
      }}
    >
      <aside
        style={{
          background: palette.pureWhite,
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          alignSelf: 'start',
        }}
      >
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

        <div>
          <span style={label}>Badge</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACTIVE_BRAND.badgePresets.map((b) => (
              <button
                key={b.id}
                type="button"
                style={pillBtn(selectedBadge?.label === b.label, b.bg, b.text)}
                onClick={() => setSelectedBadge({ label: b.label, bg: b.bg, text: b.text })}
              >
                {b.label}
              </button>
            ))}
            <button type="button" style={pillBtn(selectedBadge === null)} onClick={() => setSelectedBadge(null)}>
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
            style={{ ...field, fontFamily: typography.headline }}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>

        <div>
          <label style={label} htmlFor="banner-subtext">Subtext</label>
          <textarea
            id="banner-subtext"
            rows={2}
            style={{ ...field, fontFamily: typography.body }}
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
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
              aspectRatio: `${w} / ${h}`,
              borderRadius: 12,
              boxShadow: '0 12px 40px rgba(43,47,68,0.25)',
              transition: 'aspect-ratio 0.25s ease',
              background: palette.warmLinen,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => exportBanner('image/png')}
            style={{ ...pillBtn(true), padding: '12px 22px', fontSize: 15, background: palette.oceanTeal, color: palette.pureWhite }}
          >
            💾 Xuất Banner Sắc Nét (.png)
          </button>
          <button type="button" onClick={() => exportBanner('image/webp')} style={{ ...pillBtn(false), padding: '12px 22px', fontSize: 15 }}>
            .webp
          </button>
        </div>
      </div>
    </section>
  );
}

export default BannerStudio;
