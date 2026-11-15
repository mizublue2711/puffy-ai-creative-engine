import * as THREE from 'three';
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
import {MeadowTerrain} from './MeadowTerrain.ts';
import {SheepFlockEngine} from './SheepFlockEngine.ts';

export type SanctuaryEnvironmentMode = 'meadow' | 'bedroom';

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
  exploded: {
    position: new THREE.Vector3(2.95, 1.45, 2.45),
    target: new THREE.Vector3(0.0, 0.58, 0.0),
  },
};

const BEDROOM_CAMERA_POSE: CameraPose = {
  position: new THREE.Vector3(2.75, 1.56, 3.25),
  target: new THREE.Vector3(0.0, 0.36, -0.1),
};

export class WoolMeadowSceneModule implements ISceneModule {
  public readonly id = 'puffy-wool-meadow-sanctuary';

  private context: SceneModuleContext | null = null;
  private controls: OrbitControls | null = null;
  private envTexture: THREE.Texture | null = null;

  private meadowTerrain: MeadowTerrain | null = null;
  private floatingWoolPad: FloatingWoolPad | null = null;
  private sheepFlock: SheepFlockEngine | null = null;
  private bedroomGroup: THREE.Group | null = null;

  private environmentMode: SanctuaryEnvironmentMode = 'meadow';
  private isLabPaused = false;
  private readonly bedSurfaceHeight = 0.36;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private isPointerDown = false;
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
  private lastTelemetryEmit = 0;

  // Bound event listeners for deterministic removal in dispose()
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: (() => void) | null = null;
  private boundPointerLeave: (() => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;

  public init(context: SceneModuleContext): void {
    this.context = context;
    const {scene, camera, renderer, container, isSoftwareGl} = context;

    // 1. Dual-Color Atmospheric Sky & Volumetric Distance Fog
    scene.background = new THREE.Color('#EBF1F5');
    scene.fog = new THREE.FogExp2('#EAE6DD', 0.018);

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

    // 3. Cinematic Directional Sunlight, Low Ambient & Cool Rim Lighting Rig
    const ambientLight = new THREE.AmbientLight('#FFFFFF', 0.35);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#FFF8E7', 1.4);
    sunLight.position.set(12, 18, 8);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    const d = 10.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#D6E8FF', 0.5);
    rimLight.position.set(-10, 10, -10);
    scene.add(rimLight);

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
    });

    // 5. Instantiate 3D Sub-Modules
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    this.meadowTerrain = new MeadowTerrain(maxAnisotropy);
    scene.add(this.meadowTerrain.group);

    this.floatingWoolPad = new FloatingWoolPad(maxAnisotropy);
    scene.add(this.floatingWoolPad.group);

    this.sheepFlock = new SheepFlockEngine(8);
    scene.add(this.sheepFlock.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Bind Tactile Raycaster Pointer & Smooth Dolly Wheel Events
    this.boundPointerDown = (ev: PointerEvent) => this.handlePointerDown(ev);
    this.boundPointerMove = (ev: PointerEvent) => this.handlePointerMove(ev);
    this.boundPointerUp = () => this.handlePointerUp();
    this.boundPointerLeave = () => {
      this.hoverWorldPoint = null;
      this.floatingWoolPad?.setHoverState(false);
    };
    this.boundWheel = (ev: WheelEvent) => this.handleWheelDolly(ev);

    container.addEventListener('pointerdown', this.boundPointerDown);
    container.addEventListener('pointermove', this.boundPointerMove);
    container.addEventListener('pointerleave', this.boundPointerLeave);
    container.addEventListener('wheel', this.boundWheel, {passive: false});
    window.addEventListener('pointerup', this.boundPointerUp);
  }

  /**
   * Switches between the outdoor Meadow Sanctuary and the indoor Sanctuary Bedroom (XR)
   * within the single unified WebGL render loop, strictly disposing temporary bedroom meshes
   * when returning to the meadow to maintain 0 VRAM leaks.
   */
  public setEnvironmentMode(mode: SanctuaryEnvironmentMode): void {
    if (!this.context || this.environmentMode === mode) return;
    this.environmentMode = mode;
    const {scene} = this.context;

    if (mode === 'bedroom') {
      // 1. UNMOUNT / HIDE THE SHEEP FLOCK & MEADOW TERRAIN
      if (this.sheepFlock) {
        this.sheepFlock.group.visible = false;
      }
      if (this.meadowTerrain) {
        this.meadowTerrain.group.visible = false;
      }
      this.hoverWorldPoint = null;

      // 2. REST MATTRESS STATICALLY ON THE WOODEN BED FRAME (disable zero-G hovering)
      this.floatingWoolPad?.setFloatingEnabled(false, this.bedSurfaceHeight);

      // 3. BUILD & MOUNT SANCTUARY BEDROOM (clean up any prior group first)
      if (this.bedroomGroup) {
        scene.remove(this.bedroomGroup);
        cleanupScene(this.bedroomGroup);
        this.bedroomGroup = null;
      }
      this.bedroomGroup = this.buildSanctuaryBedroomGroup();
      scene.add(this.bedroomGroup);

      // Warm indoor sanctuary atmosphere
      scene.background = new THREE.Color('#EFEAE1');
      scene.fog = new THREE.FogExp2('#EFEAE1', 0.012);

      this.targetCameraPos.copy(BEDROOM_CAMERA_POSE.position);
      this.targetLookAt.copy(BEDROOM_CAMERA_POSE.target);
      this.isTransitioningCamera = true;
    } else {
      // 1. STRICT RESOURCE DISPOSAL of Bedroom meshes when switching back to Meadow
      if (this.bedroomGroup) {
        scene.remove(this.bedroomGroup);
        cleanupScene(this.bedroomGroup);
        this.bedroomGroup = null;
      }

      // 2. RESTORE MEADOW SANCTUARY & SHEEP FLOCK
      if (this.meadowTerrain) {
        this.meadowTerrain.group.visible = true;
      }
      if (this.sheepFlock) {
        this.sheepFlock.group.visible = true;
      }

      // 3. RE-ENABLE ZERO-G HOVERING ON MATTRESS
      this.floatingWoolPad?.setFloatingEnabled(true);

      // Restore outdoor morning sky & horizon mist
      scene.background = new THREE.Color('#EBF1F5');
      scene.fog = new THREE.FogExp2('#EAE6DD', 0.018);

      const pose = CAMERA_PRESETS[this.activeCameraPreset];
      this.targetCameraPos.copy(pose.position);
      this.targetLookAt.copy(pose.target);
      this.isTransitioningCamera = true;
    }
  }

  public getEnvironmentMode(): SanctuaryEnvironmentMode {
    return this.environmentMode;
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
    if (!this.context || !this.floatingWoolPad || this.isLabPaused) return;
    this.updatePointerNdc(event);
    this.raycaster.setFromCamera(this.pointerNdc, this.context.camera);

    // If in Exploded/Cutaway mode (or a layer is currently active), check if the user clicked a specific 3D layer (0..9)
    if (
      this.activeCameraPreset === 'exploded' ||
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
      this.isPointerDown = true;
      // Pause OrbitControls while pressing the mattress so cushion compression feels grounded
      if (this.controls) {
        this.controls.enabled = false;
      }
      this.floatingWoolPad.setHoverState(true, this.pointerNdc);
      this.floatingWoolPad.triggerCompressionAtWorldPoint(hits[0].point, 0.11);
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.context || this.isLabPaused) return;
    const now = performance.now();
    // Throttle hover raycasting to 30Hz for deterministic 60 FPS
    if (!this.isPointerDown && now - this.lastHoverRaycastTime < 32) return;
    this.lastHoverRaycastTime = now;

    this.updatePointerNdc(event);
    this.raycaster.setFromCamera(this.pointerNdc, this.context.camera);

    if (this.floatingWoolPad) {
      const padHits = this.raycaster.intersectObject(this.floatingWoolPad.hitProxyMesh, false);
      const isHoveringPad = padHits.length > 0;
      this.floatingWoolPad.setHoverState(isHoveringPad, this.pointerNdc);
      this.context.container.style.cursor = isHoveringPad ? 'pointer' : '';

      if (this.isPointerDown && isHoveringPad) {
        this.floatingWoolPad.triggerCompressionAtWorldPoint(padHits[0].point, 0.11);
      }
    }

    // Raycast against curved meadow terrain for smooth sheep hover avoidance ONLY in Meadow Mode
    if (this.environmentMode === 'meadow' && this.meadowTerrain) {
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
    if (this.isPointerDown) {
      this.isPointerDown = false;
      if (this.controls) {
        this.controls.enabled = true;
      }
      this.floatingWoolPad?.releaseCompression();
    }
  }

  private handleWheelDolly(event: WheelEvent): void {
    if (this.isLabPaused) return;
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * -0.14;
    this.dollyProgress = THREE.MathUtils.clamp(this.dollyProgress + delta, 0, 1);
    const startPose =
      this.environmentMode === 'bedroom' ? BEDROOM_CAMERA_POSE : CAMERA_PRESETS.hero45;
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
    this.isTransitioningCamera = true;
  }

  public setCameraPreset(preset: CameraAnglePreset): void {
    this.activeCameraPreset = preset;
    // Switching to a Meadow camera preset automatically returns to the Meadow Sanctuary if in Bedroom mode
    if (this.environmentMode === 'bedroom' && preset === 'hero45') {
      this.setEnvironmentMode('meadow');
    }
    const pose = CAMERA_PRESETS[preset];
    this.targetCameraPos.copy(pose.position);
    this.targetLookAt.copy(pose.target);
    this.dollyProgress = preset === 'dollyClose' ? 1 : 0;
    this.isTransitioningCamera = true;

    if (this.floatingWoolPad) {
      if (preset === 'exploded') {
        this.floatingWoolPad.setExplodedFactor(1.0);
        if (this.floatingWoolPad.getActiveLayerIndex() === null) {
          this.floatingWoolPad.setActiveLayerIndex(0);
          this.onLayerSelectCallback?.(0);
        }
      } else {
        this.floatingWoolPad.setExplodedFactor(0.0);
        this.floatingWoolPad.setActiveLayerIndex(null);
      }
    }
  }

  public getCameraPreset(): CameraAnglePreset {
    return this.activeCameraPreset;
  }

  public setActiveLayerIndex(index: number | null, focusCamera = false): void {
    if (!this.floatingWoolPad) return;
    if (index !== null && focusCamera && this.activeCameraPreset !== 'exploded') {
      this.activeCameraPreset = 'exploded';
      const pose = CAMERA_PRESETS.exploded;
      this.targetCameraPos.copy(pose.position);
      this.targetLookAt.copy(pose.target);
      this.isTransitioningCamera = true;
    }
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
  }

  public switchMattressModel(modelKey: MattressModelId): void {
    this.floatingWoolPad?.switchMattressModel(modelKey);
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
    // Softly sinks for 0.15s, holds briefly, then slowly recovers over 0.8s
    this.floatingWoolPad.triggerCompressionAtWorldPoint(randomOffset, 0.11, 240);
  }

  public onTelemetry(cb: (readout: TelemetryReadout) => void): void {
    this.onTelemetryCallback = cb;
  }

  public update(elapsedTime: number, deltaTime: number): void {
    if (!this.context) return;
    // Background CPU Throttling: pause procedural simulation when inspecting the Craft & Specs Lab
    if (this.isLabPaused) return;

    const dt = Math.min(deltaTime, 0.05);

    // 1. Smoothly lerp Camera Dolly & Preset transitions with 0.05 damping factor
    if (this.isTransitioningCamera && this.controls) {
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

    this.controls?.update();

    // 2. Update Floating / Bed-Resting Mattress & Memory-Foam Compression Physics
    if (this.floatingWoolPad) {
      this.floatingWoolPad.update(elapsedTime, dt);
      const elevation = this.floatingWoolPad.getCurrentElevation();
      const compMm = this.floatingWoolPad.getCompressionMm();

      // 3. Meadow-Only Procedural Physics: ONLY run cloud drift & sheep flocking in Meadow Mode!
      if (this.environmentMode === 'meadow') {
        this.meadowTerrain?.updateClouds(elapsedTime, dt);
        this.sheepFlock?.update(
          elapsedTime,
          dt,
          elevation,
          compMm > 12,
          this.hoverWorldPoint,
        );
      }

      // 4. Emit live telemetry to UI throttled to 200ms (5Hz) with smooth interpolation
      if (this.onTelemetryCallback && elapsedTime - this.lastTelemetryEmit >= 0.2) {
        this.lastTelemetryEmit = elapsedTime;
        const targetAirflow = 48.2 + Math.sin(elapsedTime * 0.9) * 0.8;
        this.onTelemetryCallback({
          springCompressionMm: compMm,
          activeSheepCount:
            this.environmentMode === 'meadow' ? (this.sheepFlock?.getActiveCount() ?? 8) : 0,
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
      if (this.bedroomGroup) {
        scene.remove(this.bedroomGroup);
        cleanupScene(this.bedroomGroup);
        this.bedroomGroup = null;
      }
    }
    if (this.boundPointerUp) {
      window.removeEventListener('pointerup', this.boundPointerUp);
    }

    this.controls?.dispose();
    this.controls = null;

    this.meadowTerrain?.dispose();
    this.meadowTerrain = null;

    this.floatingWoolPad?.dispose();
    this.floatingWoolPad = null;

    this.sheepFlock?.dispose();
    this.sheepFlock = null;

    this.envTexture?.dispose();
    this.envTexture = null;

    this.context = null;
  }
}
