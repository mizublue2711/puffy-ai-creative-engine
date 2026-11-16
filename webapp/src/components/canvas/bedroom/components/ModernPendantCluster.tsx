import { useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

// ============================================================================
// II. NON-PLASTIC PBR MATERIAL SPECIFICATIONS (EXPORTED AS DEFINED)
// ============================================================================

/**
 * 1. Natural Architectural Wood (Satin Natural Oak / Walnut)
 * High roughness, zero metalness, micro-roughness variation to prevent plastic sheen.
 */
export const pendantWoodMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#9B7348'), // Warm Natural Honey Oak / American Walnut tone
  roughness: 0.52,                   // Satin soft touch, not glossy plastic
  metalness: 0.0,
  roughnessMap: null,                // Accepts micro-wood noise
});

/**
 * 2. Brushed Brass Hardware Accent (End-caps, Sleeves & Couplers)
 */
export const pendantBrassMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#C5A059'),
  metalness: 0.88,
  roughness: 0.28,
});

/**
 * 3. Frosted Opal Glass Diffusers (The Glowing Spheres)
 * Soft translucent milky appearance, decorative ambient warmth
 */
export const frostedGlassOrbMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#FFFDF9'),
  roughness: 0.18,
  metalness: 0.0,
  transmission: 0.72,                // Translucent depth
  thickness: 0.04,                   // Light refracts through thin glass wall
  ior: 1.46,
  emissive: new THREE.Color('#FFE8CC'),
  emissiveIntensity: 0.45,           // Soft glow without overexposing the scene
  transparent: true,
  opacity: 0.95,
});

/**
 * Architectural Frosted White Acrylic Slat Material
 */
export const pendantWhiteAcrylicMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#FAF8F5'),
  roughness: 0.24,
  metalness: 0.0,
  transmission: 0.35,
  thickness: 0.035,
  ior: 1.49,
  clearcoat: 0.25,
  clearcoatRoughness: 0.2,
});

/**
 * Matte Black Anodized Aluminum for Canopy Plate & Grippers
 */
export const pendantCanopyMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#1A1A1A'),
  roughness: 0.54,
  metalness: 0.78,
});

/**
 * Braided Suspension Cable Wire Material
 */
export const pendantCableMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#1E1E1E'),
  roughness: 0.65,
  metalness: 0.15,
});

// ============================================================================
// PROCEDURAL PBR DETAIL GENERATORS
// ============================================================================

function createWoodMicroNoiseTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Fine longitudinal timber grain variation along y
        const grain = Math.sin(x * 0.42 + Math.sin(y * 0.06) * 1.8) * 0.16;
        const micro = (((x * 23 + y * 43) % 27) / 27 - 0.5) * 0.1;
        const val = Math.round(THREE.MathUtils.clamp(0.52 + grain + micro, 0.38, 0.7) * 255);
        const idx = (y * size + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 4.0);
  return tex;
}

function createWoodDiffuseTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(width, height);
    const data = img.data;
    // Base wood warm oak: #9B7348 (RGB: 155, 115, 72)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ring = Math.sin(x * 0.22 + Math.sin(y * 0.035) * 3.0) * 0.16;
        const finePores = Math.sin(x * 1.5 + y * 0.1) * 0.06;
        const noise = (((x * 37 + y * 59) % 23) / 23 - 0.5) * 0.1;
        const factor = 1.0 + ring + finePores + noise;

        const idx = (y * width + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(155 * factor, 110, 195));
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(115 * factor, 80, 150));
        data[idx + 2] = Math.round(THREE.MathUtils.clamp(72 * factor, 45, 100));
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.0, 2.5);
  return tex;
}

function createBrushedBrassNormalTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      const streak = (((y * 53) % 19) / 19 - 0.5) * 0.14;
      for (let x = 0; x < size; x++) {
        const micro = (((x * 17 + y * 31) % 11) / 11 - 0.5) * 0.06;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(0.5 + micro, 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(0.5 + streak, 0, 1) * 255);
        data[idx + 2] = 250;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  return tex;
}

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

export interface ModernPendantClusterOptions {
  ceilingY?: number;
  castShadow?: boolean;
  enableAccentLight?: boolean;
  accentLightIntensity?: number;
  offsetX?: number;
  offsetZ?: number;
}

export interface ModernPendantClusterInstance extends BedroomAssetInstance {
  applyStyle: (preset: BedroomStylePreset, duration?: number) => void;
  accentLight: THREE.PointLight;
}

// Archetype timber tone palette
const ARCHETYPE_TIMBER_COLORS: Record<string, string> = {
  japandi: '#9B7348',          // Honey Oak / Warm Teak
  'nordic-coastal': '#9B7348', // Warm Scandinavian Honey Oak
  'mid-century': '#8E7558',    // Warm Sand Walnut / Muted Honey Teak
  'urban-loft': '#443D37',     // Smoked Espresso Oak
};

// ============================================================================
// FACTORY: createModernPendantCluster
// ============================================================================

/**
 * 3-Drop Staggered Geometric Bedroom Pendant Light Cluster
 * Suspended from ceiling (y = 3.90m) down to bedside zone (y = 1.35m - 1.85m).
 */
export function createModernPendantCluster(
  options: ModernPendantClusterOptions = {},
): ModernPendantClusterInstance {
  const ceilingY = options.ceilingY ?? 3.90;
  const castShadow = options.castShadow ?? true;
  const enableAccentLight = options.enableAccentLight ?? true;
  const accentLightIntensity = options.accentLightIntensity ?? 1.8;
  const deltaX = options.offsetX ?? 0;
  const deltaZ = options.offsetZ ?? 0;

  const group = new THREE.Group();
  group.name = 'ModernPendantCluster';
  group.position.set(0, ceilingY, 0);

  const meshes: THREE.Mesh[] = [];
  const proceduralTextures: THREE.Texture[] = [];

  // 1. Instance Materials with High-Fidelity PBR Maps
  const woodNoiseMap = createWoodMicroNoiseTexture();
  const woodDiffuseMap = createWoodDiffuseTexture();
  const brassNormalMap = createBrushedBrassNormalTexture();
  if (woodNoiseMap) proceduralTextures.push(woodNoiseMap);
  if (woodDiffuseMap) proceduralTextures.push(woodDiffuseMap);
  if (brassNormalMap) proceduralTextures.push(brassNormalMap);

  const localWoodMat = pendantWoodMaterial.clone();
  localWoodMat.map = woodDiffuseMap;
  localWoodMat.roughnessMap = woodNoiseMap;
  localWoodMat.bumpMap = woodNoiseMap;
  localWoodMat.bumpScale = 0.001;
  localWoodMat.roughness = 0.52;
  localWoodMat.metalness = 0.0;

  const localBrassMat = pendantBrassMaterial.clone();
  localBrassMat.normalMap = brassNormalMap;
  localBrassMat.normalScale = new THREE.Vector2(0.2, 0.2);

  const localGlassMat = frostedGlassOrbMaterial.clone();
  const localAcrylicMat = pendantWhiteAcrylicMaterial.clone();
  const localCanopyMat = pendantCanopyMaterial.clone();
  const localCableMat = pendantCableMaterial.clone();

  // 2. Ceiling Canopy Mount Plate
  // CylinderGeometry(radius: 0.08m, height: 0.015m) in matte black anodized aluminum (#1A1A1A)
  const canopyRadius = 0.08;
  const canopyHeight = 0.015;
  const canopyGeo = new THREE.CylinderGeometry(canopyRadius, canopyRadius, canopyHeight, 36);
  const canopyMesh = new THREE.Mesh(canopyGeo, localCanopyMat);

  // Center canopy above the cluster centroid relative to ceiling anchor
  const clusterCenterX = 1.41 + deltaX;
  const clusterCenterZ = -0.69 + deltaZ;
  const canopyPlateY = -canopyHeight / 2;
  canopyMesh.position.set(clusterCenterX, canopyPlateY, clusterCenterZ);
  canopyMesh.castShadow = castShadow;
  canopyMesh.receiveShadow = true;
  group.add(canopyMesh);
  meshes.push(canopyMesh);

  // Bottom face of canopy plate where wires enter (relative to ceiling anchor)
  const canopyBottomY = -canopyHeight;

  // Reusable Hardware Accent Geometries
  const cableRadius = 0.0015;
  const cableGrommetGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.008, 16);

  // Helper to connect a cable seamlessly from canopy bottom down to fixture top cap
  function createSuspensionWire(
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
  ): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(startPoint, endPoint);
    const wireLength = dir.length();
    const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);

    const wireGeo = new THREE.CylinderGeometry(cableRadius, cableRadius, wireLength, 8);
    const wireMesh = new THREE.Mesh(wireGeo, localCableMat);
    wireMesh.position.copy(midPoint);
    wireMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    wireMesh.castShadow = false; // Fine 1.5mm wire casts negligible shadow
    wireMesh.receiveShadow = true;
    group.add(wireMesh);
    meshes.push(wireMesh);

    return wireMesh;
  }

  // Helper to add ceiling strain relief grommet at canopy exit
  function addCanopyGrommet(pos: THREE.Vector3) {
    const grommet = new THREE.Mesh(cableGrommetGeo, localBrassMat);
    grommet.position.copy(pos);
    grommet.castShadow = true;
    group.add(grommet);
    meshes.push(grommet);
  }

  // ==========================================================================
  // DROP FIXTURE A: Tall Timber Batten + Lower Orb
  // Position: x = 1.35m, y = 1.55m, z = -0.75m
  // Batten: BoxGeometry(0.04m, 0.42m, 0.04m) Solid Natural Oak / Walnut
  // Attached Orb: SphereGeometry(radius: 0.065m) tangent to lower side
  // ==========================================================================
  const fixAPos = new THREE.Vector3(1.35 + deltaX, 1.55 - ceilingY, -0.75 + deltaZ);
  const battenAW = 0.04;
  const battenAH = 0.42;
  const battenAD = 0.04;

  const battenAGeo = new THREE.BoxGeometry(battenAW, battenAH, battenAD);
  const battenAMesh = new THREE.Mesh(battenAGeo, localWoodMat);
  battenAMesh.position.copy(fixAPos);
  battenAMesh.castShadow = castShadow;
  battenAMesh.receiveShadow = true;
  group.add(battenAMesh);
  meshes.push(battenAMesh);

  const battenATopY = fixAPos.y + battenAH / 2;
  const battenABottomY = fixAPos.y - battenAH / 2;

  // Brushed brass top cap & bottom accent plate for Batten A
  const capGeoA = new THREE.BoxGeometry(battenAW + 0.002, 0.008, battenAD + 0.002);
  const topCapA = new THREE.Mesh(capGeoA, localBrassMat);
  topCapA.position.set(fixAPos.x, battenATopY + 0.004, fixAPos.z);
  topCapA.castShadow = castShadow;
  group.add(topCapA);
  meshes.push(topCapA);

  const bottomCapA = new THREE.Mesh(capGeoA, localBrassMat);
  bottomCapA.position.set(fixAPos.x, battenABottomY - 0.004, fixAPos.z);
  bottomCapA.castShadow = castShadow;
  group.add(bottomCapA);
  meshes.push(bottomCapA);

  // Fixture A Orb: SphereGeometry(radius: 0.065m) tangent to lower side of batten
  const orbARadius = 0.065;
  const orbAGeo = new THREE.SphereGeometry(orbARadius, 36, 28);
  const orbAMesh = new THREE.Mesh(orbAGeo, localGlassMat);
  // Mounted tangent to the inward (-X) face in the lower half of the batten
  const orbAY = fixAPos.y - battenAH * 0.24; // Lower portion (y ~ 1.45m world)
  const orbAX = fixAPos.x - (battenAW / 2 + orbARadius);
  const orbAZ = fixAPos.z;
  orbAMesh.position.set(orbAX, orbAY, orbAZ);
  orbAMesh.castShadow = castShadow;
  orbAMesh.receiveShadow = true;
  group.add(orbAMesh);
  meshes.push(orbAMesh);

  // Brass connecting coupler collar between Batten A and Orb A
  const couplerGeoA = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 16);
  couplerGeoA.rotateZ(Math.PI / 2);
  const couplerA = new THREE.Mesh(couplerGeoA, localBrassMat);
  couplerA.position.set(fixAPos.x - battenAW / 2 - 0.008, orbAY, orbAZ);
  couplerA.castShadow = castShadow;
  group.add(couplerA);
  meshes.push(couplerA);

  // Suspension Wire A: canopy port down to Batten A top cap
  const portA = new THREE.Vector3(clusterCenterX - 0.042, canopyBottomY, clusterCenterZ - 0.045);
  addCanopyGrommet(portA);
  createSuspensionWire(portA, new THREE.Vector3(fixAPos.x, battenATopY + 0.008, fixAPos.z));

  // ==========================================================================
  // DROP FIXTURE B: White Acrylic / Brass Slat + Elevated Orb
  // Position: x = 1.48m, y = 1.75m, z = -0.70m (staggered slightly forward and higher)
  // Batten: BoxGeometry(0.035m, 0.36m, 0.035m) with brushed brass mounting collar
  // Attached Orb: SphereGeometry(radius: 0.075m) positioned near upper half
  // ==========================================================================
  const fixBPos = new THREE.Vector3(1.48 + deltaX, 1.75 - ceilingY, -0.70 + deltaZ);
  const battenBW = 0.035;
  const battenBH = 0.36;
  const battenBD = 0.035;

  const battenBGeo = new THREE.BoxGeometry(battenBW, battenBH, battenBD);
  const battenBMesh = new THREE.Mesh(battenBGeo, localAcrylicMat);
  battenBMesh.position.copy(fixBPos);
  battenBMesh.castShadow = castShadow;
  battenBMesh.receiveShadow = true;
  group.add(battenBMesh);
  meshes.push(battenBMesh);

  const battenBTopY = fixBPos.y + battenBH / 2;
  const battenBBottomY = fixBPos.y - battenBH / 2;

  // Brushed brass top & bottom caps for Batten B
  const capGeoB = new THREE.BoxGeometry(battenBW + 0.002, 0.008, battenBD + 0.002);
  const topCapB = new THREE.Mesh(capGeoB, localBrassMat);
  topCapB.position.set(fixBPos.x, battenBTopY + 0.004, fixBPos.z);
  topCapB.castShadow = castShadow;
  group.add(topCapB);
  meshes.push(topCapB);

  const bottomCapB = new THREE.Mesh(capGeoB, localBrassMat);
  bottomCapB.position.set(fixBPos.x, battenBBottomY - 0.004, fixBPos.z);
  bottomCapB.castShadow = castShadow;
  group.add(bottomCapB);
  meshes.push(bottomCapB);

  // Fixture B Orb: SphereGeometry(radius: 0.075m) near upper half of batten
  const orbBRadius = 0.075;
  const orbBGeo = new THREE.SphereGeometry(orbBRadius, 36, 28);
  const orbBMesh = new THREE.Mesh(orbBGeo, localGlassMat);
  // Mounted tangent to the forward (+Z / -X) zone in upper half
  const orbBY = fixBPos.y + battenBH * 0.22; // Upper portion (y ~ 1.83m world)
  const orbBX = fixBPos.x - (battenBW / 2 + orbBRadius * 0.85);
  const orbBZ = fixBPos.z + orbBRadius * 0.52;
  orbBMesh.position.set(orbBX, orbBY, orbBZ);
  orbBMesh.castShadow = castShadow;
  orbBMesh.receiveShadow = true;
  group.add(orbBMesh);
  meshes.push(orbBMesh);

  // Brushed brass mounting collar sleeve encircling Batten B at orb mount point
  const collarSleeveGeoB = new THREE.BoxGeometry(battenBW + 0.004, 0.032, battenBD + 0.004);
  const collarSleeveB = new THREE.Mesh(collarSleeveGeoB, localBrassMat);
  collarSleeveB.position.set(fixBPos.x, orbBY, fixBPos.z);
  collarSleeveB.castShadow = castShadow;
  group.add(collarSleeveB);
  meshes.push(collarSleeveB);

  // Brass coupler pin extending from collar sleeve to Orb B
  const couplerGeoB = new THREE.CylinderGeometry(0.009, 0.009, 0.024, 16);
  couplerGeoB.rotateZ(Math.PI / 2.4);
  const couplerB = new THREE.Mesh(couplerGeoB, localBrassMat);
  couplerB.position.set((fixBPos.x + orbBX) / 2, orbBY, (fixBPos.z + orbBZ) / 2);
  couplerB.castShadow = castShadow;
  group.add(couplerB);
  meshes.push(couplerB);

  // Suspension Wire B: canopy port down to Batten B top cap
  const portB = new THREE.Vector3(clusterCenterX + 0.048, canopyBottomY, clusterCenterZ - 0.01);
  addCanopyGrommet(portB);
  createSuspensionWire(portB, new THREE.Vector3(fixBPos.x, battenBTopY + 0.008, fixBPos.z));

  // ==========================================================================
  // DROP FIXTURE C: Accent Wood Counterweight + Micro Disc/Orb
  // Position: x = 1.40m, y = 1.40m, z = -0.62m (lowest drop)
  // Batten: BoxGeometry(0.04m, 0.28m, 0.04m) Solid Natural Oak / Walnut
  // Attached Disc/Orb: Compact frosted sphere radius: 0.05m
  // ==========================================================================
  const fixCPos = new THREE.Vector3(1.40 + deltaX, 1.40 - ceilingY, -0.62 + deltaZ);
  const battenCW = 0.04;
  const battenCH = 0.28;
  const battenCD = 0.04;

  const battenCGeo = new THREE.BoxGeometry(battenCW, battenCH, battenCD);
  const battenCMesh = new THREE.Mesh(battenCGeo, localWoodMat);
  battenCMesh.position.copy(fixCPos);
  battenCMesh.castShadow = castShadow;
  battenCMesh.receiveShadow = true;
  group.add(battenCMesh);
  meshes.push(battenCMesh);

  const battenCTopY = fixCPos.y + battenCH / 2;
  const battenCBottomY = fixCPos.y - battenCH / 2;

  // Brushed brass top & bottom caps for Batten C
  const capGeoC = new THREE.BoxGeometry(battenCW + 0.002, 0.008, battenCD + 0.002);
  const topCapC = new THREE.Mesh(capGeoC, localBrassMat);
  topCapC.position.set(fixCPos.x, battenCTopY + 0.004, fixCPos.z);
  topCapC.castShadow = castShadow;
  group.add(topCapC);
  meshes.push(topCapC);

  const bottomCapC = new THREE.Mesh(capGeoC, localBrassMat);
  bottomCapC.position.set(fixCPos.x, battenCBottomY - 0.004, fixCPos.z);
  bottomCapC.castShadow = castShadow;
  group.add(bottomCapC);
  meshes.push(bottomCapC);

  // Fixture C Orb: Compact frosted sphere radius: 0.05m
  const orbCRadius = 0.05;
  const orbCGeo = new THREE.SphereGeometry(orbCRadius, 32, 24);
  const orbCMesh = new THREE.Mesh(orbCGeo, localGlassMat);
  // Mounted tangent to the lower-front face
  const orbCY = fixCPos.y - battenCH * 0.18; // y ~ 1.35m world
  const orbCX = fixCPos.x - (battenCW / 2 + orbCRadius * 0.8);
  const orbCZ = fixCPos.z + orbCRadius * 0.55;
  orbCMesh.position.set(orbCX, orbCY, orbCZ);
  orbCMesh.castShadow = castShadow;
  orbCMesh.receiveShadow = true;
  group.add(orbCMesh);
  meshes.push(orbCMesh);

  // Brass connector collar for Fixture C
  const couplerGeoC = new THREE.CylinderGeometry(0.008, 0.008, 0.018, 16);
  couplerGeoC.rotateZ(Math.PI / 2.3);
  const couplerC = new THREE.Mesh(couplerGeoC, localBrassMat);
  couplerC.position.set((fixCPos.x + orbCX) / 2, orbCY, (fixCPos.z + orbCZ) / 2);
  couplerC.castShadow = castShadow;
  group.add(couplerC);
  meshes.push(couplerC);

  // Suspension Wire C: canopy port down to Batten C top cap
  const portC = new THREE.Vector3(clusterCenterX - 0.008, canopyBottomY, clusterCenterZ + 0.046);
  addCanopyGrommet(portC);
  createSuspensionWire(portC, new THREE.Vector3(fixCPos.x, battenCTopY + 0.008, fixCPos.z));

  // ==========================================================================
  // III. INTEGRATED LIGHTING RIG (SUBTLE AMBIENCE)
  // Subtle PointLight within central cluster: 0xFFE5C4, 1.8, 2.5, 2.0
  // Position: (1.42, 1.60, -0.68)
  // ==========================================================================
  const accentLight = new THREE.PointLight(0xffe5c4, accentLightIntensity, 2.5, 2.0);
  accentLight.position.set(1.42 + deltaX, 1.60 - ceilingY, -0.68 + deltaZ);
  accentLight.castShadow = castShadow;
  if (castShadow) {
    accentLight.shadow.bias = -0.0005;
    accentLight.shadow.radius = 3;
    accentLight.shadow.mapSize.width = 512;
    accentLight.shadow.mapSize.height = 512;
    accentLight.shadow.camera.near = 0.05;
    accentLight.shadow.camera.far = 2.5;
  }
  accentLight.visible = enableAccentLight;
  group.add(accentLight);

  // ==========================================================================
  // IV. REGISTRATION & DISPOSAL
  // ==========================================================================
  registerBedroomComponent({
    id: 'staggered-pendant-cluster',
    name: 'Staggered Geometric Bedroom Pendant Light Cluster',
    category: 'lighting',
    dimensions: { width: 0.38, height: 2.65, depth: 0.38 },
    defaultTransform: {
      position: [clusterCenterX, 1.60, clusterCenterZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: [
      'pendant-wood',
      'pendant-brass',
      'frosted-opal-glass',
      'pendant-white-acrylic',
      'pendant-canopy-matte-aluminum',
    ],
    disposableMeshes: meshes,
  });

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const targetHex = ARCHETYPE_TIMBER_COLORS[preset.id] ?? '#9B7348';
    const targetCol = new THREE.Color(targetHex);

    if (duration > 0) {
      gsap.to(localWoodMat.color, {
        r: targetCol.r,
        g: targetCol.g,
        b: targetCol.b,
        duration,
        ease: 'power2.out',
      });
    } else {
      localWoodMat.color.copy(targetCol);
    }
  };

  const dispose = () => {
    disposeComponent('staggered-pendant-cluster');

    proceduralTextures.forEach((tex) => tex.dispose());
    proceduralTextures.length = 0;

    localWoodMat.dispose();
    localBrassMat.dispose();
    localGlassMat.dispose();
    localAcrylicMat.dispose();
    localCanopyMat.dispose();
    localCableMat.dispose();

    accentLight.dispose();
  };

  return {
    group,
    meshes,
    accentLight,
    applyStyle,
    dispose,
  };
}

// ============================================================================
// REACT COMPONENT MOUNT WRAPPER
// ============================================================================

export interface ModernPendantClusterProps extends ModernPendantClusterOptions {
  scene?: THREE.Scene;
}

export function ModernPendantCluster({
  scene,
  ...options
}: ModernPendantClusterProps) {
  useEffect(() => {
    if (!scene) return;
    const asset = createModernPendantCluster(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [
    scene,
    options.ceilingY,
    options.castShadow,
    options.enableAccentLight,
    options.accentLightIntensity,
    options.offsetX,
    options.offsetZ,
  ]);

  return null;
}
