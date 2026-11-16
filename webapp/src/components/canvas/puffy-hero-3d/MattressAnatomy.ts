import * as THREE from 'three';
import {
  PUFFY_FLAGSHIP_PRESETS,
  type MattressModelConfig,
  type MattressModelId,
} from './mattressPresets.ts';
import {resolvePuffyModelKey, type PuffyModelKey} from './puffyLayersData.ts';

export {PUFFY_FLAGSHIP_PRESETS, type MattressModelConfig, type MattressModelId};

export interface LoadedAssets {
  materials: {
    upperBand: THREE.MeshPhysicalMaterial;
    lowerBorder: THREE.MeshPhysicalMaterial;
    topCover: THREE.MeshPhysicalMaterial;
    pipingCord: THREE.MeshPhysicalMaterial;
    brandBadge: THREE.MeshPhysicalMaterial;
    brandBadgeRoyal: THREE.MeshPhysicalMaterial;
    brandBadgeLux: THREE.MeshPhysicalMaterial;
    brandBadgeCloud: THREE.MeshPhysicalMaterial;
    brandBadgeMonarch: THREE.MeshPhysicalMaterial;
    sidewallRoyal: THREE.MeshPhysicalMaterial;
    sidewallLux: THREE.MeshPhysicalMaterial;
    sidewallCloudFront: THREE.MeshPhysicalMaterial;
    sidewallCloudWrap: THREE.MeshPhysicalMaterial;
    slotMap: Map<string, THREE.MeshStandardMaterial>;
  };
  textures: {
    cloudPuffNormal: THREE.Texture;
    cloudPuffAO: THREE.Texture;
    diamondQuiltNormal: THREE.CanvasTexture;
    diamondQuiltAO: THREE.CanvasTexture;
    verticalFlutesNormal: THREE.CanvasTexture;
    verticalFlutesRoughness: THREE.CanvasTexture;
    verticalFlutesAo: THREE.CanvasTexture;
    microDiamondsNormal: THREE.CanvasTexture;
    microDiamondsRoughness: THREE.CanvasTexture;
    microDiamondsAo: THREE.CanvasTexture;
    badgeRoyal: THREE.Texture;
    badgeMonarch: THREE.CanvasTexture;
    badgeCloud: THREE.CanvasTexture;
    badgeLux: THREE.CanvasTexture;
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

  // 3. Enforce Royal badge map stays bound on mat_brand_badge (separate badge materials handle Monarch/Lux/Cloud)
  assets.materials.brandBadge.map =
    modelKey === 'puffy-royal' ? assets.textures.badgeRoyal : assets.textures.badgeMonarch;
  assets.materials.brandBadge.needsUpdate = true;

  // 4. Enforce Shared Static Components invariance
  assets.materials.topCover.color.set('#f7f7f7');
  assets.materials.lowerBorder.color.set(config.lowerBorder.color); // #3B3E46
  assets.materials.pipingCord.color.set('#1A1A1A');
  const pocketCoilsMat = assets.materials.slotMap.get('mat_pocket_coils');
  if (pocketCoilsMat) {
    pocketCoilsMat.color.set('#F8F9FA');
  }
}

/**
 * Updates the embroidered front badge and clamps/scales sidewall UV transforms
 * for the 3-tier Puffy ecosystem (`cloud` 10", `lux` 12", `royal` 14").
 */
export function updateModelAnatomy(
  modelKey: PuffyModelKey,
  assets: LoadedAssets,
  heightRatio = 1.0,
): void {
  const resolvedKey = resolvePuffyModelKey(modelKey);

  // Keep Royal's 2K badge material bound strictly to Royal's albedo (dedicated materials handle Lux & Cloud)
  if (resolvedKey === 'royal') {
    assets.materials.brandBadge.map = assets.textures.badgeRoyal;
    assets.materials.brandBadge.needsUpdate = true;
  }

  // 2. Clamp and adjust sidewall texture UV repeat.y without squashing the diamond quilt
  const safeHeightRatio = Number.isFinite(heightRatio) && heightRatio > 0 ? heightRatio : 1.0;
  const clampedHeightRatio = THREE.MathUtils.clamp(safeHeightRatio, 0.5, 1.25);

  const sideBorderTextures = new Set<THREE.Texture>([
    assets.textures.diamondQuiltNormal,
    assets.textures.diamondQuiltAO,
  ]);
  const lowerBorderMats = [
    assets.materials.lowerBorder,
    assets.materials.slotMap.get('mat_side_border'),
  ];
  for (const mat of lowerBorderMats) {
    if (!mat) continue;
    for (const tex of [mat.normalMap, mat.aoMap, mat.roughnessMap]) {
      if (tex) sideBorderTextures.add(tex);
    }
  }
  for (const tex of sideBorderTextures) {
    if (tex.wrapT !== THREE.ClampToEdgeWrapping) {
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    }
    tex.repeat.y = clampedHeightRatio;
    tex.offset.y = 0;
  }

  const sidewallSlots = [
    assets.materials.sidewallRoyal,
    assets.materials.sidewallLux,
    assets.materials.sidewallCloudFront,
    assets.materials.sidewallCloudWrap,
    assets.materials.slotMap.get('mat_sidewall_strip'),
    assets.materials.slotMap.get('mat_sidewall_lux'),
    assets.materials.slotMap.get('mat_sidewall_cloud_front'),
    assets.materials.slotMap.get('mat_sidewall_cloud_wrap'),
  ];
  const seenStripTextures = new Set<THREE.Texture>();
  for (const sideWallMat of sidewallSlots) {
    if (!sideWallMat) continue;
    const phys = sideWallMat as THREE.MeshPhysicalMaterial;
    const stripTextures = [
      phys.map,
      phys.normalMap,
      phys.roughnessMap,
      phys.aoMap,
      phys.sheenColorMap,
    ];
    for (const tex of stripTextures) {
      if (!tex || seenStripTextures.has(tex)) continue;
      seenStripTextures.add(tex);
      if (tex.wrapT !== THREE.ClampToEdgeWrapping) {
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
      }
      tex.repeat.y = 1;
      tex.offset.y = 0;
    }
  }
}

/**
 * Advances any active 0.45s color & sheen transitions inside the unified RAF loop (`power2.out`).
 */
export function updateColorPresetTransitions(nowSeconds = performance.now() * 0.001): void {
  const safeNow = Number.isFinite(nowSeconds) ? nowSeconds : performance.now() * 0.001;
  for (let i = activeColorTweens.length - 1; i >= 0; i--) {
    const tw = activeColorTweens[i];
    const rawProgress =
      Number.isFinite(tw.duration) && tw.duration > 0 ? (safeNow - tw.startTime) / tw.duration : 1;
    const clamped = THREE.MathUtils.clamp(Number.isFinite(rawProgress) ? rawProgress : 1, 0, 1);
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

export function createEmbroideredBadgeMaterial(
  texturePath = '/textures/badge',
): {
  material: THREE.MeshPhysicalMaterial;
  textures: THREE.Texture[];
} {
  const textureLoader = new THREE.TextureLoader();

  // 1. Load CAVP-v1.0 PBR maps with strict color space separation
  const baseColorMap = textureLoader.load(`${texturePath}/01_baseColor.png`);
  baseColorMap.colorSpace = THREE.SRGBColorSpace;

  const normalMap = textureLoader.load(`${texturePath}/02_normal.png`);
  normalMap.colorSpace = THREE.NoColorSpace;

  const roughnessMap = textureLoader.load(`${texturePath}/03_roughness.png`);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  const aoMap = textureLoader.load(`${texturePath}/05_ambientOcclusion.png`);
  aoMap.colorSpace = THREE.NoColorSpace;

  // 2. Physical embroidery shader (0.85 matte twill base, 0.35-0.40 satin thread sheen)
  const material = new THREE.MeshPhysicalMaterial({
    name: 'mat_brand_badge',
    color: new THREE.Color('#FFFFFF'),
    map: baseColorMap,
    normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    aoMap,
    aoMapIntensity: 1.0,
    sheen: 1.0,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0xffffff),
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    transparent: true,
    alphaTest: 0.5,
  });

  return {
    material,
    textures: [baseColorMap, normalMap, roughnessMap, aoMap],
  };
}

export function createEmbroideredBadge(texturePath = '/textures/badge'): THREE.Mesh {
  const {material} = createEmbroideredBadgeMaterial(texturePath);
  // 3. Thin 2:1 planar patch matching SVG viewBox (0.12m x 0.06m), avoiding thick BoxGeometry
  const geometry = new THREE.PlaneGeometry(0.12, 0.06);
  preparePBRGeometry(geometry);
  const badgeMesh = new THREE.Mesh(geometry, material);
  badgeMesh.name = 'puffy-embroidered-badge';
  return badgeMesh;
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

  // 1. C. Top Cloud Sleep Surface (`mat_top_cover` — CAVP-v1.0 `top_quilt_cloud_diamond_v1`)
  const textureLoader = new THREE.TextureLoader();

  const quiltBaseColor = textureLoader.load('/textures/quilt/01_baseColor.png');
  quiltBaseColor.colorSpace = THREE.SRGBColorSpace; // Eliminate muddy gamma gray

  const quiltNormal = textureLoader.load('/textures/quilt/02_normal.png');
  quiltNormal.colorSpace = THREE.NoColorSpace;

  const quiltHeight = textureLoader.load('/textures/quilt/04_height.png');
  quiltHeight.colorSpace = THREE.NoColorSpace;

  const quiltAO = textureLoader.load('/textures/quilt/05_ambientOcclusion.png');
  quiltAO.colorSpace = THREE.NoColorSpace;

  const repeatX = 4; // 1.6m / 0.4m = 4 repeats along width
  const repeatY = 5; // 2.0m / 0.4m = 5 repeats along length

  [quiltBaseColor, quiltNormal, quiltHeight, quiltAO].forEach((tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAnisotropy;
  });
  disposables.push(quiltBaseColor, quiltNormal, quiltHeight, quiltAO);

  const matTopCover = new THREE.MeshPhysicalMaterial({
    name: 'mat_top_cover',
    color: new THREE.Color('#f7f7f7'), // Pure cotton white
    map: quiltBaseColor,
    normalMap: quiltNormal,
    normalScale: new THREE.Vector2(0.55, 0.55), // Softened pillow normals: compressed fiber & foam, not stamped plastic
    aoMap: quiltAO,
    aoMapIntensity: 0.55, // Soft, natural stitch shadow
    roughness: 0.92,     // Deep matte cotton/microfiber, zero plastic glare
    metalness: 0.0,      // Strictly zero
    clearcoat: 0.0,      // Strictly zero (no lacquer/plastic reflection)
    sheen: 1.0,          // Fabric micro-fiber scattering
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#FFFFFF'),
    displacementMap: quiltHeight,
    displacementScale: 0.0, // Keep perimeter vertices locked to piping seam (relief via geometry + softened normalMap)
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
    clearcoat: 0.0,
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

  // 2B. Unified 5-Tier Composite Sidewall Strip (`mat_sidewall_strip` — Protocol v1.1 Class B `sidewall_strip`)
  const sideWallBaseColor = textureLoader.load('/textures/sidewall/01_baseColor.webp');
  sideWallBaseColor.colorSpace = THREE.SRGBColorSpace;

  const sideWallNormal = textureLoader.load('/textures/sidewall/02_normal.webp');
  sideWallNormal.colorSpace = THREE.NoColorSpace;

  const sideWallRoughness = textureLoader.load('/textures/sidewall/03_roughness.webp');
  sideWallRoughness.colorSpace = THREE.NoColorSpace;

  const sideWallAO = textureLoader.load('/textures/sidewall/05_ambientOcclusion.webp');
  sideWallAO.colorSpace = THREE.NoColorSpace;

  const sideWallSheenColor = textureLoader.load('/textures/sidewall/07_sheenColor.webp');
  sideWallSheenColor.colorSpace = THREE.SRGBColorSpace;

  [sideWallBaseColor, sideWallNormal, sideWallRoughness, sideWallAO, sideWallSheenColor].forEach((sideWallTexture) => {
    sideWallTexture.wrapS = THREE.RepeatWrapping;
    sideWallTexture.wrapT = THREE.ClampToEdgeWrapping;
    sideWallTexture.repeat.set(10, 1); // Equilateral ~5.3cm x 5.25cm diamonds around perimeter
    sideWallTexture.anisotropy = maxAnisotropy;
  });
  disposables.push(sideWallBaseColor, sideWallNormal, sideWallRoughness, sideWallAO, sideWallSheenColor);

  const sideWallMaterial = new THREE.MeshPhysicalMaterial({
    name: 'mat_sidewall_strip',
    color: new THREE.Color(0xffffff), // Neutral multiplier so baseColor (#18243B navy, #2E323A charcoal) is never tinted
    map: sideWallBaseColor,
    normalMap: sideWallNormal,
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughnessMap: sideWallRoughness,
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    sheen: 1.5,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0xffffff),
    sheenColorMap: sideWallSheenColor, // Blue sheen ONLY on navy band; neutral grey on piping & charcoal diamonds
    aoMap: sideWallAO,
    aoMapIntensity: 1.4,
  });
  materials.set('mat_sidewall_strip', sideWallMaterial);
  disposables.push(sideWallMaterial);

  // 2C. Puffy Lux Hybrid Sidewall (`mat_sidewall_lux`)
  // Shares sidewall normal/roughness/AO with Espresso Chocolate Brown (#43332B) upper band & Pure Matte Charcoal (#31343A) diamonds
  const luxBundle = createLuxSidewallMaps(maxAnisotropy);
  disposables.push(luxBundle.baseColorMap, luxBundle.sheenColorMap);

  const matSidewallLux = new THREE.MeshPhysicalMaterial({
    name: 'mat_sidewall_lux',
    color: new THREE.Color(0xffffff),
    map: luxBundle.baseColorMap,
    normalMap: sideWallNormal,
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughnessMap: sideWallRoughness,
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    sheen: 1.5,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0xffffff),
    sheenColorMap: luxBundle.sheenColorMap,
    aoMap: sideWallAO,
    aoMapIntensity: 1.4,
  });
  materials.set('mat_sidewall_lux', matSidewallLux);
  disposables.push(matSidewallLux);

  // 2D. Puffy Cloud (10") Front Foot Panel (`mat_sidewall_cloud_front`)
  // Full-height pure matte charcoal grey (#31343A) diamond quilt with white top/bottom piping seams (#F2F2F0)
  const cloudFrontBundle = createCloudFrontSidewallMaps(maxAnisotropy);
  disposables.push(
    cloudFrontBundle.albedoMap,
    cloudFrontBundle.normalMap,
    cloudFrontBundle.roughnessMap,
    cloudFrontBundle.aoMap,
  );

  const matSidewallCloudFront = new THREE.MeshPhysicalMaterial({
    name: 'mat_sidewall_cloud_front',
    color: new THREE.Color(0xffffff),
    map: cloudFrontBundle.albedoMap,
    normalMap: cloudFrontBundle.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: cloudFrontBundle.roughnessMap,
    roughness: 0.86,
    metalness: 0.0,
    clearcoat: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#5A5E66'),
    aoMap: cloudFrontBundle.aoMap,
    aoMapIntensity: 1.15,
  });
  materials.set('mat_sidewall_cloud_front', matSidewallCloudFront);
  disposables.push(matSidewallCloudFront);

  // 2E. Puffy Cloud (10") 3-Side White Cloud Knit Wrap (`cloud_side_knit_embossed` / `mat_sidewall_cloud_wrap`)
  // Off-white cloud knit (#F6F6F4) matching mat_top_cover with 5 embossed vertically-oriented Puffy cloud motifs
  // and crisp white top/bottom piping seams (#FFFFFF).
  const cloudWrapBundle = createCloudWrapSidewallMaps(maxAnisotropy);
  disposables.push(
    cloudWrapBundle.albedoMap,
    cloudWrapBundle.normalMap,
    cloudWrapBundle.roughnessMap,
    cloudWrapBundle.aoMap,
  );

  const matSidewallCloudWrap = new THREE.MeshPhysicalMaterial({
    name: 'cloud_side_knit_embossed',
    color: new THREE.Color('#FFFFFF'),
    map: cloudWrapBundle.albedoMap,
    normalMap: cloudWrapBundle.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: cloudWrapBundle.roughnessMap,
    roughness: 0.9,
    metalness: 0.0,
    clearcoat: 0.0,
    sheen: 1.2,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#FFFFFF'),
    aoMap: cloudWrapBundle.aoMap,
    aoMapIntensity: 1.25,
  });
  materials.set('mat_sidewall_cloud_wrap', matSidewallCloudWrap);
  materials.set('cloud_side_knit_embossed', matSidewallCloudWrap);
  disposables.push(matSidewallCloudWrap);

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
    roughness: 0.90,
    metalness: 0.0,
    clearcoat: 0.0,
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

  // 5. Center Embroidered Brand Badges (`mat_brand_badge_royal` 2K PBR + dedicated clean PBR badges for LUX, CLOUD, MONARCH)
  const {material: matBrandBadge, textures: badgeTextures} = createEmbroideredBadgeMaterial('/textures/badge');
  const badgeRoyal = badgeTextures[0];
  materials.set('mat_brand_badge', matBrandBadge);
  materials.set('mat_brand_badge_royal', matBrandBadge);

  const luxBadgeBundle = createModelBadgeMaterial('LUX', maxAnisotropy);
  const cloudBadgeBundle = createModelBadgeMaterial('CLOUD', maxAnisotropy);
  const monarchBadgeBundle = createModelBadgeMaterial('MONARCH', maxAnisotropy);

  materials.set('mat_brand_badge_lux', luxBadgeBundle.material);
  materials.set('mat_brand_badge_cloud', cloudBadgeBundle.material);
  materials.set('mat_brand_badge_monarch', monarchBadgeBundle.material);

  disposables.push(
    ...badgeTextures,
    matBrandBadge,
    ...luxBadgeBundle.disposables,
    ...cloudBadgeBundle.disposables,
    ...monarchBadgeBundle.disposables,
  );

  const badgeLux = luxBadgeBundle.albedoMap;
  const badgeCloud = cloudBadgeBundle.albedoMap;
  const badgeMonarch = monarchBadgeBundle.albedoMap;

  // 6. Internal Layers 2 through 9: Lightweight MeshStandardMaterial with roughness: 0.9 for 60 FPS
  // Layer 2: Authentic warm cream/sand wool texture (#EADCC3)
  const woolAlbedoCanvas = document.createElement('canvas');
  woolAlbedoCanvas.width = 256;
  woolAlbedoCanvas.height = 256;
  const waCtx = woolAlbedoCanvas.getContext('2d');
  const woolHeightCanvas = document.createElement('canvas');
  woolHeightCanvas.width = 256;
  woolHeightCanvas.height = 256;
  const whCtx = woolHeightCanvas.getContext('2d');

  if (waCtx && whCtx) {
    waCtx.fillStyle = '#EADCC3';
    waCtx.fillRect(0, 0, 256, 256);
    whCtx.fillStyle = '#C4C4C4';
    whCtx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1600; i++) {
      const x = (i * 53 + (i % 13) * 7) % 256;
      const y = (i * 97 + (i % 17) * 11) % 256;
      const len = 6 + (i % 9);
      const angle = ((i * 37) % 360) * (Math.PI / 180);
      const cx = x + Math.cos(angle) * len * 0.5;
      const cy = y + Math.sin(angle) * len * 0.5;
      const ex = x + Math.cos(angle + 0.65) * len;
      const ey = y + Math.sin(angle + 0.65) * len;

      waCtx.strokeStyle =
        i % 3 === 0
          ? 'rgba(246, 238, 222, 0.45)'
          : i % 3 === 1
            ? 'rgba(218, 200, 170, 0.38)'
            : 'rgba(234, 220, 195, 0.4)';
      waCtx.lineWidth = 1.2 + (i % 3) * 0.4;
      waCtx.beginPath();
      waCtx.moveTo(x, y);
      waCtx.quadraticCurveTo(cx, cy, ex, ey);
      waCtx.stroke();

      whCtx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(95,95,95,0.4)';
      whCtx.lineWidth = 1.4;
      whCtx.beginPath();
      whCtx.moveTo(x, y);
      whCtx.quadraticCurveTo(cx, cy, ex, ey);
      whCtx.stroke();
    }
  }
  const woolAlbedoMap = new THREE.CanvasTexture(woolAlbedoCanvas);
  woolAlbedoMap.colorSpace = THREE.SRGBColorSpace;
  woolAlbedoMap.wrapS = THREE.RepeatWrapping;
  woolAlbedoMap.wrapT = THREE.RepeatWrapping;
  woolAlbedoMap.repeat.set(4, 4);
  woolAlbedoMap.anisotropy = maxAnisotropy;

  const woolMaps = generatePBRMapsFromHeightCanvas(
    woolHeightCanvas,
    2.6,
    0.9,
    0.12,
    4,
    4,
    maxAnisotropy,
  );
  disposables.push(woolAlbedoMap, woolMaps.normalMap, woolMaps.roughnessMap, woolMaps.aoMap);

  const matWool = new THREE.MeshStandardMaterial({
    name: 'mat_wool',
    map: woolAlbedoMap,
    color: new THREE.Color('#FFFFFF'),
    normalMap: woolMaps.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: woolMaps.roughnessMap,
    roughness: 0.9,
    aoMap: woolMaps.aoMap,
    aoMapIntensity: 0.35,
    metalness: 0.0,
  });
  materials.set('mat_wool', matWool);
  disposables.push(matWool);

  // Layer 3: Authentic flame-barrier felt (#E8D7B8)
  const feltAlbedoCanvas = document.createElement('canvas');
  feltAlbedoCanvas.width = 256;
  feltAlbedoCanvas.height = 256;
  const flaCtx = feltAlbedoCanvas.getContext('2d');
  const feltHeightCanvas = document.createElement('canvas');
  feltHeightCanvas.width = 256;
  feltHeightCanvas.height = 256;
  const flhCtx = feltHeightCanvas.getContext('2d');

  if (flaCtx && flhCtx) {
    flaCtx.fillStyle = '#E8D7B8';
    flaCtx.fillRect(0, 0, 256, 256);
    flhCtx.fillStyle = '#BEBEBE';
    flhCtx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2400; i++) {
      const x = (i * 41 + (i % 19) * 5) % 256;
      const y = (i * 73 + (i % 23) * 7) % 256;
      const len = 4 + (i % 6);
      const angle = ((i * 61) % 360) * (Math.PI / 180);
      const ex = x + Math.cos(angle) * len;
      const ey = y + Math.sin(angle) * len;

      flaCtx.strokeStyle =
        i % 2 === 0 ? 'rgba(244, 232, 208, 0.36)' : 'rgba(212, 192, 158, 0.38)';
      flaCtx.lineWidth = 1.0;
      flaCtx.beginPath();
      flaCtx.moveTo(x, y);
      flaCtx.lineTo(ex, ey);
      flaCtx.stroke();

      flhCtx.strokeStyle = i % 2 === 0 ? 'rgba(240,240,240,0.42)' : 'rgba(110,110,110,0.42)';
      flhCtx.lineWidth = 1.1;
      flhCtx.beginPath();
      flhCtx.moveTo(x, y);
      flhCtx.lineTo(ex, ey);
      flhCtx.stroke();
    }
  }
  const feltAlbedoMap = new THREE.CanvasTexture(feltAlbedoCanvas);
  feltAlbedoMap.colorSpace = THREE.SRGBColorSpace;
  feltAlbedoMap.wrapS = THREE.RepeatWrapping;
  feltAlbedoMap.wrapT = THREE.RepeatWrapping;
  feltAlbedoMap.repeat.set(5, 5);
  feltAlbedoMap.anisotropy = maxAnisotropy;

  const feltMaps = generatePBRMapsFromHeightCanvas(
    feltHeightCanvas,
    2.4,
    0.92,
    0.1,
    5,
    5,
    maxAnisotropy,
  );
  disposables.push(feltAlbedoMap, feltMaps.normalMap, feltMaps.roughnessMap, feltMaps.aoMap);

  const matFireFelt = new THREE.MeshStandardMaterial({
    name: 'mat_fire_felt',
    map: feltAlbedoMap,
    color: new THREE.Color('#FFFFFF'),
    normalMap: feltMaps.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: feltMaps.roughnessMap,
    roughness: 0.92,
    aoMap: feltMaps.aoMap,
    aoMapIntensity: 0.3,
    metalness: 0.0,
  });
  materials.set('mat_fire_felt', matFireFelt);
  disposables.push(matFireFelt);

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

  // Layer 5: Deep blue foam albedo (#4A5D84) with subtle cooling gel micro-speckles
  const gelFoamCanvas = document.createElement('canvas');
  gelFoamCanvas.width = 256;
  gelFoamCanvas.height = 256;
  const gfcCtx = gelFoamCanvas.getContext('2d');
  if (gfcCtx) {
    gfcCtx.fillStyle = '#4A5D84';
    gfcCtx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1800; i++) {
      const x = (i * 59 + (i % 17) * 13) % 256;
      const y = (i * 101 + (i % 19) * 7) % 256;
      const r = i % 5 === 0 ? 1.4 : 0.9;
      if (i % 4 === 0) {
        gfcCtx.fillStyle = 'rgba(176, 210, 245, 0.36)';
      } else if (i % 4 === 1) {
        gfcCtx.fillStyle = 'rgba(130, 168, 218, 0.30)';
      } else if (i % 4 === 2) {
        gfcCtx.fillStyle = 'rgba(46, 60, 90, 0.35)';
      } else {
        gfcCtx.fillStyle = 'rgba(92, 118, 166, 0.28)';
      }
      gfcCtx.beginPath();
      gfcCtx.arc(x, y, r, 0, Math.PI * 2);
      gfcCtx.fill();
    }
  }
  const gelFoamAlbedoMap = new THREE.CanvasTexture(gelFoamCanvas);
  gelFoamAlbedoMap.colorSpace = THREE.SRGBColorSpace;
  gelFoamAlbedoMap.wrapS = THREE.RepeatWrapping;
  gelFoamAlbedoMap.wrapT = THREE.RepeatWrapping;
  gelFoamAlbedoMap.repeat.set(4, 4);
  gelFoamAlbedoMap.anisotropy = maxAnisotropy;
  disposables.push(gelFoamAlbedoMap);

  const matDeepClimate = new THREE.MeshStandardMaterial({
    name: 'mat_deep_climate',
    map: gelFoamAlbedoMap,
    color: new THREE.Color('#FFFFFF'),
    normalMap: foamMaps.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: foamMaps.roughnessMap,
    roughness: 0.9,
    metalness: 0.0,
  });
  materials.set('mat_deep_climate', matDeepClimate);
  disposables.push(matDeepClimate);

  const matTransitionFoam = new THREE.MeshStandardMaterial({
    name: 'mat_transition_foam',
    map: null,
    color: new THREE.Color('#3E4F7D'),
    normalMap: foamMaps.normalMap,
    normalScale: new THREE.Vector2(0.38, 0.38),
    roughnessMap: foamMaps.roughnessMap,
    roughness: 0.9,
    metalness: 0.0,
  });
  materials.set('mat_transition_foam', matTransitionFoam);
  disposables.push(matTransitionFoam);

  // High-density white foam perimeter casing for Layer 8 pocket coils
  const matCoilPerimeterFoam = new THREE.MeshStandardMaterial({
    name: 'mat_coil_perimeter_foam',
    map: null,
    color: new THREE.Color('#F2F4F7'),
    normalMap: foamMaps.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughnessMap: foamMaps.roughnessMap,
    roughness: 0.88,
    metalness: 0.0,
  });
  materials.set('mat_coil_perimeter_foam', matCoilPerimeterFoam);
  disposables.push(matCoilPerimeterFoam);

  // Layer 1 Dark Charcoal Diagonal Woven Corner Strap Badge (`mat_corner_strap`)
  const cornerStrapTex = createCornerStrapBadgeTexture(maxAnisotropy);
  const strapWeaveCanvas = document.createElement('canvas');
  strapWeaveCanvas.width = 64;
  strapWeaveCanvas.height = 64;
  const swCtx = strapWeaveCanvas.getContext('2d');
  if (swCtx) {
    swCtx.fillStyle = '#B8B8B8';
    swCtx.fillRect(0, 0, 64, 64);
    swCtx.strokeStyle = '#6E6E6E';
    swCtx.lineWidth = 1.5;
    for (let i = -64; i < 128; i += 6) {
      swCtx.beginPath();
      swCtx.moveTo(i, 0);
      swCtx.lineTo(i + 64, 64);
      swCtx.stroke();
    }
  }
  const strapMaps = generatePBRMapsFromHeightCanvas(
    strapWeaveCanvas,
    2.2,
    0.84,
    0.12,
    8,
    3,
    maxAnisotropy,
  );
  disposables.push(cornerStrapTex, strapMaps.normalMap, strapMaps.roughnessMap, strapMaps.aoMap);

  const matCornerStrap = new THREE.MeshPhysicalMaterial({
    name: 'mat_corner_strap',
    map: cornerStrapTex,
    color: new THREE.Color('#FFFFFF'),
    normalMap: strapMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: strapMaps.roughnessMap,
    roughness: 0.88,
    aoMap: strapMaps.aoMap,
    aoMapIntensity: 0.45,
    metalness: 0.0,
    clearcoat: 0.0,
    sheen: 0.7,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#4B505C'),
    polygonOffset: true,
    polygonOffsetFactor: -2.0,
    polygonOffsetUnits: -2.0,
    depthWrite: true,
  });
  materials.set('mat_corner_strap', matCornerStrap);
  disposables.push(matCornerStrap);

  // 8. `mat_pocket_coils`: LOCKED to pure white spun-bond fabric (#F8F9FA), roughness: 0.9
  const coilHeightCanvas = document.createElement('canvas');
  coilHeightCanvas.width = 64;
  coilHeightCanvas.height = 128;
  const ch2Ctx = coilHeightCanvas.getContext('2d');
  if (ch2Ctx) {
    const turns = 7;
    const stepY = 128 / turns;
    for (let i = 0; i < turns; i++) {
      const y = i * stepY;
      const grad = ch2Ctx.createLinearGradient(0, y, 0, y + stepY);
      grad.addColorStop(0, '#505050');
      grad.addColorStop(0.22, '#DEDEDE');
      grad.addColorStop(0.5, '#FFFFFF');
      grad.addColorStop(0.78, '#DEDEDE');
      grad.addColorStop(1, '#505050');
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
      brandBadgeRoyal: matBrandBadge,
      brandBadgeLux: luxBadgeBundle.material,
      brandBadgeCloud: cloudBadgeBundle.material,
      brandBadgeMonarch: monarchBadgeBundle.material,
      sidewallRoyal: sideWallMaterial,
      sidewallLux: matSidewallLux,
      sidewallCloudFront: matSidewallCloudFront,
      sidewallCloudWrap: matSidewallCloudWrap,
      slotMap: materials,
    },
    textures: {
      cloudPuffNormal: quiltNormal,
      cloudPuffAO: quiltAO,
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
      badgeCloud,
      badgeLux,
    },
  };

  return {materials, loadedAssets, disposables};
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Authentic Puffy Cloud vector subpath extracted directly from `assets/logos/Puffy_Logo_0.svg`
// (wordmark omitted; cloud + signature wave tail only, bounds ~x:[82.04..148.43], y:[0..35.46]).
const PUFFY_CLOUD_SVG_PATH =
  'M141.98 32.23a25.5 25.5 0 0 1-7.2-2.36c-5.79-3.37-10.95-5.36-20.86-1.07-8.56 3.71-17.07 3.12-22.75-.64-3.14-2.07-4.63-4.82-4.97-7.6a7.65 7.65 0 0 1 2.04-6c3.77-4.33 10.32-2.28 10.32-2.28l.49-1.57c.08-.27 2.51-6.8 8.8-6.52 6.55.3 8.87 7.99 8.87 7.99s2.04-.86 4.62-.73c2.25.1 4.91 1 7 3.61 4.27 5.32 1 11.15 1 11.15s.19.17.73-.44a11.2 11.2 0 0 0 1.64-2.85A11.02 11.02 0 0 0 120.08 7.4l-.7.07C118.06 4.98 115.1.33 108.04.01c-6.62-.3-10.84 4.55-12.4 8-2.17-.42-6.45-.31-10.23 3.48a11.94 11.94 0 0 0-3.37 9.07c.18 4.4 2.49 8.21 6.84 11.1a23.65 23.65 0 0 0 12.81 3.8c4.38 0 9.06-.84 13.88-2.82 9.79-4 12.78-2.24 16.95-.34 3.28 1.5 6.27 2.22 9.1 1.92 3.87-.41 6.81-2.38 6.81-2.38s-2.8.82-6.45.39Z';

function applyAuthenticPuffyCloudTransform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1,
  rotation = 0,
): void {
  ctx.translate(cx, cy);
  if (rotation !== 0) {
    ctx.rotate(rotation);
  }
  ctx.scale(scale, scale);
  // Center of the authentic cloud bounds in SVG space (~x:115.2, y:17.7)
  ctx.translate(-115.2, -17.7);
}

function drawPuffyCloudEmblem(
  ctx: CanvasRenderingContext2D,
  strokeColor: string,
  lineWidth: number,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(0, 14, 42, Math.PI * 0.85, Math.PI * 1.9);
  ctx.arc(62, -6, 52, Math.PI * 1.08, Math.PI * 2.08);
  ctx.arc(118, 22, 34, Math.PI * 1.25, Math.PI * 0.38);
  ctx.quadraticCurveTo(72, 60, -34, 54);
  ctx.stroke();
  ctx.restore();
}

/**
 * Generates a dedicated 1024x512 embroidered patch material with its own matching
 * normal, roughness, and AO maps so LUX / CLOUD / MONARCH never exhibit ghosted "ROYAL" normals.
 */
function createModelBadgeMaterial(
  subLabel: 'LUX' | 'CLOUD' | 'MONARCH',
  maxAnisotropy: number,
): {
  material: THREE.MeshPhysicalMaterial;
  albedoMap: THREE.CanvasTexture;
  disposables: Array<{dispose(): void}>;
} {
  const w = 1024;
  const h = 512;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const ctx = albedoCanvas.getContext('2d');

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = w;
  heightCanvas.height = h;
  const hCtx = heightCanvas.getContext('2d');

  const spacedLabel = subLabel.split('').join('  ');
  const labelColor = subLabel === 'MONARCH' ? '#D4B46A' : '#FFFFFF';

  if (ctx && hCtx) {
    ctx.clearRect(0, 0, w, h);
    hCtx.clearRect(0, 0, w, h);

    // Outer dark charcoal twill patch with transparent rounded corners
    drawRoundedRectPath(ctx, 22, 22, w - 44, h - 44, 44);
    ctx.fillStyle = '#14161B';
    ctx.fill();

    // Subtle woven twill grain clipped to rounded patch
    ctx.save();
    drawRoundedRectPath(ctx, 22, 22, w - 44, h - 44, 44);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 2;
    for (let x = -h; x < w + h; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
    }
    ctx.restore();

    // Heightfield base for the patch
    hCtx.fillStyle = '#202020';
    hCtx.fillRect(0, 0, w, h);
    drawRoundedRectPath(hCtx, 22, 22, w - 44, h - 44, 44);
    hCtx.fillStyle = '#525252';
    hCtx.fill();

    // Subtle dark tonal stitched border (#252830 for LUX & CLOUD, muted dark stitch for MONARCH)
    const outerStitchColor = subLabel === 'MONARCH' ? '#2A2D36' : '#1F222A';
    const innerStitchColor = subLabel === 'MONARCH' ? '#363A45' : '#252830';
    drawRoundedRectPath(ctx, 42, 42, w - 84, h - 84, 30);
    ctx.strokeStyle = outerStitchColor;
    ctx.lineWidth = 8;
    ctx.stroke();

    drawRoundedRectPath(ctx, 42, 42, w - 84, h - 84, 30);
    ctx.strokeStyle = innerStitchColor;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    drawRoundedRectPath(hCtx, 42, 42, w - 84, h - 84, 30);
    hCtx.strokeStyle = '#7A7A7A';
    hCtx.lineWidth = 6;
    hCtx.setLineDash([12, 10]);
    hCtx.stroke();
    hCtx.setLineDash([]);

    // Crisp white "Puffy" wordmark + cloud emblem (symmetrically centered inside 1024px patch)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 148px "PT Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Puffy', 381, 254);

    hCtx.fillStyle = '#F2F2F2';
    hCtx.font = 'bold 148px "PT Serif", Georgia, serif';
    hCtx.textAlign = 'center';
    hCtx.textBaseline = 'alphabetic';
    hCtx.fillText('Puffy', 381, 254);

    drawPuffyCloudEmblem(ctx, '#FFFFFF', 14, 673, 196, 1.05);
    drawPuffyCloudEmblem(hCtx, '#F2F2F2', 14, 673, 196, 1.05);

    // Centered sub-label: clean white (#FFFFFF) for LUX & CLOUD, metallic gold for MONARCH
    ctx.fillStyle = labelColor;
    ctx.font = '600 72px "Mukta", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spacedLabel, 512, 386);

    hCtx.fillStyle = '#EAEAEA';
    hCtx.font = '600 72px "Mukta", sans-serif';
    hCtx.textAlign = 'center';
    hCtx.fillText(spacedLabel, 512, 386);
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.ClampToEdgeWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;
  albedoMap.anisotropy = maxAnisotropy;

  const pbrMaps = generatePBRMapsFromHeightCanvas(
    heightCanvas,
    2.2,
    0.78,
    0.26,
    1,
    1,
    maxAnisotropy,
  );
  for (const map of [pbrMaps.normalMap, pbrMaps.roughnessMap, pbrMaps.aoMap]) {
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
  }

  const material = new THREE.MeshPhysicalMaterial({
    name: `mat_brand_badge_${subLabel.toLowerCase()}`,
    color: new THREE.Color('#FFFFFF'),
    map: albedoMap,
    normalMap: pbrMaps.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: pbrMaps.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    aoMap: pbrMaps.aoMap,
    aoMapIntensity: 0.9,
    sheen: 1.0,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color('#FFFFFF'),
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    transparent: true,
    alphaTest: 0.5,
  });

  return {
    material,
    albedoMap,
    disposables: [
      albedoMap,
      pbrMaps.normalMap,
      pbrMaps.roughnessMap,
      pbrMaps.aoMap,
      material,
    ],
  };
}

/**
 * Generates Lux Hybrid's dedicated 512x1024 baseColor & sheenColor strips matching the exact
 * vertical stops of `/textures/sidewall/01_baseColor.png` with Espresso (#43332B) upper band
 * and Pure Matte Charcoal (#31343A) lower quilted diamond wall (zero navy tint).
 */
function createLuxSidewallMaps(maxAnisotropy: number): {
  baseColorMap: THREE.CanvasTexture;
  sheenColorMap: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 1024;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = w;
  baseCanvas.height = h;
  const bCtx = baseCanvas.getContext('2d');

  const sheenCanvas = document.createElement('canvas');
  sheenCanvas.width = w;
  sheenCanvas.height = h;
  const sCtx = sheenCanvas.getContext('2d');

  const y1 = Math.round(0.0508 * h);
  const y2 = Math.round(0.3008 * h);
  const y3 = Math.round(0.3506 * h);
  const y4 = Math.round(0.9502 * h);

  if (bCtx && sCtx) {
    // 0.0000 .. 0.0508: Top Neutral Grey Piping Cord
    bCtx.fillStyle = '#686C73';
    bCtx.fillRect(0, 0, w, y1);
    sCtx.fillStyle = '#82868E';
    sCtx.fillRect(0, 0, w, y1);

    // 0.0508 .. 0.3008: Espresso Chocolate Brown Upper Velvet Fluted Band
    bCtx.fillStyle = '#43332B';
    bCtx.fillRect(0, y1, w, y2 - y1);
    sCtx.fillStyle = '#6E5547';
    sCtx.fillRect(0, y1, w, y2 - y1);

    // 0.3008 .. 0.3506: Middle Neutral Grey Piping Cord
    bCtx.fillStyle = '#686C73';
    bCtx.fillRect(0, y2, w, y3 - y2);
    sCtx.fillStyle = '#82868E';
    sCtx.fillRect(0, y2, w, y3 - y2);

    // 0.3506 .. 0.9502: Pure Matte Charcoal Grey Lower Quilted Diamond Mesh (zero navy tint)
    bCtx.fillStyle = '#31343A';
    bCtx.fillRect(0, y3, w, y4 - y3);
    sCtx.fillStyle = '#484B52';
    sCtx.fillRect(0, y3, w, y4 - y3);

    // 0.9502 .. 1.0000: Bottom Neutral Grey Piping Cord
    bCtx.fillStyle = '#686C73';
    bCtx.fillRect(0, y4, w, h - y4);
    sCtx.fillStyle = '#82868E';
    sCtx.fillRect(0, y4, w, h - y4);
  }

  const configureStrip = (canvasEl: HTMLCanvasElement): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvasEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(10, 1);
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  return {
    baseColorMap: configureStrip(baseCanvas),
    sheenColorMap: configureStrip(sheenCanvas),
  };
}

/**
 * Generates Cloud 10" Front Foot Panel (`256x512`): full-height Pure Matte Charcoal Grey (#31343A)
 * diamond quilt with White Piping Seams (#F2F2F0) at top (0..0.055) and bottom (0.945..1.00).
 */
function createCloudFrontSidewallMaps(maxAnisotropy: number): {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 512;
  const topPipingEnd = Math.round(0.055 * h);
  const botPipingStart = Math.round(0.945 * h);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const aCtx = albedoCanvas.getContext('2d');

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = w;
  heightCanvas.height = h;
  const hCtx = heightCanvas.getContext('2d');

  if (aCtx && hCtx) {
    // Full-height Pure Matte Charcoal Grey (#31343A) diamond quilt body
    aCtx.fillStyle = '#31343A';
    aCtx.fillRect(0, 0, w, h);
    hCtx.fillStyle = '#E8E8E8';
    hCtx.fillRect(0, 0, w, h);

    // Tileable quilted diamond grid across [topPipingEnd .. botPipingStart]
    const bodyTop = topPipingEnd;
    const bodyH = botPipingStart - bodyTop;
    const cellW = 128; // 2 exact seamless cycles per 256px width
    const rows = 4;
    const cellH = bodyH / rows;

    aCtx.save();
    aCtx.beginPath();
    aCtx.rect(0, bodyTop, w, bodyH);
    aCtx.clip();

    hCtx.save();
    hCtx.beginPath();
    hCtx.rect(0, bodyTop, w, bodyH);
    hCtx.clip();

    const drawDiamondLines = (
      ctx2d: CanvasRenderingContext2D,
      strokeStyle: string,
      lineWidth: number,
    ) => {
      ctx2d.strokeStyle = strokeStyle;
      ctx2d.lineWidth = lineWidth;
      for (let r = 0; r < rows; r++) {
        const y0 = bodyTop + r * cellH;
        const y1 = y0 + cellH;
        for (let col = -1; col <= 2; col++) {
          const x0 = col * cellW;
          const x1 = x0 + cellW;
          ctx2d.beginPath();
          ctx2d.moveTo(x0, y0);
          ctx2d.lineTo(x1, y1);
          ctx2d.moveTo(x1, y0);
          ctx2d.lineTo(x0, y1);
          ctx2d.stroke();
        }
      }
    };

    // Soft cushion bevel + deep stitch grooves
    drawDiamondLines(hCtx, '#848484', 12);
    drawDiamondLines(hCtx, '#242424', 4.5);
    drawDiamondLines(aCtx, '#25282D', 3.5);

    aCtx.restore();
    hCtx.restore();

    // Top & Bottom White Braided Piping Seams (#F2F2F0)
    const drawPipingBand = (yStart: number, bandH: number) => {
      aCtx.fillStyle = '#F2F2F0';
      aCtx.fillRect(0, yStart, w, bandH);
      aCtx.strokeStyle = '#DFDFDC';
      aCtx.lineWidth = 2.5;
      for (let x = -bandH; x < w + bandH; x += 12) {
        aCtx.beginPath();
        aCtx.moveTo(x, yStart);
        aCtx.lineTo(x + bandH, yStart + bandH);
        aCtx.stroke();
      }

      const grad = hCtx.createLinearGradient(0, yStart, 0, yStart + bandH);
      grad.addColorStop(0, '#585858');
      grad.addColorStop(0.5, '#FFFFFF');
      grad.addColorStop(1, '#585858');
      hCtx.fillStyle = grad;
      hCtx.fillRect(0, yStart, w, bandH);
      hCtx.strokeStyle = '#8E8E8E';
      hCtx.lineWidth = 2.2;
      for (let x = -bandH; x < w + bandH; x += 12) {
        hCtx.beginPath();
        hCtx.moveTo(x, yStart);
        hCtx.lineTo(x + bandH, yStart + bandH);
        hCtx.stroke();
      }
    };

    drawPipingBand(0, topPipingEnd);
    drawPipingBand(botPipingStart, h - botPipingStart);
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;
  albedoMap.repeat.set(10, 1);
  albedoMap.anisotropy = maxAnisotropy;

  const pbrMaps = generatePBRMapsFromHeightCanvas(
    heightCanvas,
    3.4,
    0.85,
    0.16,
    10,
    1,
    maxAnisotropy,
  );
  for (const map of [pbrMaps.normalMap, pbrMaps.roughnessMap, pbrMaps.aoMap]) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
  }

  return {
    albedoMap,
    normalMap: pbrMaps.normalMap,
    roughnessMap: pbrMaps.roughnessMap,
    aoMap: pbrMaps.aoMap,
  };
}

/**
 * Generates Cloud 10" 3-Side White Cloud Knit Wrap (`1024x512`):
 * Tone-on-tone Jacquard knit base (#F6F6F4) featuring 5 embossed vertically-oriented
 * Puffy cloud motifs spaced along the lateral side flanks with crisp white top/bottom piping seams (#FFFFFF).
 * Shader style: Tone-on-tone white-on-white with normal map & AO cavity depth.
 */
function createCloudWrapSidewallMaps(maxAnisotropy: number): {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
} {
  const w = 1024;
  const h = 512;
  const topPipingEnd = Math.round(0.06 * h); // ~31px
  const botPipingStart = Math.round(0.94 * h); // ~481px

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const aCtx = albedoCanvas.getContext('2d');

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = w;
  heightCanvas.height = h;
  const hCtx = heightCanvas.getContext('2d');

  if (aCtx && hCtx) {
    // 1. Off-white Jacquard knit base (#F6F6F4)
    aCtx.fillStyle = '#F6F6F4';
    aCtx.fillRect(0, 0, w, h);
    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, w, h);

    // Fine tactile vertical knit ribs across the off-white body
    const ribStep = 16;
    for (let x = 0; x < w; x += ribStep) {
      aCtx.fillStyle = 'rgba(235, 235, 231, 0.45)';
      aCtx.fillRect(x, topPipingEnd, 3, botPipingStart - topPipingEnd);

      const hGrad = hCtx.createLinearGradient(x, 0, x + ribStep, 0);
      hGrad.addColorStop(0, '#797979');
      hGrad.addColorStop(0.5, '#878787');
      hGrad.addColorStop(1, '#797979');
      hCtx.fillStyle = hGrad;
      hCtx.fillRect(x, topPipingEnd, ribStep, botPipingStart - topPipingEnd);
    }

    // 2. Stamp Authentic Puffy Cloud Asset (`assets/logos/Puffy_Logo_0.svg` cloud path)
    // Vertically oriented (-90deg), centered at cx = 512, cy = 256
    const cx = w * 0.5;
    const cy = h * 0.5;
    const cloudScale = 4.1;
    const cloudRotation = -Math.PI * 0.5;
    const cloudPath = new Path2D(PUFFY_CLOUD_SVG_PATH);

    // --- Heightfield Embossing (Soft Jacquard knit relief + subtle cavity depth) ---
    // A. Soft outer pillowed bevel
    hCtx.save();
    applyAuthenticPuffyCloudTransform(hCtx, cx, cy, cloudScale, cloudRotation);
    hCtx.fillStyle = '#9C9C9C';
    hCtx.fill(cloudPath);
    hCtx.strokeStyle = '#505050';
    hCtx.lineWidth = 2.8;
    hCtx.lineJoin = 'round';
    hCtx.stroke(cloudPath);
    // B. Raised Jacquard knit stroke highlight along the authentic cloud ribbon
    hCtx.fillStyle = '#AEAEAE';
    hCtx.fill(cloudPath);
    hCtx.strokeStyle = '#383838';
    hCtx.lineWidth = 1.2;
    hCtx.stroke(cloudPath);
    hCtx.restore();

    // --- Albedo Shading (Tone-on-tone off-white #F8FAFC Jacquard fabric relief) ---
    // A. Subtle bright off-white relief (#F8FAFC)
    aCtx.save();
    applyAuthenticPuffyCloudTransform(aCtx, cx, cy, cloudScale, cloudRotation);
    aCtx.fillStyle = '#F8FAFC';
    aCtx.fill(cloudPath);
    // B. Soft tone-on-tone cavity outline
    aCtx.strokeStyle = 'rgba(214, 218, 224, 0.72)';
    aCtx.lineWidth = 1.1;
    aCtx.lineJoin = 'round';
    aCtx.stroke(cloudPath);
    aCtx.restore();

    // C. Subtle inner highlight catching ambient light
    aCtx.save();
    applyAuthenticPuffyCloudTransform(aCtx, cx, cy, cloudScale * 0.96, cloudRotation);
    aCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    aCtx.lineWidth = 0.6;
    aCtx.lineJoin = 'round';
    aCtx.stroke(cloudPath);
    aCtx.restore();

    // 3. Top & Bottom Crisp White Piping Seams (#FFFFFF)
    const drawWhitePiping = (yStart: number, bandH: number) => {
      aCtx.fillStyle = '#FFFFFF';
      aCtx.fillRect(0, yStart, w, bandH);
      aCtx.strokeStyle = '#E8E8E5';
      aCtx.lineWidth = 2;
      aCtx.strokeRect(0, yStart, w, bandH);

      const grad = hCtx.createLinearGradient(0, yStart, 0, yStart + bandH);
      grad.addColorStop(0, '#5E5E5E');
      grad.addColorStop(0.5, '#FFFFFF');
      grad.addColorStop(1, '#5E5E5E');
      hCtx.fillStyle = grad;
      hCtx.fillRect(0, yStart, w, bandH);
    };

    drawWhitePiping(0, topPipingEnd);
    drawWhitePiping(botPipingStart, h - botPipingStart);
  }

  // 19 tile cycles around the 9.314m perimeter (5 cycles along each 2.45m flank)
  const uvCyclesPerPerimeter = 4.4;
  const targetPerimeterTiles = 19;
  const repeatX = targetPerimeterTiles / uvCyclesPerPerimeter; // ~4.31818

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;
  albedoMap.repeat.set(repeatX, 1);
  albedoMap.offset.set(0.5, 0); // Centers the 5 clouds with 24.5cm equal margins at front & back
  albedoMap.anisotropy = maxAnisotropy;

  const pbrMaps = generatePBRMapsFromHeightCanvas(
    heightCanvas,
    2.0, // Normal strength for crisp Jacquard depth
    0.9, // Base roughness (fabric matte)
    0.1,
    repeatX,
    1,
    maxAnisotropy,
  );
  for (const map of [pbrMaps.normalMap, pbrMaps.roughnessMap, pbrMaps.aoMap]) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.offset.set(0.5, 0);
  }

  return {
    albedoMap,
    normalMap: pbrMaps.normalMap,
    roughnessMap: pbrMaps.roughnessMap,
    aoMap: pbrMaps.aoMap,
  };
}

function createCornerStrapBadgeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich dark charcoal woven fabric base
    ctx.fillStyle = '#22252B';
    ctx.fillRect(0, 0, 512, 160);

    // Subtle diagonal twill weave lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 2;
    for (let x = -160; x < 672; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 160, 160);
      ctx.stroke();
    }

    // Stitched top and bottom strap borders
    ctx.strokeStyle = '#3C404A';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(512, 14);
    ctx.moveTo(0, 146);
    ctx.lineTo(512, 146);
    ctx.stroke();
    ctx.setLineDash([]);

    // "Puffy" wordmark
    ctx.fillStyle = '#F3F5F8';
    ctx.font = 'bold 46px "PT Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Puffy', 228, 76);

    // Signature cloud icon beside Puffy
    ctx.strokeStyle = '#F3F5F8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(308, 62, 11, Math.PI * 0.8, Math.PI * 1.9);
    ctx.arc(324, 57, 13, Math.PI * 1.1, Math.PI * 2.1);
    ctx.arc(338, 64, 9, Math.PI * 1.3, Math.PI * 0.4);
    ctx.lineTo(298, 73);
    ctx.stroke();

    // Subtle 4 micro-icons row underneath (matching reference corner ribbon)
    ctx.strokeStyle = '#C9CED8';
    ctx.fillStyle = '#C9CED8';
    ctx.lineWidth = 2;
    const iconXs = [184, 232, 280, 328];
    for (let idx = 0; idx < iconXs.length; idx++) {
      const ix = iconXs[idx];
      const iy = 114;
      ctx.beginPath();
      ctx.arc(ix, iy, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(ix - 2, iy - 2, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
