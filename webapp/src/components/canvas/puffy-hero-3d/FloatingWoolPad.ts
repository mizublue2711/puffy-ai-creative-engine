import * as THREE from 'three';
import {
  getModelConfig,
  isLayerActiveInModel,
  PUFFY_10_LAYERS,
  resolvePuffyModelKey,
  type PuffyModelKey,
} from './puffyLayersData.ts';
import type {MattressSizeSpec} from './types.ts';
import {
  createMattressPBRMaterials,
  preparePBRGeometry,
  PUFFY_FLAGSHIP_PRESETS,
  switchMattressModel,
  updateColorPresetTransitions,
  updateModelAnatomy,
  type LoadedAssets,
  type MattressModelConfig,
  type MattressModelId,
} from './MattressAnatomy.ts';

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
  private activeEcoModelKey: PuffyModelKey = 'royal';

  // Encasement tray & top cover dynamic sub-mesh references for multi-model Lego swapping
  private sidewallMesh!: THREE.Mesh;
  private badgeMesh!: THREE.Mesh;
  private badgeRoyalMesh!: THREE.Mesh;
  private badgeLuxMesh!: THREE.Mesh;
  private badgeCloudMesh!: THREE.Mesh;
  private badgeMonarchMesh!: THREE.Mesh;
  private handleMeshes: THREE.Mesh[] = [];
  private hybridTagMesh!: THREE.Mesh;
  private cornerStrapMeshes: THREE.Mesh[] = [];

  // Baseline dimensions for 14" Puffy Royal encasement & internal layers 1..9
  private readonly baseLayerThickness: number[] = [
    0.032, // Layer 1: Quilted Cloud Cover underside slab
    0.024, // Layer 2: Premium Blended Wool
    0.018, // Layer 3: Fire-Resistant Fiber Layer
    0.034, // Layer 4: Comfort Quilt Foam Layer
    0.038, // Layer 5: Plush Contouring Foam
    0.036, // Layer 6: Reflexive Memory Foam
    0.046, // Layer 7: Cloud Breeze™ Cooling Technology
    0.118, // Layer 8: Contour-Adapt Pocket Coils
    0.044, // Layer 9: Firm Core Support Foam
  ];
  private readonly baseGripBottomY = -0.238; // gripBase center -0.222, height 0.032
  private readonly baseSidewallBottomY = -0.206;
  private readonly baseSidewallHeight = 0.394; // spans -0.206 to +0.188
  private readonly baseCharcoalHeight = 0.264;

  // 0.4s ease-out ecosystem model morph state (`cloud` 10", `lux` 12", `royal` 14")
  private currentHeightRatio = 1.0;
  private targetHeightRatio = 1.0;
  private fromHeightRatio = 1.0;
  private modelMorphStartTime = 0;
  private readonly modelMorphDuration = 0.4;
  private isMorphingModel = false;
  private pendingMorphStart = false;
  private isExplodedStackMode = false;

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
  private readonly targetDefaultLayerY: number[] = [...this.defaultLayerY];
  private readonly fromDefaultLayerY: number[] = [...this.defaultLayerY];
  private readonly currentLayerScaleY: number[] = new Array(9).fill(1.0);
  private readonly targetLayerScaleY: number[] = new Array(9).fill(1.0);
  private readonly fromLayerScaleY: number[] = new Array(9).fill(1.0);

  // Top Quilted Foam Mesh & Rest Vertices for Local Memory Foam Indentation
  public topQuiltMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null;
  private topQuiltGeo: THREE.PlaneGeometry | null = null;
  private topBaseVertices: Float32Array | null = null;
  private isDented = false;

  // Local Memory Foam Indentation State
  private localHitPoint = new THREE.Vector3(0, 0, 0);
  private currentDentDepth = 0.0;
  private targetDentDepth = 0.0;
  private readonly maxDentDepth = 0.035; // 35mm authentic local memory-foam sink
  private readonly dentRadius = 0.28; // Gaussian sigma radius (~0.5m gentle depression)

  // Two-Tier Motion Decoupling: Continuous Antigravity Idle Wave + Damped Buoyancy
  private readonly floatSpeed = 1.2;
  private readonly floatAmplitude = 0.045; // Smooth zero-g elevation oscillation
  private currentBuoyancySinkY = 0.0;
  private targetBuoyancySinkY = 0.0;
  private readonly maxBuoyancySink = 0.035; // Damped buoyancy (strictly <= 0.05m / ~2 inches clamp)

  // Macro Inertial Angular Tilt / Torque Response
  private currentTorqueRotX = 0.0;
  private currentTorqueRotZ = 0.0;
  private targetTorqueRotX = 0.0;
  private targetTorqueRotZ = 0.0;

  // Subtle volumetric breathing scale
  private currentPressScaleY = 1.0;
  private currentPressScaleXZ = 1.0;

  private isPressed = false;
  private autoReleaseTimer: number | null = null;

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

    // LAYER 3 (index 2): Fire-Resistant Fiber Layer (`mat_fire_felt` #E8D7B8, roughness: 0.92)
    const matFireFelt = this.materials.get('mat_fire_felt')!;
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

    // Synchronize initial seamless 14" Royal stacking & badge/UV state
    this.updateModel('royal', true);
  }

  /**
   * Updates the 3D mattress to the selected Puffy ecosystem model (`cloud` 10", `lux` 12", `royal` 14"):
   * toggles active layers, recomputes zero-gap vertical cavity stacking, updates badge & sidewall UVs,
   * and triggers a smooth 0.4s ease-out morph transition.
   */
  public updateModel(modelKey: PuffyModelKey | string, immediate = false): void {
    const resolvedKey = resolvePuffyModelKey(modelKey);
    const cfg = getModelConfig(resolvedKey);
    const rawHeightRatio = cfg.profileHeightInches / 14;
    const newTargetHeightRatio =
      Number.isFinite(rawHeightRatio) && rawHeightRatio > 0
        ? THREE.MathUtils.clamp(rawHeightRatio, 0.5, 1.25)
        : 1.0;

    // If called before the first update() tick, apply immediately so geometry never waits on uninitialized clocks
    const applyImmediate = immediate || this.lastElapsedTime === 0;

    this.group.visible = true;
    this.encasementTrayGroup.visible = true;
    this.internalCoreGroup.visible = true;

    this.activeEcoModelKey = resolvedKey;
    this.targetHeightRatio = newTargetHeightRatio;

    updateModelAnatomy(resolvedKey, this.loadedAssets, newTargetHeightRatio);

    // Toggle model-specific sidewall materials, dedicated PBR badge meshes, handles, hybrid tag & corner straps
    if (this.sidewallMesh) {
      const {sidewallRoyal, sidewallLux, sidewallCloudFront, sidewallCloudWrap} =
        this.loadedAssets.materials;
      if (resolvedKey === 'cloud') {
        this.sidewallMesh.material = [sidewallCloudFront, sidewallCloudWrap];
      } else if (resolvedKey === 'lux') {
        this.sidewallMesh.material = [sidewallLux, sidewallLux];
      } else {
        this.sidewallMesh.material = [sidewallRoyal, sidewallRoyal];
      }
    }

    if (this.badgeRoyalMesh) this.badgeRoyalMesh.visible = resolvedKey === 'royal';
    if (this.badgeLuxMesh) this.badgeLuxMesh.visible = resolvedKey === 'lux';
    if (this.badgeCloudMesh) this.badgeCloudMesh.visible = resolvedKey === 'cloud';
    if (this.badgeMonarchMesh) this.badgeMonarchMesh.visible = false;
    this.badgeMesh =
      resolvedKey === 'cloud'
        ? this.badgeCloudMesh
        : resolvedKey === 'lux'
          ? this.badgeLuxMesh
          : this.badgeRoyalMesh;

    const showHybridExtras = resolvedKey !== 'cloud';
    for (const handle of this.handleMeshes) {
      handle.visible = showHybridExtras;
    }
    if (this.hybridTagMesh) {
      this.hybridTagMesh.visible = showHybridExtras;
    }
    for (const strap of this.cornerStrapMeshes) {
      strap.visible = resolvedKey !== 'cloud';
    }

    for (let i = 0; i < this.layerMeshes.length; i++) {
      this.layerMeshes[i].visible = isLayerActiveInModel(i + 1, resolvedKey);
    }

    const cavityBottomY = this.baseSidewallBottomY;
    const targetSidewallH = this.baseSidewallHeight * newTargetHeightRatio;
    const targetCasingTopY = cavityBottomY + targetSidewallH;

    let activeInternalBaseSum = 0;
    for (let i = 1; i <= 8; i++) {
      if (this.layerMeshes[i]?.visible) {
        activeInternalBaseSum += this.baseLayerThickness[i];
      }
    }
    const fillScale =
      activeInternalBaseSum > 0 && Number.isFinite(targetSidewallH)
        ? Math.max(0.05, targetSidewallH / activeInternalBaseSum)
        : 1.0;

    let cursorY = cavityBottomY;
    for (let i = 8; i >= 1; i--) {
      if (this.layerMeshes[i]?.visible) {
        const scaledH = this.baseLayerThickness[i] * fillScale;
        this.targetLayerScaleY[i] = fillScale;
        this.targetDefaultLayerY[i] = cursorY + scaledH * 0.5;
        cursorY += scaledH;
      } else {
        this.targetLayerScaleY[i] = 1.0;
        this.targetDefaultLayerY[i] = cursorY;
      }
    }

    // Layer 1 anchors flush at targetCasingTopY with unstretched quilting (scale.y = 1.0)
    this.targetLayerScaleY[0] = 1.0;
    this.targetDefaultLayerY[0] = targetCasingTopY;
    // Layer 10 (encasementTrayGroup) stays fixed at 0.0 (gripBase bottom anchored at -0.238)
    this.targetDefaultLayerY[9] = 0.0;

    if (applyImmediate) {
      this.isMorphingModel = false;
      this.pendingMorphStart = false;
      this.currentHeightRatio = newTargetHeightRatio;
      this.fromHeightRatio = newTargetHeightRatio;
      this.applyTrayGeometryForHeightRatio(this.currentHeightRatio);

      for (let i = 0; i < 9; i++) {
        this.defaultLayerY[i] = this.targetDefaultLayerY[i];
        this.fromDefaultLayerY[i] = this.targetDefaultLayerY[i];
        this.currentLayerScaleY[i] = this.targetLayerScaleY[i];
        this.fromLayerScaleY[i] = this.targetLayerScaleY[i];
        this.layerMeshes[i].scale.y = Math.max(
          0.001,
          i === 0 ? 1.0 : this.currentLayerScaleY[i],
        );
        this.layerMeshes[i].userData.defaultY = this.defaultLayerY[i];
        this.layerKinematics[i].defaultY = this.defaultLayerY[i];
        if (this.activeLayerIndex === null && !this.isExplodedStackMode) {
          this.layerKinematics[i].fromY = this.defaultLayerY[i];
          this.layerKinematics[i].liftTargetY = this.defaultLayerY[i];
          this.layerKinematics[i].currentY = this.defaultLayerY[i];
          this.layerMeshes[i].position.y = this.defaultLayerY[i];
        }
      }
      this.defaultLayerY[9] = this.targetDefaultLayerY[9];
      this.fromDefaultLayerY[9] = this.targetDefaultLayerY[9];
      this.layerMeshes[9].userData.defaultY = this.defaultLayerY[9];
      this.layerKinematics[9].defaultY = this.defaultLayerY[9];
    } else {
      this.fromHeightRatio = Number.isFinite(this.currentHeightRatio)
        ? this.currentHeightRatio
        : newTargetHeightRatio;
      for (let i = 0; i < 9; i++) {
        this.fromDefaultLayerY[i] = Number.isFinite(this.defaultLayerY[i])
          ? this.defaultLayerY[i]
          : this.targetDefaultLayerY[i];
        this.fromLayerScaleY[i] =
          Number.isFinite(this.currentLayerScaleY[i]) && this.currentLayerScaleY[i] > 0
            ? this.currentLayerScaleY[i]
            : this.targetLayerScaleY[i];
      }
      this.fromDefaultLayerY[9] = Number.isFinite(this.defaultLayerY[9])
        ? this.defaultLayerY[9]
        : 0.0;
      this.modelMorphStartTime = this.lastElapsedTime;
      this.pendingMorphStart = true;
      this.isMorphingModel = true;
    }

    if (this.isExplodedStackMode) {
      this.setAllLayersExplodedStack(true, applyImmediate);
    } else if (this.activeLayerIndex !== null) {
      this.setActiveLayerIndex(this.activeLayerIndex);
      if (applyImmediate) {
        for (let i = 0; i < this.layerMeshes.length; i++) {
          const kin = this.layerKinematics[i];
          kin.currentX = 0;
          kin.currentY = Number.isFinite(kin.liftTargetY) ? kin.liftTargetY : kin.defaultY;
          kin.currentZ = Number.isFinite(kin.slideTargetZ) ? kin.slideTargetZ : 0;
          kin.currentRotX = Number.isFinite(kin.targetRotX) ? kin.targetRotX : 0;
          kin.currentEmissive = kin.toEmissive;
          this.layerMeshes[i].position.set(kin.currentX, kin.currentY, kin.currentZ);
          this.layerMeshes[i].rotation.set(kin.currentRotX, 0, 0);
        }
      }
    }
  }

  private applyTrayGeometryForHeightRatio(ratio: number): void {
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1.0;
    const clampedRatio = THREE.MathUtils.clamp(safeRatio, 0.5, 1.25);

    if (this.sidewallMesh) {
      this.sidewallMesh.scale.y = clampedRatio;
      this.sidewallMesh.position.y =
        this.baseSidewallBottomY + this.baseSidewallHeight * clampedRatio * 0.5;
    }

    const scaledCharcoalY =
      this.baseSidewallBottomY + this.baseCharcoalHeight * clampedRatio * 0.5;
    const scaledFullFrontMidY =
      this.baseSidewallBottomY + this.baseSidewallHeight * clampedRatio * 0.5;
    const badgeScale = 0.85 + 0.15 * clampedRatio;

    for (const badge of [
      this.badgeRoyalMesh,
      this.badgeLuxMesh,
      this.badgeCloudMesh,
      this.badgeMonarchMesh,
    ]) {
      if (!badge) continue;
      badge.position.y = scaledCharcoalY;
      badge.scale.set(badgeScale, badgeScale, 1);
    }

    for (const handle of this.handleMeshes) {
      handle.position.y = scaledCharcoalY;
      handle.scale.y = clampedRatio;
    }

    if (this.hybridTagMesh) {
      this.hybridTagMesh.position.y = scaledCharcoalY;
      this.hybridTagMesh.scale.y = clampedRatio;
    }

    if (this.hitProxyMesh) {
      const proxyScaleY = Math.max(
        0.1,
        (0.077 + this.baseSidewallHeight * clampedRatio) / 0.471,
      );
      this.hitProxyMesh.scale.y = proxyScaleY;
      this.hitProxyMesh.position.y = this.baseGripBottomY + 0.471 * proxyScaleY * 0.5;
    }
  }

  public getActiveEcoModelKey(): PuffyModelKey {
    return this.activeEcoModelKey;
  }

  public getHeightDeltaFromRoyal(): number {
    const safeRatio = Number.isFinite(this.currentHeightRatio) ? this.currentHeightRatio : 1.0;
    return (safeRatio - 1.0) * this.baseSidewallHeight;
  }

  public getCurrentHeightRatio(): number {
    return Number.isFinite(this.currentHeightRatio) ? this.currentHeightRatio : 1.0;
  }

  /**
   * Dual Flagship Modular "Lego" Swapping Logic:
   * Routes ecosystem keys (`'cloud' | 'lux' | 'royal'`) to `updateModel`, and preserves
   * `'puffy-royal'` / `'puffy-monarch'` flagship preset switching.
   */
  public switchMattressModel(modelKey: MattressModelId | PuffyModelKey): void {
    if (modelKey === 'cloud' || modelKey === 'lux' || modelKey === 'royal') {
      this.updateModel(modelKey);
      return;
    }
    this.activeModelKey = modelKey;
    switchMattressModel(modelKey, this.loadedAssets);

    const isMonarch = modelKey === 'puffy-monarch';
    if (this.badgeRoyalMesh) this.badgeRoyalMesh.visible = !isMonarch;
    if (this.badgeLuxMesh) this.badgeLuxMesh.visible = false;
    if (this.badgeCloudMesh) this.badgeCloudMesh.visible = false;
    if (this.badgeMonarchMesh) this.badgeMonarchMesh.visible = isMonarch;
    this.badgeMesh = isMonarch ? this.badgeMonarchMesh : this.badgeRoyalMesh;
    for (const handle of this.handleMeshes) {
      handle.visible = true;
    }
    if (this.hybridTagMesh) {
      this.hybridTagMesh.visible = true;
    }
    for (const strap of this.cornerStrapMeshes) {
      strap.visible = true;
    }
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
    this.isExplodedStackMode = false;
    let normalized =
      index !== null && index >= 0 && index < this.layerMeshes.length ? index : null;

    if (normalized !== null && !this.layerMeshes[normalized]?.visible) {
      const firstVisible = this.layerMeshes.findIndex((layerObj) => layerObj.visible);
      normalized = firstVisible >= 0 ? firstVisible : null;
    }

    this.activeLayerIndex = normalized;

    const targetCasingTopY =
      this.baseSidewallBottomY + this.baseSidewallHeight * this.targetHeightRatio;
    const trayRimClearanceY = targetCasingTopY + 0.052; // Ensures even lower layers clear the active tray rim

    for (let i = 0; i < this.layerMeshes.length; i++) {
      const kin = this.layerKinematics[i];
      kin.startTime = this.lastElapsedTime;
      kin.fromX = kin.currentX;
      kin.fromY = kin.currentY;
      kin.fromZ = kin.currentZ;
      kin.fromRotX = kin.currentRotX;
      kin.fromEmissive = kin.currentEmissive;

      if (!this.layerMeshes[i].visible) {
        kin.mode = 'reset';
        kin.liftTargetY = this.targetDefaultLayerY[i];
        kin.slideTargetZ = 0;
        kin.targetRotX = 0;
        kin.toEmissive = 0.0;
        continue;
      }

      // Layer 10 (index 9) is `encasementTrayGroup`: slide forward & drop slightly without mutating or green-tinting casing color
      if (i === 9) {
        if (normalized === 9) {
          kin.mode = 'tray-slide';
          kin.liftTargetY = -0.05;
          kin.slideTargetZ = 0.25;
          kin.targetRotX = 0;
        } else {
          kin.mode = 'reset';
          kin.liftTargetY = this.targetDefaultLayerY[i];
          kin.slideTargetZ = 0;
          kin.targetRotX = 0;
        }
        kin.toEmissive = 0.0;
        continue;
      }

      if (normalized !== null && i === normalized) {
        // Active Layer (Layers 1..9): Lift-then-Slide!
        kin.mode = 'lift-then-slide';
        kin.liftTargetY = Math.max(this.targetDefaultLayerY[i] + 0.3, trayRimClearanceY);
        kin.slideTargetZ = kin.defaultZ + 0.32;
        kin.targetRotX = THREE.MathUtils.degToRad(3);
        kin.toEmissive = 0.22;
      } else if (normalized !== null && normalized < 9 && i < normalized) {
        // Layers positioned ABOVE the selected layer lift cleanly upward at z=0 so the active layer
        // can lift above the tray rim without passing through upper layers
        const activeTargetY = Math.max(
          this.targetDefaultLayerY[normalized] + 0.3,
          trayRimClearanceY,
        );
        const stackOffsetAboveActive =
          this.targetDefaultLayerY[i] - this.targetDefaultLayerY[normalized] + 0.045;
        kin.mode = 'upper-clearance';
        kin.liftTargetY = activeTargetY + stackOffsetAboveActive;
        kin.slideTargetZ = 0;
        kin.targetRotX = 0;
        kin.toEmissive = 0.0;
      } else {
        // Inactive layers below the active layer (or all layers when deselected) reset to resting position
        kin.mode = 'reset';
        kin.liftTargetY = this.targetDefaultLayerY[i];
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
   * Raycasts directly against visible 3D layer meshes so clicking a layer in 3D selects it.
   */
  public raycastLayerIndex(raycaster: THREE.Raycaster): number | null {
    const visibleLayerMeshes = this.layerMeshes.filter((layerObj) => layerObj.visible);
    const hits = raycaster.intersectObjects(visibleLayerMeshes, true);
    for (const hit of hits) {
      let visibleInHierarchy = true;
      let visNode: THREE.Object3D | null = hit.object;
      while (visNode) {
        if (!visNode.visible) {
          visibleInHierarchy = false;
          break;
        }
        visNode = visNode.parent;
      }
      if (!visibleInHierarchy) continue;

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
   * Builds Layer 7: Cloud Breeze™ Cooling Technology (`mat_transition_foam` #3E4F7D)
   * laying flat on the horizontal XZ plane with sculpted 5-zone contour channel grooves
   * (wavy cooling grid channels) matching the reference surface relief.
   */
  private buildContourTransitionFoam(
    width: number,
    height: number,
    length: number,
  ): THREE.MeshStandardMaterial[] {
    const baseHeight = height * 0.62;
    const padHeight = height * 0.38;

    const foamMat = this.materials.get('mat_transition_foam')!;
    const channelHighlightMat = foamMat.clone();
    channelHighlightMat.color.set('#53689E');
    this.disposables.push(channelHighlightMat);

    const baseSlabGeo = new THREE.BoxGeometry(width, baseHeight, length);
    preparePBRGeometry(baseSlabGeo);
    const baseSlab = new THREE.Mesh(baseSlabGeo, foamMat);
    baseSlab.position.set(0, -padHeight * 0.5, 0);
    baseSlab.rotation.set(0, 0, 0);
    baseSlab.castShadow = true;
    baseSlab.receiveShadow = true;
    this.layer7CloudBreezeGroup.add(baseSlab);

    // Sculpted rounded-cloud contour pad geometry for 5-zone wavy cooling grid channels
    const cols = 12;
    const rows = 15;
    const cellW = (width * 0.96) / cols;
    const cellL = (length * 0.96) / rows;
    const padW = cellW * 0.72;
    const padL = cellL * 0.7;
    const padR = Math.min(padW, padL) * 0.34;

    const hw = padW * 0.5;
    const hl = padL * 0.5;
    const padShape = new THREE.Shape();
    padShape.moveTo(-hw + padR, -hl);
    padShape.lineTo(hw - padR, -hl);
    padShape.quadraticCurveTo(hw, -hl, hw, -hl + padR);
    padShape.lineTo(hw, hl - padR);
    padShape.quadraticCurveTo(hw, hl, hw - padR, hl);
    padShape.lineTo(-hw + padR, hl);
    padShape.quadraticCurveTo(-hw, hl, -hw, hl - padR);
    padShape.lineTo(-hw, -hl + padR);
    padShape.quadraticCurveTo(-hw, -hl, -hw + padR, -hl);

    const padGeo = new THREE.ExtrudeGeometry(padShape, {
      depth: padHeight * 0.78,
      bevelEnabled: true,
      bevelThickness: padHeight * 0.22,
      bevelSize: 0.006,
      bevelSegments: 2,
      curveSegments: 6,
    });
    padGeo.rotateX(-Math.PI * 0.5);
    preparePBRGeometry(padGeo);

    const totalPads = cols * rows;
    const padsInstanced = new THREE.InstancedMesh(padGeo, channelHighlightMat, totalPads);
    padsInstanced.castShadow = true;
    padsInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const normZ = r / (rows - 1) - 0.5; // -0.5 (head) to +0.5 (foot)
      // 5-zone ergonomic modulation: lumbar center (|normZ| < 0.16) denser/firmer, shoulders/hips contoured
      const zoneIndex = Math.min(4, Math.floor((normZ + 0.5) * 5));
      const zoneScaleZ = zoneIndex === 2 ? 1.16 : zoneIndex === 1 || zoneIndex === 3 ? 0.92 : 1.0;
      const waveOffsetX = Math.sin(r * 0.85) * cellW * 0.16;

      for (let c = 0; c < cols; c++) {
        const normX = c / (cols - 1) - 0.5;
        const waveOffsetZ = Math.cos(c * 0.75) * cellL * 0.1;
        const px = normX * (width * 0.96 - cellW) + waveOffsetX;
        const pz = normZ * (length * 0.96 - cellL) + waveOffsetZ;
        dummy.position.set(
          THREE.MathUtils.clamp(px, -width * 0.47, width * 0.47),
          baseHeight * 0.5 - padHeight * 0.5,
          THREE.MathUtils.clamp(pz, -length * 0.47, length * 0.47),
        );
        dummy.scale.set(1.0, 1.0, zoneScaleZ);
        dummy.updateMatrix();
        padsInstanced.setMatrixAt(idx++, dummy.matrix);
      }
    }
    padsInstanced.instanceMatrix.needsUpdate = true;
    padsInstanced.computeBoundingSphere();
    this.layer7CloudBreezeGroup.add(padsInstanced);

    this.disposables.push(baseSlabGeo, padGeo);
    return [foamMat, channelHighlightMat];
  }

  /**
   * Builds Layer 8: Contour-Adapt Pocket Coils (`mat_pocket_coils` — LOCKED to #F8F9FA clean white spun-bond fabric)
   * enclosed within a high-density white foam perimeter casing (`mat_coil_perimeter_foam`).
   */
  private buildWhitePocketSpringsCore(
    width: number,
    length: number,
  ): THREE.MeshStandardMaterial[] {
    const matPocketCoils = this.materials.get('mat_pocket_coils')!;
    const matPerimeterFoam =
      this.materials.get('mat_coil_perimeter_foam') ?? this.materials.get('mat_cooling_foam')!;
    const coilCapMat = new THREE.MeshStandardMaterial({
      name: 'mat_pocket_coils_cap',
      map: null,
      color: new THREE.Color('#F8F9FA'),
      roughness: 0.88,
      metalness: 0.0,
    });

    const coilHeight = 0.118;
    const railThick = 0.095;

    // High-density white foam perimeter casing (Left, Right, Back walls + low-profile front support rim)
    const sideRailGeo = new THREE.BoxGeometry(railThick, coilHeight, length);
    preparePBRGeometry(sideRailGeo);
    const leftRail = new THREE.Mesh(sideRailGeo, matPerimeterFoam);
    leftRail.position.set(-width * 0.5 + railThick * 0.5, 0, 0);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;

    const rightRail = new THREE.Mesh(sideRailGeo, matPerimeterFoam);
    rightRail.position.set(width * 0.5 - railThick * 0.5, 0, 0);
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;

    const innerSpanW = width - railThick * 2;
    const backRailGeo = new THREE.BoxGeometry(innerSpanW, coilHeight, railThick);
    preparePBRGeometry(backRailGeo);
    const backRail = new THREE.Mesh(backRailGeo, matPerimeterFoam);
    backRail.position.set(0, 0, -length * 0.5 + railThick * 0.5);
    backRail.castShadow = true;
    backRail.receiveShadow = true;

    // Low-profile front foam lip so the front row of fabric-encased pocket coils remains clearly visible
    const frontLipGeo = new THREE.BoxGeometry(innerSpanW, 0.02, 0.065);
    preparePBRGeometry(frontLipGeo);
    const frontLip = new THREE.Mesh(frontLipGeo, matPerimeterFoam);
    frontLip.position.set(0, -coilHeight * 0.5 + 0.01, length * 0.5 - 0.0325);
    frontLip.castShadow = true;
    frontLip.receiveShadow = true;

    this.layer8PocketSpringsGroup.add(leftRail, rightRail, backRail, frontLip);

    // Individually fabric-encased cylindrical coils inside the foam perimeter cavity
    const coilRadius = 0.056;
    const coilGeo = new THREE.CylinderGeometry(coilRadius, coilRadius, coilHeight, 20, 1, false);
    preparePBRGeometry(coilGeo);

    const cols = 14;
    const rows = 15;
    const totalCoils = cols * rows;
    const coilInstanced = new THREE.InstancedMesh(
      coilGeo,
      [matPocketCoils, coilCapMat, coilCapMat],
      totalCoils,
    );
    coilInstanced.castShadow = true;
    coilInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const gridW = innerSpanW - coilRadius * 2.15;
    const gridL = length - railThick - 0.03 - coilRadius * 2.15;
    const startX = -gridW * 0.5;
    const startZ = -length * 0.5 + railThick + coilRadius * 1.1;

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

    this.disposables.push(sideRailGeo, backRailGeo, frontLipGeo, coilGeo, coilCapMat);
    return [matPocketCoils, coilCapMat, matPerimeterFoam];
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
    const {
      sidewallRoyal: matSidewallStrip,
      sidewallLux: matSidewallLux,
      sidewallCloudFront: matSidewallCloudFront,
      sidewallCloudWrap: matSidewallCloudWrap,
      brandBadgeRoyal: matBadgeRoyal,
      brandBadgeLux: matBadgeLux,
      brandBadgeCloud: matBadgeCloud,
      brandBadgeMonarch: matBadgeMonarch,
    } = this.loadedAssets.materials;
    const matPipingCord = this.materials.get('mat_piping_cord')!;

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
    const sidewallMesh = new THREE.Mesh(sidewallGeo, [matSidewallStrip, matSidewallStrip]);
    sidewallMesh.position.set(0, sidewallY, 0);
    sidewallMesh.castShadow = true;
    sidewallMesh.receiveShadow = true;
    this.encasementTrayGroup.add(sidewallMesh);
    this.sidewallMesh = sidewallMesh;
    this.disposables.push(sidewallGeo);

    // 3. Dedicated Embroidered Brand Badges per model (zero shared normal/AO ROYAL ghosting)
    // Unified badge geometry across ALL 3 tiers (Cloud = Lux = Royal): aspect ratio ~2.2:1 (0.38m x 0.172m)
    // Height occupies ~65% of the lower sidewall tier (0.264m * 0.65 = 0.1716m ~ 0.172m)
    // Width spans ~48% of the horizontal gap between front handles (~0.797m gap * 0.48 = 0.38m)
    const unifiedBadgeGeo = new THREE.PlaneGeometry(0.38, 0.172);
    preparePBRGeometry(unifiedBadgeGeo);

    const createBadgeMesh = (
      name: string,
      mat: THREE.MeshPhysicalMaterial,
      visible: boolean,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(unifiedBadgeGeo, mat);
      mesh.name = name;
      mesh.position.set(0, charcoalY, length / 2 + 0.0018);
      mesh.visible = visible;
      this.encasementTrayGroup.add(mesh);
      return mesh;
    };

    this.badgeRoyalMesh = createBadgeMesh('puffy-embroidered-badge-royal', matBadgeRoyal, true);
    this.badgeLuxMesh = createBadgeMesh('puffy-embroidered-badge-lux', matBadgeLux, false);
    this.badgeCloudMesh = createBadgeMesh('puffy-embroidered-badge-cloud', matBadgeCloud, false);
    this.badgeMonarchMesh = createBadgeMesh(
      'puffy-embroidered-badge-monarch',
      matBadgeMonarch,
      false,
    );
    this.badgeMesh = this.badgeRoyalMesh;

    // 4. Symmetrical Vertical Fabric Loop Handles flush against the front wall (x = ±width * 0.28)
    const handleTex = this.createFlushHandleStrapTexture(maxAnisotropy);
    const handleGeo = new THREE.BoxGeometry(0.056, charcoalHeight * 0.95, 0.008);
    const handleFaceMat = new THREE.MeshStandardMaterial({
      map: handleTex,
      roughness: 0.78,
      metalness: 0.0,
    });

    this.handleMeshes = [];
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
      this.handleMeshes.push(handleMesh);
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
    this.hybridTagMesh = hybridTagMesh;

    this.disposables.push(
      unifiedBadgeGeo,
      handleTex,
      handleGeo,
      handleFaceMat,
      hybridTagTex,
      hybridTagGeo,
      hybridTagMat,
    );

    return [
      matGripBase,
      matSidewallStrip,
      matSidewallLux,
      matSidewallCloudFront,
      matSidewallCloudWrap,
    ];
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

    // Split perimeter into 2 material groups:
    // materialIndex 0 = Front Foot Panel (+Z edge between 45° front-right & 45° front-left corners)
    // materialIndex 1 = Left, Back, and Right 3-side wrap
    const mid0 = Math.floor(cornerSegments / 2);
    const mid1 = cornerSegments + 1 + Math.floor(cornerSegments / 2);
    const totalSegments = pts.length - 1;
    if (mid0 > 0 && mid1 > mid0 && mid1 < totalSegments) {
      geo.addGroup(0, mid0 * 6, 1);
      geo.addGroup(mid0 * 6, (mid1 - mid0) * 6, 0);
      geo.addGroup(mid1 * 6, (totalSegments - mid1) * 6, 1);
    } else {
      geo.addGroup(0, indices.length, 0);
    }

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
    const uvAttr = topGeo.attributes.uv;
    const halfW = (outerWidth * 0.996) / 2;
    const halfL = (outerLength * 0.996) / 2;
    const cornerR = 0.048;
    const seamOverlapLipDepth = -0.015; // 0.015m downward curvature/bevel that tucks inside the outer border
    const ix = halfW - cornerR;
    const iz = halfL - cornerR;

    // Maps any (x, z) in [-halfW, halfW] x [-halfL, halfL] to a strictly non-degenerate
    // concentric rounded-rectangle grid + normalized ring parameter s in [0, 1].
    const mapToRoundedRect = (rawX: number, rawZ: number): {x: number; z: number; s: number} => {
      const u = THREE.MathUtils.clamp(rawX / halfW, -1, 1);
      const v = THREE.MathUtils.clamp(rawZ / halfL, -1, 1);
      const s = Math.max(Math.abs(u), Math.abs(v));
      if (s < 1e-6) {
        return {x: 0, z: 0, s: 0};
      }
      // Project onto unit square perimeter, then map onto rounded-rectangle perimeter
      let bx = (u / s) * halfW;
      let bz = (v / s) * halfL;
      if (Math.abs(bx) > ix && Math.abs(bz) > iz) {
        const dx = Math.abs(bx) - ix;
        const dz = Math.abs(bz) - iz;
        const dist = Math.hypot(dx, dz) || 1;
        bx = Math.sign(bx) * (ix + (dx / dist) * cornerR);
        bz = Math.sign(bz) * (iz + (dz / dist) * cornerR);
      }
      return {x: s * bx, z: s * bz, s};
    };

    const sampleTopCoverY = (x: number, z: number, sOverride?: number): number => {
      let s = sOverride;
      if (s === undefined) {
        const u = Math.abs(x) / halfW;
        const v = Math.abs(z) / halfL;
        s = Math.min(1, Math.max(u, v));
      }
      const edgeDrop = Math.pow(Math.max(0, 1 - s * s), 0.34);
      const quiltPuff =
        Math.abs(Math.sin(x * 7.5) * Math.cos(z * 7.5)) * 0.010 * edgeDrop;
      return seamOverlapLipDepth + edgeDrop * 0.060 + quiltPuff;
    };

    for (let i = 0; i < posAttr.count; i++) {
      const {x, z, s} = mapToRoundedRect(posAttr.getX(i), posAttr.getZ(i));
      posAttr.setX(i, x);
      posAttr.setZ(i, z);
      posAttr.setY(i, sampleTopCoverY(x, z, s));
      if (uvAttr) {
        uvAttr.setXY(i, (x / (halfW * 2)) + 0.5, (z / (halfL * 2)) + 0.5);
      }
    }
    topGeo.computeVertexNormals();
    preparePBRGeometry(topGeo);

    const topCoverMesh = new THREE.Mesh(topGeo, matTopCover);
    topCoverMesh.castShadow = true;
    topCoverMesh.receiveShadow = true;
    this.layer1TopCoverGroup.add(topCoverMesh);

    // 3. Two Dark Charcoal Diagonal Woven Corner Strap Badges angled 45° across the top front corners
    this.cornerStrapMeshes = [];
    const matCornerStrap = this.materials.get('mat_corner_strap');
    if (matCornerStrap) {
      const strapSpan = 0.27;
      const strapWidth = 0.072;
      const segU = 20;
      const segV = 8;

      for (const sideSign of [-1, 1] as const) {
        const strapGeo = new THREE.BufferGeometry();
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        // 45° diagonal across the actual front-left / front-right corner
        const pStart = new THREE.Vector2(sideSign * halfW, halfL - strapSpan);
        const pEnd = new THREE.Vector2(sideSign * (halfW - strapSpan), halfL);
        const dir = pEnd.clone().sub(pStart).normalize();
        const inwardNormal =
          sideSign < 0 ? new THREE.Vector2(dir.y, -dir.x) : new THREE.Vector2(-dir.y, dir.x);
        if (inwardNormal.dot(new THREE.Vector2(-sideSign, -1)) < 0) {
          inwardNormal.negate();
        }

        for (let iv = 0; iv <= segV; iv++) {
          const vFrac = iv / segV; // 0 = outer corner edge, 1 = inner edge
          for (let iu = 0; iu <= segU; iu++) {
            const uFrac = iu / segU;
            const tU = uFrac;
            const basePt = pStart.clone().lerp(pEnd, tU);
            const pt = basePt.addScaledVector(inwardNormal, vFrac * strapWidth);

            // Clamp smoothly to the rounded-rect perimeter so the strap never overhangs into air
            let cx = THREE.MathUtils.clamp(pt.x, -halfW, halfW);
            let cz = THREE.MathUtils.clamp(pt.y, -halfL, halfL);
            if (Math.abs(cx) > ix && Math.abs(cz) > iz) {
              const dx = Math.abs(cx) - ix;
              const dz = Math.abs(cz) - iz;
              const dist = Math.hypot(dx, dz);
              if (dist > cornerR) {
                cx = Math.sign(cx) * (ix + (dx / dist) * cornerR);
                cz = Math.sign(cz) * (iz + (dz / dist) * cornerR);
              }
            }

            // +0.003m (+3mm) elevation clearance above the quilted cover curvature
            const cy = sampleTopCoverY(cx, cz) + 0.003;

            positions.push(cx, cy, cz);
            const texU = sideSign < 0 ? uFrac : 1 - uFrac;
            uvs.push(texU, vFrac);
          }
        }

        for (let iv = 0; iv < segV; iv++) {
          for (let iu = 0; iu < segU; iu++) {
            const a = iv * (segU + 1) + iu;
            const b = a + 1;
            const c = (iv + 1) * (segU + 1) + iu;
            const d = c + 1;
            if (sideSign < 0) {
              indices.push(a, b, c, b, d, c);
            } else {
              indices.push(a, c, b, b, c, d);
            }
          }
        }

        strapGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        strapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        strapGeo.setIndex(indices);
        strapGeo.computeVertexNormals();
        preparePBRGeometry(strapGeo);

        const strapMesh = new THREE.Mesh(strapGeo, matCornerStrap);
        strapMesh.name = sideSign < 0 ? 'corner-strap-left' : 'corner-strap-right';
        strapMesh.castShadow = false;
        strapMesh.receiveShadow = true;
        this.layer1TopCoverGroup.add(strapMesh);
        this.cornerStrapMeshes.push(strapMesh);
        this.disposables.push(strapGeo);
      }
    }

    this.topQuiltMesh = topCoverMesh;
    this.topQuiltGeo = topGeo;
    this.topBaseVertices = new Float32Array(posAttr.array.length);
    this.topBaseVertices.set(posAttr.array);

    this.disposables.push(underSlabGeo, topGeo);
    return matCornerStrap ? [matTopCover, matCornerStrap] : [matTopCover];
  }

  public setHoverState(hovered: boolean, mouseNdc?: THREE.Vector2): void {
    this.isHovered = hovered;
    if (mouseNdc) {
      this.hoverMouseNdc.copy(mouseNdc);
    }
  }

  public triggerCompressionAtWorldPoint(
    worldPoint: THREE.Vector3,
    dentStrength = 0.032,
    autoReleaseAfterMs?: number,
  ): void {
    if (this.autoReleaseTimer !== null) {
      window.clearTimeout(this.autoReleaseTimer);
      this.autoReleaseTimer = null;
    }

    this.isPressed = true;

    // Transform world hit point into local coordinates of topQuiltMesh
    if (this.topQuiltMesh) {
      this.topQuiltMesh.updateWorldMatrix(true, false);
      const scratch = new THREE.Vector3();
      this.topQuiltMesh.worldToLocal(scratch.copy(worldPoint));
      this.localHitPoint.copy(scratch);
    } else {
      this.localHitPoint.set(worldPoint.x, 0, worldPoint.z);
    }

    // 1. Local Dent Target Depth (simulating Puffy high-density memory foam)
    this.targetDentDepth = Math.min(Math.max(dentStrength, 0.015), this.maxDentDepth);

    // 2. Macro Inertial Response (Subtle Buoyancy & Tilt)
    const halfW = (2.15 * this.currentScaleX) / 2;
    const halfL = (2.55 * this.currentScaleZ) / 2;
    const normX = THREE.MathUtils.clamp(this.localHitPoint.x / halfW, -1, 1);
    const normZ = THREE.MathUtils.clamp(this.localHitPoint.z / halfL, -1, 1);

    // Gentle angular torque:
    // If pressed on the right edge (normX = +1), tilt rotation.z by +0.03 rad
    // If pressed on the front (normZ = +1), tilt rotation.x by +0.03 rad
    this.targetTorqueRotZ = normX * 0.03;
    this.targetTorqueRotX = normZ * 0.03;

    // Damped vertical impulse: maximum displacement clamped to 0.035m (strictly <= 0.05m / ~2 inches),
    // absorbing the press like a floating cushion on calm water, never breaching the ground plane
    this.targetBuoyancySinkY = THREE.MathUtils.clamp(
      this.maxBuoyancySink * (0.65 + 0.35 * (1 - Math.hypot(normX, normZ) * 0.5)),
      0.015,
      this.maxBuoyancySink,
    );

    if (autoReleaseAfterMs && autoReleaseAfterMs > 0) {
      this.autoReleaseTimer = window.setTimeout(() => {
        this.autoReleaseTimer = null;
        this.releaseCompression();
      }, autoReleaseAfterMs);
    }
  }

  public releaseCompression(): void {
    this.isPressed = false;
    this.targetDentDepth = 0.0;
    this.targetBuoyancySinkY = 0.0;
    this.targetTorqueRotX = 0.0;
    this.targetTorqueRotZ = 0.0;
    if (this.autoReleaseTimer !== null) {
      window.clearTimeout(this.autoReleaseTimer);
      this.autoReleaseTimer = null;
    }
  }

  public setSizeSpec(spec: MattressSizeSpec): void {
    const nextX = spec.widthMeters / 2.15;
    const nextZ = spec.lengthMeters / 2.55;
    if (Number.isFinite(nextX) && nextX > 0) {
      this.targetScaleX = nextX;
    }
    if (Number.isFinite(nextZ) && nextZ > 0) {
      this.targetScaleZ = nextZ;
    }
  }

  public setExplodedFactor(target: number): void {
    const clamped = THREE.MathUtils.clamp(target, 0, 1);
    if (clamped < 0.1 && this.activeLayerIndex !== null) {
      this.setActiveLayerIndex(null);
    } else if (clamped >= 0.5 && this.activeLayerIndex === null) {
      this.setActiveLayerIndex(0);
    }
  }

  /**
   * Separates active model layers vertically in a clean exploded stack above the encasement tray
   * with compact spacing for 6 (Cloud), 8 (Lux), or 10 (Royal) layers.
   */
  public setAllLayersExplodedStack(exploded: boolean, immediate = false): void {
    if (!exploded) {
      this.isExplodedStackMode = false;
      this.setActiveLayerIndex(null);
      return;
    }
    this.isExplodedStackMode = true;
    this.activeLayerIndex = 0;

    const stackY: number[] = new Array(10).fill(0);
    if (this.activeEcoModelKey === 'royal') {
      const royalStack = [
        1.24, // Layer 1: Quilted Cloud Cover + Corner Straps
        1.11, // Layer 2: Premium Blended Wool (#EADCC3)
        1.01, // Layer 3: Fire-Resistant Fiber Layer (#E8D7B8)
        0.90, // Layer 4: Comfort Quilt Foam (#B4D5F6)
        0.78, // Layer 5: Plush Contouring Foam (#4A5D84 + gel speckles)
        0.66, // Layer 6: Reflexive Memory Foam (#46BCA8)
        0.53, // Layer 7: Cloud Breeze™ 5-Zone Contour Channels
        0.36, // Layer 8: Contour-Adapt Pocket Coils + White Foam Perimeter
        0.20, // Layer 9: Firm Core Support Foam (#E8E6E1)
        -0.16, // Layer 10: Open-Top Encasement Tray & Grip Base
      ];
      for (let i = 0; i < 10; i++) {
        stackY[i] = royalStack[i];
      }
    } else {
      const trayY = this.activeEcoModelKey === 'cloud' ? -0.14 : -0.15;
      stackY[9] = trayY;
      const targetTopRim =
        this.baseSidewallBottomY + this.baseSidewallHeight * this.targetHeightRatio;
      const gap = this.activeEcoModelKey === 'cloud' ? 0.065 : 0.056;
      let cursorTop = Math.max(0.1, trayY + targetTopRim + 0.16);

      for (let i = 8; i >= 1; i--) {
        if (!this.layerMeshes[i].visible) {
          stackY[i] = this.targetDefaultLayerY[i];
          continue;
        }
        const halfH = this.baseLayerThickness[i] * this.targetLayerScaleY[i] * 0.5;
        const centerY = cursorTop + halfH;
        stackY[i] = centerY;
        cursorTop = centerY + halfH + gap;
      }
      stackY[0] = cursorTop + 0.022;
    }

    for (let i = 0; i < this.layerMeshes.length; i++) {
      const kin = this.layerKinematics[i];
      kin.startTime = this.lastElapsedTime;
      kin.fromX = kin.currentX;
      kin.fromY = kin.currentY;
      kin.fromZ = kin.currentZ;
      kin.fromRotX = kin.currentRotX;
      kin.fromEmissive = kin.currentEmissive;

      if (!this.layerMeshes[i].visible) {
        kin.mode = 'reset';
        kin.liftTargetY = this.targetDefaultLayerY[i];
        kin.slideTargetZ = 0;
        kin.targetRotX = 0;
        kin.toEmissive = 0;
        continue;
      }

      kin.mode = 'upper-clearance';
      kin.liftTargetY = stackY[i] ?? kin.defaultY;
      kin.slideTargetZ = 0;
      kin.targetRotX = 0;
      kin.toEmissive = 0;

      if (immediate) {
        kin.currentX = 0;
        kin.currentY = kin.liftTargetY;
        kin.currentZ = 0;
        kin.currentRotX = 0;
        kin.currentEmissive = 0;
        this.layerMeshes[i].position.set(0, kin.currentY, 0);
        this.layerMeshes[i].rotation.set(0, 0, 0);
      }
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
    const foamMm = (this.currentDentDepth / this.maxDentDepth) * 35;
    const sinkMm = (this.currentBuoyancySinkY / this.maxBuoyancySink) * 15;
    return Math.round(foamMm + sinkMm);
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
    const safeElapsed = Number.isFinite(elapsedTime) ? elapsedTime : this.lastElapsedTime;
    const safeDelta = Number.isFinite(deltaTime) && deltaTime >= 0 ? deltaTime : 0.016;
    const dt = Math.min(safeDelta, 0.05);
    this.lastElapsedTime = safeElapsed;

    this.group.visible = true;
    this.encasementTrayGroup.visible = true;
    this.internalCoreGroup.visible = true;

    if (!Number.isFinite(this.currentHeightRatio) || this.currentHeightRatio <= 0) {
      this.currentHeightRatio = Number.isFinite(this.targetHeightRatio)
        ? this.targetHeightRatio
        : 1.0;
    }
    if (!Number.isFinite(this.currentBuoyancySinkY)) {
      this.currentBuoyancySinkY = 0;
    }
    if (!Number.isFinite(this.currentScaleX) || this.currentScaleX <= 0) {
      this.currentScaleX = 1.0;
    }
    if (!Number.isFinite(this.currentScaleZ) || this.currentScaleZ <= 0) {
      this.currentScaleZ = 1.0;
    }
    if (!Number.isFinite(this.currentPressScaleY) || this.currentPressScaleY <= 0) {
      this.currentPressScaleY = 1.0;
    }
    if (!Number.isFinite(this.currentPressScaleXZ) || this.currentPressScaleXZ <= 0) {
      this.currentPressScaleXZ = 1.0;
    }

    // Advance any active 0.4s runtime color preset transitions (`applyColorPreset`)
    updateColorPresetTransitions();

    // 0. Smooth 0.4s ease-out model height & internal layer morph animation
    if (this.isMorphingModel) {
      if (this.pendingMorphStart) {
        this.modelMorphStartTime = safeElapsed;
        this.pendingMorphStart = false;
      }
      const morphElapsed = Math.max(0, safeElapsed - this.modelMorphStartTime);
      const t =
        this.modelMorphDuration > 0
          ? THREE.MathUtils.clamp(morphElapsed / this.modelMorphDuration, 0, 1)
          : 1;
      const eased = easeOutQuad(t);

      const safeFromRatio = Number.isFinite(this.fromHeightRatio) ? this.fromHeightRatio : 1.0;
      const safeTargetRatio = Number.isFinite(this.targetHeightRatio) ? this.targetHeightRatio : 1.0;
      this.currentHeightRatio = THREE.MathUtils.lerp(safeFromRatio, safeTargetRatio, eased);
      this.applyTrayGeometryForHeightRatio(this.currentHeightRatio);

      for (let i = 0; i < 9; i++) {
        const fromY = Number.isFinite(this.fromDefaultLayerY[i])
          ? this.fromDefaultLayerY[i]
          : this.targetDefaultLayerY[i];
        const toY = Number.isFinite(this.targetDefaultLayerY[i])
          ? this.targetDefaultLayerY[i]
          : 0;
        const fromScale =
          Number.isFinite(this.fromLayerScaleY[i]) && this.fromLayerScaleY[i] > 0
            ? this.fromLayerScaleY[i]
            : 1.0;
        const toScale =
          Number.isFinite(this.targetLayerScaleY[i]) && this.targetLayerScaleY[i] > 0
            ? this.targetLayerScaleY[i]
            : 1.0;

        this.defaultLayerY[i] = THREE.MathUtils.lerp(fromY, toY, eased);
        this.currentLayerScaleY[i] = Math.max(0.001, THREE.MathUtils.lerp(fromScale, toScale, eased));
        this.layerMeshes[i].scale.y = i === 0 ? 1.0 : this.currentLayerScaleY[i];
        this.layerMeshes[i].userData.defaultY = this.defaultLayerY[i];
        this.layerKinematics[i].defaultY = this.defaultLayerY[i];
      }
      this.defaultLayerY[9] = this.targetDefaultLayerY[9];
      this.layerMeshes[9].userData.defaultY = this.defaultLayerY[9];
      this.layerKinematics[9].defaultY = this.defaultLayerY[9];

      if (t >= 1) {
        this.isMorphingModel = false;
      }
    }

    // 1. Two-Tier Motion Decoupling: Continuous Idle Antigravity Wave + Damped Buoyancy
    // Keep continuous idle floating sine wave running on the base coordinate:
    const idleFloatY = this.floatingEnabled
      ? Math.sin(safeElapsed * this.floatSpeed) * this.floatAmplitude
      : 0;
    const y_base = this.baseY + idleFloatY;

    // Damp vertical impulse smoothly like floating cushion on calm water (max clamped to 0.035m <= 0.05m)
    const sinkDampSpeed = this.isPressed ? 7.5 : 3.8;
    this.currentBuoyancySinkY = THREE.MathUtils.damp(
      this.currentBuoyancySinkY,
      Number.isFinite(this.targetBuoyancySinkY) ? this.targetBuoyancySinkY : 0,
      sinkDampSpeed,
      dt,
    );
    if (!Number.isFinite(this.currentBuoyancySinkY)) {
      this.currentBuoyancySinkY = 0;
    }
    this.currentElevation = Number.isFinite(y_base - this.currentBuoyancySinkY)
      ? y_base - this.currentBuoyancySinkY
      : this.baseY;
    this.group.position.y = this.currentElevation;

    // 2. Macro Inertial Angular Tilt / Torque Response
    const tiltDampSpeed = this.isPressed ? 6.5 : 3.8;
    this.currentTorqueRotX = THREE.MathUtils.damp(
      Number.isFinite(this.currentTorqueRotX) ? this.currentTorqueRotX : 0,
      Number.isFinite(this.targetTorqueRotX) ? this.targetTorqueRotX : 0,
      tiltDampSpeed,
      dt,
    );
    this.currentTorqueRotZ = THREE.MathUtils.damp(
      Number.isFinite(this.currentTorqueRotZ) ? this.currentTorqueRotZ : 0,
      Number.isFinite(this.targetTorqueRotZ) ? this.targetTorqueRotZ : 0,
      tiltDampSpeed,
      dt,
    );

    const idleRotX = this.floatingEnabled ? Math.sin(safeElapsed * 0.95) * 0.008 : 0;
    const idleRotZ = this.floatingEnabled ? Math.cos(safeElapsed * 0.85) * 0.008 : 0;
    const hoverParallaxX =
      this.isHovered && !this.isPressed && Number.isFinite(this.hoverMouseNdc.y)
        ? this.hoverMouseNdc.y * 0.012
        : 0;
    const hoverParallaxZ =
      this.isHovered && !this.isPressed && Number.isFinite(this.hoverMouseNdc.x)
        ? -this.hoverMouseNdc.x * 0.012
        : 0;

    this.group.rotation.x = idleRotX + hoverParallaxX + this.currentTorqueRotX;
    this.group.rotation.z = idleRotZ + hoverParallaxZ + this.currentTorqueRotZ;

    // 3. Authentic Tactile Local Dent & Viscoelastic Memory Foam Rebound
    const foamDampSpeed = this.isPressed ? 12.0 : 3.6;
    this.currentDentDepth = THREE.MathUtils.damp(
      Number.isFinite(this.currentDentDepth) ? this.currentDentDepth : 0,
      Number.isFinite(this.targetDentDepth) ? this.targetDentDepth : 0,
      foamDampSpeed,
      dt,
    );

    if (this.topQuiltGeo && this.topBaseVertices) {
      const posAttr = this.topQuiltGeo.attributes.position;
      const count = posAttr.count;

      if (this.currentDentDepth > 0.0004) {
        this.isDented = true;
        const twoSigmaSq = 2 * this.dentRadius * this.dentRadius;
        const hx = this.localHitPoint.x;
        const hz = this.localHitPoint.z;

        for (let i = 0; i < count; i++) {
          const vx = this.topBaseVertices[i * 3];
          const vy = this.topBaseVertices[i * 3 + 1];
          const vz = this.topBaseVertices[i * 3 + 2];

          const dx = vx - hx;
          const dz = vz - hz;
          const distSq = dx * dx + dz * dz;

          // Localized inward dent using Gaussian falloff around the hit coordinate
          if (distSq < twoSigmaSq * 4.5) {
            const falloff = Math.exp(-distSq / twoSigmaSq);
            posAttr.setY(i, vy - this.currentDentDepth * falloff);
          } else {
            posAttr.setY(i, vy);
          }
        }
        posAttr.needsUpdate = true;
        this.topQuiltGeo.computeVertexNormals();
      } else if (this.isDented) {
        // Viscoelastic rebound has fully recovered to pristine rest shape
        for (let i = 0; i < count; i++) {
          posAttr.setY(i, this.topBaseVertices[i * 3 + 1]);
        }
        posAttr.needsUpdate = true;
        this.topQuiltGeo.computeVertexNormals();
        this.isDented = false;
        this.currentDentDepth = 0.0;
      }
    }

    // 4. Subtle Volumetric Elastic Cushion Conservation (1% Y cushion compression & lateral expansion)
    const targetPressScaleY = this.isPressed ? 0.988 : 1.0;
    const targetPressScaleXZ = this.isPressed ? 1.003 : 1.0;
    this.currentPressScaleY = THREE.MathUtils.damp(
      this.currentPressScaleY,
      targetPressScaleY,
      6.0,
      dt,
    );
    this.currentPressScaleXZ = THREE.MathUtils.damp(
      this.currentPressScaleXZ,
      targetPressScaleXZ,
      6.0,
      dt,
    );
    if (!Number.isFinite(this.currentPressScaleY) || this.currentPressScaleY <= 0) {
      this.currentPressScaleY = 1.0;
    }
    if (!Number.isFinite(this.currentPressScaleXZ) || this.currentPressScaleXZ <= 0) {
      this.currentPressScaleXZ = 1.0;
    }

    // 5. Smoothly damp mattress size changes (Twin -> Cal King)
    this.currentScaleX = THREE.MathUtils.damp(
      this.currentScaleX,
      Number.isFinite(this.targetScaleX) && this.targetScaleX > 0 ? this.targetScaleX : 1.0,
      6.5,
      dt,
    );
    this.currentScaleZ = THREE.MathUtils.damp(
      this.currentScaleZ,
      Number.isFinite(this.targetScaleZ) && this.targetScaleZ > 0 ? this.targetScaleZ : 1.0,
      6.5,
      dt,
    );
    this.group.scale.set(
      Math.max(0.1, this.currentScaleX * this.currentPressScaleXZ),
      Math.max(0.1, this.currentPressScaleY),
      Math.max(0.1, this.currentScaleZ * this.currentPressScaleXZ),
    );

    // 5. Phase 1 Kinematics: Two-Step "Lift-then-Slide" (0% Side-Wall Clipping)
    for (let i = 0; i < this.layerMeshes.length; i++) {
      const layerObj = this.layerMeshes[i];
      const kin = this.layerKinematics[i];
      if (!Number.isFinite(this.defaultLayerY[i])) {
        this.defaultLayerY[i] = this.targetDefaultLayerY[i] ?? 0;
      }
      if (!Number.isFinite(kin.defaultY)) {
        kin.defaultY = this.defaultLayerY[i];
      }
      const startTime = Number.isFinite(kin.startTime) ? kin.startTime : safeElapsed;
      const elapsed = Math.max(0, safeElapsed - startTime);

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

      if (!Number.isFinite(kin.currentX)) kin.currentX = 0;
      if (!Number.isFinite(kin.currentY)) kin.currentY = kin.defaultY;
      if (!Number.isFinite(kin.currentZ)) kin.currentZ = 0;
      if (!Number.isFinite(kin.currentRotX)) kin.currentRotX = 0;
      if (!Number.isFinite(kin.currentEmissive)) kin.currentEmissive = 0;

      layerObj.position.set(kin.currentX, kin.currentY, kin.currentZ);
      layerObj.rotation.set(kin.currentRotX, 0, 0);
      if (i < 9 && (!Number.isFinite(layerObj.scale.y) || layerObj.scale.y <= 0)) {
        layerObj.scale.y = i === 0 ? 1.0 : Math.max(0.001, this.currentLayerScaleY[i] || 1.0);
      }

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
    this.topQuiltMesh = null;
    this.topQuiltGeo = null;
    this.topBaseVertices = null;
    this.handleMeshes = [];
    this.cornerStrapMeshes = [];
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
