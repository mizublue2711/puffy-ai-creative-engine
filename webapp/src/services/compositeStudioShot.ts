export interface BadgeTransform {
  offsetX: number; // px in 1080-base reference space, default: 0 (range: -200 to 200)
  offsetY: number; // px in 1080-base reference space, default: 0 (range: -200 to 200)
  scale: number; // scale multiplier, default: 1.0 (range: 0.5 to 2.0, step 0.05)
  rotation: number; // angle in degrees, default: 0 (range: -30 to 30, step 1)
}

export interface OpaqueBounds {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  imgWidth: number;
  imgHeight: number;
}

export const DEFAULT_BADGE_TRANSFORM: BadgeTransform = {
  offsetX: 0,
  offsetY: 0,
  scale: 1.0,
  rotation: 0,
};

/**
 * Detects the tight non-transparent bounding box of a Pass B badge image so
 * live scale and rotation pivot cleanly around the badge's visual center.
 */
export function detectOpaqueBounds(
  img: HTMLImageElement,
  alphaThreshold = 8,
  padding = 4,
): OpaqueBounds | null {
  const imgWidth = img.naturalWidth || img.width;
  const imgHeight = img.naturalHeight || img.height;
  if (!imgWidth || !imgHeight) return null;

  const fullBounds: OpaqueBounds = {
    sx: 0,
    sy: 0,
    sw: imgWidth,
    sh: imgHeight,
    imgWidth,
    imgHeight,
  };

  try {
    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fullBounds;

    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, imgWidth, imgHeight);

    let minX = imgWidth;
    let minY = imgHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < imgHeight; y++) {
      const rowOffset = y * imgWidth * 4;
      for (let x = 0; x < imgWidth; x++) {
        if (data[rowOffset + x * 4 + 3] > alphaThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return fullBounds;

    const sx = Math.max(0, minX - padding);
    const sy = Math.max(0, minY - padding);
    const ex = Math.min(imgWidth - 1, maxX + padding);
    const ey = Math.min(imgHeight - 1, maxY + padding);

    return {
      sx,
      sy,
      sw: ex - sx + 1,
      sh: ey - sy + 1,
      imgWidth,
      imgHeight,
    };
  } catch {
    return fullBounds;
  }
}

/**
 * Renders the isolated Pass B badge onto `targetRect` with live offset, scale,
 * and rotation centered on the badge's opaque bounding box.
 */
export function drawTransformedBadge(
  ctx: CanvasRenderingContext2D,
  badgeImage: HTMLImageElement,
  targetRect: { x: number; y: number; width: number; height: number },
  transform: BadgeTransform = DEFAULT_BADGE_TRANSFORM,
  bounds?: OpaqueBounds | null,
  offsetScale = 1,
): void {
  const imgW = badgeImage.naturalWidth || badgeImage.width;
  const imgH = badgeImage.naturalHeight || badgeImage.height;
  if (!imgW || !imgH) return;

  const resolvedBounds: OpaqueBounds = bounds ?? {
    sx: 0,
    sy: 0,
    sw: imgW,
    sh: imgH,
    imgWidth: imgW,
    imgHeight: imgH,
  };

  const fitScale = Math.min(targetRect.width / imgW, targetRect.height / imgH);
  const frameWidth = imgW * fitScale;
  const frameHeight = imgH * fitScale;
  const frameX = targetRect.x + (targetRect.width - frameWidth) / 2;
  const frameY = targetRect.y + (targetRect.height - frameHeight) / 2;

  const baseBadgeWidth = (resolvedBounds.sw / imgW) * frameWidth;
  const baseBadgeHeight = (resolvedBounds.sh / imgH) * frameHeight;
  const baseBadgeX =
    frameX + ((resolvedBounds.sx + resolvedBounds.sw / 2) / imgW) * frameWidth;
  const baseBadgeY =
    frameY + ((resolvedBounds.sy + resolvedBounds.sh / 2) / imgH) * frameHeight;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  const centerX = baseBadgeX + transform.offsetX * offsetScale;
  const centerY = baseBadgeY + transform.offsetY * offsetScale;

  ctx.translate(centerX, centerY);

  if (transform.rotation !== 0) {
    ctx.rotate((transform.rotation * Math.PI) / 180);
  }

  const finalWidth = baseBadgeWidth * transform.scale;
  const finalHeight = baseBadgeHeight * transform.scale;

  ctx.drawImage(
    badgeImage,
    resolvedBounds.sx,
    resolvedBounds.sy,
    resolvedBounds.sw,
    resolvedBounds.sh,
    -finalWidth / 2,
    -finalHeight / 2,
    finalWidth,
    finalHeight,
  );

  ctx.restore();
}

export async function compositeLogoOntoScene(
  aiGeneratedSceneSrc: string,
  passBLogoMatteSrc: string,
  outputWidth = 2048,
  outputHeight = 2048,
  transform: BadgeTransform = DEFAULT_BADGE_TRANSFORM,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to create 2D canvas context'));
      return;
    }

    const imgScene = new Image();
    const imgLogo = new Image();

    imgScene.crossOrigin = 'anonymous';
    imgLogo.crossOrigin = 'anonymous';

    imgScene.onload = () => {
      ctx.drawImage(imgScene, 0, 0, outputWidth, outputHeight);

      imgLogo.onload = () => {
        if (!imgLogo.naturalWidth || !imgLogo.naturalHeight) {
          reject(new Error('Pass B Logo Matte has invalid image dimensions'));
          return;
        }

        const bounds = detectOpaqueBounds(imgLogo);
        const offsetScale = Math.min(outputWidth, outputHeight) / 1080;
        drawTransformedBadge(
          ctx,
          imgLogo,
          { x: 0, y: 0, width: outputWidth, height: outputHeight },
          transform,
          bounds,
          offsetScale,
        );
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      imgLogo.onerror = () => reject(new Error('Failed to load Pass B Logo Matte'));
      imgLogo.src = passBLogoMatteSrc;
    };

    imgScene.onerror = () => reject(new Error('Failed to load AI Scene'));
    imgScene.src = aiGeneratedSceneSrc;
  });
}
