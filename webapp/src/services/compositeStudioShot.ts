export async function compositeLogoOntoScene(
  aiGeneratedSceneSrc: string,
  passBLogoMatteSrc: string,
  outputWidth = 2048,
  outputHeight = 2048,
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

        ctx.globalCompositeOperation = 'source-over';
        const scale = Math.min(
          outputWidth / imgLogo.naturalWidth,
          outputHeight / imgLogo.naturalHeight,
        );
        const logoWidth = imgLogo.naturalWidth * scale;
        const logoHeight = imgLogo.naturalHeight * scale;
        const logoX = (outputWidth - logoWidth) / 2;
        const logoY = (outputHeight - logoHeight) / 2;
        ctx.drawImage(imgLogo, logoX, logoY, logoWidth, logoHeight);
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      imgLogo.onerror = () => reject(new Error('Failed to load Pass B Logo Matte'));
      imgLogo.src = passBLogoMatteSrc;
    };

    imgScene.onerror = () => reject(new Error('Failed to load AI Scene'));
    imgScene.src = aiGeneratedSceneSrc;
  });
}
