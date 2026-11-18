import * as THREE from 'three';
import gsap from 'gsap';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import type {
  CameraAnglePreset,
  ISceneModule,
  MattressSizeSpec,
  SceneModuleContext,
  TelemetryReadout,
} from './types.ts';
import {FloatingWoolPad} from './FloatingWoolPad.ts';
import type {MattressModelId} from './MattressAnatomy.ts';
import {resolvePuffyModelKey, type PuffyModelKey} from './puffyLayersData.ts';
import {MeadowTerrain} from './MeadowTerrain.ts';
import {SheepFlockEngine} from './SheepFlockEngine.ts';
import {HeroCloudletGuide} from './HeroCloudletGuide.ts';
import {
  IntroSequence,
  FLIGHT_SPLINE,
  type IntroPhase1Stage,
  type IntroState,
} from './IntroSequence.ts';
import {
  createBedroomSanctuaryScene,
  type BedroomSanctuaryInstance,
} from '../bedroom/BedroomSanctuaryScene.tsx';
import type { BedroomStyle } from '../bedroom/BedroomRegistry.ts';
import {
  type BedroomRoomId,
  DEFAULT_BEDROOM_ROOM_ID,
} from '../../../config/bedroomRooms.config.ts';
import { useBedroomConfigStore } from '../../../store/useBedroomConfigStore.ts';
import { createDawnLensFlare, type DawnLensFlareRig } from './dawnLensFlare.ts';
import { GroundMistLayer } from './GroundMistLayer.ts';

export type SanctuaryEnvironmentMode = 'bedroom' | 'meadow' | 'studio';
export {FLIGHT_SPLINE, FLIGHT_SPLINE as CINEMATIC_FLIGHT_SPLINE};
export type {IntroPhase1Stage, IntroState};

/**
 * Strict Resource Disposal Protocol to guarantee 0 VRAM leaks across scene transitions.
 */
export function cleanupScene(sceneGroup: THREE.Group): void {
  sceneGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
  sceneGroup.clear();
}

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const CAMERA_PRESETS: Record<CameraAnglePreset, CameraPose> = {
  // Wide FOV-60 Tiny Planet / Curved Horizon overview
  hero45: {
    position: new THREE.Vector3(3.65, 2.38, 4.85),
    target: new THREE.Vector3(0.0, 0.15, 0.0),
  },
  // Smooth Dolly-In close-up onto the Floating Wool Pad & Claymation Sheep
  dollyClose: {
    position: new THREE.Vector3(1.62, 0.88, 2.08),
    target: new THREE.Vector3(-0.15, 0.36, 0.25),
  },
  topDown: {
    position: new THREE.Vector3(0.0, 3.65, 0.65),
    target: new THREE.Vector3(0.0, 0.45, 0.0),
  },
};

// Room-aware cinematic flight splines.
// Meadow: outdoor 360° orbit (sunrise angle at (0, 3.5, -9)).
const MEADOW_SPLINE = [
  new THREE.Vector3(0, 2.5, 9),
  new THREE.Vector3(7, 3.2, 5),
  new THREE.Vector3(8, 2.8, -4),
  new THREE.Vector3(0, 3.5, -9),
  new THREE.Vector3(-7, 2.5, -4),
  new THREE.Vector3(-6, 2.2, 6),
  new THREE.Vector3(0, 2.5, 9),
];
const MEADOW_TARGET = new THREE.Vector3(0.0, 0.15, 0.0);

// Bedroom: interior dolly arc. Every point stays well inside the room walls.
const BEDROOM_SPLINE = [
  new THREE.Vector3(-1.6, 1.4, 1.8),
  new THREE.Vector3(-0.8, 1.25, 1.5),
  new THREE.Vector3(0.0, 1.15, 1.2),
  new THREE.Vector3(1.1, 1.3, 0.8),
  new THREE.Vector3(1.4, 1.45, 1.4),
];
const BEDROOM_TARGET = new THREE.Vector3(0, 0.75, -0.2);

const BEDROOM_CAMERA_POSE: CameraPose = {
  position: new THREE.Vector3(2.75, 1.56, 3.25),
  target: new THREE.Vector3(0.0, 0.36, -0.1),
};

const STUDIO_CAMERA_POSE: CameraPose = {
  position: new THREE.Vector3(3.15, 1.85, 3.75),
  target: new THREE.Vector3(0.0, 0.45, 0.0),
};

export class WoolMeadowSceneModule implements ISceneModule {
  public readonly id = 'puffy-wool-meadow-sanctuary';

  private context: SceneModuleContext | null = null;
  private controls: OrbitControls | null = null;
  private envTexture: THREE.Texture | null = null;

  private meadowTerrain: MeadowTerrain | null = null;
  private groundMist: GroundMistLayer | null = null;
  private floatingWoolPad: FloatingWoolPad | null = null;
  private sheepFlock: SheepFlockEngine | null = null;
  private heroCloudlet: HeroCloudletGuide | null = null;
  private bedroomGroup: THREE.Group | null = null;
  private bedroomSanctuary: BedroomSanctuaryInstance | null = null;
  private bedroomStyle: BedroomStyle = 'nordic-coastal';
  private bedroomRoomId: BedroomRoomId = DEFAULT_BEDROOM_ROOM_ID;
  private meadowLights: THREE.Light[] = [];
  private sunLight: THREE.DirectionalLight | null = null;
  private dawnFlare: DawnLensFlareRig | null = null;

  // Decoupled Scene State Machines
  private currentEnvironment: SanctuaryEnvironmentMode = 'meadow';
  private activeEcoModel: PuffyModelKey = 'royal';
  private isExploded = false;
  private cameraPosition = new THREE.Vector3().copy(CAMERA_PRESETS.hero45.position);

  private isLabPaused = false;
  private readonly bedSurfaceHeight = 0.478;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private isPointerDownOnMattress = false;
  private isOrbitingCamera = false;
  private isDraggingCamera = false;
  private pointerDownScreenX = 0;
  private pointerDownScreenY = 0;
  private hoverWorldPoint: THREE.Vector3 | null = null;
  private scratchHoverVec = new THREE.Vector3();
  private lastHoverRaycastTime = 0;

  private activeCameraPreset: CameraAnglePreset = 'hero45';
  private isTransitioningCamera = false;
  private targetCameraPos = new THREE.Vector3().copy(CAMERA_PRESETS.hero45.position);
  private targetLookAt = new THREE.Vector3().copy(CAMERA_PRESETS.hero45.target);
  private dollyProgress = 0; // 0 = Tiny Planet wide, 1 = Close-up Dolly

  private onTelemetryCallback: ((readout: TelemetryReadout) => void) | null = null;
  private onLayerSelectCallback: ((layerIndex: number) => void) | null = null;
  private onCameraPositionChangeCallback: ((pos: THREE.Vector3) => void) | null = null;
  private onIntroFlightCompleteCallback: (() => void) | null = null;
  private onIntroStateChangeCallback: ((state: IntroState) => void) | null = null;
  private onIntroPhase1StageChangeCallback: ((stage: IntroPhase1Stage) => void) | null = null;
  private lastTelemetryEmit = 0;

  // Cohesive Cinematic Intro Controller
  private introSequence: IntroSequence | null = null;

  // Bound event listeners for deterministic removal in dispose()
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: (() => void) | null = null;
  private boundPointerLeave: (() => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;

  public init(context: SceneModuleContext): void {
    this.context = context;
    const {scene, camera, renderer, container, isSoftwareGl} = context;

    // 1. Atmospheric Golden Dawn Mist & Height-Damped Exponential Distance Fog
    const MIST_COLOR = new THREE.Color('#E3DFD5');
    scene.background = MIST_COLOR;
    scene.fog = new THREE.FogExp2('#E3DFD5', 0.048);

    // 2. LEGO BLOCK 3: Studio Environment Lighting (PMREM Radiance for MeshPhysicalMaterial Sheen)
    const fallbackPmrem = new THREE.PMREMGenerator(renderer);
    this.envTexture = fallbackPmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.envTexture;
    scene.environmentIntensity = 0.75; // Soft ambient bounce across fabric micro-fibers
    fallbackPmrem.dispose();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    new RGBELoader().load(
      '/assets/3d/textures/studio_soft_sanctuary_512.hdr',
      (texture) => {
        if (!this.context) {
          texture.dispose();
          pmremGenerator.dispose();
          return;
        }
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        this.envTexture?.dispose();
        this.envTexture = envMap;
        scene.environment = envMap;
        scene.environmentIntensity = 0.75; // Soft ambient bounce, non-intrusive
        texture.dispose();
        pmremGenerator.dispose();
      },
      undefined,
      () => {
        pmremGenerator.dispose();
      },
    );

    // 3. Golden Dawn Sunlight, Hemisphere Fill & Soft Rim Lighting Rig (No Texture Burnout)
    const hemiLight = new THREE.HemisphereLight('#DCEBFA', '#D9E6D0', 0.55);
    scene.add(hemiLight);

    const SUN_POSITION = new THREE.Vector3(28.0, 9.5, -65.0);
    const sunLight = new THREE.DirectionalLight('#FFE4C4', 0.95);
    sunLight.position.copy(SUN_POSITION);
    sunLight.target.position.set(0, 0.8, 0);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 110;
    const d = 10.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);
    this.sunLight = sunLight;

    // Multi-spectral GPU sprite-based optical lens flare attached to dawn sun position
    const dawnFlare = createDawnLensFlare(container);
    sunLight.add(dawnFlare.lensflare);
    this.dawnFlare = dawnFlare;

    const rimLight = new THREE.DirectionalLight('#D6E8FF', 0.4);
    rimLight.position.set(-10, 10, -10);
    scene.add(rimLight);
    this.meadowLights = [hemiLight, sunLight, rimLight];

    // 4. Wide FOV 60 Camera & Smooth Damped OrbitControls
    camera.fov = 60;
    camera.updateProjectionMatrix();
    camera.position.copy(CAMERA_PRESETS.hero45.position);

    this.controls = new OrbitControls(camera, renderer.domElement);
    this.controls.target.copy(CAMERA_PRESETS.hero45.target);
    this.controls.enableDamping = !isSoftwareGl;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = false; // Handled by smooth custom wheel Dolly lerp (0.05)
    this.controls.minDistance = 1.65;
    this.controls.maxDistance = 9.0;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minPolarAngle = 0.12;
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.isTransitioningCamera = false;
      this.isOrbitingCamera = true;
      if (this.isPointerDownOnMattress) {
        this.isPointerDownOnMattress = false;
        this.floatingWoolPad?.releaseCompression();
      }
    });

    this.controls.addEventListener('end', () => {
      this.isOrbitingCamera = false;
      this.isDraggingCamera = false;
      if (this.context) {
        this.cameraPosition.copy(this.context.camera.position);
        this.onCameraPositionChangeCallback?.(this.cameraPosition.clone());
      }
    });

    // 5. Instantiate 3D Sub-Modules
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    this.meadowTerrain = new MeadowTerrain(maxAnisotropy);
    scene.add(this.meadowTerrain.group);

    this.groundMist = new GroundMistLayer();
    scene.add(this.groundMist.group);

    this.floatingWoolPad = new FloatingWoolPad(maxAnisotropy);
    if (this.activeEcoModel !== 'royal') {
      this.floatingWoolPad.updateModel(this.activeEcoModel, true);
    }
    scene.add(this.floatingWoolPad.group);

    this.sheepFlock = new SheepFlockEngine(8);
    scene.add(this.sheepFlock.group);

    this.heroCloudlet = new HeroCloudletGuide();
    scene.add(this.heroCloudlet.group);

    this.introSequence = new IntroSequence({
      scene,
      camera,
      getControls: () => this.controls,
      getCloudlet: () => this.heroCloudlet,
      getMattressGroup: () => this.floatingWoolPad?.group ?? null,
      getMattressTopY: () => (this.floatingWoolPad?.getCurrentElevation() ?? 0.52) + 0.35,
      isSoftwareGl,
      onStateChange: (state) => {
        this.onIntroStateChangeCallback?.(state);
      },
      onPhase1StageChange: (stage) => {
        this.onIntroPhase1StageChangeCallback?.(stage);
      },
      onCameraPositionChange: (pos) => {
        this.cameraPosition.copy(pos);
        this.onCameraPositionChangeCallback?.(pos);
      },
      onFlightComplete: () => {
        this.onIntroFlightCompleteCallback?.();
      },
      onSheepIntroPose: (active) => {
        this.sheepFlock?.setHeroSheepIntroPose(active);
      },
    });

    if (typeof window !== 'undefined' && window.location.search.includes('audit=exploded')) {
      this.setEnvironmentMode('studio');
      this.floatingWoolPad.setFloatingEnabled(false, 0.25);
      this.floatingWoolPad.setAllLayersExplodedStack(true, true);
      const auditPos = new THREE.Vector3(1.85, 1.68, 3.45);
      const auditTarget = new THREE.Vector3(0, 0.82, 0);
      camera.position.copy(auditPos);
      this.targetCameraPos.copy(auditPos);
      this.cameraPosition.copy(auditPos);
      this.targetLookAt.copy(auditTarget);
      if (this.controls) {
        this.controls.target.copy(auditTarget);
        this.controls.update();
      }
      camera.lookAt(auditTarget);
      this.isTransitioningCamera = false;
      this.introSequence.forceExploring();
    } else {
      this.introSequence.enterIdleStage();
    }

    // Warm up all shaders during Phase 1 IDLE state
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Bind Tactile Raycaster Pointer & Smooth Dolly Wheel Events
    this.boundPointerDown = (ev: PointerEvent) => this.handlePointerDown(ev);
    this.boundPointerMove = (ev: PointerEvent) => this.handlePointerMove(ev);
    this.boundPointerUp = () => this.handlePointerUp();
    this.boundPointerLeave = () => {
      this.hoverWorldPoint = null;
      if (this.isPointerDownOnMattress) {
        this.isPointerDownOnMattress = false;
        this.floatingWoolPad?.releaseCompression();
      }
      this.isDraggingCamera = false;
      this.floatingWoolPad?.setHoverState(false);
    };
    this.boundWheel = (ev: WheelEvent) => this.handleWheelDolly(ev);

    container.addEventListener('pointerdown', this.boundPointerDown);
    container.addEventListener('pointermove', this.boundPointerMove);
    container.addEventListener('pointerleave', this.boundPointerLeave);
    container.addEventListener('wheel', this.boundWheel, {passive: false});
    window.addEventListener('pointerup', this.boundPointerUp);
  }

  private getDefaultPoseForEnvironment(mode: SanctuaryEnvironmentMode): CameraPose {
    if (mode === 'bedroom') return BEDROOM_CAMERA_POSE;
    if (mode === 'studio') return STUDIO_CAMERA_POSE;
    return CAMERA_PRESETS.hero45;
  }

  private isVectorFinite(v: THREE.Vector3): boolean {
    return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  }

  /**
   * Restores camera & OrbitControls target to valid finite coordinates for the active environment
   * if any NaN/Infinity slips into camera or controls state.
   */
  private sanitizeCameraAndControls(): void {
    const defaultPose = this.getDefaultPoseForEnvironment(this.currentEnvironment);
    if (!this.isVectorFinite(this.targetCameraPos)) {
      this.targetCameraPos.copy(defaultPose.position);
    }
    if (!this.isVectorFinite(this.targetLookAt)) {
      this.targetLookAt.copy(defaultPose.target);
    }
    if (this.controls && !this.isVectorFinite(this.controls.target)) {
      this.controls.target.copy(defaultPose.target);
      this.controls.update();
    }
    if (this.context && !this.isVectorFinite(this.context.camera.position)) {
      this.context.camera.position.copy(defaultPose.position);
      this.cameraPosition.copy(defaultPose.position);
      this.context.camera.lookAt(
        this.controls ? this.controls.target : defaultPose.target,
      );
    }
  }

  /**
   * Switches between the outdoor Meadow Sanctuary, indoor Sanctuary Bedroom (XR), and Studio
   * within the single unified WebGL render loop, strictly disposing temporary bedroom meshes
   * when leaving the bedroom to maintain 0 VRAM leaks.
   * Preserves `isExploded` state across environment transitions.
   */
  public setEnvironmentMode(mode: SanctuaryEnvironmentMode): void {
    if (this.floatingWoolPad) {
      this.floatingWoolPad.group.visible = true;
    }
    if (!this.context || this.currentEnvironment === mode) {
      this.sanitizeCameraAndControls();
      return;
    }
    this.currentEnvironment = mode;
    const {scene} = this.context;

    if (mode === 'bedroom') {
      // 1. UNMOUNT / HIDE THE SHEEP FLOCK & MEADOW TERRAIN
      if (this.sheepFlock) {
        this.sheepFlock.group.visible = false;
      }
      if (this.meadowTerrain) {
        this.meadowTerrain.group.visible = false;
      }
      if (this.groundMist) {
        this.groundMist.group.visible = false;
      }
      this.hoverWorldPoint = null;

      // 2. REST MATTRESS STATICALLY ON THE WOODEN BED FRAME (disable zero-G hovering)
      this.floatingWoolPad?.setFloatingEnabled(false, this.bedSurfaceHeight);

      // 3. BUILD & MOUNT SANCTUARY BEDROOM (clean up any prior group first)
      if (this.bedroomSanctuary) {
        scene.remove(this.bedroomSanctuary.group);
        this.bedroomSanctuary.dispose();
        this.bedroomSanctuary = null;
      }
      if (this.bedroomGroup) {
        scene.remove(this.bedroomGroup);
        cleanupScene(this.bedroomGroup);
        this.bedroomGroup = null;
      }

      this.bedroomSanctuary = createBedroomSanctuaryScene({
        floatingWoolPad: this.floatingWoolPad,
        sheepFlock: this.sheepFlock,
        initialStyle: this.bedroomStyle,
        roomId: this.bedroomRoomId,
        castShadow: !this.context.isSoftwareGl,
      });
      // Align bedroom room floor & carpet at world y = 0 with bed frame and docked mattress
      this.bedroomSanctuary.group.position.set(0, 0, 0);
      // Respect current independent isExploded state
      this.bedroomSanctuary.setBedDecorVisible(!this.isExploded);
      // Sync pillows and throw blanket immediately to the active mattress height
      this.bedroomSanctuary.syncMattressHeight(
        this.floatingWoolPad?.getHeightDeltaFromRoyal() ?? 0,
      );
      this.bedroomGroup = this.bedroomSanctuary.group;
      scene.add(this.bedroomGroup);

      // Warm indoor sanctuary atmosphere with Soft Sanctuary Daylight Rig
      this.meadowLights.forEach((l) => {
        l.visible = false;
      });
      scene.environmentIntensity = 0.5;
      scene.background = new THREE.Color('#EFEAE1');
      scene.fog = new THREE.FogExp2('#EFEAE1', 0.012);

      // Frame camera around active room mattress anchor
      const anchor = this.bedroomSanctuary.activeRoomConfig.mattressAnchor.position;
      const targetPos = new THREE.Vector3(anchor[0] + 2.75, anchor[1] + 1.40, anchor[2] + 3.35);
      const targetLook = new THREE.Vector3(anchor[0], anchor[1] + 0.36, anchor[2]);
      this.targetCameraPos.copy(targetPos);
      this.targetLookAt.copy(targetLook);
      this.cameraPosition.copy(targetPos);
      this.onCameraPositionChangeCallback?.(this.cameraPosition.clone());
      this.isTransitioningCamera = true;
    } else if (mode === 'studio') {
      // 1. STRICT RESOURCE DISPOSAL of Bedroom meshes
      if (this.bedroomSanctuary) {
        scene.remove(this.bedroomSanctuary.group);
        this.bedroomSanctuary.dispose();
        this.bedroomSanctuary = null;
        this.bedroomGroup = null;
      } else if (this.bedroomGroup) {
        scene.remove(this.bedroomGroup);
        cleanupScene(this.bedroomGroup);
        this.bedroomGroup = null;
      }

      // 2. HIDE MEADOW & SHEEP FOR CLEAN STUDIO BACKDROP
      if (this.meadowTerrain) {
        this.meadowTerrain.group.visible = false;
      }
      if (this.groundMist) {
        this.groundMist.group.visible = false;
      }
      if (this.sheepFlock) {
        this.sheepFlock.group.visible = false;
      }
      this.hoverWorldPoint = null;
      this.meadowLights.forEach((l) => {
        l.visible = true;
      });
      scene.environmentIntensity = 0.85;
      this.floatingWoolPad?.setFloatingEnabled(true);

      scene.background = new THREE.Color('#F4F6F9');
      scene.fog = new THREE.FogExp2('#F4F6F9', 0.01);

      this.targetCameraPos.copy(STUDIO_CAMERA_POSE.position);
      this.targetLookAt.copy(STUDIO_CAMERA_POSE.target);
      this.cameraPosition.copy(STUDIO_CAMERA_POSE.position);
      this.onCameraPositionChangeCallback?.(this.cameraPosition.clone());
      this.isTransitioningCamera = true;
    } else {
      // 1. STRICT RESOURCE DISPOSAL of Bedroom meshes when switching back to Meadow
      if (this.bedroomSanctuary) {
        scene.remove(this.bedroomSanctuary.group);
        this.bedroomSanctuary.dispose();
        this.bedroomSanctuary = null;
        this.bedroomGroup = null;
      } else if (this.bedroomGroup) {
        scene.remove(this.bedroomGroup);
        cleanupScene(this.bedroomGroup);
        this.bedroomGroup = null;
      }

      // 2. RESTORE MEADOW SANCTUARY & SHEEP FLOCK
      this.meadowLights.forEach((l) => {
        l.visible = true;
      });
      scene.environmentIntensity = 0.75;
      if (this.meadowTerrain) {
        this.meadowTerrain.group.visible = true;
      }
      if (this.groundMist) {
        this.groundMist.group.visible = true;
      }
      if (this.sheepFlock) {
        this.sheepFlock.group.visible = true;
      }

      // 3. RE-ENABLE ZERO-G HOVERING ON MATTRESS
      this.floatingWoolPad?.setFloatingEnabled(true);

      // Restore outdoor morning mist & exponential horizon fog
      scene.background = new THREE.Color('#E3DFD5');
      scene.fog = new THREE.FogExp2('#E3DFD5', 0.048);

      const pose = CAMERA_PRESETS[this.activeCameraPreset];
      this.targetCameraPos.copy(pose.position);
      this.targetLookAt.copy(pose.target);
      this.cameraPosition.copy(pose.position);
      this.onCameraPositionChangeCallback?.(this.cameraPosition.clone());
      this.isTransitioningCamera = true;
    }
    this.sanitizeCameraAndControls();
  }

  public getEnvironmentMode(): SanctuaryEnvironmentMode {
    return this.currentEnvironment;
  }

  public setBedroomStyle(style: BedroomStyle): void {
    this.bedroomStyle = style;
    this.bedroomSanctuary?.setStyle(style, 0.5);
    useBedroomConfigStore.getState().setEnvironment(style as any);
  }

  public setBedroomRoom(roomId: BedroomRoomId): void {
    this.bedroomRoomId = roomId;
    useBedroomConfigStore.getState().setRoomId(roomId);
    if (this.bedroomSanctuary) {
      this.bedroomSanctuary.setRoomId(roomId);
      const anchor = this.bedroomSanctuary.activeRoomConfig.mattressAnchor.position;
      const targetPos = new THREE.Vector3(anchor[0] + 2.75, anchor[1] + 1.40, anchor[2] + 3.35);
      const targetLook = new THREE.Vector3(anchor[0], anchor[1] + 0.36, anchor[2]);
      this.targetCameraPos.copy(targetPos);
      this.targetLookAt.copy(targetLook);
      this.isTransitioningCamera = true;
    }
  }

  public getBedroomRoomId(): BedroomRoomId {
    return this.bedroomRoomId;
  }

  /**
   * Pauses background procedural physics (wind sway, sheep flocking, cloud drift)
   * when the user is inspecting the "Craft & Specs Lab" overlay.
   */
  public setLabPaused(paused: boolean): void {
    this.isLabPaused = paused;
  }

  /**
   * Builds the indoor Sanctuary Bedroom environment featuring a solid walnut wooden platform bed frame,
   * upholstered bouclé headboard, decorative pillows, nightstands with warm lamps, and woven area rug.
   */
  private buildSanctuaryBedroomGroup(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'PuffySanctuaryBedroomGroup';

    const walnutMat = new THREE.MeshStandardMaterial({
      color: '#5C3D28',
      roughness: 0.62,
      metalness: 0.06,
    });
    const darkWalnutMat = new THREE.MeshStandardMaterial({
      color: '#3D2719',
      roughness: 0.58,
      metalness: 0.08,
    });
    const boucleFabricMat = new THREE.MeshStandardMaterial({
      color: '#EAE3D5',
      roughness: 0.9,
      metalness: 0.0,
    });
    const oakFloorMat = new THREE.MeshStandardMaterial({
      color: '#C8B094',
      roughness: 0.72,
      metalness: 0.04,
    });
    const rugMat = new THREE.MeshStandardMaterial({
      color: '#F4F0E8',
      roughness: 0.94,
      metalness: 0.0,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#E6E0D5',
      roughness: 0.88,
      metalness: 0.0,
    });
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: '#FFF9EC',
      emissive: new THREE.Color('#FFE4B5'),
      emissiveIntensity: 0.45,
      roughness: 0.6,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#C5A880',
      roughness: 0.35,
      metalness: 0.65,
    });

    // 1. Sanctuary Hardwood Floor (y = -0.22)
    const floorGeo = new THREE.PlaneGeometry(18, 18);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, oakFloorMat);
    floorMesh.position.y = -0.22;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    // 2. Plush Woven Cream Area Rug under the Bed Frame (y = -0.205)
    const rugGeo = new THREE.BoxGeometry(3.85, 0.024, 4.1);
    const rugMesh = new THREE.Mesh(rugGeo, rugMat);
    rugMesh.position.set(0, -0.205, 0.15);
    rugMesh.receiveShadow = true;
    group.add(rugMesh);

    // 3. Architectural Sanctuary Feature Wall behind the Headboard (z = -1.62)
    const wallGeo = new THREE.BoxGeometry(9.5, 4.2, 0.14);
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(0, 1.85, -1.62);
    wallMesh.receiveShadow = true;
    group.add(wallMesh);

    // 4. Artisanal Solid Walnut Wooden Platform Bed Frame
    // Mattress bottom is at y = bedSurfaceHeight - 0.236 = 0.124.
    // The wooden bed platform deck sits directly underneath from y = -0.02 to y = +0.124!
    const bedDeckGeo = new THREE.BoxGeometry(2.36, 0.144, 2.74);
    const bedDeckMesh = new THREE.Mesh(bedDeckGeo, walnutMat);
    bedDeckMesh.position.set(0, 0.052, 0.0);
    bedDeckMesh.castShadow = true;
    bedDeckMesh.receiveShadow = true;
    group.add(bedDeckMesh);

    // Lower recessed solid walnut plinth & 4 tapered corner legs resting on the rug
    const plinthGeo = new THREE.BoxGeometry(2.05, 0.12, 2.42);
    const plinthMesh = new THREE.Mesh(plinthGeo, darkWalnutMat);
    plinthMesh.position.set(0, -0.08, 0.0);
    plinthMesh.castShadow = true;
    group.add(plinthMesh);

    const legGeo = new THREE.CylinderGeometry(0.045, 0.032, 0.19, 14);
    const legOffsets: Array<[number, number]> = [
      [-1.06, -1.24],
      [1.06, -1.24],
      [-1.06, 1.24],
      [1.06, 1.24],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, darkWalnutMat);
      leg.position.set(lx, -0.11, lz);
      leg.castShadow = true;
      group.add(leg);
    }

    // 5. Tailored Walnut & Upholstered Bouclé Headboard at the back of the bed (-Z)
    const headboardFrameGeo = new THREE.BoxGeometry(2.54, 1.28, 0.11);
    const headboardFrame = new THREE.Mesh(headboardFrameGeo, walnutMat);
    headboardFrame.position.set(0, 0.62, -1.38);
    headboardFrame.castShadow = true;
    headboardFrame.receiveShadow = true;
    group.add(headboardFrame);

    const cushionPanelGeo = new THREE.BoxGeometry(2.34, 0.92, 0.08);
    const cushionPanel = new THREE.Mesh(cushionPanelGeo, boucleFabricMat);
    cushionPanel.position.set(0, 0.66, -1.32);
    cushionPanel.castShadow = true;
    cushionPanel.receiveShadow = true;
    group.add(cushionPanel);

    // 6. Symmetrical Walnut Nightstands & Warm Ambient Lamps
    const standGeo = new THREE.BoxGeometry(0.56, 0.48, 0.48);
    const stemGeo = new THREE.CylinderGeometry(0.022, 0.035, 0.24, 14);
    const shadeGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.22, 20);

    for (const side of [-1, 1]) {
      const nx = side * 1.62;
      const nz = -1.08;

      const stand = new THREE.Mesh(standGeo, walnutMat);
      stand.position.set(nx, 0.02, nz);
      stand.castShadow = true;
      stand.receiveShadow = true;
      group.add(stand);

      const stem = new THREE.Mesh(stemGeo, brassMat);
      stem.position.set(nx, 0.38, nz);
      group.add(stem);

      const shade = new THREE.Mesh(shadeGeo, lampShadeMat);
      shade.position.set(nx, 0.54, nz);
      shade.castShadow = true;
      group.add(shade);
    }

    return group;
  }

  private updatePointerNdc(event: PointerEvent | WheelEvent): void {
    if (!this.context) return;
    const rect = this.context.container.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown(event: PointerEvent): void {
    if (!this.context || !this.floatingWoolPad || this.isLabPaused || this.getIntroState() !== 'EXPLORING') return;

    this.pointerDownScreenX = event.clientX;
    this.pointerDownScreenY = event.clientY;
    this.isDraggingCamera = false;

    // If OrbitControls is actively orbiting, bypass mattress interaction
    if (this.isOrbitingCamera) return;

    this.updatePointerNdc(event);
    this.raycaster.setFromCamera(this.pointerNdc, this.context.camera);

    // If in Exploded/Cutaway mode (or a layer is currently active), check if the user clicked a specific 3D layer (0..9)
    if (
      this.isExploded ||
      this.floatingWoolPad.getActiveLayerIndex() !== null
    ) {
      const hitLayerIdx = this.floatingWoolPad.raycastLayerIndex(this.raycaster);
      if (hitLayerIdx !== null) {
        this.floatingWoolPad.setActiveLayerIndex(hitLayerIdx);
        this.onLayerSelectCallback?.(hitLayerIdx);
        return;
      }
    }

    const hits = this.raycaster.intersectObject(this.floatingWoolPad.hitProxyMesh, false);
    if (hits.length > 0) {
      this.isPointerDownOnMattress = true;
      this.floatingWoolPad.setHoverState(true, this.pointerNdc);
      // Gentle authentic tactile squish with local foam dent & macro buoyancy tilt
      this.floatingWoolPad.triggerCompressionAtWorldPoint(hits[0].point, 0.035);
    } else {
      this.isPointerDownOnMattress = false;
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.context || this.isLabPaused) return;

    // Distinguish between "Click/Hold to press mattress" and "Drag mouse to rotate camera OrbitControls"
    if (this.isPointerDownOnMattress && !this.isDraggingCamera) {
      const dragDist = Math.hypot(
        event.clientX - this.pointerDownScreenX,
        event.clientY - this.pointerDownScreenY,
      );
      if (dragDist > 6) {
        // Drag threshold exceeded: transition to camera orbit, release mattress compression
        this.isDraggingCamera = true;
        this.isPointerDownOnMattress = false;
        this.floatingWoolPad?.releaseCompression();
      }
    }

    // When user is dragging to rotate the camera or OrbitControls is actively orbiting,
    // suppress raycasting onto the mattress to prevent accidental continuous indentation during view orbit
    if (this.isOrbitingCamera || this.isDraggingCamera) {
      if (this.context.container.style.cursor === 'pointer') {
        this.context.container.style.cursor = '';
      }
      return;
    }

    const now = performance.now();
    // Throttle hover raycasting to 30Hz for deterministic 60 FPS
    if (!this.isPointerDownOnMattress && now - this.lastHoverRaycastTime < 32) return;
    this.lastHoverRaycastTime = now;

    this.updatePointerNdc(event);
    this.raycaster.setFromCamera(this.pointerNdc, this.context.camera);

    if (this.floatingWoolPad) {
      const padHits = this.raycaster.intersectObject(this.floatingWoolPad.hitProxyMesh, false);
      const isHoveringPad = padHits.length > 0;
      this.floatingWoolPad.setHoverState(isHoveringPad, this.pointerNdc);
      this.context.container.style.cursor = isHoveringPad ? 'pointer' : '';
    }

    // Raycast against curved meadow terrain for smooth sheep hover avoidance ONLY in Meadow Mode
    if (this.currentEnvironment === 'meadow' && this.meadowTerrain) {
      const groundHits = this.raycaster.intersectObject(this.meadowTerrain.terrainMesh, false);
      if (groundHits.length > 0) {
        this.scratchHoverVec.copy(groundHits[0].point);
        this.hoverWorldPoint = this.scratchHoverVec;
      } else {
        this.hoverWorldPoint = null;
      }
    } else {
      this.hoverWorldPoint = null;
    }
  }

  private handlePointerUp(): void {
    if (this.isPointerDownOnMattress) {
      this.isPointerDownOnMattress = false;
      this.floatingWoolPad?.releaseCompression();
    }
    this.isDraggingCamera = false;
  }

  private handleWheelDolly(event: WheelEvent): void {
    if (this.isLabPaused || this.getIntroState() !== 'EXPLORING') return;
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * -0.14;
    this.dollyProgress = THREE.MathUtils.clamp(this.dollyProgress + delta, 0, 1);
    const startPose = this.getDefaultPoseForEnvironment(this.currentEnvironment);
    this.targetCameraPos.lerpVectors(
      startPose.position,
      CAMERA_PRESETS.dollyClose.position,
      this.dollyProgress,
    );
    this.targetLookAt.lerpVectors(
      startPose.target,
      CAMERA_PRESETS.dollyClose.target,
      this.dollyProgress,
    );
    this.cameraPosition.copy(this.targetCameraPos);
    this.onCameraPositionChangeCallback?.(this.cameraPosition.clone());
    this.isTransitioningCamera = true;
  }

  /**
   * Repositions the camera to a preset angle WITHOUT mutating `currentEnvironment` or `isExploded`.
   */
  public setCameraPreset(preset: CameraAnglePreset): void {
    this.activeCameraPreset = preset;
    const pose =
      preset === 'hero45'
        ? this.getDefaultPoseForEnvironment(this.currentEnvironment)
        : CAMERA_PRESETS[preset];
    this.targetCameraPos.copy(pose.position);
    this.targetLookAt.copy(pose.target);
    this.cameraPosition.copy(pose.position);
    this.onCameraPositionChangeCallback?.(this.cameraPosition.clone());
    this.dollyProgress = preset === 'dollyClose' ? 1 : 0;
    this.isTransitioningCamera = true;
  }

  public getCameraPreset(): CameraAnglePreset {
    return this.activeCameraPreset;
  }

  /**
   * Sanitizes Reset Camera behavior:
   * ONLY repositions Camera and Controls target to default coordinates relative to the current room.
   * NEVER mutates `currentEnvironment` or `isExploded` layer anatomy.
   */
  public resetCamera(): void {
    if (!this.context) return;
    this.activeCameraPreset = 'hero45';
    this.dollyProgress = 0;
    const defaultPose = this.getDefaultPoseForEnvironment(this.currentEnvironment);
    this.targetCameraPos.copy(defaultPose.position);
    this.targetLookAt.copy(defaultPose.target);
    this.cameraPosition.copy(defaultPose.position);
    this.onCameraPositionChangeCallback?.(this.cameraPosition.clone());
    this.isTransitioningCamera = true;
  }

  public getCameraPosition(): THREE.Vector3 {
    return this.cameraPosition.clone();
  }

  public onCameraPositionChange(cb: (pos: THREE.Vector3) => void): void {
    this.onCameraPositionChangeCallback = cb;
  }

  public onIntroFlightComplete(cb: () => void): void {
    this.onIntroFlightCompleteCallback = cb;
  }

  public onIntroStateChange(cb: (state: IntroState) => void): void {
    this.onIntroStateChangeCallback = cb;
  }

  public onIntroPhase1StageChange(cb: (stage: IntroPhase1Stage) => void): void {
    this.onIntroPhase1StageChangeCallback = cb;
  }

  public getIntroState(): IntroState {
    return this.introSequence?.getState() ?? 'IDLE';
  }

  public getIntroPhase1Stage(): IntroPhase1Stage {
    return this.introSequence?.getPhase1Stage() ?? 'void';
  }

  public startIntroFlight(): void {
    this.isTransitioningCamera = false;
    this.introSequence?.startFlight();
  }

  public skipIntroFlight(): void {
    this.isTransitioningCamera = false;
    this.introSequence?.skipFlight();
  }

  public skipIntro(): void {
    this.skipIntroFlight();
  }

  /**
   * Independent Layer Explosion state machine (`isExploded`).
   * Elevates or collapses the 10 layers strictly in-place inside the current environment
   * without mutating `currentEnvironment` or `cameraPosition`.
   */
  public setExploded(exploded: boolean): void {
    this.isExploded = exploded;
    if (!this.floatingWoolPad) return;

    if (exploded) {
      this.bedroomSanctuary?.setBedDecorVisible(false);
      this.floatingWoolPad.setExplodedFactor(1.0);
      if (this.floatingWoolPad.getActiveLayerIndex() === null) {
        this.floatingWoolPad.setActiveLayerIndex(0);
        this.onLayerSelectCallback?.(0);
      }
    } else {
      this.bedroomSanctuary?.setBedDecorVisible(true);
      this.floatingWoolPad.setExplodedFactor(0.0);
      this.floatingWoolPad.setActiveLayerIndex(null);
    }
  }

  public getIsExploded(): boolean {
    return this.isExploded;
  }

  public setActiveLayerIndex(index: number | null): void {
    if (!this.floatingWoolPad) return;
    this.isExploded = index !== null;
    this.bedroomSanctuary?.setBedDecorVisible(index === null);
    this.floatingWoolPad.setExplodedFactor(index !== null ? 1.0 : 0.0);
    this.floatingWoolPad.setActiveLayerIndex(index);
  }

  public getActiveLayerIndex(): number | null {
    return this.floatingWoolPad?.getActiveLayerIndex() ?? null;
  }

  public onLayerSelect(cb: (layerIndex: number) => void): void {
    this.onLayerSelectCallback = cb;
  }

  public setMattressSize(spec: MattressSizeSpec): void {
    this.floatingWoolPad?.setSizeSpec(spec);
    if (this.currentEnvironment === 'meadow') {
      this.floatingWoolPad?.setFloatingEnabled(true);
    }
  }

  public setActiveModel(modelKey: PuffyModelKey | string): void {
    this.activeEcoModel = resolvePuffyModelKey(modelKey);
    if (this.floatingWoolPad) {
      this.floatingWoolPad.group.visible = true;
      // Apply immediately while the Craft & Specs Lab pauses the main loop so the mattress
      // is already in its target height/layer configuration upon closing the overlay.
      this.floatingWoolPad.updateModel(this.activeEcoModel, this.isLabPaused);
      if (this.currentEnvironment === 'meadow') {
        this.floatingWoolPad.setFloatingEnabled(true);
      }
    }
    this.bedroomSanctuary?.snapAccessoriesToSurface();
    this.bedroomSanctuary?.syncMattressHeight(
      this.floatingWoolPad?.getHeightDeltaFromRoyal() ?? 0,
    );
    this.sanitizeCameraAndControls();
  }

  public getActiveModel(): PuffyModelKey {
    return this.activeEcoModel;
  }

  public switchMattressModel(modelKey: MattressModelId | PuffyModelKey): void {
    if (modelKey === 'cloud' || modelKey === 'lux' || modelKey === 'royal') {
      this.setActiveModel(modelKey);
      return;
    }
    if (this.floatingWoolPad) {
      this.floatingWoolPad.group.visible = true;
      this.floatingWoolPad.switchMattressModel(modelKey);
    }
    this.sanitizeCameraAndControls();
  }

  public setExplodedFactor(factor: number): void {
    this.floatingWoolPad?.setExplodedFactor(factor);
  }

  public triggerCenterHandPress(): void {
    if (!this.floatingWoolPad) return;
    const randomOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.45,
      0.55,
      (Math.random() - 0.5) * 0.55,
    );
    // Softly indents top memory foam, holds briefly, then smoothly rebounds over 0.8s
    this.floatingWoolPad.triggerCompressionAtWorldPoint(randomOffset, 0.035, 320);
  }

  public onTelemetry(cb: (readout: TelemetryReadout) => void): void {
    this.onTelemetryCallback = cb;
  }

  private cinematicTween: gsap.core.Tween | null = null;
  private cinematicFlight: {
    startElapsed: number | null;
    durationSec: number;
    startOffset: THREE.Vector3;
    target: THREE.Vector3;
    onProgress: (p: number) => void;
    onComplete: () => void;
  } | null = null;

  public getCamera(): THREE.Camera | null {
    return this.context?.camera ?? null;
  }

  /**
   * Eased 360° orbit with a gentle rise/dip around the current OrbitControls target.
   * Progress is driven from update(), so it is frame-locked to the recorded canvas.
   */
  public startCinematicFlight(
    durationSec: number,
    onProgress: (p: number) => void,
    onComplete: () => void
  ): void {
    if (!this.context || !this.controls) {
      onComplete();
      return;
    }
    const target = this.controls.target.clone();
    this.isTransitioningCamera = false;

    const env = this.currentEnvironment;
    if (env === 'meadow' || env === 'bedroom') {
      const isBedroom = env === 'bedroom';
      const curve = new THREE.CatmullRomCurve3(
        (isBedroom ? BEDROOM_SPLINE : MEADOW_SPLINE).map((v) => v.clone()),
        false,
        'catmullrom',
        0.5
      );
      const lookAt = (isBedroom ? BEDROOM_TARGET : MEADOW_TARGET).clone();
      const controls = this.controls;
      const cam = this.context.camera;
      const prevEnabled = controls.enabled;
      controls.enabled = false;
      this.cinematicTween?.kill();
      const state = { t: 0 };
      this.cinematicTween = gsap.to(state, {
        t: 1,
        duration: durationSec,
        ease: 'power2.inOut',
        onUpdate: () => {
          cam.position.copy(curve.getPointAt(state.t));
          controls.target.copy(lookAt);
          cam.lookAt(lookAt);
          onProgress(state.t);
        },
        onComplete: () => {
          controls.enabled = prevEnabled;
          controls.update();
          this.cinematicTween = null;
          onComplete();
        },
      });
      return;
    }
    this.cinematicFlight = {
      startElapsed: null,
      durationSec,
      startOffset: this.context.camera.position.clone().sub(target),
      target,
      onProgress,
      onComplete,
    };
  }

  private advanceCinematicFlight(elapsed: number): void {
    const f = this.cinematicFlight;
    if (!f || !this.context) return;
    if (f.startElapsed === null) f.startElapsed = elapsed;
    const p = THREE.MathUtils.clamp((elapsed - f.startElapsed) / f.durationSec, 0, 1);
    const eased = p * p * (3 - 2 * p);
    const angle = eased * Math.PI * 2;
    const offset = f.startOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    offset.y = Math.max(0.3, f.startOffset.y + Math.sin(p * Math.PI) * 0.6);
    const cam = this.context.camera;
    cam.position.copy(f.target).add(offset);
    cam.lookAt(f.target);
    f.onProgress(p);
    if (p >= 1) {
      this.cinematicFlight = null;
      f.onComplete();
    }
  }

  public update(elapsedTime: number, deltaTime: number): void {
    if (!this.context) return;
    // Background CPU Throttling: pause procedural simulation when inspecting the Craft & Specs Lab
    if (this.isLabPaused) return;

    const safeElapsed = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    const dt = Number.isFinite(deltaTime)
      ? THREE.MathUtils.clamp(deltaTime, 0, 0.05)
      : 0.016;

    this.sanitizeCameraAndControls();

    // 1. Cohesive Intro Sequence (IDLE breathing, FLYING chase cam, or EXPLORING preset lerp)
    this.introSequence?.update(safeElapsed);

    if (this.getIntroState() === 'EXPLORING' && this.isTransitioningCamera && this.controls) {
      const cam = this.context.camera;
      cam.position.lerp(this.targetCameraPos, 0.05);
      this.controls.target.lerp(this.targetLookAt, 0.05);

      if (
        cam.position.distanceToSquared(this.targetCameraPos) < 0.0006 &&
        this.controls.target.distanceToSquared(this.targetLookAt) < 0.0006
      ) {
        this.isTransitioningCamera = false;
      }
    }

    this.advanceCinematicFlight(safeElapsed);

    if (this.controls && this.controls.enabled) {
      this.controls.update();
    }
    this.sanitizeCameraAndControls();

    // Dynamic view-angle & mattress occlusion damping for Golden Dawn optical lens flare
    if (this.dawnFlare && this.sunLight) {
      this.dawnFlare.update(
        this.context.camera,
        this.sunLight.position,
        this.currentEnvironment === 'meadow',
        this.floatingWoolPad?.group,
      );
    }

    // 2. Update Floating / Bed-Resting Mattress & Memory-Foam Compression Physics

    if (this.floatingWoolPad) {
      this.floatingWoolPad.update(safeElapsed, dt);
      if (this.currentEnvironment === 'bedroom' && this.bedroomSanctuary) {
        this.bedroomSanctuary.syncMattressHeight(
          this.floatingWoolPad.getHeightDeltaFromRoyal(),
        );
      }
      const elevation = this.floatingWoolPad.getCurrentElevation();
      const compMm = this.floatingWoolPad.getCompressionMm();

      // 3. Meadow-Only Procedural Physics: ONLY run cloud drift, ground mist & sheep flocking in Meadow Mode!
      if (this.currentEnvironment === 'meadow') {
        this.meadowTerrain?.updateClouds(safeElapsed, dt);
        this.groundMist?.update(safeElapsed);
        this.sheepFlock?.update(
          safeElapsed,
          dt,
          elevation,
          compMm > 12,
          this.hoverWorldPoint,
        );
      }

      // 4. Emit live telemetry to UI throttled to 200ms (5Hz) with smooth interpolation
      if (this.onTelemetryCallback && safeElapsed - this.lastTelemetryEmit >= 0.2) {
        this.lastTelemetryEmit = safeElapsed;
        const targetAirflow = 48.2 + Math.sin(safeElapsed * 0.9) * 0.8;
        this.onTelemetryCallback({
          springCompressionMm: compMm,
          activeSheepCount:
            this.currentEnvironment === 'meadow' ? (this.sheepFlock?.getActiveCount() ?? 8) : 0,
          airflowCfm: Number(targetAirflow.toFixed(1)),
          surfaceTempC: 28.5,
        });
      }
    }
  }

  public onResize(width: number, height: number): void {
    if (!this.context || width <= 0 || height <= 0) return;
    this.context.camera.aspect = width / height;
    this.context.camera.updateProjectionMatrix();
    this.context.renderer.setSize(width, height, false);
  }

  public dispose(): void {
    this.introSequence?.dispose();
    this.introSequence = null;

    if (this.context) {
      const {container, scene} = this.context;
      if (this.boundPointerDown) {
        container.removeEventListener('pointerdown', this.boundPointerDown);
      }
      if (this.boundPointerMove) {
        container.removeEventListener('pointermove', this.boundPointerMove);
      }
      if (this.boundPointerLeave) {
        container.removeEventListener('pointerleave', this.boundPointerLeave);
      }
      if (this.boundWheel) {
        container.removeEventListener('wheel', this.boundWheel);
      }
      if (this.bedroomSanctuary) {
        scene.remove(this.bedroomSanctuary.group);
        this.bedroomSanctuary.dispose();
        this.bedroomSanctuary = null;
        this.bedroomGroup = null;
      } else if (this.bedroomGroup) {
        scene.remove(this.bedroomGroup);
        cleanupScene(this.bedroomGroup);
        this.bedroomGroup = null;
      }
    }
    if (this.boundPointerUp) {
      window.removeEventListener('pointerup', this.boundPointerUp);
    }

    this.dawnFlare?.dispose();
    this.dawnFlare = null;
    this.sunLight = null;

    this.controls?.dispose();
    this.controls = null;

    this.meadowTerrain?.dispose();
    this.meadowTerrain = null;

    this.groundMist?.dispose();
    this.groundMist = null;

    this.floatingWoolPad?.dispose();
    this.floatingWoolPad = null;

    this.sheepFlock?.dispose();
    this.sheepFlock = null;

    this.heroCloudlet?.dispose();
    this.heroCloudlet = null;

    this.envTexture?.dispose();
    this.envTexture = null;

    this.context = null;
  }
}
