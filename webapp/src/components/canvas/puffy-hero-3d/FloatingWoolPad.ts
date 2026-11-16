import * as THREE from 'three';
import {PUFFY_10_LAYERS} from './puffyLayersData.ts';
import type {MattressSizeSpec} from './types.ts';
import {
  createMattressPBRMaterials,
  preparePBRGeometry,
  PUFFY_FLAGSHIP_PRESETS,
  switchMattressModel,
  updateColorPresetTransitions,
  type LoadedAssets,
  type MattressModelConfig,
  type MattressModelId,
} from './MattressAnatomy.ts';

interface FoamTweenState {
  startTime: number;
  duration: number;
  fromSinkY: number;
  toSinkY: number;
  fromScaleY: number;
  toScaleY: number;
  fromScaleXZ: number;
  toScaleXZ: number;
  mode: 'press' | 'release' | 'idle';
}

interface LayerLiftSlideTween {
  defaultY: number;
  defaultZ: number;
  startTime: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  fromRotX: number;
  liftTargetY: number;
  slideTargetZ: number;
  targetRotX: number;
  currentX: number;
  currentY: number;
  currentZ: number;
  currentRotX: number;
  fromEmissive: number;
  toEmissive: number;
  currentEmissive: number;
  mode: 'lift-then-slide' | 'upper-clearance' | 'tray-slide' | 'reset';
}

// power2.out
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// power2.inOut
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Soft breathing cushion rebound matching elastic.out(1, 0.5) without harsh oscillation
function easeOutPlushMemoryFoam(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = (2 * Math.PI) / 0.5;
  return Math.pow(2, -11 * t) * Math.sin((t - 0.5 / 4) * c4) * 0.12 + (1 - Math.pow(1 - t, 3));
}

const OCEAN_TEAL_EMISSIVE = new THREE.Color('#067A57');
const ZERO_EMISSIVE = new THREE.Color('#000000');

export class FloatingWoolPad {
  public readonly group: THREE.Group;
  public readonly hitProxyMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

  // Phase 1: Cleanly decoupled "Open-Top Encasement Tray" & "Internal Core Group"
  public readonly encasementTrayGroup: THREE.Group; // Shell Container (Layer 10 Grip Base + 4 Outer Border Walls) at (0,0,0)
  public readonly internalCoreGroup: THREE.Group; // Layers 1 to 9 stacked neatly inside the inner cavity of the tray

  // Phase 2: Named PBR Material Slots (`mat_top_cover`, `mat_side_border`, `mat_piping_cord`, etc.) & LoadedAssets
  public readonly materials: Map<string, THREE.MeshStandardMaterial>;
  public readonly loadedAssets: LoadedAssets;
  private activeModelKey: MattressModelId = 'puffy-royal';

  // 10-Layer Puffy Royal Interactive Stack (indexed 0..9 matching PUFFY_10_LAYERS)
  public readonly layerMeshes: THREE.Object3D[] = [];
  private readonly layerHighlightMaterials: THREE.MeshStandardMaterial[][] = [];
  private readonly layerKinematics: LayerLiftSlideTween[] = [];
  private activeLayerIndex: number | null = null;

  // Individual 10-Layer Groups & Meshes
  private layer1TopCoverGroup: THREE.Group; // 1. Quilted Cloud Cover (`mat_top_cover` + `mat_piping_cord`)
  private layer2WoolCashmereMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; // 2. Premium Blended Wool (`mat_wool`)
  private layer3FireFeltMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; // 3. Fire-Resistant Fiber Layer
  private layer4ComfortQuiltMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; // 4. Comfort Quilt Foam Layer (`mat_cooling_foam`)
  private layer5PlushContourMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; // 5. Plush Contouring Foam (`mat_deep_climate`)
  private layer6ReflexiveFoamMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; // 6. Reflexive Memory Foam
  private layer7CloudBreezeGroup: THREE.Group; // 7. Cloud Breeze™ Cooling Technology (`mat_transition_foam`)
  private layer8PocketSpringsGroup: THREE.Group; // 8. Contour-Adapt Pocket Coils (`mat_pocket_coils` — LOCKED to #F8F9FA)
  private layer9FirmSupportMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; // 9. Firm Core Support Foam

  // Baseline resting Y positions inside `internalCoreGroup` (Layers 1..9) and `encasementTrayGroup` (Layer 10)
  // The open-top encasement tray rim sits at casingWallTopY = +0.188, and Layer 1 anchors directly at +0.188
  // with a 0.015m downward seam overlap lip + 1.01x piping welt bead so zero light gap exists at any zoom angle.
  private readonly defaultLayerY: number[] = [
    0.188, // Layer 1: Quilted Cloud Cover (anchored flush at casingWallTopY = 0.188)
    0.162, // Layer 2: Premium Blended Wool (0.25")
    0.138, // Layer 3: Fire-Resistant Fiber Layer (0.25")
    0.108, // Layer 4: Comfort Quilt Foam Layer (1")
    0.068, // Layer 5: Plush Contouring Foam (2")
    0.026, // Layer 6: Reflexive Memory Foam (1")
    -0.022, // Layer 7: Cloud Breeze™ Cooling Technology (2.5")
    -0.106, // Layer 8: Contour-Adapt Pocket Coils (6")
    -0.188, // Layer 9: Firm Core Support Foam (1")
    0.0, // Layer 10: Grip Base & Open-Top Encasement Tray
  ];

  // Method A: Whole-Pad Cushion Sink & Scale Compression state
  private currentSinkY = 0;
  private currentPressScaleY = 1.0;
  private currentPressScaleXZ = 1.0;
  private isPressed = false;
  private autoReleaseTimer: number | null = null;

  private tween: FoamTweenState = {
    startTime: 0,
    duration: 0.15,
    fromSinkY: 0,
    toSinkY: 0,
    fromScaleY: 1,
    toScaleY: 1,
    fromScaleXZ: 1,
    toScaleXZ: 1,
    mode: 'idle',
  };

  // Tactile hover state (1° max cursor parallax tilt)
  private isHovered = false;
  private hoverMouseNdc = new THREE.Vector2(0, 0);

  // Smoothly damped dimensions
  private currentScaleX = 1.0;
  private currentScaleZ = 1.0;
  private targetScaleX = 1.0;
  private targetScaleZ = 1.0;

  private baseY = 0.52;
  private floatingEnabled = true;
  private currentElevation = 0.52;
  private lastElapsedTime = 0;

  private disposables: Array<{dispose(): void}> = [];

  constructor(maxAnisotropy = 4) {
    this.group = new THREE.Group();
    this.group.name = 'FloatingPuffyRoyalMattress';
    this.group.position.set(0, this.baseY, 0);

    // Build all 11 Named Decoupled PBR Material Slots + pre-generated Royal & Monarch LoadedAssets
    const pbrBundle = createMattressPBRMaterials(maxAnisotropy);
    this.materials = pbrBundle.materials;
    this.loadedAssets = pbrBundle.loadedAssets;
    this.disposables.push(...pbrBundle.disposables);

    const refWidth = 2.15; // Queen baseline outer width in scene units
    const refLength = 2.55; // Queen baseline outer length in scene units
    const wallThick = 0.046;
    // Inner cavity dimensions with clearance margin so Layers 1..9 lift and slide with 0% side-wall clipping
    const coreWidth = refWidth - wallThick * 2 - 0.024;
    const coreLength = refLength - wallThick * 2 - 0.024;

    // Invisible simplified collision box for fast raycasting
    const hitGeo = new THREE.BoxGeometry(refWidth, 0.58, refLength);
    const hitMat = new THREE.MeshBasicMaterial({visible: false});
    this.hitProxyMesh = new THREE.Mesh(hitGeo, hitMat);
    this.hitProxyMesh.name = 'WoolPadHitProxy';
    this.group.add(this.hitProxyMesh);
    this.disposables.push(hitGeo, hitMat);

    // =========================================================================
    // 1. `encasementTrayGroup` (The Open-Top Shell Container at position (0,0,0))
    //    - Bottom Grip Base (Layer 10, `mat_grip_base`)
    //    - 4 Outer Border Walls (`mat_side_border` + `mat_accent_strip` + `mat_piping_cord` + `mat_brand_badge`)
    //    - Open-top box with NO top lid
    // =========================================================================
    this.encasementTrayGroup = new THREE.Group();
    this.encasementTrayGroup.name = 'encasementTrayGroup';
    this.encasementTrayGroup.position.set(0, 0, 0);
    this.encasementTrayGroup.rotation.set(0, 0, 0);
    const trayHighlightMats = this.buildOpenTopEncasementTray(
      refWidth,
      refLength,
      wallThick,
      maxAnisotropy,
    );
    this.group.add(this.encasementTrayGroup);

    // =========================================================================
    // 2. `internalCoreGroup` (Layers 1 to 9 stacked neatly inside the tray cavity)
    // =========================================================================
    this.internalCoreGroup = new THREE.Group();
    this.internalCoreGroup.name = 'internalCoreGroup';
    this.internalCoreGroup.position.set(0, 0, 0);
    this.internalCoreGroup.rotation.set(0, 0, 0);
    this.group.add(this.internalCoreGroup);

    // LAYER 9 (index 8): Firm Core Support Foam (#E8E6E1 high-density base foam, roughness: 0.9)
    const matFirmSupport = this.materials.get('mat_cooling_foam')!.clone();
    matFirmSupport.name = 'mat_firm_support';
    matFirmSupport.color.set('#E8E6E1');
    matFirmSupport.roughness = 0.9;
    matFirmSupport.metalness = 0.0;
    this.disposables.push(matFirmSupport);
    this.layer9FirmSupportMesh = this.createPBRSlabMesh(
      coreWidth,
      0.044,
      coreLength,
      matFirmSupport,
    );
    this.layer9FirmSupportMesh.position.set(0, this.defaultLayerY[8], 0);
    this.internalCoreGroup.add(this.layer9FirmSupportMesh);

    // LAYER 8 (index 7): Contour-Adapt Pocket Coils (`mat_pocket_coils` — LOCKED to #F8F9FA)
    this.layer8PocketSpringsGroup = new THREE.Group();
    this.layer8PocketSpringsGroup.position.set(0, this.defaultLayerY[7], 0);
    this.layer8PocketSpringsGroup.rotation.set(0, 0, 0);
    const layer8Mats = this.buildWhitePocketSpringsCore(coreWidth, coreLength);
    this.internalCoreGroup.add(this.layer8PocketSpringsGroup);

    // LAYER 7 (index 6): Cloud Breeze™ Cooling Technology (`mat_transition_foam` with airflow channels)
    this.layer7CloudBreezeGroup = new THREE.Group();
    this.layer7CloudBreezeGroup.position.set(0, this.defaultLayerY[6], 0);
    this.layer7CloudBreezeGroup.rotation.set(0, 0, 0);
    const layer7Mats = this.buildContourTransitionFoam(coreWidth, 0.046, coreLength);
    this.internalCoreGroup.add(this.layer7CloudBreezeGroup);

    // LAYER 6 (index 5): Reflexive Memory Foam (#46BCA8 Mint / Ocean Teal, roughness: 0.9)
    const matReflexiveMint = this.materials.get('mat_cooling_foam')!.clone();
    matReflexiveMint.name = 'mat_reflexive_foam';
    matReflexiveMint.color.set('#46BCA8');
    matReflexiveMint.roughness = 0.9;
    matReflexiveMint.metalness = 0.0;
    this.disposables.push(matReflexiveMint);
    this.layer6ReflexiveFoamMesh = this.createPBRSlabMesh(
      coreWidth,
      0.036,
      coreLength,
      matReflexiveMint,
    );
    this.layer6ReflexiveFoamMesh.position.set(0, this.defaultLayerY[5], 0);
    this.internalCoreGroup.add(this.layer6ReflexiveFoamMesh);

    // LAYER 5 (index 4): Plush Contouring Foam (`mat_deep_climate` #2A88E8, roughness: 0.9)
    const matDeepClimate = this.materials.get('mat_deep_climate')!;
    this.layer5PlushContourMesh = this.createPBRSlabMesh(
      coreWidth,
      0.038,
      coreLength,
      matDeepClimate,
    );
    this.layer5PlushContourMesh.position.set(0, this.defaultLayerY[4], 0);
    this.internalCoreGroup.add(this.layer5PlushContourMesh);

    // LAYER 4 (index 3): Comfort Quilt Foam Layer (`mat_cooling_foam` #B4D5F6, roughness: 0.9)
    const matCoolingFoam = this.materials.get('mat_cooling_foam')!;
    this.layer4ComfortQuiltMesh = this.createPBRSlabMesh(
      coreWidth,
      0.034,
      coreLength,
      matCoolingFoam,
    );
    this.layer4ComfortQuiltMesh.position.set(0, this.defaultLayerY[3], 0);
    this.internalCoreGroup.add(this.layer4ComfortQuiltMesh);

    // LAYER 3 (index 2): Fire-Resistant Fiber Layer (#D9D6D0, roughness: 0.9)
    const matFireFelt = this.materials.get('mat_wool')!.clone();
    matFireFelt.name = 'mat_fire_felt';
    matFireFelt.color.set('#D9D6D0');
    matFireFelt.roughness = 0.9;
    matFireFelt.metalness = 0.0;
    this.disposables.push(matFireFelt);
    this.layer3FireFeltMesh = this.createPBRSlabMesh(coreWidth, 0.018, coreLength, matFireFelt);
    this.layer3FireFeltMesh.position.set(0, this.defaultLayerY[2], 0);
    this.internalCoreGroup.add(this.layer3FireFeltMesh);

    // LAYER 2 (index 1): Premium Blended Wool (`mat_wool` #F2EDE4, roughness: 0.9)
    const matWool = this.materials.get('mat_wool')!;
    this.layer2WoolCashmereMesh = this.createPBRSlabMesh(coreWidth, 0.024, coreLength, matWool);
    this.layer2WoolCashmereMesh.position.set(0, this.defaultLayerY[1], 0);
    this.internalCoreGroup.add(this.layer2WoolCashmereMesh);

    // LAYER 1 (index 0): Quilted Cloud Cover (`mat_top_cover` + `mat_piping_cord` anchored at casingWallTopY = 0.188)
    this.layer1TopCoverGroup = new THREE.Group();
    this.layer1TopCoverGroup.position.set(0, this.defaultLayerY[0], 0);
    this.layer1TopCoverGroup.rotation.set(0, 0, 0);
    const layer1Mats = this.buildTopSleepingCoverAndPiping(refWidth, refLength, coreWidth, coreLength);
    this.internalCoreGroup.add(this.layer1TopCoverGroup);

    // Register all 10 layers in exact order (0 = Layer 1 ... 8 = Layer 9 in `internalCoreGroup`, 9 = Layer 10 `encasementTrayGroup`)
    const orderedLayers: THREE.Object3D[] = [
      this.layer1TopCoverGroup,
      this.layer2WoolCashmereMesh,
      this.layer3FireFeltMesh,
      this.layer4ComfortQuiltMesh,
      this.layer5PlushContourMesh,
      this.layer6ReflexiveFoamMesh,
      this.layer7CloudBreezeGroup,
      this.layer8PocketSpringsGroup,
      this.layer9FirmSupportMesh,
      this.encasementTrayGroup,
    ];

    const orderedMats: THREE.MeshStandardMaterial[][] = [
      layer1Mats,
      [matWool],
      [matFireFelt],
      [matCoolingFoam],
      [matDeepClimate],
      [matReflexiveMint],
      layer7Mats,
      layer8Mats,
      [matFirmSupport],
      trayHighlightMats,
    ];

    orderedLayers.forEach((layerObj, idx) => {
      layerObj.name = `PuffyLayer_${idx + 1}_${PUFFY_10_LAYERS[idx]?.name ?? ''}`;
      layerObj.userData.layerIndex = idx;
      layerObj.userData.defaultY = this.defaultLayerY[idx];
      layerObj.traverse((child) => {
        child.userData.layerIndex = idx;
      });
      this.layerMeshes.push(layerObj);
      this.layerHighlightMaterials.push(orderedMats[idx]);
      this.layerKinematics.push({
        defaultY: this.defaultLayerY[idx],
        defaultZ: 0,
        startTime: 0,
        fromX: 0,
        fromY: this.defaultLayerY[idx],
        fromZ: 0,
        fromRotX: 0,
        liftTargetY: this.defaultLayerY[idx],
        slideTargetZ: 0,
        targetRotX: 0,
        currentX: 0,
        currentY: this.defaultLayerY[idx],
        currentZ: 0,
        currentRotX: 0,
        fromEmissive: 0,
        toEmissive: 0,
        currentEmissive: 0,
        mode: 'reset',
      });
    });
  }

  /**
   * Dual Flagship Modular "Lego" Swapping Logic:
   * Switches between `'puffy-royal'` (Midnight Navy Fluted Velvet + Puffy ROYAL Badge)
   * and `'puffy-monarch'` (Espresso Mocha Micro-Diamond + Puffy MONARCH Badge)
   * while keeping all shared components (Top Cloud Cover, Charcoal Lower Border, Piping, Coils) untouched.
   */
  public switchMattressModel(modelKey: MattressModelId): void {
    this.activeModelKey = modelKey;
    switchMattressModel(modelKey, this.loadedAssets);
  }

  public getActiveModelConfig(): MattressModelConfig {
    return PUFFY_FLAGSHIP_PRESETS[this.activeModelKey];
  }

  /**
   * Phase 1 Kinematics: "Lift-then-Slide" Interaction (Zero Side-Wall Clipping)
   * When a user selects Layer `i` (index 0..8 for Layers 1..9):
   * - STEP A (0.00s -> 0.25s, power2.out): Lifts vertically (`y: defaultY + 0.30`, guaranteed above the tray rim)
   *   while any layers above `i` also lift out of the way so there is 0% vertical or side-wall collision.
   * - STEP B (0.25s -> 0.50s, power2.out): Slides forward (`z: defaultZ + 0.32`) and tilts (`rotation.x: 3°`).
   * - Inactive layers smoothly reset back to `{ x: 0, y: defaultY, z: 0, rotation: (0,0,0) }` over 0.3s (`power2.inOut`).
   */
  public setActiveLayerIndex(index: number | null): void {
    const normalized =
      index !== null && index >= 0 && index < this.layerMeshes.length ? index : null;
    this.activeLayerIndex = normalized;

    const trayRimClearanceY = 0.24; // Ensures even lower layers (L7, L8, L9) clear the open-top tray rim at y = +0.165

    for (let i = 0; i < this.layerMeshes.length; i++) {
      const kin = this.layerKinematics[i];
      kin.startTime = this.lastElapsedTime;
      kin.fromX = kin.currentX;
      kin.fromY = kin.currentY;
      kin.fromZ = kin.currentZ;
      kin.fromRotX = kin.currentRotX;
      kin.fromEmissive = kin.currentEmissive;

      // Layer 10 (index 9) is `encasementTrayGroup`: slide forward & drop slightly without mutating or green-tinting casing color
      if (i === 9) {
        if (normalized === 9) {
          kin.mode = 'tray-slide';
          kin.liftTargetY = -0.05;
          kin.slideTargetZ = 0.25;
          kin.targetRotX = 0;
        } else {
          kin.mode = 'reset';
          kin.liftTargetY = kin.defaultY;
          kin.slideTargetZ = 0;
          kin.targetRotX = 0;
        }
        kin.toEmissive = 0.0;
        continue;
      }

      if (normalized !== null && i === normalized) {
        // Active Layer (Layers 1..9): Lift-then-Slide!
        kin.mode = 'lift-then-slide';
        kin.liftTargetY = Math.max(kin.defaultY + 0.3, trayRimClearanceY);
        kin.slideTargetZ = kin.defaultZ + 0.32;
        kin.targetRotX = THREE.MathUtils.degToRad(3);
        kin.toEmissive = 0.22;
      } else if (normalized !== null && normalized < 9 && i < normalized) {
        // Layers positioned ABOVE the selected layer lift cleanly upward at z=0 so the active layer
        // can lift above the tray rim without passing through upper layers
        const activeTargetY = Math.max(
          this.defaultLayerY[normalized] + 0.3,
          trayRimClearanceY,
        );
        const stackOffsetAboveActive = this.defaultLayerY[i] - this.defaultLayerY[normalized] + 0.045;
        kin.mode = 'upper-clearance';
        kin.liftTargetY = activeTargetY + stackOffsetAboveActive;
        kin.slideTargetZ = 0;
        kin.targetRotX = 0;
        kin.toEmissive = 0.0;
      } else {
        // Inactive layers below the active layer (or all layers when deselected) reset to resting position
        kin.mode = 'reset';
        kin.liftTargetY = kin.defaultY;
        kin.slideTargetZ = 0;
        kin.targetRotX = 0;
        kin.toEmissive = 0.0;
      }
    }
  }

  public getActiveLayerIndex(): number | null {
    return this.activeLayerIndex;
  }

  /**
   * Raycasts directly against the 10 3D layer meshes so clicking a layer in 3D selects it.
   */
  public raycastLayerIndex(raycaster: THREE.Raycaster): number | null {
    const hits = raycaster.intersectObjects(this.layerMeshes, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (typeof obj.userData?.layerIndex === 'number') {
          return obj.userData.layerIndex as number;
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  private createPBRSlabMesh(
    width: number,
    height: number,
    length: number,
    material: THREE.MeshStandardMaterial,
  ): THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> {
    const geo = new THREE.BoxGeometry(width, height, length);
    preparePBRGeometry(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.set(0, 0, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.disposables.push(geo);
    return mesh;
  }

  /**
   * Builds Layer 7: Cloud Breeze™ Cooling Technology (`mat_transition_foam` #4B5478)
   * laying flat on the horizontal XZ plane with 5-zone sculpted ventilation channels.
   */
  private buildContourTransitionFoam(
    width: number,
    height: number,
    length: number,
  ): THREE.MeshStandardMaterial[] {
    const baseHeight = height * 0.65;
    const ribHeight = height * 0.35;

    const foamMat = this.materials.get('mat_transition_foam')!;
    const channelHighlightMat = foamMat.clone();
    channelHighlightMat.color.set('#5C6791');
    this.disposables.push(channelHighlightMat);

    const baseSlabGeo = new THREE.BoxGeometry(width, baseHeight, length);
    preparePBRGeometry(baseSlabGeo);
    const baseSlab = new THREE.Mesh(baseSlabGeo, foamMat);
    baseSlab.position.set(0, -ribHeight * 0.5, 0);
    baseSlab.rotation.set(0, 0, 0);
    baseSlab.castShadow = true;
    baseSlab.receiveShadow = true;
    this.layer7CloudBreezeGroup.add(baseSlab);

    const ribCount = 9;
    const ribWidth = (width / ribCount) * 0.72;
    const ribGeo = new THREE.BoxGeometry(ribWidth, ribHeight, length * 0.996);
    preparePBRGeometry(ribGeo);
    for (let i = 0; i < ribCount; i++) {
      const rx = ((i + 0.5) / ribCount - 0.5) * width;
      const rib = new THREE.Mesh(ribGeo, channelHighlightMat);
      rib.position.set(rx, baseHeight * 0.5, 0);
      rib.rotation.set(0, 0, 0);
      rib.castShadow = true;
      rib.receiveShadow = true;
      this.layer7CloudBreezeGroup.add(rib);
    }

    this.disposables.push(baseSlabGeo, ribGeo);
    return [foamMat, channelHighlightMat];
  }

  /**
   * Builds Layer 8: Contour-Adapt Pocket Coils (`mat_pocket_coils` — LOCKED to #F8F9FA clean white spun-bond fabric)
   */
  private buildWhitePocketSpringsCore(
    width: number,
    length: number,
  ): THREE.MeshStandardMaterial[] {
    const matPocketCoils = this.materials.get('mat_pocket_coils')!;
    const coilCapMat = new THREE.MeshStandardMaterial({
      name: 'mat_pocket_coils_cap',
      map: null,
      color: new THREE.Color('#F8F9FA'),
      roughness: 0.88,
      metalness: 0.0,
    });

    const coilHeight = 0.118;
    const coilRadius = 0.086;
    const coilGeo = new THREE.CylinderGeometry(coilRadius, coilRadius, coilHeight, 20, 1, false);
    preparePBRGeometry(coilGeo);

    const cols = 10;
    const rows = 11;
    const totalCoils = cols * rows;
    const coilInstanced = new THREE.InstancedMesh(
      coilGeo,
      [matPocketCoils, coilCapMat, coilCapMat],
      totalCoils,
    );
    coilInstanced.castShadow = true;
    coilInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const gridW = width - coilRadius * 2.2;
    const gridL = length - coilRadius * 2.2;
    const startX = -gridW * 0.5;
    const startZ = -gridL * 0.5;

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = startX + (c / (cols - 1)) * gridW;
        const cz = startZ + (r / (rows - 1)) * gridL;
        dummy.position.set(cx, 0.0, cz);
        dummy.updateMatrix();
        coilInstanced.setMatrixAt(idx++, dummy.matrix);
      }
    }
    coilInstanced.instanceMatrix.needsUpdate = true;
    coilInstanced.computeBoundingSphere();
    this.layer8PocketSpringsGroup.add(coilInstanced);

    this.disposables.push(coilGeo, coilCapMat);
    return [matPocketCoils, coilCapMat];
  }

  /**
   * Builds `encasementTrayGroup`: The Open-Top Encasement Tray (Shell Container at (0,0,0))
   * - Consists of the bottom grip base (Layer 10, `mat_grip_base`)
   * - 4 complete outer border walls (`mat_side_border` diamond quilt + `mat_accent_strip` fluted velvet
   *   + `mat_piping_cord` perimeter welt beading + centered `mat_brand_badge` Puffy ROYAL/MONARCH logo)
   * - Top rim sits at `casingWallTopY = 0.188`, meeting `layer1TopCoverGroup` with zero air gap.
   */
  private buildOpenTopEncasementTray(
    width: number,
    length: number,
    wallThick: number,
    maxAnisotropy: number,
  ): THREE.MeshStandardMaterial[] {
    const matGripBase = this.materials.get('mat_grip_base')!;
    const matSidewallStrip =
      this.materials.get('mat_sidewall_strip') ?? this.materials.get('mat_side_border')!;
    const matPipingCord = this.materials.get('mat_piping_cord')!;
    const matBrandBadge = this.materials.get('mat_brand_badge')!;

    // 1. Bottom Grip Base Plate (Layer 10 foundation floor of the open-top tray, 5cm rounded corners)
    const cornerRadius = 0.05; // 5cm continuous rounded corner radius
    const cornerSegments = 12;
    const gripBaseGeo = this.createRoundedRectSlabGeometry(
      width,
      length,
      0.032,
      cornerRadius,
      cornerSegments,
    );
    preparePBRGeometry(gripBaseGeo);
    const gripBaseMesh = new THREE.Mesh(gripBaseGeo, matGripBase);
    gripBaseMesh.position.set(0, -0.222, 0);
    gripBaseMesh.castShadow = true;
    gripBaseMesh.receiveShadow = true;
    this.encasementTrayGroup.add(gripBaseMesh);
    this.disposables.push(gripBaseGeo);

    // 2. Continuous Smooth Rounded-Corner Perimeter Sidewall (`sidewall_strip_v1`)
    // Spans y = -0.206 up to casingWallTopY = +0.188 with 12-segment 5cm rounded corners and continuous arc-length UVs
    const charcoalHeight = 0.264; // Reference height for lower badge/handle placement
    const charcoalY = -0.074;
    const sidewallHeight = 0.394; // y: -0.206 to +0.188
    const sidewallY = -0.009;

    const sidewallGeo = this.createRoundedPerimeterSidewallGeometry(
      width,
      length,
      sidewallHeight,
      cornerRadius,
      cornerSegments,
      4.4, // 4.4 * repeat.x(10) = 44 exact integer tile repeats around ~9.31m perimeter (~5.29cm per diamond)
    );
    preparePBRGeometry(sidewallGeo);
    const sidewallMesh = new THREE.Mesh(sidewallGeo, matSidewallStrip);
    sidewallMesh.position.set(0, sidewallY, 0);
    sidewallMesh.castShadow = true;
    sidewallMesh.receiveShadow = true;
    this.encasementTrayGroup.add(sidewallMesh);
    this.disposables.push(sidewallGeo);

    // 3. Centered "Puffy ROYAL / MONARCH" Embroidered Patch (`mat_brand_badge`) flush on front wall (0.001m offset)
    const badgeGeo = new THREE.PlaneGeometry(0.12, 0.06);
    preparePBRGeometry(badgeGeo);
    const badgeMesh = new THREE.Mesh(badgeGeo, matBrandBadge);
    badgeMesh.name = 'puffy-embroidered-badge';
    badgeMesh.position.set(0, charcoalY, length / 2 + 0.001);
    this.encasementTrayGroup.add(badgeMesh);

    // 4. Symmetrical Vertical Fabric Loop Handles flush against the front wall (x = ±width * 0.28)
    const handleTex = this.createFlushHandleStrapTexture(maxAnisotropy);
    const handleGeo = new THREE.BoxGeometry(0.056, charcoalHeight * 0.95, 0.008);
    const handleFaceMat = new THREE.MeshStandardMaterial({
      map: handleTex,
      roughness: 0.78,
      metalness: 0.0,
    });

    for (const side of [-1, 1]) {
      const handleMesh = new THREE.Mesh(handleGeo, [
        matPipingCord,
        matPipingCord,
        matPipingCord,
        matPipingCord,
        handleFaceMat,
        matPipingCord,
      ]);
      handleMesh.position.set(side * width * 0.28, charcoalY, length / 2 + 0.004);
      this.encasementTrayGroup.add(handleMesh);
    }

    // 5. Flush "HYBRID Signature of Quality" Woven Strip on the front-right border
    const hybridTagTex = this.createHybridSpecTagTexture(maxAnisotropy);
    const hybridTagGeo = new THREE.BoxGeometry(0.115, charcoalHeight * 0.96, 0.006);
    const hybridTagMat = new THREE.MeshStandardMaterial({
      map: hybridTagTex,
      roughness: 0.8,
      metalness: 0.0,
    });
    const hybridTagMesh = new THREE.Mesh(hybridTagGeo, hybridTagMat);
    hybridTagMesh.position.set(width * 0.4, charcoalY, length / 2 + 0.003);
    this.encasementTrayGroup.add(hybridTagMesh);

    this.disposables.push(
      badgeGeo,
      handleTex,
      handleGeo,
      handleFaceMat,
      hybridTagTex,
      hybridTagGeo,
      hybridTagMat,
    );

    return [matGripBase, matSidewallStrip];
  }

  /**
   * Builds a 4-sided tubular perimeter piping bead (`CylinderGeometry` + corner joints)
   * that sits over casing junctions with `scale.set(1.01, 1.01, 1.01)` to seal light leaks.
   */
  private createRoundedRectSlabGeometry(
    width: number,
    length: number,
    height: number,
    radius: number,
    curveSegments = 12,
  ): THREE.BufferGeometry {
    const hw = width * 0.5;
    const hl = length * 0.5;
    const r = Math.min(radius, hw * 0.45, hl * 0.45);
    const shape = new THREE.Shape();
    shape.moveTo(-hw + r, -hl);
    shape.lineTo(hw - r, -hl);
    shape.quadraticCurveTo(hw, -hl, hw, -hl + r);
    shape.lineTo(hw, hl - r);
    shape.quadraticCurveTo(hw, hl, hw - r, hl);
    shape.lineTo(-hw + r, hl);
    shape.quadraticCurveTo(-hw, hl, -hw, hl - r);
    shape.lineTo(-hw, -hl + r);
    shape.quadraticCurveTo(-hw, -hl, -hw + r, -hl);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments,
    });
    geo.rotateX(Math.PI * 0.5);
    geo.translate(0, height * 0.5, 0);
    return geo;
  }

  /**
   * Builds a continuous smooth rounded-corner perimeter sidewall ribbon with
   * arc-length UVs so textures wrap seamlessly around all 4 corners with zero facets.
   */
  private createRoundedPerimeterSidewallGeometry(
    width: number,
    length: number,
    height: number,
    radius: number,
    cornerSegments: number,
    uvCyclesPerPerimeter: number,
  ): THREE.BufferGeometry {
    const hw = width * 0.5;
    const hl = length * 0.5;
    const r = Math.min(radius, hw * 0.45, hl * 0.45);
    const pts: Array<{x: number; z: number; nx: number; nz: number}> = [];

    // 4 corner arc centers in clockwise order starting at front-right (+X, +Z)
    const corners: Array<{cx: number; cz: number; startAngle: number}> = [
      {cx: hw - r, cz: hl - r, startAngle: 0},
      {cx: -hw + r, cz: hl - r, startAngle: Math.PI * 0.5},
      {cx: -hw + r, cz: -hl + r, startAngle: Math.PI},
      {cx: hw - r, cz: -hl + r, startAngle: Math.PI * 1.5},
    ];

    for (const c of corners) {
      for (let i = 0; i <= cornerSegments; i++) {
        const a = c.startAngle + (i / cornerSegments) * (Math.PI * 0.5);
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        pts.push({
          x: c.cx + r * nx,
          z: c.cz + r * nz,
          nx,
          nz,
        });
      }
    }
    // Close the loop explicitly at the first point
    pts.push({...pts[0]});

    const arcLengths = new Float32Array(pts.length);
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dz = pts[i].z - pts[i - 1].z;
      arcLengths[i] = arcLengths[i - 1] + Math.hypot(dx, dz);
    }
    const totalPerimeter = arcLengths[pts.length - 1] || 1;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfH = height * 0.5;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const u = (arcLengths[i] / totalPerimeter) * uvCyclesPerPerimeter;
      // Bottom vertex (v = 0)
      positions.push(p.x, -halfH, p.z);
      normals.push(p.nx, 0, p.nz);
      uvs.push(u, 0);
      // Top vertex (v = 1)
      positions.push(p.x, halfH, p.z);
      normals.push(p.nx, 0, p.nz);
      uvs.push(u, 1);

      if (i < pts.length - 1) {
        const b0 = i * 2;
        const t0 = i * 2 + 1;
        const b1 = (i + 1) * 2;
        const t1 = (i + 1) * 2 + 1;
        indices.push(b0, t0, b1);
        indices.push(b1, t0, t1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  private createPerimeterPipingBead(
    width: number,
    length: number,
    radius: number,
    material: THREE.MeshStandardMaterial,
  ): THREE.Group {
    const beadGroup = new THREE.Group();
    const halfW = width * 0.5;
    const halfL = length * 0.5;

    const xRailGeo = new THREE.CylinderGeometry(radius, radius, width, 16, 1);
    xRailGeo.rotateZ(Math.PI * 0.5);
    preparePBRGeometry(xRailGeo);

    const zRailGeo = new THREE.CylinderGeometry(radius, radius, length, 16, 1);
    zRailGeo.rotateX(Math.PI * 0.5);
    preparePBRGeometry(zRailGeo);

    const cornerGeo = new THREE.SphereGeometry(radius * 1.04, 14, 14);
    preparePBRGeometry(cornerGeo);

    const frontRail = new THREE.Mesh(xRailGeo, material);
    frontRail.position.set(0, 0, halfL);
    const backRail = new THREE.Mesh(xRailGeo, material);
    backRail.position.set(0, 0, -halfL);
    const leftRail = new THREE.Mesh(zRailGeo, material);
    leftRail.position.set(-halfW, 0, 0);
    const rightRail = new THREE.Mesh(zRailGeo, material);
    rightRail.position.set(halfW, 0, 0);

    beadGroup.add(frontRail, backRail, leftRail, rightRail);

    const corners: Array<[number, number]> = [
      [-halfW, -halfL],
      [halfW, -halfL],
      [-halfW, halfL],
      [halfW, halfL],
    ];
    for (const [cx, cz] of corners) {
      const cMesh = new THREE.Mesh(cornerGeo, material);
      cMesh.position.set(cx, 0, cz);
      beadGroup.add(cMesh);
    }

    this.disposables.push(xRailGeo, zRailGeo, cornerGeo);
    return beadGroup;
  }

  /**
   * Builds Layer 1 (Top of `internalCoreGroup`, resting at `casingWallTopY = 0.188`):
   * - LEGO BLOCK 1:
   *   1. Seam Overlap Lip: The perimeter edge of `topCoverMesh` has a downward curvature/bevel
   *      (`depth: 0.015m`) that tucks inside the outer border.
   *   2. Piping Welt Anchorage: The black piping bead (`CylinderGeometry`) sits directly over the junction
   *      (`pipingMesh.position.y = 0`, which is `casingWallTopY = 0.188`) with `pipingMesh.scale.set(1.01, 1.01, 1.01)`
   *      overlapping both surfaces by 1% to seal light leaks from all grazing angles.
   *   3. Full-width underside collar (`outerWidth * 0.996` x `outerLength * 0.996`) eliminates any empty air space
   *      between the underside of `topCover` and the top rim of `encasementTrayGroup`.
   */
  private buildTopSleepingCoverAndPiping(
    outerWidth: number,
    outerLength: number,
    _coreWidth: number,
    _coreLength: number,
  ): THREE.MeshStandardMaterial[] {
    const matTopCover = this.materials.get('mat_top_cover')!;

    // 1. Full-Width Underside Collar Slab (`mat_top_cover`) with matching 5cm rounded corners
    // so zero empty air space or sharp corner overhangs exist between `topCover` and `encasementTrayGroup`
    const underSlabGeo = this.createRoundedRectSlabGeometry(
      outerWidth * 0.994,
      outerLength * 0.994,
      0.032,
      0.048,
      12,
    );
    preparePBRGeometry(underSlabGeo);
    const underSlabMesh = new THREE.Mesh(underSlabGeo, matTopCover);
    underSlabMesh.position.y = -0.002; // spans -0.018m (tucked inside tray wall) to +0.014m
    underSlabMesh.castShadow = true;
    underSlabMesh.receiveShadow = true;
    this.layer1TopCoverGroup.add(underSlabMesh);

    // 2. Sculpted Quilted Cloud Top Sleeping Surface (`topCoverMesh`) with 0.015m downward perimeter overlap lip
    // 64x64 grid enables physical displacementMap relief (15mm) when viewed from grazing angles
    const topGeo = new THREE.PlaneGeometry(outerWidth * 0.996, outerLength * 0.996, 64, 64);
    topGeo.rotateX(-Math.PI / 2);

    const posAttr = topGeo.attributes.position;
    const halfW = (outerWidth * 0.996) / 2;
    const halfL = (outerLength * 0.996) / 2;
    const cornerR = 0.048;
    const seamOverlapLipDepth = -0.015; // 0.015m downward curvature/bevel that tucks inside the outer border

    for (let i = 0; i < posAttr.count; i++) {
      let x = posAttr.getX(i);
      let z = posAttr.getZ(i);
      // Clamp corners onto 4.8cm rounded rectangle so top cover matches sidewall rounded corners
      const ix = halfW - cornerR;
      const iz = halfL - cornerR;
      if (Math.abs(x) > ix && Math.abs(z) > iz) {
        const dx = Math.abs(x) - ix;
        const dz = Math.abs(z) - iz;
        const dist = Math.hypot(dx, dz);
        if (dist > cornerR) {
          const scale = cornerR / dist;
          x = Math.sign(x) * (ix + dx * scale);
          z = Math.sign(z) * (iz + dz * scale);
          posAttr.setX(i, x);
          posAttr.setZ(i, z);
        }
      }
      const nx = x / halfW;
      const nz = z / halfL;
      const edgeDrop = Math.pow(Math.max(0, 1 - nx * nx) * Math.max(0, 1 - nz * nz), 0.28);
      const quiltPuff =
        Math.abs(Math.sin(x * 7.5) * Math.cos(z * 7.5)) * 0.018 * edgeDrop;
      // At the outer perimeter (edgeDrop = 0), y = -0.015m (tucking inside the border below casingWallTopY)
      // Across the sleeping surface, it rises smoothly into the plush quilted crown (+0.052m)
      const y = seamOverlapLipDepth + edgeDrop * 0.064 + quiltPuff;

      posAttr.setY(i, y);
    }
    topGeo.computeVertexNormals();
    preparePBRGeometry(topGeo);

    const topCoverMesh = new THREE.Mesh(topGeo, matTopCover);
    topCoverMesh.castShadow = true;
    topCoverMesh.receiveShadow = true;
    this.layer1TopCoverGroup.add(topCoverMesh);

    this.disposables.push(underSlabGeo, topGeo);
    return [matTopCover];
  }

  public setHoverState(hovered: boolean, mouseNdc?: THREE.Vector2): void {
    this.isHovered = hovered;
    if (mouseNdc) {
      this.hoverMouseNdc.copy(mouseNdc);
    }
  }

  public triggerCompressionAtWorldPoint(
    _worldPoint: THREE.Vector3,
    _dentStrength = 0.02,
    autoReleaseAfterMs?: number,
  ): void {
    if (this.autoReleaseTimer !== null) {
      window.clearTimeout(this.autoReleaseTimer);
      this.autoReleaseTimer = null;
    }

    if (!this.isPressed) {
      this.isPressed = true;
      this.tween = {
        startTime: this.lastElapsedTime,
        duration: 0.15,
        fromSinkY: this.currentSinkY,
        toSinkY: -0.15,
        fromScaleY: this.currentPressScaleY,
        toScaleY: 0.9,
        fromScaleXZ: this.currentPressScaleXZ,
        toScaleXZ: 1.02,
        mode: 'press',
      };
    }

    if (autoReleaseAfterMs && autoReleaseAfterMs > 0) {
      this.autoReleaseTimer = window.setTimeout(() => {
        this.autoReleaseTimer = null;
        this.releaseCompression();
      }, autoReleaseAfterMs);
    }
  }

  public releaseCompression(): void {
    if (!this.isPressed && this.tween.mode !== 'press') return;
    this.isPressed = false;
    this.tween = {
      startTime: this.lastElapsedTime,
      duration: 0.8,
      fromSinkY: this.currentSinkY,
      toSinkY: 0.0,
      fromScaleY: this.currentPressScaleY,
      toScaleY: 1.0,
      fromScaleXZ: this.currentPressScaleXZ,
      toScaleXZ: 1.0,
      mode: 'release',
    };
  }

  public setSizeSpec(spec: MattressSizeSpec): void {
    this.targetScaleX = spec.widthMeters / 2.15;
    this.targetScaleZ = spec.lengthMeters / 2.55;
  }

  public setExplodedFactor(target: number): void {
    const clamped = THREE.MathUtils.clamp(target, 0, 1);
    if (clamped < 0.1 && this.activeLayerIndex !== null) {
      this.setActiveLayerIndex(null);
    } else if (clamped >= 0.5 && this.activeLayerIndex === null) {
      this.setActiveLayerIndex(0);
    }
  }

  public setFloatingEnabled(enabled: boolean, staticSurfaceY = 0.36): void {
    this.floatingEnabled = enabled;
    this.baseY = enabled ? 0.52 : staticSurfaceY;
    if (!enabled) {
      this.group.rotation.set(0, 0, 0);
    }
  }

  public getCompressionMm(): number {
    const sinkRatio = Math.abs(this.currentSinkY) / 0.15;
    return Math.round(THREE.MathUtils.clamp(sinkRatio, 0, 1.1) * 55);
  }

  public getCurrentElevation(): number {
    return this.currentElevation;
  }

  public getCurrentScale(): {scaleX: number; scaleZ: number} {
    return {
      scaleX: this.currentScaleX * this.currentPressScaleXZ,
      scaleZ: this.currentScaleZ * this.currentPressScaleXZ,
    };
  }

  public update(elapsedTime: number, deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.05);
    this.lastElapsedTime = elapsedTime;

    // Advance any active 0.4s runtime color preset transitions (`applyColorPreset`)
    updateColorPresetTransitions();

    // 1. Evaluate Method A Whole-Pad Cushion Sink (0.15s power2.out) & Rebound (0.8s elastic.out(1, 0.5))
    if (this.tween.mode !== 'idle') {
      const rawProgress =
        this.tween.duration > 0
          ? (elapsedTime - this.tween.startTime) / this.tween.duration
          : 1;
      const clamped = THREE.MathUtils.clamp(rawProgress, 0, 1);

      if (this.tween.mode === 'press') {
        const eased = easeOutQuad(clamped);
        this.currentSinkY = THREE.MathUtils.lerp(this.tween.fromSinkY, this.tween.toSinkY, eased);
        this.currentPressScaleY = THREE.MathUtils.lerp(
          this.tween.fromScaleY,
          this.tween.toScaleY,
          eased,
        );
        this.currentPressScaleXZ = THREE.MathUtils.lerp(
          this.tween.fromScaleXZ,
          this.tween.toScaleXZ,
          eased,
        );
      } else if (this.tween.mode === 'release') {
        const easedFoam = easeOutPlushMemoryFoam(clamped);
        this.currentSinkY = THREE.MathUtils.lerp(
          this.tween.fromSinkY,
          this.tween.toSinkY,
          easedFoam,
        );
        this.currentPressScaleY = THREE.MathUtils.lerp(
          this.tween.fromScaleY,
          this.tween.toScaleY,
          easedFoam,
        );
        this.currentPressScaleXZ = THREE.MathUtils.lerp(
          this.tween.fromScaleXZ,
          this.tween.toScaleXZ,
          easedFoam,
        );
        if (clamped >= 1) {
          this.tween.mode = 'idle';
        }
      }
    }

    // 2. Zero-G Harmonic Floating Motion (Meadow Mode) vs Static Bed Frame Rest (Bedroom Mode)
    const zeroGFloatOffset = this.floatingEnabled ? Math.sin(elapsedTime * 1.2) * 0.065 : 0;
    this.currentElevation = this.baseY + zeroGFloatOffset + this.currentSinkY;
    this.group.position.y = this.currentElevation;

    // 3. Tactile Hover Cue: Subtle 1° Cursor Parallax Tilt in Meadow Mode
    const idleRotX = this.floatingEnabled ? Math.sin(elapsedTime * 0.95) * 0.008 : 0;
    const idleRotZ = this.floatingEnabled ? Math.cos(elapsedTime * 0.85) * 0.008 : 0;
    const targetRotX =
      this.floatingEnabled && (this.isHovered || this.isPressed)
        ? this.hoverMouseNdc.y * 0.0175
        : idleRotX;
    const targetRotZ =
      this.floatingEnabled && (this.isHovered || this.isPressed)
        ? -this.hoverMouseNdc.x * 0.0175
        : idleRotZ;
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, targetRotX, 0.1);
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, targetRotZ, 0.1);

    // 4. Smoothly damp mattress size changes (Twin -> Cal King)
    this.currentScaleX = THREE.MathUtils.damp(this.currentScaleX, this.targetScaleX, 6.5, dt);
    this.currentScaleZ = THREE.MathUtils.damp(this.currentScaleZ, this.targetScaleZ, 6.5, dt);
    this.group.scale.set(
      this.currentScaleX * this.currentPressScaleXZ,
      this.currentPressScaleY,
      this.currentScaleZ * this.currentPressScaleXZ,
    );

    // 5. Phase 1 Kinematics: Two-Step "Lift-then-Slide" (0% Side-Wall Clipping)
    for (let i = 0; i < this.layerMeshes.length; i++) {
      const layerObj = this.layerMeshes[i];
      const kin = this.layerKinematics[i];
      const elapsed = Math.max(0, elapsedTime - kin.startTime);

      if (kin.mode === 'lift-then-slide') {
        // STEP A (0.00s -> 0.25s, power2.out): Vertical Clearance Lift above tray rim (y: defaultY + 0.30)
        const liftT = THREE.MathUtils.clamp(elapsed / 0.25, 0, 1);
        const easedLift = easeOutQuad(liftT);
        kin.currentX = THREE.MathUtils.lerp(kin.fromX, 0, easedLift);
        kin.currentY = THREE.MathUtils.lerp(kin.fromY, kin.liftTargetY, easedLift);

        // STEP B (0.25s -> 0.50s, power2.out, triggered onComplete of Step A):
        // Forward Slide (z: defaultZ + 0.32) & 3° inspection tilt
        if (elapsed <= 0.25) {
          kin.currentZ = kin.fromZ;
          kin.currentRotX = kin.fromRotX;
        } else {
          const slideT = THREE.MathUtils.clamp((elapsed - 0.25) / 0.25, 0, 1);
          const easedSlide = easeOutQuad(slideT);
          kin.currentZ = THREE.MathUtils.lerp(kin.fromZ, kin.slideTargetZ, easedSlide);
          kin.currentRotX = THREE.MathUtils.lerp(kin.fromRotX, kin.targetRotX, easedSlide);
        }

        const emisT = THREE.MathUtils.clamp(elapsed / 0.35, 0, 1);
        kin.currentEmissive = THREE.MathUtils.lerp(
          kin.fromEmissive,
          kin.toEmissive,
          easeOutQuad(emisT),
        );
      } else if (kin.mode === 'upper-clearance') {
        // Upper layers part vertically at z = 0 so the active layer has 100% clearance
        const t = THREE.MathUtils.clamp(elapsed / 0.25, 0, 1);
        const eased = easeOutQuad(t);
        kin.currentX = THREE.MathUtils.lerp(kin.fromX, 0, eased);
        kin.currentZ = THREE.MathUtils.lerp(kin.fromZ, 0, eased);
        kin.currentRotX = THREE.MathUtils.lerp(kin.fromRotX, 0, eased);
        kin.currentY = THREE.MathUtils.lerp(kin.fromY, kin.liftTargetY, eased);
        kin.currentEmissive = THREE.MathUtils.lerp(kin.fromEmissive, 0, eased);
      } else if (kin.mode === 'tray-slide') {
        // Layer 10 encasement tray slides forward (z: 0.25, y: -0.05) over 0.35s with zero color/emissive green tint
        const t = THREE.MathUtils.clamp(elapsed / 0.35, 0, 1);
        const eased = easeOutQuad(t);
        kin.currentX = THREE.MathUtils.lerp(kin.fromX, 0, eased);
        kin.currentY = THREE.MathUtils.lerp(kin.fromY, kin.liftTargetY, eased);
        kin.currentZ = THREE.MathUtils.lerp(kin.fromZ, kin.slideTargetZ, eased);
        kin.currentRotX = THREE.MathUtils.lerp(kin.fromRotX, 0, eased);
        kin.currentEmissive = 0;
      } else {
        // Reset inactive layers back to resting position (duration: 0.3s, ease: "power2.inOut")
        // If returning from a forward slide (fromZ > 0.02), retract Z first so it never clips the front wall
        const t = THREE.MathUtils.clamp(elapsed / 0.3, 0, 1);
        const eased = easeInOutQuad(t);
        kin.currentX = THREE.MathUtils.lerp(kin.fromX, 0, eased);
        kin.currentZ = THREE.MathUtils.lerp(kin.fromZ, 0, eased);
        kin.currentRotX = THREE.MathUtils.lerp(kin.fromRotX, 0, eased);

        if (kin.fromZ > 0.02) {
          const yT = THREE.MathUtils.clamp((elapsed - 0.1) / 0.2, 0, 1);
          kin.currentY = THREE.MathUtils.lerp(kin.fromY, kin.defaultY, easeInOutQuad(yT));
        } else {
          kin.currentY = THREE.MathUtils.lerp(kin.fromY, kin.defaultY, eased);
        }
        kin.currentEmissive = THREE.MathUtils.lerp(kin.fromEmissive, kin.toEmissive, eased);
      }

      layerObj.position.set(kin.currentX, kin.currentY, kin.currentZ);
      layerObj.rotation.set(kin.currentRotX, 0, 0);

      const mats = this.layerHighlightMaterials[i];
      for (const mat of mats) {
        if (kin.currentEmissive > 0.002) {
          mat.emissive.copy(OCEAN_TEAL_EMISSIVE);
          mat.emissiveIntensity = kin.currentEmissive;
        } else {
          mat.emissive.copy(ZERO_EMISSIVE);
          mat.emissiveIntensity = 0;
        }
      }
    }
  }

  private createFlushHandleStrapTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#191B20';
      ctx.fillRect(0, 0, 64, 256);

      ctx.strokeStyle = '#0E1014';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 2, 56, 252);

      ctx.strokeStyle = '#2C2F38';
      ctx.lineWidth = 2;
      ctx.strokeRect(12, 14, 40, 28);
      ctx.beginPath();
      ctx.moveTo(12, 14);
      ctx.lineTo(52, 42);
      ctx.moveTo(52, 14);
      ctx.lineTo(12, 42);
      ctx.stroke();

      ctx.strokeStyle = '#E6E9F0';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(26, 130, 6, Math.PI * 0.8, Math.PI * 1.9);
      ctx.arc(34, 127, 7.5, Math.PI * 1.1, Math.PI * 2.1);
      ctx.arc(41, 131, 5, Math.PI * 1.3, Math.PI * 0.4);
      ctx.lineTo(21, 136);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  }

  private createHybridSpecTagTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#34373F';
      ctx.fillRect(0, 0, 160, 320);

      ctx.strokeStyle = '#23262C';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 2, 152, 316);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 22px "Mukta", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H Y B R I D', 80, 58);

      ctx.strokeStyle = '#D9DCE2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(46, 84);
      ctx.bezierCurveTo(64, 70, 92, 92, 116, 76);
      ctx.stroke();

      ctx.fillStyle = '#B8BDC7';
      ctx.font = '12px "Mukta", sans-serif';
      ctx.fillText('Signature of Quality', 80, 112);

      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(26, 128);
      ctx.lineTo(134, 128);
      ctx.stroke();

      ctx.fillStyle = '#DCE0E8';
      ctx.font = '11px "Mukta", sans-serif';
      ctx.fillText('Memory', 48, 188);
      ctx.fillText('Foam', 48, 202);
      ctx.fillText('Wrapped', 112, 188);
      ctx.fillText('Coils', 112, 202);

      ctx.fillText('TENCEL™', 48, 264);
      ctx.fillText('Fibers', 48, 278);
      ctx.fillText('Edge', 112, 264);
      ctx.fillText('Support', 112, 278);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  }

  public dispose(): void {
    if (this.autoReleaseTimer !== null) {
      window.clearTimeout(this.autoReleaseTimer);
      this.autoReleaseTimer = null;
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
