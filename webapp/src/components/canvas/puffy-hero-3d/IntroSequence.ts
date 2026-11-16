import * as THREE from 'three';
import gsap from 'gsap';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {HeroCloudletGuide} from './HeroCloudletGuide.ts';

export type IntroState = 'IDLE' | 'FLYING' | 'EXPLORING';
export type IntroPhase1Stage = 'void' | '2d' | '3d-morph' | 'ready';

// EXTENDED 360° CLOUDLET PATH
export const CLOUDLET_SPLINE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 4.2, 16.0),    // 0%: High mist takeoff
  new THREE.Vector3(2.5, 1.8, 10.5),  // 20%: Banking right
  new THREE.Vector3(-1.6, 0.55, 6.0), // 40%: Low meadow graze past the sheep face
  new THREE.Vector3(2.8, 1.6, 1.2),   // 60%: Sweeping right flank of the mattress
  new THREE.Vector3(1.2, 2.0, -2.4),  // 75%: DEEP BEHIND the mattress (rear view!)
  new THREE.Vector3(-2.2, 1.8, -1.0), // 85%: Circling left rear corner
  new THREE.Vector3(-1.4, 1.4, 2.2),  // 92%: Sweeping back to front
  new THREE.Vector3(0, 0.95, 0.0),    // 100%: Soft touchdown on mattress surface
]);

// EXTENDED 360° CHASE CAMERA PATH (Flows alongside and frames the mattress)
export const CAMERA_SPLINE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 4.5, 17.5),    // 0%
  new THREE.Vector3(1.8, 2.4, 12.0),  // 20%
  new THREE.Vector3(-0.8, 1.2, 7.5),  // 40%: Framing sheep & cloudlet
  new THREE.Vector3(3.6, 2.2, 2.2),   // 60%: High right-quarter angle
  new THREE.Vector3(1.8, 2.6, -3.4),  // 75%: High angle viewing the BACK of the mattress
  new THREE.Vector3(-3.0, 2.2, -1.8), // 85%: Sweeping around the left side
  new THREE.Vector3(-1.8, 1.8, 3.2),  // 92%: Framing return to front
  new THREE.Vector3(0, 1.6, 3.4),     // 100%: Final front-hero inspection point
]);

export const CINEMATIC_FLIGHT_SPLINE = CAMERA_SPLINE;
export const FLIGHT_SPLINE = CAMERA_SPLINE;

export const FINAL_HERO_CAMERA_POS = new THREE.Vector3(0, 1.6, 3.4);
export const FINAL_HERO_LOOKAT = new THREE.Vector3(0, 0.65, 0);

const SCROLL_LERP_FACTOR = 0.04;
const WHEEL_SENSITIVITY = 0.0005;
const TOUCH_SENSITIVITY = 0.0018;

export interface IntroSequenceConfig {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  getControls: () => OrbitControls | null;
  getCloudlet: () => HeroCloudletGuide | null;
  getMattressGroup: () => THREE.Group | null;
  getMattressTopY: () => number;
  isSoftwareGl: boolean;
  onStateChange?: (state: IntroState) => void;
  onPhase1StageChange?: (stage: IntroPhase1Stage) => void;
  onCameraPositionChange?: (pos: THREE.Vector3) => void;
  onFlightComplete?: () => void;
  onSheepIntroPose?: (active: boolean) => void;
}

/**
 * Cohesive controller for the 3-Phase Cinematic Zero-Gravity Intro:
 *  1. IDLE: Pristine #F6F4EE linen stage, centered breathing 3D Cloudlet, delayed CTA reveal.
 *  2. FLYING: 1.0s linen fade-out + 6.5s power2.inOut slalom flight with clamped roll & chase cam.
 *  3. TOUCHDOWN & HANDOVER: 1.2s breathing pause on mattress quilt, sky ascension, 360° OrbitControls.
 */
export class IntroSequence {
  private readonly cfg: IntroSequenceConfig;

  private introState: IntroState = 'IDLE';
  private phase1Stage: IntroPhase1Stage = 'void';

  private phase1Timer: gsap.core.Tween | null = null;
  private flightTimeline: gsap.core.Timeline | null = null;
  private curtainTween: gsap.core.Tween | null = null;
  private ascendTween: gsap.core.Tween | null = null;
  private ascendFadeTween: gsap.core.Tween | null = null;
  private failsafeTimer: number | null = null;

  private readonly flightProgress = {current: 0, target: 0};
  private lastTouchY: number | null = null;
  private scrollListenersAttached = false;
  private stopAutoRotateHandler: (() => void) | null = null;
  private readonly scratchCloudPos = new THREE.Vector3();
  private readonly scratchCamPos = new THREE.Vector3();
  private readonly scratchLookAt = new THREE.Vector3();
  private readonly scratchNextPos = new THREE.Vector3();
  private readonly scratchForwardDir = new THREE.Vector3();
  private readonly scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  private readonly linenCurtainMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  constructor(config: IntroSequenceConfig) {
    this.cfg = config;

    // 3D warm linen backdrop plane positioned behind the cloudlet and in front of the meadow
    // during IDLE, fading out smoothly over 1.0s when flight begins.
    const curtainGeo = new THREE.PlaneGeometry(24, 16);
    const curtainMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#F6F4EE'),
      transparent: true,
      opacity: 1,
      depthWrite: true,
      toneMapped: false,
    });
    this.linenCurtainMesh = new THREE.Mesh(curtainGeo, curtainMat);
    this.linenCurtainMesh.name = 'intro_3d_linen_curtain';
    this.linenCurtainMesh.renderOrder = 1;
    this.linenCurtainMesh.visible = false;
    this.cfg.scene.add(this.linenCurtainMesh);
  }

  public getState(): IntroState {
    return this.introState;
  }

  public getPhase1Stage(): IntroPhase1Stage {
    return this.phase1Stage;
  }

  private setPhase1Stage(stage: IntroPhase1Stage): void {
    this.phase1Stage = stage;
    this.cfg.onPhase1StageChange?.(stage);
  }

  private setState(state: IntroState): void {
    this.introState = state;
    this.cfg.onStateChange?.(state);
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    if (this.introState !== 'FLYING') return;
    event.preventDefault();
    const delta = event.deltaY * WHEEL_SENSITIVITY;
    this.flightProgress.target = THREE.MathUtils.clamp(this.flightProgress.target + delta, 0, 1);
  };

  private readonly handleTouchStart = (event: TouchEvent): void => {
    if (this.introState !== 'FLYING' || event.touches.length === 0) return;
    this.lastTouchY = event.touches[0].clientY;
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    if (this.introState !== 'FLYING' || event.touches.length === 0) return;
    event.preventDefault();
    const currentY = event.touches[0].clientY;
    if (this.lastTouchY !== null) {
      const deltaY = this.lastTouchY - currentY;
      const delta = deltaY * TOUCH_SENSITIVITY;
      this.flightProgress.target = THREE.MathUtils.clamp(this.flightProgress.target + delta, 0, 1);
    }
    this.lastTouchY = currentY;
  };

  private attachScrollListeners(): void {
    if (this.scrollListenersAttached || typeof window === 'undefined') return;
    window.addEventListener('wheel', this.handleWheel, {passive: false});
    window.addEventListener('touchstart', this.handleTouchStart, {passive: true});
    window.addEventListener('touchmove', this.handleTouchMove, {passive: false});
    this.scrollListenersAttached = true;
  }

  private detachScrollListeners(): void {
    if (!this.scrollListenersAttached || typeof window === 'undefined') return;
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    this.lastTouchY = null;
    this.scrollListenersAttached = false;
  }

  private detachAutoRotateListener(): void {
    if (this.stopAutoRotateHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.stopAutoRotateHandler);
      this.stopAutoRotateHandler = null;
    }
  }

  private killAllTweens(): void {
    this.detachScrollListeners();
    this.detachAutoRotateListener();
    if (this.failsafeTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.failsafeTimer);
      this.failsafeTimer = null;
    }
    this.phase1Timer?.kill();
    this.phase1Timer = null;
    this.flightTimeline?.kill();
    this.flightTimeline = null;
    this.curtainTween?.kill();
    this.curtainTween = null;
    this.ascendTween?.kill();
    this.ascendTween = null;
    this.ascendFadeTween?.kill();
    this.ascendFadeTween = null;
  }

  private positionCurtainBehindCloudlet(): void {
    const {camera} = this.cfg;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    this.linenCurtainMesh.position.copy(camera.position).addScaledVector(forward, 2.2);
    this.linenCurtainMesh.quaternion.copy(camera.quaternion);
  }

  public enterIdleStage(): void {
    this.killAllTweens();
    this.setState('IDLE');
    this.setPhase1Stage('void');

    const controls = this.cfg.getControls();
    if (controls) {
      controls.enabled = false;
    }

    const startCloudPos = CLOUDLET_SPLINE.getPoint(0);
    // Center the cloudlet dead-center in the viewport during IDLE
    const idleCamPos = CAMERA_SPLINE.getPoint(0);

    const {camera} = this.cfg;
    camera.position.copy(idleCamPos);
    camera.lookAt(startCloudPos);
    this.cfg.onCameraPositionChange?.(idleCamPos.clone());

    const cloudlet = this.cfg.getCloudlet();
    if (cloudlet) {
      cloudlet.group.visible = true;
      cloudlet.group.position.copy(startCloudPos);
      cloudlet.group.rotation.set(0, 0, 0);
      cloudlet.mesh.scale.set(1, 1, 1);
      cloudlet.mesh.material.transparent = false;
      cloudlet.mesh.material.opacity = 1;
    }

    // Mask the meadow, sheep, and mattress behind the cloudlet
    this.linenCurtainMesh.visible = true;
    this.linenCurtainMesh.material.opacity = 1;
    this.positionCurtainBehindCloudlet();

    // Reveal the Enter the Dream CTA 0.8s after the cloudlet stabilizes
    this.phase1Timer = gsap.delayedCall(0.8, () => {
      if (this.introState === 'IDLE') {
        this.setPhase1Stage('ready');
      }
    });

    // Safety fallback: if intro or 3D cloudlet fails after 4s, clear blocking overlay automatically
    if (typeof window !== 'undefined') {
      this.failsafeTimer = window.setTimeout(() => {
        this.failsafeTimer = null;
        if (typeof document !== 'undefined') {
          const curtain = document.getElementById('intro-curtain');
          if (curtain && curtain.style.opacity !== '0') {
            curtain.style.pointerEvents = 'none';
            curtain.style.opacity = '0';
          }
        }
        const activeCloudlet = this.cfg.getCloudlet();
        const cloudletFailed = !activeCloudlet || !activeCloudlet.group.visible;
        if (this.introState === 'IDLE' && (cloudletFailed || this.phase1Stage !== 'ready')) {
          this.forceExploring();
        }
      }, 4000);
    }
  }

  private applyFlightFrame(t: number): void {
    const clampedT = THREE.MathUtils.clamp(t, 0, 1);
    const {camera} = this.cfg;
    const cloudlet = this.cfg.getCloudlet();

    // 1. Cloudlet follows CLOUDLET_SPLINE
    CLOUDLET_SPLINE.getPoint(clampedT, this.scratchCloudPos);

    if (cloudlet) {
      cloudlet.group.position.copy(this.scratchCloudPos);

      // Safe forward sampling for subtle banking along CLOUDLET_SPLINE
      if (clampedT >= 0.98) {
        const prevPos = CLOUDLET_SPLINE.getPoint(Math.max(0.0, clampedT - 0.02));
        this.scratchNextPos.copy(this.scratchCloudPos);
        this.scratchForwardDir.subVectors(this.scratchNextPos, prevPos);
      } else {
        CLOUDLET_SPLINE.getPoint(Math.min(1.0, clampedT + 0.02), this.scratchNextPos);
        this.scratchForwardDir.subVectors(this.scratchNextPos, this.scratchCloudPos);
      }

      if (this.scratchForwardDir.lengthSq() > 1e-6) {
        this.scratchForwardDir.normalize();
      } else {
        this.scratchForwardDir.set(0, 0, -1);
      }

      const bankFade = 1 - THREE.MathUtils.smoothstep(clampedT, 0.85, 1.0);
      const horizontalCurve = this.scratchNextPos.x - this.scratchCloudPos.x;
      const clampedRoll = THREE.MathUtils.clamp(-horizontalCurve * 0.4, -0.25, 0.25) * bankFade;
      const targetYaw = Math.atan2(-this.scratchForwardDir.x, -this.scratchForwardDir.z) * 0.45 * bankFade;
      const targetPitch = Math.asin(THREE.MathUtils.clamp(this.scratchForwardDir.y, -0.6, 0.6)) * 0.5 * bankFade;
      this.scratchEuler.set(targetPitch, targetYaw, clampedRoll, 'YXZ');
      cloudlet.group.quaternion.setFromEuler(this.scratchEuler);
    }

    // 2. Camera follows CAMERA_SPLINE independently (360° orbital odyssey)
    CAMERA_SPLINE.getPoint(clampedT, this.scratchCamPos);
    camera.position.copy(this.scratchCamPos);

    // 3. Dynamic LookAt:
    // 0% - 50%: Focus on the cloudlet guide.
    // 50% - 100%: Smoothly interpolate lookAt toward mattressGroup.position.
    const mattressTarget = this.cfg.getMattressGroup()?.position ?? FINAL_HERO_LOOKAT;
    const targetBlend = THREE.MathUtils.smoothstep(clampedT, 0.5, 1.0);
    this.scratchLookAt.lerpVectors(this.scratchCloudPos, mattressTarget, targetBlend);
    camera.lookAt(this.scratchLookAt);
    this.cfg.onCameraPositionChange?.(camera.position.clone());
  }

  private handoverOrbitControls(): void {
    const {camera} = this.cfg;
    const controls = this.cfg.getControls();
    const mattressGroup = this.cfg.getMattressGroup();
    const targetPos = mattressGroup ? mattressGroup.position : FINAL_HERO_LOOKAT;

    camera.position.copy(FINAL_HERO_CAMERA_POS);
    this.cfg.onCameraPositionChange?.(FINAL_HERO_CAMERA_POS.clone());

    if (controls) {
      controls.enabled = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true; // Subtly tease rotation
      controls.autoRotateSpeed = 1.0; // Gentle turntable speed
      controls.enableZoom = true;
      controls.zoomSpeed = 0.8;
      controls.minAzimuthAngle = -Infinity; // Full 360° rotation
      controls.maxAzimuthAngle = Infinity;
      controls.minPolarAngle = Math.PI / 6;
      controls.maxPolarAngle = Math.PI / 2.05;
      controls.minDistance = 2.0; // Close enough to inspect fabric stitches
      controls.maxDistance = 6.5; // Far enough to view whole bedroom/meadow
      controls.target.copy(targetPos);
      controls.update();

      if (typeof window !== 'undefined') {
        this.detachAutoRotateListener();
        this.stopAutoRotateHandler = () => {
          controls.autoRotate = false;
          this.detachAutoRotateListener();
        };
        window.addEventListener('pointerdown', this.stopAutoRotateHandler);
      }
    }
    camera.lookAt(targetPos);
  }

  private beginAscensionAndHandover(): void {
    if (this.introState === 'EXPLORING') return;

    this.detachScrollListeners();
    this.linenCurtainMesh.visible = false;
    this.cfg.onSheepIntroPose?.(false);
    this.setState('EXPLORING');
    this.handoverOrbitControls();
    this.cfg.onFlightComplete?.();

    const cloudlet = this.cfg.getCloudlet();
    if (cloudlet) {
      cloudlet.mesh.material.transparent = true;
      cloudlet.mesh.material.opacity = 1;
      this.ascendTween = gsap.to(cloudlet.group.position, {
        y: '+=4.0',
        z: '-=2.0',
        duration: 1.5,
        ease: 'power2.inOut',
      });
      this.ascendFadeTween = gsap.to(cloudlet.mesh.material, {
        opacity: 0,
        duration: 1.2,
        delay: 0.3,
        ease: 'power1.out',
        onComplete: () => {
          cloudlet.group.visible = false;
        },
      });
    }
  }

  public startFlight(): void {
    if (this.introState !== 'IDLE') return;
    this.killAllTweens();

    const controls = this.cfg.getControls();
    if (controls) {
      controls.enabled = false;
    }

    const cloudlet = this.cfg.getCloudlet();
    if (cloudlet) {
      cloudlet.group.visible = true;
      cloudlet.mesh.scale.set(1, 1, 1);
      cloudlet.mesh.material.transparent = false;
      cloudlet.mesh.material.opacity = 1;
    }

    this.flightProgress.current = 0;
    this.flightProgress.target = 0;
    this.setState('FLYING');
    this.cfg.onSheepIntroPose?.(true);
    this.attachScrollListeners();

    // 1.0s soft fade-out of the 3D linen curtain revealing the mist-draped meadow
    this.curtainTween = gsap.to(this.linenCurtainMesh.material, {
      opacity: 0,
      duration: 1.0,
      ease: 'power1.out',
      onComplete: () => {
        this.linenCurtainMesh.visible = false;
      },
    });

    this.applyFlightFrame(0);
  }

  public skipFlight(): void {
    if (this.introState === 'EXPLORING') return;
    this.killAllTweens();

    this.linenCurtainMesh.visible = false;
    this.linenCurtainMesh.material.opacity = 0;

    const cloudlet = this.cfg.getCloudlet();
    if (cloudlet) {
      cloudlet.group.visible = false;
    }

    this.cfg.onSheepIntroPose?.(false);
    this.setState('EXPLORING');
    this.handoverOrbitControls();
    this.cfg.onFlightComplete?.();
  }

  public forceExploring(): void {
    this.killAllTweens();
    this.linenCurtainMesh.visible = false;
    const cloudlet = this.cfg.getCloudlet();
    if (cloudlet) {
      cloudlet.group.visible = false;
    }
    this.setState('EXPLORING');
    this.setPhase1Stage('ready');
  }

  public update(elapsedTime: number): void {
    const cloudlet = this.cfg.getCloudlet();
    cloudlet?.update(elapsedTime, true);

    if (this.introState === 'IDLE' || (this.introState === 'FLYING' && this.linenCurtainMesh.visible)) {
      this.positionCurtainBehindCloudlet();
    }

    if (this.introState === 'FLYING') {
      this.flightProgress.current +=
        (this.flightProgress.target - this.flightProgress.current) * SCROLL_LERP_FACTOR;
      this.applyFlightFrame(this.flightProgress.current);

      if (this.flightProgress.current >= 0.99) {
        this.beginAscensionAndHandover();
      }
    }
  }

  public dispose(): void {
    this.killAllTweens();
    this.linenCurtainMesh.geometry.dispose();
    this.linenCurtainMesh.material.dispose();
    this.cfg.scene.remove(this.linenCurtainMesh);
  }
}
