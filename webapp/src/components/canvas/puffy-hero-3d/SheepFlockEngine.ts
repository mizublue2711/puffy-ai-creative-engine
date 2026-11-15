import * as THREE from 'three';
import {getMeadowHeightAt} from './MeadowTerrain.ts';

interface SheepAgent {
  root: THREE.Group;
  headGroup: THREE.Group;
  ears: [THREE.Mesh, THREE.Mesh];
  legs: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
  headTargetQuaternion: THREE.Quaternion;
  wanderHeading: number;
  state: 'wandering' | 'grazing' | 'evading';
  stateTimer: number;
  walkCycle: number;
  scale: number;
}

const _upAxis = new THREE.Vector3(0, 1, 0);
const _rightAxis = new THREE.Vector3(1, 0, 0);
const _desiredDir = new THREE.Vector3();
const _steerForce = new THREE.Vector3();
const _mouseRepel = new THREE.Vector3();

export class SheepFlockEngine {
  public readonly group: THREE.Group;
  private agents: SheepAgent[] = [];
  private disposables: Array<{dispose(): void}> = [];

  constructor(count = 8) {
    this.group = new THREE.Group();
    this.group.name = 'SheepFlockEngine';

    // 1. Claymation Palette & PBR Materials (Benchmark: Shaun-the-Sheep Clay Style)
    const clayCharcoalMat = new THREE.MeshStandardMaterial({
      color: 0x242426,
      roughness: 0.8,
      metalness: 0.04,
    });
    const nostrilMat = new THREE.MeshStandardMaterial({
      color: 0x111113,
      roughness: 0.9,
      metalness: 0.0,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.02,
    });
    const eyePupilMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      roughness: 0.12,
      metalness: 0.08,
    });
    const woolCreamMat = new THREE.MeshStandardMaterial({
      color: 0xf5efeb,
      roughness: 0.92,
      metalness: 0.0,
    });
    const woolWarmAccentMat = new THREE.MeshStandardMaterial({
      color: 0xede5de,
      roughness: 0.94,
      metalness: 0.0,
    });

    // 2. Shared Smooth Clay Geometries (ZERO BoxGeometry)
    const bodyCoreGeo = new THREE.SphereGeometry(0.23, 20, 18);
    const bodyBubbleGeo = new THREE.SphereGeometry(0.115, 16, 14);
    const topknotBubbleGeo = new THREE.SphereGeometry(0.046, 14, 12);

    // Head: Pear/Egg shape using SphereGeometry with scale.set(0.7, 1.1, 0.8)
    const headSphereGeo = new THREE.SphereGeometry(0.115, 24, 20);
    const snoutJawGeo = new THREE.SphereGeometry(0.072, 20, 16);
    const nostrilGeo = new THREE.SphereGeometry(0.011, 10, 10);

    // Eyes: 2 large round eyes close together on forehead
    const scleraGeo = new THREE.SphereGeometry(0.025, 18, 16);
    const pupilGeo = new THREE.SphereGeometry(0.0135, 14, 14);
    const catchlightGeo = new THREE.SphereGeometry(0.0045, 8, 8);

    // Ears: Flattened Capsule drooping at 35-40 deg from temples
    const earCapsuleGeo = new THREE.CapsuleGeometry(0.023, 0.082, 8, 14);
    earCapsuleGeo.translate(0, -0.045, 0); // Pivot at temple root

    // Legs: Slender flared claymation legs + cloven hoof bell at base
    const legShaftGeo = new THREE.CylinderGeometry(0.017, 0.028, 0.23, 14);
    legShaftGeo.translate(0, -0.115, 0);
    const hoofBellGeo = new THREE.SphereGeometry(0.031, 14, 12);
    hoofBellGeo.scale(1.0, 0.65, 1.15);
    hoofBellGeo.translate(0, -0.225, 0.005);

    this.disposables.push(
      clayCharcoalMat,
      nostrilMat,
      eyeWhiteMat,
      eyePupilMat,
      woolCreamMat,
      woolWarmAccentMat,
      bodyCoreGeo,
      bodyBubbleGeo,
      topknotBubbleGeo,
      headSphereGeo,
      snoutJawGeo,
      nostrilGeo,
      scleraGeo,
      pupilGeo,
      catchlightGeo,
      earCapsuleGeo,
      legShaftGeo,
      hoofBellGeo,
    );

    // Pillowy Wool Sphere offsets around the core torso (18 overlapping spheres)
    const bodyPuffOffsets: Array<[number, number, number, number]> = [
      [0, 0.08, 0.14, 1.08],
      [0, 0.09, -0.14, 1.05],
      [-0.14, 0.05, 0.08, 1.02],
      [0.14, 0.05, 0.08, 1.02],
      [-0.15, 0.04, -0.08, 1.0],
      [0.15, 0.04, -0.08, 1.0],
      [-0.09, 0.13, 0.02, 0.96],
      [0.09, 0.13, 0.02, 0.96],
      [0, 0.15, -0.04, 1.04],
      [-0.17, -0.04, 0.0, 0.95],
      [0.17, -0.04, 0.0, 0.95],
      [-0.11, -0.06, 0.13, 0.9],
      [0.11, -0.06, 0.13, 0.9],
      [-0.11, -0.06, -0.13, 0.9],
      [0.11, -0.06, -0.13, 0.9],
      [0, -0.05, 0.19, 0.94],
      [0, -0.04, -0.21, 0.88],
      [0, 0.02, -0.26, 0.65], // Fluffy wool tail puff
    ];

    // 6-sphere Wool Topknot beret on the head crown
    const headTopknotOffsets: Array<[number, number, number, number]> = [
      [0, 0.115, -0.01, 1.18],
      [-0.038, 0.105, 0.01, 1.02],
      [0.038, 0.105, 0.01, 1.02],
      [-0.026, 0.11, -0.042, 0.96],
      [0.026, 0.11, -0.042, 0.96],
      [0, 0.125, 0.028, 0.94],
    ];

    const initialSpots = [
      {x: -2.35, z: 1.75},
      {x: -1.9, z: -1.85},
      {x: 2.3, z: 1.55},
      {x: 2.65, z: -1.45},
      {x: -0.45, z: 2.45},
      {x: 1.15, z: -2.45},
      {x: -2.85, z: -0.2},
      {x: 1.75, z: 2.35},
    ];

    for (let i = 0; i < count; i++) {
      const spot = initialSpots[i % initialSpots.length];
      const sheepScale = 0.94 + (i % 3) * 0.09;

      const root = new THREE.Group();
      root.scale.setScalar(sheepScale);

      // Pillowy Wool Torso Group
      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.35, 0);

      const coreSphere = new THREE.Mesh(bodyCoreGeo, woolCreamMat);
      coreSphere.scale.set(1.06, 0.96, 1.24);
      coreSphere.castShadow = true;
      coreSphere.receiveShadow = true;
      torsoGroup.add(coreSphere);

      for (let p = 0; p < bodyPuffOffsets.length; p++) {
        const [px, py, pz, ps] = bodyPuffOffsets[p];
        const puffMat = (p + i) % 3 === 0 ? woolWarmAccentMat : woolCreamMat;
        const puff = new THREE.Mesh(bodyBubbleGeo, puffMat);
        puff.position.set(px, py, pz);
        puff.scale.setScalar(ps);
        puff.castShadow = true;
        puff.receiveShadow = true;
        torsoGroup.add(puff);
      }
      root.add(torsoGroup);

      // Claymation Shaun-Style Head Group
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.42, 0.27);

      // Main Pear/Egg Head: SphereGeometry scaled (0.7, 1.1, 0.8)
      const headMain = new THREE.Mesh(headSphereGeo, clayCharcoalMat);
      headMain.scale.set(0.7, 1.1, 0.8);
      headMain.rotation.x = -0.32;
      headMain.position.set(0, -0.01, 0.04);
      headMain.castShadow = true;
      headGroup.add(headMain);

      // Rounded lower snout fullness for authentic pear silhouette
      const snoutBulb = new THREE.Mesh(snoutJawGeo, clayCharcoalMat);
      snoutBulb.scale.set(0.88, 0.78, 0.92);
      snoutBulb.position.set(0, -0.068, 0.082);
      snoutBulb.castShadow = true;
      headGroup.add(snoutBulb);

      // Two indented nostrils on the rounded snout
      const leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
      leftNostril.position.set(-0.024, -0.072, 0.142);
      const rightNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
      rightNostril.position.set(0.024, -0.072, 0.142);
      headGroup.add(leftNostril, rightNostril);

      // 2 Big Close-Set Eyes on Forehead (White sclera + Black pupils + Catchlight)
      const leftEyeSclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
      leftEyeSclera.scale.set(0.95, 1.08, 0.62);
      leftEyeSclera.position.set(-0.023, 0.032, 0.105);

      const rightEyeSclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
      rightEyeSclera.scale.set(0.95, 1.08, 0.62);
      rightEyeSclera.position.set(0.023, 0.032, 0.105);

      const leftPupil = new THREE.Mesh(pupilGeo, eyePupilMat);
      leftPupil.scale.set(1.0, 1.05, 0.65);
      leftPupil.position.set(-0.021, 0.032, 0.12);

      const rightPupil = new THREE.Mesh(pupilGeo, eyePupilMat);
      rightPupil.scale.set(1.0, 1.05, 0.65);
      rightPupil.position.set(0.021, 0.032, 0.12);

      const leftCatch = new THREE.Mesh(catchlightGeo, eyeWhiteMat);
      leftCatch.position.set(-0.017, 0.038, 0.128);
      const rightCatch = new THREE.Mesh(catchlightGeo, eyeWhiteMat);
      rightCatch.position.set(0.025, 0.038, 0.128);

      headGroup.add(
        leftEyeSclera,
        rightEyeSclera,
        leftPupil,
        rightPupil,
        leftCatch,
        rightCatch,
      );

      // 2 Drooping Capsule Ears at 38° angle from temples
      const earDroopRad = THREE.MathUtils.degToRad(38);
      const leftEar = new THREE.Mesh(earCapsuleGeo, clayCharcoalMat);
      leftEar.scale.set(0.85, 1.0, 0.52);
      leftEar.position.set(-0.068, 0.042, 0.025);
      leftEar.rotation.z = -(Math.PI / 2 - earDroopRad);
      leftEar.rotation.y = 0.18;
      leftEar.castShadow = true;

      const rightEar = new THREE.Mesh(earCapsuleGeo, clayCharcoalMat);
      rightEar.scale.set(0.85, 1.0, 0.52);
      rightEar.position.set(0.068, 0.042, 0.025);
      rightEar.rotation.z = Math.PI / 2 - earDroopRad;
      rightEar.rotation.y = -0.18;
      rightEar.castShadow = true;

      headGroup.add(leftEar, rightEar);

      // Cluster of 6 Mini Cream Wool Spheres on Crown of Head (Wool Hat)
      for (let t = 0; t < headTopknotOffsets.length; t++) {
        const [tx, ty, tz, ts] = headTopknotOffsets[t];
        const knotSphere = new THREE.Mesh(topknotBubbleGeo, woolCreamMat);
        knotSphere.position.set(tx, ty, tz);
        knotSphere.scale.setScalar(ts);
        knotSphere.castShadow = true;
        headGroup.add(knotSphere);
      }

      root.add(headGroup);

      // 4 Slender Claymation Legs with Cloven Hoof Bells
      const createClayLeg = (lx: number, lz: number): THREE.Group => {
        const legGroup = new THREE.Group();
        legGroup.position.set(lx, 0.23, lz);
        const shaft = new THREE.Mesh(legShaftGeo, clayCharcoalMat);
        shaft.castShadow = true;
        const hoof = new THREE.Mesh(hoofBellGeo, clayCharcoalMat);
        hoof.castShadow = true;
        legGroup.add(shaft, hoof);
        return legGroup;
      };

      const legFL = createClayLeg(-0.075, 0.12);
      const legFR = createClayLeg(0.075, 0.12);
      const legBL = createClayLeg(-0.075, -0.12);
      const legBR = createClayLeg(0.075, -0.12);
      root.add(legFL, legFR, legBL, legBR);

      const groundY = getMeadowHeightAt(spot.x, spot.z);
      root.position.set(spot.x, groundY, spot.z);

      const initialHeading = (i * 1.57) % (Math.PI * 2);
      const initQuat = new THREE.Quaternion().setFromAxisAngle(_upAxis, initialHeading);
      root.quaternion.copy(initQuat);

      this.group.add(root);
      this.agents.push({
        root,
        headGroup,
        ears: [leftEar, rightEar],
        legs: [legFL, legFR, legBL, legBR],
        position: new THREE.Vector3(spot.x, groundY, spot.z),
        velocity: new THREE.Vector3(
          Math.sin(initialHeading) * 0.18,
          0,
          Math.cos(initialHeading) * 0.18,
        ),
        targetQuaternion: initQuat.clone(),
        headTargetQuaternion: new THREE.Quaternion(),
        wanderHeading: initialHeading,
        state: i % 2 === 0 ? 'grazing' : 'wandering',
        stateTimer: 2.2 + (i % 4) * 1.3,
        walkCycle: i * 1.4,
        scale: sheepScale,
      });
    }
  }

  public getActiveCount(): number {
    return this.agents.length;
  }

  public update(
    elapsedTime: number,
    deltaTime: number,
    mattressElevation: number,
    mattressCompressed: boolean,
    hoverWorldPoint: THREE.Vector3 | null = null,
  ): void {
    const dt = Math.min(deltaTime, 0.05);
    const padShadowRadius = mattressCompressed || mattressElevation < 0.42 ? 2.15 : 1.55;

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      agent.stateTimer -= dt;

      const distFromPadCenter = Math.hypot(agent.position.x, agent.position.z);

      // 1. Mouse Raycaster Hover Avoidance using THREE.MathUtils.smoothstep(distance, 1.0, 4.0)
      _mouseRepel.set(0, 0, 0);
      let mouseInfluence = 0;
      if (hoverWorldPoint) {
        const mdx = agent.position.x - hoverWorldPoint.x;
        const mdz = agent.position.z - hoverWorldPoint.z;
        const distToMouse = Math.hypot(mdx, mdz);
        // smoothstep(distance, 1.0, 4.0) -> 0 at <=1m, 1 at >=4m; invert for soft repulsion
        mouseInfluence = 1.0 - THREE.MathUtils.smoothstep(distToMouse, 1.0, 4.0);
        if (mouseInfluence > 0.01 && distToMouse > 0.001) {
          _mouseRepel.set(mdx / distToMouse, 0, mdz / distToMouse).multiplyScalar(mouseInfluence * 1.35);
          if (mouseInfluence > 0.18) {
            agent.state = 'evading';
            agent.stateTimer = Math.max(agent.stateTimer, 0.9);
          }
        }
      }

      // 2. Mattress Shadow Zone Avoidance & Natural Grazing State Machine
      if (distFromPadCenter < padShadowRadius) {
        agent.state = 'evading';
        agent.wanderHeading = Math.atan2(agent.position.x, agent.position.z);
        agent.stateTimer = 1.5;
      } else if (agent.stateTimer <= 0) {
        if (agent.state === 'wandering' || agent.state === 'evading') {
          agent.state = 'grazing';
          agent.stateTimer = 2.8 + ((i * 1.3) % 2.5);
        } else {
          agent.state = 'wandering';
          agent.stateTimer = 3.5 + ((i * 0.9) % 2.8);
          agent.wanderHeading += Math.sin(elapsedTime * 0.7 + i * 2.1) * 1.1;
        }
      }

      // Soft curved-horizon meadow containment (radius 1.6m .. 5.8m)
      if (distFromPadCenter > 5.6) {
        const inwardAngle = Math.atan2(-agent.position.x, -agent.position.z) + 0.3;
        agent.wanderHeading = inwardAngle;
        agent.state = 'wandering';
      }

      // 3. Boids Separation from neighbor sheep
      _steerForce.set(0, 0, 0);
      for (let j = 0; j < this.agents.length; j++) {
        if (i === j) continue;
        const other = this.agents[j];
        const dx = agent.position.x - other.position.x;
        const dz = agent.position.z - other.position.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.001 && dSq < 0.95) {
          const invD = 1 / Math.sqrt(dSq);
          _steerForce.x += dx * invD * 0.45;
          _steerForce.z += dz * invD * 0.45;
        }
      }

      if (agent.state === 'wandering' || agent.state === 'evading' || mouseInfluence > 0.05) {
        const baseSpeed = agent.state === 'evading' ? 0.56 : 0.3;
        const speed = baseSpeed + mouseInfluence * 0.42;

        _desiredDir.set(Math.sin(agent.wanderHeading), 0, Math.cos(agent.wanderHeading));
        _desiredDir.add(_steerForce).add(_mouseRepel);
        if (_desiredDir.lengthSq() > 0.0001) {
          _desiredDir.normalize();
        }

        agent.velocity.x = THREE.MathUtils.damp(agent.velocity.x, _desiredDir.x * speed, 3.8, dt);
        agent.velocity.z = THREE.MathUtils.damp(agent.velocity.z, _desiredDir.z * speed, 3.8, dt);

        agent.position.x += agent.velocity.x * dt;
        agent.position.z += agent.velocity.z * dt;

        if (agent.velocity.lengthSq() > 0.0004) {
          const moveHeading = Math.atan2(agent.velocity.x, agent.velocity.z);
          agent.wanderHeading = moveHeading;
          agent.targetQuaternion.setFromAxisAngle(_upAxis, moveHeading);
        }

        // Smooth Quaternion Slerp (Factor 0.06 per requirement — zero abrupt snapping)
        agent.root.quaternion.slerp(agent.targetQuaternion, 0.06);

        // Animate walking legs & gentle ear bounce
        agent.walkCycle += dt * (agent.state === 'evading' ? 9.5 : 6.0);
        const swing = Math.sin(agent.walkCycle) * 0.38;
        agent.legs[0].rotation.x = swing;
        agent.legs[1].rotation.x = -swing;
        agent.legs[2].rotation.x = -swing;
        agent.legs[3].rotation.x = swing;

        const earBounce = Math.abs(Math.sin(agent.walkCycle)) * 0.08;
        const baseDroop = Math.PI / 2 - THREE.MathUtils.degToRad(38);
        agent.ears[0].rotation.z = -(baseDroop - earBounce);
        agent.ears[1].rotation.z = baseDroop - earBounce;

        // Smooth head pitch while walking via Quaternion slerp
        const headPitch = 0.04 + Math.sin(agent.walkCycle * 2) * 0.04;
        agent.headTargetQuaternion.setFromAxisAngle(_rightAxis, headPitch);
        agent.headGroup.quaternion.slerp(agent.headTargetQuaternion, 0.08);

        const groundY = getMeadowHeightAt(agent.position.x, agent.position.z);
        const hopBob = Math.abs(Math.sin(agent.walkCycle)) * 0.02;
        agent.position.y = groundY + hopBob;
      } else {
        // Grazing state: still legs, smooth quaternion slerp for body & nodding head
        agent.velocity.multiplyScalar(0.9);
        agent.root.quaternion.slerp(agent.targetQuaternion, 0.06);

        for (const leg of agent.legs) {
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 5.5, dt);
        }

        const nibblePitch = 0.46 + Math.sin(elapsedTime * 4.8 + i) * 0.07;
        agent.headTargetQuaternion.setFromAxisAngle(_rightAxis, nibblePitch);
        agent.headGroup.quaternion.slerp(agent.headTargetQuaternion, 0.06);

        agent.position.y = getMeadowHeightAt(agent.position.x, agent.position.z);
      }

      agent.root.position.copy(agent.position);
    }
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.agents = [];
  }
}
