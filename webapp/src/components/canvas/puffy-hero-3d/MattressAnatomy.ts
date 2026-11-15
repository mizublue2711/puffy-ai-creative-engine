import * as THREE from 'three';
import {
  PUFFY_FLAGSHIP_PRESETS,
  type MattressModelConfig,
  type MattressModelId,
} from './mattressPresets.ts';

export {PUFFY_FLAGSHIP_PRESETS, type MattressModelConfig, type MattressModelId};

export interface LoadedAssets {
  materials: {
    upperBand: THREE.MeshPhysicalMaterial;
    lowerBorder: THREE.MeshPhysicalMaterial;
    topCover: THREE.MeshPhysicalMaterial;
    pipingCord: THREE.MeshPhysicalMaterial;
    brandBadge: THREE.MeshStandardMaterial;
    slotMap: Map<string, THREE.MeshStandardMaterial>;
  };
  textures: {
    cloudPuffNormal: THREE.CanvasTexture;
    cloudPuffAO: THREE.CanvasTexture;
    diamondQuiltNormal: THREE.CanvasTexture;
    diamondQuiltAO: THREE.CanvasTexture;
    verticalFlutesNormal: THREE.CanvasTexture;
    verticalFlutesRoughness: THREE.CanvasTexture;
    verticalFlutesAo: THREE.CanvasTexture;
    microDiamondsNormal: THREE.CanvasTexture;
    microDiamondsRoughness: THREE.CanvasTexture;
    microDiamondsAo: THREE.CanvasTexture;
    badgeRoyal: THREE.CanvasTexture;
    badgeMonarch: THREE.CanvasTexture;
  };
}

interface ActiveColorTween {
  material: THREE.MeshPhysicalMaterial;
  fromColor: THREE.Color;
  toColor: THREE.Color;
  fromSheenColor: THREE.Color;
  toSheenColor: THREE.Color;
  startTime: number;
  duration: number;
}

const activeColorTweens: ActiveColorTween[] = [];

/**
 * Modular Lego Swapping Logic (Execution in Runtime):
 * Toggles between [ Puffy Royal ] and [ Puffy Monarch ] with 0ms reload lag and zero VRAM increase:
 * 1. Smoothly transitions Upper Band color (#18243B Midnight Navy <-> #45382E Espresso Mocha Bronze)
 *    and micro-fiber sheenColor (#3D5A80 <-> #705A4A) over 0.45s (power2.out)
 * 2. Hot-swaps Upper Band Normal/Roughness/AO maps ('vertical-flutes' <-> 'micro-diamonds')
 * 3. Hot-swaps Center Embroidered Badge Texture ('Puffy ROYAL' <-> 'Puffy MONARCH')
 * While keeping Shared Static Components (#FFFFFF Top Cover, #3B3E46 Large Diamond Lower Walls, #1A1A1A Braided Piping, #F8F9FA Pocket Coils) identical.
 */
export function switchMattressModel(modelKey: MattressModelId, assets: LoadedAssets): void {
  const config = PUFFY_FLAGSHIP_PRESETS[modelKey] ?? PUFFY_FLAGSHIP_PRESETS['puffy-royal'];
  const now = performance.now() * 0.001;

  // 1. Smoothly Transition Upper Velvet/Quilted Band Color & SheenColor (0.45s, power2.out)
  const upperMat = assets.materials.upperBand;
  const existingIdx = activeColorTweens.findIndex((t) => t.material === upperMat);
  if (existingIdx !== -1) {
    activeColorTweens.splice(existingIdx, 1);
  }
  activeColorTweens.push({
    material: upperMat,
    fromColor: upperMat.color.clone(),
    toColor: new THREE.Color(config.upperBand.color),
    fromSheenColor: upperMat.sheenColor.clone(),
    toSheenColor: new THREE.Color(config.upperBand.sheenColor),
    startTime: now,
    duration: 0.45,
  });
  upperMat.roughness = config.upperBand.roughness;

  // 2. Hot-Swap Upper Band Normal Map (plus matching Roughness & AO maps)
  if (config.upperBand.normalMapType === 'vertical-flutes') {
    upperMat.normalMap = assets.textures.verticalFlutesNormal;
    upperMat.roughnessMap = assets.textures.verticalFlutesRoughness;
    upperMat.aoMap = assets.textures.verticalFlutesAo;
  } else {
    upperMat.normalMap = assets.textures.microDiamondsNormal;
    upperMat.roughnessMap = assets.textures.microDiamondsRoughness;
    upperMat.aoMap = assets.textures.microDiamondsAo;
  }
  upperMat.needsUpdate = true;

  // 3. Swap Center Embroidered Badge Texture ("Puffy ROYAL" vs "Puffy MONARCH")
  assets.materials.brandBadge.map =
    modelKey === 'puffy-royal' ? assets.textures.badgeRoyal : assets.textures.badgeMonarch;
  assets.materials.brandBadge.needsUpdate = true;

  // 4. Enforce Shared Static Components invariance
  assets.materials.topCover.color.set('#FFFFFF');
  assets.materials.lowerBorder.color.set(config.lowerBorder.color); // #3B3E46
  assets.materials.pipingCord.color.set('#1A1A1A');
  const pocketCoilsMat = assets.materials.slotMap.get('mat_pocket_coils');
  if (pocketCoilsMat) {
    pocketCoilsMat.color.set('#F8F9FA');
  }
}

/**
 * Advances any active 0.45s color & sheen transitions inside the unified RAF loop (`power2.out`).
 */
export function updateColorPresetTransitions(nowSeconds = performance.now() * 0.001): void {
  for (let i = activeColorTweens.length - 1; i >= 0; i--) {
    const tw = activeColorTweens[i];
    const rawProgress = tw.duration > 0 ? (nowSeconds - tw.startTime) / tw.duration : 1;
    const clamped = THREE.MathUtils.clamp(rawProgress, 0, 1);
    // power2.out easing
    const eased = 1 - (1 - clamped) * (1 - clamped);
    tw.material.color.lerpColors(tw.fromColor, tw.toColor, eased);
    tw.material.sheenColor.lerpColors(tw.fromSheenColor, tw.toSheenColor, eased);
    if (clamped >= 1) {
      activeColorTweens.splice(i, 1);
    }
  }
}

/**
 * Ensures a BufferGeometry has a 'uv2' attribute required by Three.js for aoMap evaluation,
 * and computes tangents when indexed + UV+normal attributes exist for crisp normalMap shading.
 */
export function preparePBRGeometry(geometry: THREE.BufferGeometry): void {
  const uv = geometry.attributes.uv;
  if (uv && !geometry.attributes.uv2) {
    geometry.setAttribute('uv2', uv);
  }
  if (geometry.index && geometry.attributes.position && geometry.attributes.normal && uv) {
    geometry.computeTangents();
  }
}

/**
 * Converts a single-channel 2D heightfield canvas into a Tangent-Space Normal Map,
 * a Roughness Map, and an Ambient Occlusion (AO) Map (all in linear NoColorSpace).
 * This allows `material.map = null` so `material.color` stays 100% vibrant without gray muddiness.
 */
function generatePBRMapsFromHeightCanvas(
  heightCanvas: HTMLCanvasElement,
  normalStrength: number,
  baseRoughness: number,
  roughnessContrast: number,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
} {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext('2d');

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const nCtx = normalCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rCtx = roughCanvas.getContext('2d');

  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = w;
  aoCanvas.height = h;
  const aCtx = aoCanvas.getContext('2d');

  if (hCtx && nCtx && rCtx && aCtx) {
    const src = hCtx.getImageData(0, 0, w, h).data;
    const nImg = nCtx.createImageData(w, h);
    const rImg = rCtx.createImageData(w, h);
    const aImg = aCtx.createImageData(w, h);

    const nData = nImg.data;
    const rData = rImg.data;
    const aData = aImg.data;

    const sampleH = (x: number, y: number): number => {
      const wx = ((x % w) + w) % w;
      const wy = ((y % h) + h) % h;
      return src[(wy * w + wx) * 4] / 255;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const centerH = sampleH(x, y);
        const leftH = sampleH(x - 1, y);
        const rightH = sampleH(x + 1, y);
        const upH = sampleH(x, y - 1);
        const downH = sampleH(x, y + 1);

        const dx = (leftH - rightH) * normalStrength;
        const dy = (upH - downH) * normalStrength;
        const dz = 1.0;
        const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);

        nData[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
        nData[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
        nData[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
        nData[idx + 3] = 255;

        const roughVal = THREE.MathUtils.clamp(
          baseRoughness + (0.5 - centerH) * roughnessContrast,
          0.15,
          0.98,
        );
        const rByte = Math.round(roughVal * 255);
        rData[idx] = rByte;
        rData[idx + 1] = rByte;
        rData[idx + 2] = rByte;
        rData[idx + 3] = 255;

        const aoVal = THREE.MathUtils.clamp(0.45 + centerH * 0.55, 0.38, 1.0);
        const aByte = Math.round(aoVal * 255);
        aData[idx] = aByte;
        aData[idx + 1] = aByte;
        aData[idx + 2] = aByte;
        aData[idx + 3] = 255;
      }
    }

    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    aCtx.putImageData(aImg, 0, 0);
  }

  const configureDataTex = (canvasEl: HTMLCanvasElement): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvasEl);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  return {
    normalMap: configureDataTex(normalCanvas),
    roughnessMap: configureDataTex(roughCanvas),
    aoMap: configureDataTex(aoCanvas),
  };
}

/**
 * Builds all 11 Named PBR Material Slots and pre-allocates the `LoadedAssets` textures
 * for instant 0ms Lego hot-swapping between Puffy Royal Hybrid and Puffy Monarch Hybrid.
 */
export function createMattressPBRMaterials(maxAnisotropy: number): {
  materials: Map<string, THREE.MeshStandardMaterial>;
  loadedAssets: LoadedAssets;
  disposables: Array<{dispose(): void}>;
} {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const disposables: Array<{dispose(): void}> = [];

  // 1. C. Top Cloud Sleep Surface (`mat_top_cover` — MeshPhysicalMaterial with Cloud-White Sheen)
  const cloudHeightCanvas = document.createElement('canvas');
  cloudHeightCanvas.width = 256;
  cloudHeightCanvas.height = 256;
  const chCtx = cloudHeightCanvas.getContext('2d');
  if (chCtx) {
    chCtx.fillStyle = '#B0B0B0';
    chCtx.fillRect(0, 0, 256, 256);
    const cells = 4;
    const step = 256 / cells;
    for (let row = 0; row <= cells; row++) {
      for (let col = 0; col <= cells; col++) {
        const cx = col * step + (row % 2 === 0 ? 0 : step * 0.5);
        const cy = row * step;
        const grad = chCtx.createRadialGradient(cx, cy, 2, cx, cy, step * 0.62);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.76, '#E2E2E2');
        grad.addColorStop(1, '#484848');
        chCtx.fillStyle = grad;
        chCtx.beginPath();
        chCtx.arc(cx, cy, step * 0.62, 0, Math.PI * 2);
        chCtx.fill();
      }
    }
  }
  const cloudMaps = generatePBRMapsFromHeightCanvas(
    cloudHeightCanvas,
    3.6,
    0.9,
    0.12,
    3.5,
    4.0,
    maxAnisotropy,
  );
  disposables.push(cloudMaps.normalMap, cloudMaps.roughnessMap, cloudMaps.aoMap);

  const matTopCover = new THREE.MeshPhysicalMaterial({
    name: 'mat_top_cover',
    map: null,
    color: new THREE.Color('#FFFFFF'),
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.8,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#E8EDF2'), // Cloud-white sheen
    normalMap: cloudMaps.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    aoMap: cloudMaps.aoMap,
    aoMapIntensity: 0.9,
  });
  materials.set('mat_top_cover', matTopCover);
  disposables.push(matTopCover);

  // 2. A. Side Border Walls (`mat_side_border` — MeshPhysicalMaterial with Micro-Fiber Sheen)
  // Soft, woven, deeply quilted diamond channels with zero plastic specular glare
  const diamondHeightCanvas = document.createElement('canvas');
  diamondHeightCanvas.width = 256;
  diamondHeightCanvas.height = 128;
  const dhCtx = diamondHeightCanvas.getContext('2d');
  if (dhCtx) {
    dhCtx.fillStyle = '#F5F5F5';
    dhCtx.fillRect(0, 0, 256, 128);
    // Soft cushion pillow bevel around each diamond seam
    dhCtx.strokeStyle = '#787878';
    dhCtx.lineWidth = 10.0;
    const stepX = 32;
    for (let x = -128; x < 384; x += stepX) {
      dhCtx.beginPath();
      dhCtx.moveTo(x, 0);
      dhCtx.lineTo(x + 128, 128);
      dhCtx.stroke();

      dhCtx.beginPath();
      dhCtx.moveTo(x + 128, 0);
      dhCtx.lineTo(x, 128);
      dhCtx.stroke();
    }
    // Deep tufted stitch channel centerlines
    dhCtx.strokeStyle = '#1E1E1E';
    dhCtx.lineWidth = 4.2;
    for (let x = -128; x < 384; x += stepX) {
      dhCtx.beginPath();
      dhCtx.moveTo(x, 0);
      dhCtx.lineTo(x + 128, 128);
      dhCtx.stroke();

      dhCtx.beginPath();
      dhCtx.moveTo(x + 128, 0);
      dhCtx.lineTo(x, 128);
      dhCtx.stroke();
    }
  }
  const diamondMaps = generatePBRMapsFromHeightCanvas(
    diamondHeightCanvas,
    4.2,
    0.85,
    0.16,
    3.5,
    1.0,
    maxAnisotropy,
  );
  disposables.push(diamondMaps.normalMap, diamondMaps.roughnessMap, diamondMaps.aoMap);

  const matSideBorder = new THREE.MeshPhysicalMaterial({
    name: 'mat_side_border',
    map: null,
    color: new THREE.Color('#3B3E46'), // Charcoal Slate Base
    roughness: 0.85, // High roughness kills plastic specular shine
    metalness: 0.0, // Strict zero metallic for organic textile
    sheen: 1.0, // Full micro-fiber retro-reflection
    sheenRoughness: 0.65, // Soft dispersed fabric halo at glancing angles
    sheenColor: new THREE.Color('#7A808C'), // Subtle light tint catching the rim light
    normalMap: diamondMaps.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2), // Deep, soft quilted diamond grooves
    aoMap: diamondMaps.aoMap,
    aoMapIntensity: 1.1, // Deep rich shadowing inside tufted seams
  });
  materials.set('mat_side_border', matSideBorder);
  disposables.push(matSideBorder);

  // 3. Braided Welt Piping (`mat_piping_cord`, Shared #1A1A1A Black Woven Edge Cord)
  const pipingHeightCanvas = document.createElement('canvas');
  pipingHeightCanvas.width = 128;
  pipingHeightCanvas.height = 32;
  const phCtx = pipingHeightCanvas.getContext('2d');
  if (phCtx) {
    phCtx.fillStyle = '#D8D8D8';
    phCtx.fillRect(0, 0, 128, 32);
    phCtx.strokeStyle = '#484848';
    phCtx.lineWidth = 2.5;
    for (let x = -32; x < 160; x += 8) {
      phCtx.beginPath();
      phCtx.moveTo(x, 0);
      phCtx.lineTo(x + 16, 32);
      phCtx.stroke();
    }
  }
  const pipingMaps = generatePBRMapsFromHeightCanvas(
    pipingHeightCanvas,
    2.8,
    0.82,
    0.15,
    14,
    1,
    maxAnisotropy,
  );
  disposables.push(pipingMaps.normalMap, pipingMaps.roughnessMap, pipingMaps.aoMap);

  const matPipingCord = new THREE.MeshPhysicalMaterial({
    name: 'mat_piping_cord',
    map: null,
    color: new THREE.Color('#1A1A1A'),
    roughness: 0.82,
    metalness: 0.0,
    sheen: 0.75,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color('#3F434D'),
    normalMap: pipingMaps.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    aoMap: pipingMaps.aoMap,
    aoMapIntensity: 0.85,
  });
  materials.set('mat_piping_cord', matPipingCord);
  disposables.push(matPipingCord);

  // 4A. Upper Band Normal Set 1: 'vertical-flutes' (Puffy Royal Hybrid — #18243B Midnight Navy Velvet)
  const velvetHeightCanvas = document.createElement('canvas');
  velvetHeightCanvas.width = 256;
  velvetHeightCanvas.height = 64;
  const vhCtx = velvetHeightCanvas.getContext('2d');
  if (vhCtx) {
    const channelW = 16;
    for (let x = 0; x < 256; x += channelW) {
      const grad = vhCtx.createLinearGradient(x, 0, x + channelW, 0);
      grad.addColorStop(0, '#282828');
      grad.addColorStop(0.2, '#D8D8D8');
      grad.addColorStop(0.5, '#FFFFFF');
      grad.addColorStop(0.8, '#D8D8D8');
      grad.addColorStop(1, '#282828');
      vhCtx.fillStyle = grad;
      vhCtx.fillRect(x, 0, channelW, 64);
    }
  }
  const verticalFlutesMaps = generatePBRMapsFromHeightCanvas(
    velvetHeightCanvas,
    3.8,
    0.75,
    0.18,
    4,
    1,
    maxAnisotropy,
  );
  disposables.push(
    verticalFlutesMaps.normalMap,
    verticalFlutesMaps.roughnessMap,
    verticalFlutesMaps.aoMap,
  );

  // 4B. Upper Band Normal Set 2: 'micro-diamonds' (Puffy Monarch Hybrid — #45382E Espresso/Mocha Bronze)
  const microDiamondCanvas = document.createElement('canvas');
  microDiamondCanvas.width = 256;
  microDiamondCanvas.height = 64;
  const mdCtx = microDiamondCanvas.getContext('2d');
  if (mdCtx) {
    mdCtx.fillStyle = '#F2F2F2';
    mdCtx.fillRect(0, 0, 256, 64);
    mdCtx.strokeStyle = '#282828';
    mdCtx.lineWidth = 2.6;
    const stepX = 12;
    for (let x = -64; x < 320; x += stepX) {
      mdCtx.beginPath();
      mdCtx.moveTo(x, 0);
      mdCtx.lineTo(x + 64, 64);
      mdCtx.stroke();

      mdCtx.beginPath();
      mdCtx.moveTo(x + 64, 0);
      mdCtx.lineTo(x, 64);
      mdCtx.stroke();
    }
  }
  const microDiamondsMaps = generatePBRMapsFromHeightCanvas(
    microDiamondCanvas,
    3.6,
    0.75,
    0.18,
    5,
    1,
    maxAnisotropy,
  );
  disposables.push(
    microDiamondsMaps.normalMap,
    microDiamondsMaps.roughnessMap,
    microDiamondsMaps.aoMap,
  );

  // 4C. B. Upper Accent Band (`mat_accent_strip` — MeshPhysicalMaterial with Velvet/Mocha Sheen)
  const royalPreset = PUFFY_FLAGSHIP_PRESETS['puffy-royal'];
  const matAccentStrip = new THREE.MeshPhysicalMaterial({
    name: 'mat_accent_strip',
    map: null,
    color: new THREE.Color(royalPreset.upperBand.color), // #18243B Midnight Navy
    roughness: 0.75,
    metalness: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(royalPreset.upperBand.sheenColor), // #3D5A80 for Navy, #705A4A for Mocha
    normalMap: verticalFlutesMaps.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: verticalFlutesMaps.roughnessMap,
    aoMap: verticalFlutesMaps.aoMap,
    aoMapIntensity: 0.9,
  });
  materials.set('mat_accent_strip', matAccentStrip);
  disposables.push(matAccentStrip);

  // 5. Center Embroidered Brand Badges (`badgeRoyal` vs `badgeMonarch`)
  const badgeRoyal = createFlagshipBadgeTexture('ROYAL', maxAnisotropy);
  const badgeMonarch = createFlagshipBadgeTexture('MONARCH', maxAnisotropy);
  const matBrandBadge = new THREE.MeshStandardMaterial({
    name: 'mat_brand_badge',
    map: badgeRoyal,
    color: new THREE.Color('#FFFFFF'),
    roughness: 0.55,
    metalness: 0.05,
  });
  materials.set('mat_brand_badge', matBrandBadge);
  disposables.push(badgeRoyal, badgeMonarch, matBrandBadge);

  // 6. Internal Layers 2 through 9: Lightweight MeshStandardMaterial with roughness: 0.9 for 60 FPS
  const woolHeightCanvas = document.createElement('canvas');
  woolHeightCanvas.width = 128;
  woolHeightCanvas.height = 128;
  const whCtx = woolHeightCanvas.getContext('2d');
  if (whCtx) {
    whCtx.fillStyle = '#C8C8C8';
    whCtx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      const x = (i * 47) % 128;
      const y = (i * 83) % 128;
      const r = 2 + (i % 5);
      whCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(90,90,90,0.45)';
      whCtx.beginPath();
      whCtx.arc(x, y, r, 0, Math.PI * 2);
      whCtx.fill();
    }
  }
  const woolMaps = generatePBRMapsFromHeightCanvas(
    woolHeightCanvas,
    2.4,
    0.9,
    0.12,
    4,
    4,
    maxAnisotropy,
  );
  disposables.push(woolMaps.normalMap, woolMaps.roughnessMap, woolMaps.aoMap);

  const matWool = new THREE.MeshStandardMaterial({
    name: 'mat_wool',
    map: null,
    color: new THREE.Color('#F2EDE4'),
    normalMap: woolMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: woolMaps.roughnessMap,
    roughness: 0.9,
    aoMap: woolMaps.aoMap,
    aoMapIntensity: 0.3,
    metalness: 0.0,
  });
  materials.set('mat_wool', matWool);
  disposables.push(matWool);

  // 7. Micro-cellular Foam Normal & Roughness Maps shared across internal foam layers 3..7 & 9 (`roughness: 0.9`)
  const foamHeightCanvas = document.createElement('canvas');
  foamHeightCanvas.width = 128;
  foamHeightCanvas.height = 128;
  const fhCtx = foamHeightCanvas.getContext('2d');
  if (fhCtx) {
    fhCtx.fillStyle = '#D0D0D0';
    fhCtx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 700; i++) {
      const x = (i * 37) % 128;
      const y = (i * 71) % 128;
      fhCtx.fillStyle = i % 2 === 0 ? '#F2F2F2' : '#9E9E9E';
      fhCtx.fillRect(x, y, 2, 2);
    }
  }
  const foamMaps = generatePBRMapsFromHeightCanvas(
    foamHeightCanvas,
    1.8,
    0.9,
    0.1,
    5,
    5,
    maxAnisotropy,
  );
  disposables.push(foamMaps.normalMap, foamMaps.roughnessMap, foamMaps.aoMap);

  const matCoolingFoam = new THREE.MeshStandardMaterial({
    name: 'mat_cooling_foam',
    map: null,
    color: new THREE.Color('#B4D5F6'),
    normalMap: foamMaps.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughnessMap: foamMaps.roughnessMap,
    roughness: 0.9,
    metalness: 0.0,
  });
  materials.set('mat_cooling_foam', matCoolingFoam);
  disposables.push(matCoolingFoam);

  const matDeepClimate = new THREE.MeshStandardMaterial({
    name: 'mat_deep_climate',
    map: null,
    color: new THREE.Color('#2A88E8'),
    normalMap: foamMaps.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughnessMap: foamMaps.roughnessMap,
    roughness: 0.9,
    metalness: 0.0,
  });
  materials.set('mat_deep_climate', matDeepClimate);
  disposables.push(matDeepClimate);

  const matTransitionFoam = new THREE.MeshStandardMaterial({
    name: 'mat_transition_foam',
    map: null,
    color: new THREE.Color('#4B5478'),
    normalMap: foamMaps.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: foamMaps.roughnessMap,
    roughness: 0.9,
    metalness: 0.0,
  });
  materials.set('mat_transition_foam', matTransitionFoam);
  disposables.push(matTransitionFoam);

  // 8. `mat_pocket_coils`: LOCKED to pure white spun-bond fabric (#F8F9FA), roughness: 0.9
  const coilHeightCanvas = document.createElement('canvas');
  coilHeightCanvas.width = 64;
  coilHeightCanvas.height = 128;
  const ch2Ctx = coilHeightCanvas.getContext('2d');
  if (ch2Ctx) {
    const turns = 5;
    const stepY = 128 / turns;
    for (let i = 0; i < turns; i++) {
      const y = i * stepY;
      const grad = ch2Ctx.createLinearGradient(0, y, 0, y + stepY);
      grad.addColorStop(0, '#606060');
      grad.addColorStop(0.22, '#DFDFDF');
      grad.addColorStop(0.5, '#FFFFFF');
      grad.addColorStop(0.78, '#DFDFDF');
      grad.addColorStop(1, '#606060');
      ch2Ctx.fillStyle = grad;
      ch2Ctx.fillRect(0, y, 64, stepY);
    }
  }
  const coilMaps = generatePBRMapsFromHeightCanvas(
    coilHeightCanvas,
    3.0,
    0.9,
    0.12,
    1,
    1,
    maxAnisotropy,
  );
  disposables.push(coilMaps.normalMap, coilMaps.roughnessMap, coilMaps.aoMap);

  const matPocketCoils = new THREE.MeshStandardMaterial({
    name: 'mat_pocket_coils',
    map: null,
    color: new THREE.Color('#F8F9FA'),
    normalMap: coilMaps.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: coilMaps.roughnessMap,
    roughness: 0.9,
    aoMap: coilMaps.aoMap,
    aoMapIntensity: 0.35,
    metalness: 0.0,
  });
  materials.set('mat_pocket_coils', matPocketCoils);
  disposables.push(matPocketCoils);

  // 9. `mat_grip_base`: Anti-slip dark charcoal dotted base (#22242A), map: null
  const gripHeightCanvas = document.createElement('canvas');
  gripHeightCanvas.width = 128;
  gripHeightCanvas.height = 128;
  const ghCtx = gripHeightCanvas.getContext('2d');
  if (ghCtx) {
    ghCtx.fillStyle = '#909090';
    ghCtx.fillRect(0, 0, 128, 128);
    ghCtx.fillStyle = '#FFFFFF';
    for (let y = 8; y < 128; y += 16) {
      for (let x = 8; x < 128; x += 16) {
        ghCtx.beginPath();
        ghCtx.arc(x, y, 3.5, 0, Math.PI * 2);
        ghCtx.fill();
      }
    }
  }
  const gripMaps = generatePBRMapsFromHeightCanvas(
    gripHeightCanvas,
    2.6,
    0.85,
    0.14,
    8,
    8,
    maxAnisotropy,
  );
  disposables.push(gripMaps.normalMap, gripMaps.roughnessMap, gripMaps.aoMap);

  const matGripBase = new THREE.MeshStandardMaterial({
    name: 'mat_grip_base',
    map: null,
    color: new THREE.Color('#22242A'),
    normalMap: gripMaps.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: gripMaps.roughnessMap,
    roughness: 0.85,
    metalness: 0.0,
  });
  materials.set('mat_grip_base', matGripBase);
  disposables.push(matGripBase);

  const loadedAssets: LoadedAssets = {
    materials: {
      upperBand: matAccentStrip,
      lowerBorder: matSideBorder,
      topCover: matTopCover,
      pipingCord: matPipingCord,
      brandBadge: matBrandBadge,
      slotMap: materials,
    },
    textures: {
      cloudPuffNormal: cloudMaps.normalMap,
      cloudPuffAO: cloudMaps.aoMap,
      diamondQuiltNormal: diamondMaps.normalMap,
      diamondQuiltAO: diamondMaps.aoMap,
      verticalFlutesNormal: verticalFlutesMaps.normalMap,
      verticalFlutesRoughness: verticalFlutesMaps.roughnessMap,
      verticalFlutesAo: verticalFlutesMaps.aoMap,
      microDiamondsNormal: microDiamondsMaps.normalMap,
      microDiamondsRoughness: microDiamondsMaps.roughnessMap,
      microDiamondsAo: microDiamondsMaps.aoMap,
      badgeRoyal,
      badgeMonarch,
    },
  };

  return {materials, loadedAssets, disposables};
}

function createFlagshipBadgeTexture(
  subLabel: 'ROYAL' | 'MONARCH',
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#14161B';
    ctx.fillRect(0, 0, 512, 180);
    ctx.strokeStyle = '#2F333E';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 160);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px "PT Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Puffy', 210, 92);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.arc(338, 74, 18, Math.PI * 0.8, Math.PI * 1.9);
    ctx.arc(364, 65, 22, Math.PI * 1.1, Math.PI * 2.1);
    ctx.arc(388, 78, 14, Math.PI * 1.3, Math.PI * 0.4);
    ctx.lineTo(322, 92);
    ctx.stroke();

    // Warm metallic gold "R O Y A L" or "M O N A R C H" sub-label
    ctx.fillStyle = '#D4B46A';
    ctx.font = '600 29px "Mukta", sans-serif';
    const spaced = subLabel.split('').join('  ');
    ctx.fillText(spaced, 256, 144);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
