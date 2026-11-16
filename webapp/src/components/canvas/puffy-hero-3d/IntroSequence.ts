import * as THREE from 'three';
import gsap from 'gsap';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {HeroCloudletGuide} from './HeroCloudletGuide.ts';

export type IntroState = 'IDLE' | 'FLYING' | 'EXPLORING';
export type IntroPhase1Stage = 'void' | '2d' | '3d-morph' | 'ready';

// 5-Point Curving Spline
export const FLIGHT_SPLINE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 3.8, 14.0),    // High initial altitude
  new THREE.Vector3(2.2, 1.6, 9.5),   // Gentle descent bank to the right
  new THREE.Vector3(-1.4, 0.65, 5.8), // Low-grazing skim right past the sheep flock!
  new THREE.Vector3(1.6, 1.4, -0.6),  // Sweeping arc behind the mattress
  new THREE.Vector3(0, 1.5, 2.6),     // Emerging smoothly in front of mattress
]);

export const FINAL_HERO_CAMERA_POS = new THREE.Vector3(0, 1.5, 3.2);
export const FINAL_HERO_LOOKAT = new THREE.Vector3(0, 0.65, 0);

const CHASE_DAMPING = 0.08;

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

  private readonly flightProgress = {t: 0};
  private readonly desiredChaseCamPos = new THREE.Vector3();
  private readonly desiredChaseLookAt = new THREE.Vector3();
  private readonly smoothedChaseLookAt = new THREE.Vector3();
  private readonly scratchCloudPos = new THREE.Vector3();
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

  private killAllTweens(): void {
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

    const startCloudPos = FLIGHT_SPLINE.getPoint(0);
    // Center the cloudlet dead-center in the viewport during IDLE
    const idleCamPos = new THREE.Vector3(
      startCloudPos.x,
      startCloudPos.y,
      startCloudPos.z + 1.45,
    );

    const {camera} = this.cfg;
    camera.position.copy(idleCamPos);
    camera.lookAt(startCloudPos);
    this.desiredChaseCamPos.copy(idleCamPos);
    this.desiredChaseLookAt.copy(startCloudPos);
    this.smoothedChaseLookAt.copy(startCloudPos);
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

  private applyFlightFrame(t: number, snapCamera = false): void {
    const clampedT = THREE.MathUtils.clamp(t, 0, 1);
    const {camera} = this.cfg;
    const cloudlet = this.cfg.getCloudlet();
    const mattressTopY = this.cfg.getMattressTopY();
    const touchdownY = mattressTopY + 0.04;

    if (clampedT <= 0.85) {
      const splineU = clampedT / 0.85;
      FLIGHT_SPLINE.getPoint(splineU, this.scratchCloudPos);

      // Safe forward sampling (avoid zero-length delta at spline end)
      if (splineU >= 0.98) {
        const prevPos = FLIGHT_SPLINE.getPoint(Math.max(0.0, splineU - 0.02));
        this.scratchNextPos.copy(this.scratchCloudPos);
        this.scratchForwardDir.subVectors(this.scratchNextPos, prevPos);
      } else {
        FLIGHT_SPLINE.getPoint(Math.min(1.0, splineU + 0.02), this.scratchNextPos);
        this.scratchForwardDir.subVectors(this.scratchNextPos, this.scratchCloudPos);
      }

      if (this.scratchForwardDir.lengthSq() > 1e-6) {
        this.scratchForwardDir.normalize();
      } else {
        this.scratchForwardDir.set(0, 0, -1);
      }

      if (cloudlet) {
        cloudlet.group.position.copy(this.scratchCloudPos);

        // Safe orientation without tangent flip or gimbal lock:
        // Level out banking smoothly as we approach touchdown (t -> 0.85)
        const bankFade = 1 - THREE.MathUtils.smoothstep(clampedT, 0.72, 0.85);
        const horizontalCurve = this.scratchNextPos.x - this.scratchCloudPos.x;
        const clampedRoll = THREE.MathUtils.clamp(-horizontalCurve * 0.4, -0.25, 0.25) * bankFade;

        const targetYaw = Math.atan2(-this.scratchForwardDir.x, -this.scratchForwardDir.z) * 0.45 * bankFade;
        const targetPitch = Math.asin(THREE.MathUtils.clamp(this.scratchForwardDir.y, -0.6, 0.6)) * 0.5 * bankFade;
        this.scratchEuler.set(targetPitch, targetYaw, clampedRoll, 'YXZ');
        cloudlet.group.quaternion.setFromEuler(this.scratchEuler);
      }

      // Over-The-Shoulder Chase Camera (trailing behind & above the cloudlet)
      this.desiredChaseCamPos.set(
        this.scratchCloudPos.x * 0.85,
        Math.max(0.75, this.scratchCloudPos.y + 0.45),
        this.scratchCloudPos.z + 1.25,
      );
      this.desiredChaseLookAt.set(
        this.scratchCloudPos.x,
        this.scratchCloudPos.y + 0.1,
        this.scratchCloudPos.z - 1.5,
      );
    } else {
      // Touchdown glide onto the top of the mattress quilt (position.y = mattressTopY + 0.04m)
      const settleT = THREE.MathUtils.smoothstep(clampedT, 0.85, 0.98);
      const endSplinePos = FLIGHT_SPLINE.getPoint(1.0);
      this.scratchCloudPos.set(
        THREE.MathUtils.lerp(endSplinePos.x, 0, settleT),
        THREE.MathUtils.lerp(endSplinePos.y, touchdownY, settleT),
        THREE.MathUtils.lerp(endSplinePos.z, 0, settleT),
      );

      if (cloudlet) {
        cloudlet.group.position.copy(this.scratchCloudPos);
        cloudlet.group.rotation.set(0, 0, 0);
      }

      // Ease camera smoothly to (0, 1.5, 3.2) looking at the mattress
      const prevCamX = endSplinePos.x * 0.85;
      const prevCamY = endSplinePos.y + 0.45;
      const prevCamZ = endSplinePos.z + 1.25;
      this.desiredChaseCamPos.set(
        THREE.MathUtils.lerp(prevCamX, FINAL_HERO_CAMERA_POS.x, settleT),
        THREE.MathUtils.lerp(prevCamY, FINAL_HERO_CAMERA_POS.y, settleT),
        THREE.MathUtils.lerp(prevCamZ, FINAL_HERO_CAMERA_POS.z, settleT),
      );

      const mattressTarget = this.cfg.getMattressGroup()?.position ?? FINAL_HERO_LOOKAT;
      this.desiredChaseLookAt.set(
        THREE.MathUtils.lerp(endSplinePos.x, mattressTarget.x, settleT),
        THREE.MathUtils.lerp(endSplinePos.y + 0.1, mattressTarget.y, settleT),
        THREE.MathUtils.lerp(endSplinePos.z - 1.5, mattressTarget.z, settleT),
      );
    }

    if (snapCamera) {
      camera.position.copy(this.desiredChaseCamPos);
      this.smoothedChaseLookAt.copy(this.desiredChaseLookAt);
      camera.lookAt(this.smoothedChaseLookAt);
      this.cfg.onCameraPositionChange?.(camera.position.clone());
    }
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
      controls.enableDamping = !this.cfg.isSoftwareGl;
      controls.dampingFactor = 0.05;
      controls.minAzimuthAngle = -Infinity; // Full 360° rotation
      controls.maxAzimuthAngle = Infinity;
      controls.minPolarAngle = Math.PI / 6;
      controls.maxPolarAngle = Math.PI / 2.05;
      controls.minDistance = 2.0;
      controls.maxDistance = 8.5;
      controls.target.copy(targetPos);
      controls.update();
    }
    camera.lookAt(targetPos);
  }

  private beginAscensionAndHandover(): void {
    if (this.introState === 'EXPLORING') return;

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

    this.flightProgress.t = 0;
    this.setState('FLYING');
    this.cfg.onSheepIntroPose?.(true);

    // 1.0s soft fade-out of the 3D linen curtain revealing the mist-draped meadow
    this.curtainTween = gsap.to(this.linenCurtainMesh.material, {
      opacity: 0,
      duration: 1.0,
      ease: 'power1.out',
      onComplete: () => {
        this.linenCurtainMesh.visible = false;
      },
    });

    // 6.5s Gliding Slalom Flight + 1.2s Touchdown Breathing Pause + Ascension & Handover
    this.flightTimeline = gsap.timeline();
    this.flightTimeline.to(this.flightProgress, {
      t: 1,
      duration: 6.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.applyFlightFrame(this.flightProgress.t, false);
      },
    });

    // Pause 1.2s on top of the mattress quilt, breathing softly
    this.flightTimeline.to({}, {duration: 1.2});

    // At t = 1.0 + pause: Ascension & Control Transfer
    this.flightTimeline.add(() => {
      this.beginAscensionAndHandover();
    });
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
      const {camera} = this.cfg;
      camera.position.lerp(this.desiredChaseCamPos, CHASE_DAMPING);
      this.smoothedChaseLookAt.lerp(this.desiredChaseLookAt, CHASE_DAMPING);
      camera.lookAt(this.smoothedChaseLookAt);
      this.cfg.onCameraPositionChange?.(camera.position.clone());
    }
  }

  public dispose(): void {
    this.killAllTweens();
    this.linenCurtainMesh.geometry.dispose();
    this.linenCurtainMesh.material.dispose();
    this.cfg.scene.remove(this.linenCurtainMesh);
  }
}
