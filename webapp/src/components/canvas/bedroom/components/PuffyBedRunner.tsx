import React from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// JSX intrinsic element declarations for Three.js elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      meshPhysicalMaterial: any;
      meshStandardMaterial: any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        group: any;
        mesh: any;
        meshPhysicalMaterial: any;
        meshStandardMaterial: any;
      }
    }
  }
}

/**
 * Bulletproof Environment Bed Runner Color & Material Palettes
 * Maps both short and full environment keys ('zen', 'zen-sanctuary', 'mid-century', 'modern', 'modern-sanctuary')
 * to coordinated textile, fringe, and sheen colors.
 */
export const ENVIRONMENT_RUNNER_PALETTES: Record<
  string,
  {
    color: string;
    tasselColor: string;
    sheenColor: string;
    roughness: number;
  }
> = {
  // 1. Zen Courtyard (Matches bleached sand, bamboo & tatami tones)
  zen: {
    color: '#B5AFA2', // Bleached bamboo / pale raw linen
    tasselColor: '#D8D4CA', // Natural unbleached cotton fringe
    sheenColor: '#C8C2B6',
    roughness: 0.94,
  },
  'zen-sanctuary': {
    color: '#B5AFA2',
    tasselColor: '#D8D4CA',
    sheenColor: '#C8C2B6',
    roughness: 0.94,
  },

  // 2. Mid-Century Modern (Matches warm walnut & honey teak)
  'mid-century': {
    color: '#AFA695', // Warm oat cashmere / soft natural hemp
    tasselColor: '#D5CFC3', // Natural ecru fringe
    sheenColor: '#C4BCAE',
    roughness: 0.95,
  },

  // 3. Modern Sanctuary (Matches warm greige plaster & sheer drapes)
  modern: {
    color: '#7C828D', // Muted smoke slate greige
    tasselColor: '#EAE6DF', // Soft white fringe
    sheenColor: '#9CA3AF',
    roughness: 0.92,
  },
  'modern-sanctuary': {
    color: '#7C828D',
    tasselColor: '#EAE6DF',
    sheenColor: '#9CA3AF',
    roughness: 0.92,
  },
};

/**
 * Evaluates the exact draped side-overhang (cx, cy) for a given overhang distance and Z coordinate.
 */
function evaluateDrapeOverhang(
  signX: number,
  over: number,
  z: number,
  halfW: number,
  drapeDrop: number,
  edgeCrownY: number,
  shoulderRadius: number,
  shoulderArcLen: number,
): { cx: number; cy: number; nx: number; ny: number } {
  const hangFactor = THREE.MathUtils.clamp(over / drapeDrop, 0, 1);
  let cx: number;
  let cy: number;
  let nx: number;
  let ny: number;

  if (over <= shoulderArcLen) {
    const angle = (over / shoulderArcLen) * (Math.PI / 2);
    cx = signX * (halfW + Math.sin(angle) * shoulderRadius);
    cy = edgeCrownY - (1 - Math.cos(angle)) * shoulderRadius;
    nx = signX * Math.sin(angle);
    ny = Math.cos(angle);
  } else {
    const rem = over - shoulderArcLen;
    cy = edgeCrownY - shoulderRadius - rem;
    const gravityRipple = Math.sin(cy * 20.0) * 0.005 * hangFactor;
    cx = signX * (halfW + shoulderRadius + rem * 0.02) + signX * gravityRipple;
    nx = signX * 0.998;
    ny = 0.02;
  }

  const pleat =
    (Math.sin(z * 14.0 + signX * 1.1) * 0.0065 +
      Math.cos(z * 23.0 - signX * 0.7) * 0.003) *
    hangFactor;
  const hemWave = Math.sin(z * 9.5 + signX * 0.5) * 0.0035 * hangFactor;

  cx += nx * pleat;
  cy += ny * pleat * 0.25 - hemWave;

  return { cx, cy, nx, ny };
}

/**
 * Generates the draped fabric BufferGeometry hugging the mattress crown
 * and draping down both left and right sides.
 */
export function createRunnerDrapedGeometry(
  mattressW = 2.10,
  drapeDrop = 0.22,
  runnerDepth = 0.6,
): THREE.BufferGeometry {
  const halfW = mattressW / 2;
  const halfZ = runnerDepth / 2;
  const totalHalfSpan = halfW + drapeDrop;
  const thickness = 0.012;
  const segsX = 80;
  const segsY = 2;
  const segsZ = 28;

  const geo = new THREE.BoxGeometry(
    totalHalfSpan * 2,
    thickness,
    runnerDepth,
    segsX,
    segsY,
    segsZ,
  );
  const pos = geo.attributes.position;

  const shoulderRadius = 0.04;
  const shoulderArcLen = (Math.PI / 2) * shoulderRadius;
  const crownCenterOffset = 0.002;
  const crownDrop = 0.015;
  const edgeCrownY = crownCenterOffset - crownDrop;
  const cornerRadius = 0.07;

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);
    const rawZ = pos.getZ(i);

    const signX = rawX >= 0 ? 1 : -1;
    const signZ = rawZ >= 0 ? 1 : -1;

    const innerX = totalHalfSpan - cornerRadius;
    const innerZ = halfZ - cornerRadius;
    const dxCorner = Math.max(0, Math.abs(rawX) - innerX);
    const dzCorner = Math.max(0, Math.abs(rawZ) - innerZ);

    let x = rawX;
    let z = rawZ;
    if (dxCorner > 0 && dzCorner > 0) {
      const dist = Math.hypot(dxCorner, dzCorner);
      if (dist > cornerRadius) {
        const scale = cornerRadius / dist;
        x = signX * (innerX + dxCorner * scale);
        z = signZ * (innerZ + dzCorner * scale);
      }
    }

    const edgeFactorX = THREE.MathUtils.clamp(
      (Math.abs(x) - (totalHalfSpan - 0.025)) / 0.025,
      0,
      1,
    );
    const edgeFactorZ = THREE.MathUtils.clamp((Math.abs(z) - (halfZ - 0.025)) / 0.025, 0, 1);
    const hemTaper = 1.0 - 0.65 * Math.max(edgeFactorX, edgeFactorZ);
    const localThicknessOffset = (rawY + thickness / 2) * hemTaper;

    const absX = Math.abs(x);
    let cx: number;
    let cy: number;
    let nx: number;
    let ny: number;

    if (absX <= halfW) {
      const mattressCrownY = crownCenterOffset - Math.pow(x / halfW, 2) * crownDrop;
      const topRipple =
        (Math.sin(z * 11.0 + x * 2.2) * 0.0012 +
          Math.cos(z * 19.0 - x * 3.4) * 0.0006 +
          0.0018) *
        THREE.MathUtils.clamp(1 - Math.abs(x) / halfW, 0.15, 1);

      cx = x;
      cy = mattressCrownY + topRipple;
      const slope = -(2 * crownDrop * x) / (halfW * halfW);
      const len = Math.hypot(-slope, 1);
      nx = -slope / len;
      ny = 1 / len;
    } else {
      const over = absX - halfW;
      ({ cx, cy, nx, ny } = evaluateDrapeOverhang(
        signX,
        over,
        z,
        halfW,
        drapeDrop,
        edgeCrownY,
        shoulderRadius,
        shoulderArcLen,
      ));
    }

    pos.setXYZ(i, cx + nx * localThicknessOffset, cy + ny * localThicknessOffset, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a single knotted twisted-yarn tassel cluster (total length 0.08m) hanging along -Y.
 */
function createKnottedTasselGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const knot = new THREE.SphereGeometry(0.0068, 8, 6);
  knot.scale(1.0, 0.85, 1.0);
  knot.translate(0, -0.005, 0);
  parts.push(knot);

  const strandLen = 0.072;
  for (let s = 0; s < 3; s++) {
    const angle = (s / 3) * Math.PI * 2;
    const strand = new THREE.CylinderGeometry(0.0024, 0.0016, strandLen, 6, 1);
    strand.translate(0, -0.008 - strandLen / 2, 0);
    strand.rotateZ(Math.cos(angle) * 0.055);
    strand.rotateX(Math.sin(angle) * 0.055);
    strand.translate(Math.cos(angle) * 0.0022, 0, Math.sin(angle) * 0.0022);
    parts.push(strand);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  return merged ?? new THREE.CylinderGeometry(0.004, 0.002, 0.08, 6);
}

/**
 * Generates the combined knotted yarn tassel fringe BufferGeometry.
 * Formatted to be placed at position [0, -drapeDrop, 0].
 */
export function createTasselFringeGeometry(
  mattressW = 2.10,
  drapeDrop = 0.22,
  runnerDepth = 0.6,
): THREE.BufferGeometry {
  const baseTasselGeo = createKnottedTasselGeometry();
  const halfW = mattressW / 2;
  const crownCenterOffset = 0.002;
  const crownDrop = 0.015;
  const edgeCrownY = crownCenterOffset - crownDrop;
  const shoulderRadius = 0.04;
  const shoulderArcLen = (Math.PI / 2) * shoulderRadius;

  const tasselsPerSide = 28;
  const zInset = 0.025;
  const zSpan = Math.max(0.1, runnerDepth - zInset * 2);

  const instances: THREE.BufferGeometry[] = [];

  for (const signX of [-1, 1]) {
    for (let t = 0; t < tasselsPerSide; t++) {
      const ratio = tasselsPerSide > 1 ? t / (tasselsPerSide - 1) : 0.5;
      const z = -zSpan / 2 + ratio * zSpan;
      const hem = evaluateDrapeOverhang(
        signX,
        drapeDrop,
        z,
        halfW,
        drapeDrop,
        edgeCrownY,
        shoulderRadius,
        shoulderArcLen,
      );

      const clone = baseTasselGeo.clone();
      const s = 0.94 + ((t * 7) % 5) * 0.03;
      clone.scale(s, 1.0, s);
      clone.rotateZ(Math.cos(t * 1.9 - signX) * 0.04);
      clone.rotateY(t * 0.7 + signX);
      clone.rotateX(Math.sin(t * 2.3 + signX) * 0.04);
      // Offset by +drapeDrop because the tassel mesh is placed at [0, -drapeDrop, 0]
      clone.translate(hem.cx, hem.cy + drapeDrop, z);
      instances.push(clone);
    }
  }

  const merged = mergeGeometries(instances, false);
  baseTasselGeo.dispose();
  for (const inst of instances) {
    inst.dispose();
  }
  return merged ?? new THREE.BufferGeometry();
}

// Pre-generated geometries for immediate reuse
export const runnerDrapedGeometry: THREE.BufferGeometry = createRunnerDrapedGeometry();
export const tasselFringeGeometry: THREE.BufferGeometry = createTasselFringeGeometry();

export interface PuffyBedRunnerProps {
  environmentKey?: string;
  position?: [number, number, number];
}

/**
 * PuffyBedRunner Component
 * Ensures fallback resolution so the runner is ALWAYS rendered and never disappears.
 */
export const PuffyBedRunner: React.FC<PuffyBedRunnerProps> = ({
  environmentKey = 'zen',
  position = [0, 0, 0.45],
}) => {
  // Guaranteed fallback ensures mesh never breaks or disappears:
  const palette =
    ENVIRONMENT_RUNNER_PALETTES[environmentKey] || ENVIRONMENT_RUNNER_PALETTES['zen'];

  return (
    <group name="PuffyBedRunner" position={position} visible={true}>
      <mesh geometry={runnerDrapedGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={palette.color}
          roughness={palette.roughness}
          metalness={0.0}
          sheen={0.8}
          sheenColor={palette.sheenColor}
          sheenRoughness={0.5}
        />
      </mesh>

      <mesh geometry={tasselFringeGeometry} position={[0, -0.22, 0]}>
        <meshStandardMaterial
          color={palette.tasselColor}
          roughness={0.95}
        />
      </mesh>
    </group>
  );
};

/**
 * Three.js Imperative Factory for scenes not using React Three Fiber JSX.
 */
export function createPuffyBedRunnerGroup(
  environmentKey = 'zen',
  position: [number, number, number] = [0, 0, 0.45],
): THREE.Group {
  const palette =
    ENVIRONMENT_RUNNER_PALETTES[environmentKey] || ENVIRONMENT_RUNNER_PALETTES['zen'];

  const group = new THREE.Group();
  group.name = 'PuffyBedRunner';
  group.position.set(...position);
  group.visible = true;

  const runnerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.color),
    roughness: palette.roughness,
    metalness: 0.0,
    sheen: 0.8,
    sheenColor: new THREE.Color(palette.sheenColor),
    sheenRoughness: 0.5,
  });
  const runnerMesh = new THREE.Mesh(runnerDrapedGeometry, runnerMat);
  runnerMesh.castShadow = true;
  runnerMesh.receiveShadow = true;
  group.add(runnerMesh);

  const tasselMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.tasselColor),
    roughness: 0.95,
  });
  const tasselMesh = new THREE.Mesh(tasselFringeGeometry, tasselMat);
  tasselMesh.position.set(0, -0.22, 0);
  tasselMesh.castShadow = true;
  tasselMesh.receiveShadow = true;
  group.add(tasselMesh);

  return group;
}

export default PuffyBedRunner;
