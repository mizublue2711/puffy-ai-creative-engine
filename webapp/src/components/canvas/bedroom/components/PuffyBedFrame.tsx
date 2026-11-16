import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedFrameVariantId,
} from '../BedroomRegistry.ts';

export interface PuffyBedFrameOptions {
  variant?: BedFrameVariantId;
  width?: number;
  length?: number;
  rimHeight?: number;
  slatHeight?: number;
  ledgeWidth?: number;
  mattressClearance?: number;
  legHeight?: number;
  legRadius?: number;
}

export interface BedroomAssetInstance {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  dispose: () => void;
}

const ALL_FRAME_IDS: Array<'puffy-kyoto-frame' | 'puffy-milan-frame' | 'puffy-solace-frame'> = [
  'puffy-kyoto-frame',
  'puffy-milan-frame',
  'puffy-solace-frame',
];

export function unregisterAllPuffyBedFrames(): void {
  for (const id of ALL_FRAME_IDS) {
    disposeComponent(id);
  }
}

export function getBedFrameOuterDimensions(
  variant: BedFrameVariantId,
  mattressW: number,
  mattressL: number,
): { outerW: number; outerL: number; clearance: number; railWidth: number } {
  if (variant === 'kyoto') {
    const clearance = 0.015;
    const railWidth = 0.14;
    return {
      outerW: mattressW + (clearance + railWidth) * 2,
      outerL: mattressL + clearance + railWidth,
      clearance,
      railWidth,
    };
  }
  if (variant === 'milan') {
    const clearance = 0.012;
    const railWidth = 0.085;
    return {
      outerW: mattressW + (clearance + railWidth) * 2,
      outerL: mattressL + clearance + railWidth,
      clearance,
      railWidth,
    };
  }
  // solace
  const clearance = 0.012;
  const railWidth = 0.105;
  return {
    outerW: mattressW + (clearance + railWidth) * 2,
    outerL: mattressL + clearance + railWidth,
    clearance,
    railWidth,
  };
}

export function createWovenFabricNormalMap(repeatX = 12, repeatY = 12): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const warp = Math.sin(x * 0.95) * 0.48;
        const weft = Math.sin(y * 0.95) * 0.48;
        const slub = (((x * 41 + y * 23) % 13) / 13 - 0.5) * 0.28;
        const nx = THREE.MathUtils.clamp(0.5 + (warp + slub) * 0.18, 0, 1);
        const ny = THREE.MathUtils.clamp(0.5 + (weft + slub) * 0.18, 0, 1);
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
        data[idx + 2] = 240;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

/**
 * Procedural Natural Ash / Warm Light Oak PBR textures for Puffy Kyoto timber elements.
 */
export function createNaturalAshWoodTextures(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');

  if (colorCtx && roughCtx && bumpCtx) {
    const cImg = colorCtx.createImageData(size, size);
    const rImg = roughCtx.createImageData(size, size);
    const bImg = bumpCtx.createImageData(size, size);
    const cData = cImg.data;
    const rData = rImg.data;
    const bData = bImg.data;

    // 4 horizontal ash wood planks per tile
    const plankH = 128;
    for (let y = 0; y < size; y++) {
      const plankIdx = Math.floor(y / plankH);
      const localY = y % plankH;
      const seamDist = Math.min(localY, plankH - 1 - localY);
      const seamShade = seamDist <= 1 ? 0.90 : 1.0;

      for (let x = 0; x < size; x++) {
        const wave = Math.sin(x * 0.022 + plankIdx * 2.1) * 5.5;
        const cathedral = Math.sin((y + wave) * 0.28 + plankIdx * 1.3);
        const fineFiber = Math.sin((y + wave * 0.5) * 1.45 + x * 0.04) * 0.35;
        const pore = (((x * 31 + y * 19 + plankIdx * 73) % 17) / 17 - 0.5) * 0.16;
        const grain = cathedral * 0.55 + fineFiber + pore;

        // Subtle plank-to-plank warm ash variation
        const plankTone = ((plankIdx * 37) % 5) - 2;
        const lum = THREE.MathUtils.clamp((0.94 + plankTone * 0.018 + grain * 0.045) * seamShade, 0.72, 1.0);

        // Warm natural ash tint (#D9BC98 base multiplied by material color)
        const r = Math.round(lum * 248);
        const g = Math.round(lum * 238);
        const b = Math.round(lum * 224);

        const idx = (y * size + x) * 4;
        cData[idx] = r;
        cData[idx + 1] = g;
        cData[idx + 2] = b;
        cData[idx + 3] = 255;

        const roughVal = THREE.MathUtils.clamp(0.68 - grain * 0.06 + (seamDist <= 1 ? 0.12 : 0), 0.52, 0.88);
        const rByte = Math.round(roughVal * 255);
        rData[idx] = rByte;
        rData[idx + 1] = rByte;
        rData[idx + 2] = rByte;
        rData[idx + 3] = 255;

        const bByte = Math.round(THREE.MathUtils.clamp(0.5 + grain * 0.25, 0, 1) * 255);
        bData[idx] = bByte;
        bData[idx + 1] = bByte;
        bData[idx + 2] = bByte;
        bData[idx + 3] = 255;
      }
    }

    colorCtx.putImageData(cImg, 0, 0);
    roughCtx.putImageData(rImg, 0, 0);
    bumpCtx.putImageData(bImg, 0, 0);
  }

  const configureTex = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.85, 0.85);
    tex.anisotropy = 4;
    return tex;
  };

  return {
    map: configureTex(colorCanvas, true),
    roughnessMap: configureTex(roughCanvas, false),
    bumpMap: configureTex(bumpCanvas, false),
  };
}

export function createNaturalAshMaterial(): THREE.MeshStandardMaterial {
  const { map, roughnessMap, bumpMap } = createNaturalAshWoodTextures();
  return new THREE.MeshStandardMaterial({
    color: '#D5B895',
    map,
    roughnessMap,
    bumpMap,
    bumpScale: 0.0022,
    roughness: 0.70,
    metalness: 0.0,
  });
}

/**
 * LEGO Component 1A: Modular Puffy Bed Frame (`kyoto` | `milan` | `solace`)
 * - kyoto: Natural Ash low-profile platform with wide filleted overhanging ledge & cylindrical legs
 * - milan: Dark charcoal/slate tailored upholstered frame hugging the Royal mattress contour
 * - solace: Warm oatmeal bouclé upholstered frame with sculpted soft edges & center foot-rail seam
 */
export function createPuffyBedFrame(options: PuffyBedFrameOptions = {}): BedroomAssetInstance {
  const variant: BedFrameVariantId = options.variant ?? 'kyoto';
  const width = options.width ?? 1.60;
  const length = options.length ?? 2.10;
  const rimHeight = options.rimHeight ?? 0.28;
  const slatSurfaceY = options.slatHeight ?? 0.24;
  const legRadius = options.legRadius ?? 0.042;
  const legFloorY = 0.005;

  const { outerW, outerL, clearance: mattressClearance, railWidth: defaultRailW } =
    getBedFrameOuterDimensions(variant, width, length);
  const ledgeWidth = options.ledgeWidth ?? defaultRailW;

  const registryId: 'puffy-kyoto-frame' | 'puffy-milan-frame' | 'puffy-solace-frame' =
    variant === 'milan'
      ? 'puffy-milan-frame'
      : variant === 'solace'
        ? 'puffy-solace-frame'
        : 'puffy-kyoto-frame';

  const group = new THREE.Group();
  group.name = `PuffyBedFrame_${variant}`;

  const slatWoodMat = new THREE.MeshStandardMaterial({
    color: '#C2A37E',
    roughness: 0.72,
    metalness: 0.0,
  });

  const meshes: THREE.Mesh[] = [];
  const innerW = width + mattressClearance * 2;
  const zHead = -(length / 2 + mattressClearance);
  const zInnerFoot = length / 2 + mattressClearance;
  const zOuterFoot = zInnerFoot + ledgeWidth;

  if (variant === 'kyoto') {
    const ashWoodMat = createNaturalAshMaterial();

    // 1. Wide Filleted Overhanging Platform Ledge (Extruded U-shape with rounded front corners)
    const yHead = -zHead;
    const yInnerFoot = -zInnerFoot;
    const yOuterFoot = -zOuterFoot;
    const cornerR = 0.085;

    const ledgeShape = new THREE.Shape();
    ledgeShape.moveTo(-outerW / 2, yHead);
    ledgeShape.lineTo(-outerW / 2, yOuterFoot + cornerR);
    ledgeShape.quadraticCurveTo(-outerW / 2, yOuterFoot, -outerW / 2 + cornerR, yOuterFoot);
    ledgeShape.lineTo(outerW / 2 - cornerR, yOuterFoot);
    ledgeShape.quadraticCurveTo(outerW / 2, yOuterFoot, outerW / 2, yOuterFoot + cornerR);
    ledgeShape.lineTo(outerW / 2, yHead);
    ledgeShape.lineTo(innerW / 2, yHead);
    ledgeShape.lineTo(innerW / 2, yInnerFoot);
    ledgeShape.lineTo(-innerW / 2, yInnerFoot);
    ledgeShape.lineTo(-innerW / 2, yHead);
    ledgeShape.closePath();

    const bevelSize = 0.011;
    const ledgeCoreDepth = 0.026;
    const ledgeGeo = new THREE.ExtrudeGeometry(ledgeShape, {
      depth: ledgeCoreDepth,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 16,
    });
    ledgeGeo.rotateX(-Math.PI / 2);

    const ledgeMesh = new THREE.Mesh(ledgeGeo, ashWoodMat);
    ledgeMesh.position.set(0, rimHeight - (ledgeCoreDepth + bevelSize), 0);
    ledgeMesh.castShadow = true;
    ledgeMesh.receiveShadow = true;
    group.add(ledgeMesh);
    meshes.push(ledgeMesh);

    // 2. Recessed Apron Rails
    const ledgeBottomY = rimHeight - (ledgeCoreDepth + bevelSize * 2);
    const apronBottomY = 0.060;
    const apronHeight = Math.max(0.10, ledgeBottomY - apronBottomY + 0.008);
    const apronCenterY = apronBottomY + apronHeight / 2;
    const apronInset = 0.038;
    const apronThick = 0.036;

    const apronOuterHalfW = outerW / 2 - apronInset;
    const apronOuterFootZ = zOuterFoot - apronInset;
    const sideApronLen = apronOuterFootZ - zHead - legRadius * 0.6;
    const sideApronCenterZ = zHead + sideApronLen / 2;

    const sideApronGeo = new RoundedBoxGeometry(apronThick, apronHeight, sideApronLen, 2, 0.005);
    const leftApron = new THREE.Mesh(sideApronGeo, ashWoodMat);
    leftApron.position.set(-(apronOuterHalfW - apronThick / 2), apronCenterY, sideApronCenterZ);
    leftApron.castShadow = true;
    leftApron.receiveShadow = true;

    const rightApron = new THREE.Mesh(sideApronGeo, ashWoodMat);
    rightApron.position.set(apronOuterHalfW - apronThick / 2, apronCenterY, sideApronCenterZ);
    rightApron.castShadow = true;
    rightApron.receiveShadow = true;

    const footApronWidth = (apronOuterHalfW - legRadius * 0.6) * 2;
    const footApronGeo = new RoundedBoxGeometry(footApronWidth, apronHeight, apronThick, 2, 0.005);
    const footApron = new THREE.Mesh(footApronGeo, ashWoodMat);
    footApron.position.set(0, apronCenterY, apronOuterFootZ - apronThick / 2);
    footApron.castShadow = true;
    footApron.receiveShadow = true;

    group.add(leftApron, rightApron, footApron);
    meshes.push(leftApron, rightApron, footApron);

    // 3. Signature Cylindrical Solid Ash Corner Legs
    const legTopY = ledgeBottomY + 0.006;
    const actualLegHeight = legTopY - legFloorY;
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius * 0.94, actualLegHeight, 24);
    const frontLegX = apronOuterHalfW - legRadius * 0.45;
    const frontLegZ = apronOuterFootZ - legRadius * 0.45;
    const rearLegZ = zHead + 0.08;

    const legPositions: Array<[number, number]> = [
      [-frontLegX, frontLegZ],
      [frontLegX, frontLegZ],
      [-frontLegX, rearLegZ],
      [frontLegX, rearLegZ],
    ];

    for (const [lx, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, ashWoodMat);
      leg.position.set(lx, legFloorY + actualLegHeight / 2, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
      meshes.push(leg);
    }
  } else {
    // Upholstered Perimeter Frame: Milan (Dark Charcoal) or Solace (Warm Oatmeal Bouclé)
    const isMilan = variant === 'milan';
    const fabricNormal = createWovenFabricNormalMap(10, 10);
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: isMilan ? '#282B32' : '#DFD5C5',
      roughness: isMilan ? 0.88 : 0.90,
      metalness: 0.0,
      sheen: isMilan ? 0.35 : 0.42,
      sheenColor: new THREE.Color(isMilan ? '#4E5462' : '#F4EDE1'),
      sheenRoughness: 0.72,
      normalMap: fabricNormal,
      normalScale: new THREE.Vector2(isMilan ? 0.25 : 0.45, isMilan ? 0.25 : 0.45),
    });

    const railBottomY = isMilan ? 0.015 : 0.028;
    const railH = rimHeight - railBottomY;
    const railCenterY = railBottomY + railH / 2;
    const railRadius = isMilan ? 0.022 : 0.032;

    const sideRailLen = zOuterFoot - zHead;
    const sideRailCenterZ = zHead + sideRailLen / 2;
    const sideRailGeo = new RoundedBoxGeometry(ledgeWidth, railH, sideRailLen, 4, railRadius);

    const leftRail = new THREE.Mesh(sideRailGeo, frameMat);
    leftRail.position.set(-(innerW / 2 + ledgeWidth / 2), railCenterY, sideRailCenterZ);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;

    const rightRail = new THREE.Mesh(sideRailGeo, frameMat);
    rightRail.position.set(innerW / 2 + ledgeWidth / 2, railCenterY, sideRailCenterZ);
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;

    group.add(leftRail, rightRail);
    meshes.push(leftRail, rightRail);

    if (isMilan) {
      const footRailGeo = new RoundedBoxGeometry(outerW, railH, ledgeWidth, 4, railRadius);
      const footRail = new THREE.Mesh(footRailGeo, frameMat);
      footRail.position.set(0, railCenterY, zInnerFoot + ledgeWidth / 2);
      footRail.castShadow = true;
      footRail.receiveShadow = true;
      group.add(footRail);
      meshes.push(footRail);
    } else {
      // Solace: Split foot rail with subtle center French seam
      const halfFootW = outerW / 2 - 0.002;
      const halfFootGeo = new RoundedBoxGeometry(halfFootW, railH, ledgeWidth, 4, railRadius);
      const footLeft = new THREE.Mesh(halfFootGeo, frameMat);
      footLeft.position.set(-(halfFootW / 2 + 0.002), railCenterY, zInnerFoot + ledgeWidth / 2);
      footLeft.castShadow = true;
      footLeft.receiveShadow = true;

      const footRight = new THREE.Mesh(halfFootGeo, frameMat);
      footRight.position.set(halfFootW / 2 + 0.002, railCenterY, zInnerFoot + ledgeWidth / 2);
      footRight.castShadow = true;
      footRight.receiveShadow = true;

      group.add(footLeft, footRight);
      meshes.push(footLeft, footRight);
    }

    // Low-profile dark glides/micro-feet contacting rug at y = 0.005m
    const microFootMat = new THREE.MeshStandardMaterial({
      color: '#1C1B1A',
      roughness: 0.6,
      metalness: 0.1,
    });
    const microFootH = railBottomY - legFloorY + 0.004;
    const microFootGeo = new THREE.CylinderGeometry(0.022, 0.018, microFootH, 16);
    const footX = outerW / 2 - 0.08;
    const footZFront = zOuterFoot - 0.08;
    const footZBack = zHead + 0.08;
    for (const [fx, fz] of [
      [-footX, footZFront],
      [footX, footZFront],
      [-footX, footZBack],
      [footX, footZBack],
    ]) {
      const foot = new THREE.Mesh(microFootGeo, microFootMat);
      foot.position.set(fx, legFloorY + microFootH / 2, fz);
      foot.castShadow = true;
      foot.receiveShadow = true;
      group.add(foot);
      meshes.push(foot);
    }
  }

  // Center support feet under the slat deck for structural grounding
  const centerFootHeight = slatSurfaceY - 0.04 - legFloorY;
  const centerFootGeo = new THREE.CylinderGeometry(0.026, 0.024, centerFootHeight, 16);
  for (const cz of [-length * 0.22, length * 0.22]) {
    const foot = new THREE.Mesh(centerFootGeo, slatWoodMat);
    foot.position.set(0, legFloorY + centerFootHeight / 2, cz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
    meshes.push(foot);
  }

  // 4. Recessed Platform Deck & Slats at y = 0.24m (recessDepth = 0.04m below rimHeight = 0.28m)
  const deckThickness = 0.024;
  const subDeckGeo = new THREE.BoxGeometry(innerW - 0.01, deckThickness, length);
  const subDeckMesh = new THREE.Mesh(subDeckGeo, slatWoodMat);
  subDeckMesh.position.set(0, slatSurfaceY - deckThickness / 2 - 0.014, 0);
  subDeckMesh.receiveShadow = true;
  group.add(subDeckMesh);
  meshes.push(subDeckMesh);

  const slatCount = 12;
  const slatThick = 0.014;
  const slatDepth = 0.095;
  const slatGeo = new THREE.BoxGeometry(innerW - 0.02, slatThick, slatDepth);
  const slatSpan = length - 0.16;
  for (let i = 0; i < slatCount; i++) {
    const t = slatCount > 1 ? i / (slatCount - 1) : 0.5;
    const sz = -slatSpan / 2 + t * slatSpan;
    const slat = new THREE.Mesh(slatGeo, slatWoodMat);
    slat.position.set(0, slatSurfaceY - slatThick / 2, sz);
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
    meshes.push(slat);
  }

  unregisterAllPuffyBedFrames();
  registerBedroomComponent({
    id: registryId,
    name:
      variant === 'milan'
        ? 'Puffy Milan Upholstered Frame'
        : variant === 'solace'
          ? 'Puffy Solace Sculpted Frame'
          : 'Puffy Kyoto Platform Frame',
    category: 'furniture',
    dimensions: { width: outerW, height: rimHeight - legFloorY, depth: outerL },
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots:
      variant === 'kyoto'
        ? ['natural-ash-timber', 'slat-wood']
        : variant === 'milan'
          ? ['charcoal-tailored-upholstery', 'slat-wood']
          : ['oatmeal-boucle-upholstery', 'slat-wood'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent(registryId),
  };
}

export function PuffyBedFrame({
  scene,
  ...options
}: PuffyBedFrameOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPuffyBedFrame(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.variant, options.width, options.length, options.rimHeight, options.slatHeight]);

  return null;
}

