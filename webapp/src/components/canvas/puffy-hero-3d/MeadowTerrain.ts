import * as THREE from 'three';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Curved Horizon / Tiny Planet heightfield for the rolling sheep meadow.
 * Combines gentle multi-octave Simplex-like hill undulations with radial planetoid drop-off
 * so the horizon curves gracefully like a miniature pastoral world.
 */
export function getMeadowHeightAt(x: number, z: number): number {
  const distSq = x * x + z * z;
  const dist = Math.sqrt(distSq);

  // Spherical Tiny-Planet horizon curvature
  const planetCurvature = -distSq * 0.0145;

  // Soft pastoral rolling undulations
  const n1 = Math.sin(x * 0.24 + 0.4) * Math.cos(z * 0.24 - 0.3) * 0.28;
  const n2 = Math.sin(x * 0.52 - z * 0.41) * 0.1;
  const n3 = Math.cos((x + z) * 0.75) * 0.04;

  const centerCrown = THREE.MathUtils.smoothstep(dist, 0.4, 4.2);
  return -0.82 + planetCurvature + (n1 + n2 + n3) * (0.25 + 0.75 * centerCrown);
}

export function getMeadowNormalAt(x: number, z: number, outNormal: THREE.Vector3): THREE.Vector3 {
  const eps = 0.08;
  const hL = getMeadowHeightAt(x - eps, z);
  const hR = getMeadowHeightAt(x + eps, z);
  const hD = getMeadowHeightAt(x, z - eps);
  const hU = getMeadowHeightAt(x, z + eps);
  outNormal.set(hL - hR, 2 * eps, hD - hU).normalize();
  return outNormal;
}

interface GrassTuftMeta {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scaleXZ: number;
  scaleY: number;
}

/**
 * Builds a single merged 3-blade curved fan tuft geometry with rounded tips
 * and muted terrain-matched vertex colors (#648A64 -> #759875).
 * Eliminates all sharp apex cones/spikes and keeps contrast subtle.
 */
function createSoftBladeClusterGeometry(): THREE.BufferGeometry {
  const bladeCount = 3;
  const bladeAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  const outwardTilt = THREE.MathUtils.degToRad(24);

  const rootColor = new THREE.Color('#648A64');
  const midColor = new THREE.Color('#6d916d');
  const tipColor = new THREE.Color('#759875');
  const tempColor = new THREE.Color();

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  const bladeMat4 = new THREE.Matrix4();
  const rotYMat = new THREE.Matrix4();
  const tiltXMat = new THREE.Matrix4();
  const normalMat3 = new THREE.Matrix3();
  const vPos = new THREE.Vector3();
  const vNorm = new THREE.Vector3();

  const bladeHeight = 0.32;
  for (let b = 0; b < bladeCount; b++) {
    const geom = new THREE.PlaneGeometry(0.11, bladeHeight, 1, 3);
    // Shift bottom edge to y = 0 so blade grows upward from ground
    geom.translate(0, bladeHeight * 0.5, 0);

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const normY = THREE.MathUtils.clamp(y / bladeHeight, 0, 1);
      // Natural outward arch & soft rounded top (never a needle point)
      const archZ = Math.pow(normY, 1.8) * 0.14;
      const widthTaper = normY > 0.45 ? 1.0 - (normY - 0.45) * 0.68 : 1.0;
      pos.setX(i, pos.getX(i) * widthTaper);
      pos.setZ(i, pos.getZ(i) + archZ);
    }
    geom.computeVertexNormals();

    rotYMat.makeRotationY(bladeAngles[b]);
    tiltXMat.makeRotationX(outwardTilt);
    bladeMat4.copy(rotYMat).multiply(tiltXMat);
    normalMat3.getNormalMatrix(bladeMat4);

    const normAttr = geom.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const rawY = pos.getY(i);
      const normY = THREE.MathUtils.clamp(rawY / bladeHeight, 0, 1);

      vPos.fromBufferAttribute(pos, i).applyMatrix4(bladeMat4);
      vNorm.fromBufferAttribute(normAttr, i).applyMatrix3(normalMat3).normalize();

      positions.push(vPos.x, vPos.y, vPos.z);
      normals.push(vNorm.x, vNorm.y, vNorm.z);

      if (normY < 0.5) {
        tempColor.copy(rootColor).lerp(midColor, normY * 2.0);
      } else {
        tempColor.copy(midColor).lerp(tipColor, (normY - 0.5) * 2.0);
      }
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }

    const indexAttr = geom.getIndex();
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.getX(i) + vertexOffset);
      }
    }
    vertexOffset += pos.count;
    geom.dispose();
  }

  const clusterGeo = new THREE.BufferGeometry();
  clusterGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  clusterGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  clusterGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  clusterGeo.setIndex(indices);
  return clusterGeo;
}

/**
 * Feathers distant terrain and hill ridge edges into the warm dawn mist (#E3DFD5)
 * with smooth radial alpha falloff so no sharp polygon tips cut across the sky.
 */
function applyHorizonMistFeather(
  material: THREE.MeshStandardMaterial,
  colorFadeStart: number,
  colorFadeEnd: number,
  alphaFadeStart: number,
  alphaFadeEnd: number,
): void {
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vMistWorldPos;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vMistWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vMistWorldPos;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float mistDist = length(vMistWorldPos.xz);
         float edgeFade = smoothstep(${colorFadeStart.toFixed(1)}, ${colorFadeEnd.toFixed(1)}, mistDist);
         gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.89, 0.87, 0.83), edgeFade * 0.85);
         float alphaFade = 1.0 - smoothstep(${alphaFadeStart.toFixed(1)}, ${alphaFadeEnd.toFixed(1)}, mistDist);
         gl_FragColor.a *= alphaFade;`,
      );
  };
  material.customProgramCacheKey = () =>
    `horizon-mist-${colorFadeStart}-${colorFadeEnd}-${alphaFadeStart}-${alphaFadeEnd}`;
}

export class MeadowTerrain {
  public readonly group: THREE.Group;
  public readonly terrainMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private grassInstanced: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private mossMoundInstanced: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private grassInstances: GrassTuftMeta[] = [];
  private flowerInstanced: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private skyDomeMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private cloudGroups: THREE.Group[] = [];
  private disposables: Array<{dispose(): void}> = [];

  constructor(_maxAnisotropy = 4) {
    this.group = new THREE.Group();
    this.group.name = 'MeadowTerrainSanctuary';

    // 0. Dual-Color Atmospheric Sky Dome (Zenith #DCEBFA -> Horizon #EAE6DD)
    const skyGeo = new THREE.SphereGeometry(68, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uZenithColor: {value: new THREE.Color('#DCEBFA')},
        uMidSkyColor: {value: new THREE.Color('#E3EFFB')},
        uHorizonColor: {value: new THREE.Color('#EAE6DD')},
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uMidSkyColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp((vWorldPos.y + 4.0) / 38.0, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.38, h));
          col = mix(col, uZenithColor, smoothstep(0.35, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(this.skyDomeMesh);
    this.disposables.push(skyGeo, skyMat);

    // 1. Curved Horizon / Tiny Planet Meadow Geometry with Harmonized Vertex Colors
    const planeGeo = new THREE.PlaneGeometry(52, 52, 112, 112);
    planeGeo.rotateX(-Math.PI / 2);

    const posAttr = planeGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const lowColor = new THREE.Color('#5a805a');
    const midColor = new THREE.Color('#688e68');
    const crestColor = new THREE.Color('#789c78');
    const edgeFogColor = new THREE.Color('#EAE6DD');

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getMeadowHeightAt(vx, vz);
      posAttr.setY(i, vy);

      const heightNorm = THREE.MathUtils.clamp((vy + 2.2) / 1.6, 0, 1);
      _color.copy(lowColor).lerp(midColor, THREE.MathUtils.smoothstep(heightNorm, 0, 0.6));
      _color.lerp(crestColor, THREE.MathUtils.smoothstep(heightNorm, 0.55, 1.0));

      const radialDist = Math.sqrt(vx * vx + vz * vz);
      const horizonBlend = THREE.MathUtils.smoothstep(radialDist, 12.5, 25.0);
      _color.lerp(edgeFogColor, horizonBlend * 0.82);

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planeGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
    });
    applyHorizonMistFeather(terrainMat, 12.0, 24.0, 17.0, 25.0);

    this.terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    this.terrainMesh.name = 'MeadowGroundSurface';
    this.terrainMesh.receiveShadow = true;
    this.group.add(this.terrainMesh);
    this.disposables.push(planeGeo, terrainMat);

    // 1B. Multi-Layered Background Horizon Ridges (Z: -16 and Z: -24) for 3D Parallax & Fog Depth
    this.buildHorizonParallaxRidges();

    // 2. Discreet Micro-Grass Tufts (Pruned by 60%, 3.5m Central Clearance, Roughness 0.95)
    const grassCount = 210;
    const grassGeo = createSoftBladeClusterGeometry();
    const grassMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.grassInstanced = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    this.grassInstanced.receiveShadow = true;

    // Subtle Micro-Moss Bumps (ultra-low profile, blends with #648A64 - #759875 ground)
    const moundCount = 75;
    const moundGeo = new THREE.SphereGeometry(0.11, 10, 8);
    moundGeo.scale(1.0, 0.24, 1.0);
    moundGeo.translate(0, 0.008, 0);
    const moundMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      metalness: 0.0,
    });
    this.mossMoundInstanced = new THREE.InstancedMesh(moundGeo, moundMat, moundCount);
    this.mossMoundInstanced.receiveShadow = true;

    const flowerCount = 45;
    const flowerGeo = new THREE.SphereGeometry(0.024, 8, 8);
    flowerGeo.scale(1.0, 0.55, 1.0);
    flowerGeo.translate(0, 0.018, 0);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.92,
      metalness: 0.0,
    });
    this.flowerInstanced = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);

    let seed = 1337;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const tintPalette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#f6f8f4'),
      new THREE.Color('#eef3ec'),
    ];

    // Enforce strict 3.5m Clearance Zone under the Hero Mattress & Sheep Sanctuary
    const clearanceRadius = 3.5;

    for (let i = 0; i < grassCount; i++) {
      const angle = nextRand() * Math.PI * 2;
      const radius = clearanceRadius + Math.pow(nextRand(), 0.85) * 10.5;
      const gx = Math.cos(angle) * radius;
      const gz = Math.sin(angle) * radius;
      const gy = getMeadowHeightAt(gx, gz);
      const rotY = nextRand() * Math.PI * 2;

      // Tiny ground carpet scale: 0.25 to 0.38 with 0.75 Y flattening (sits well below sheep ankles)
      const baseScale = 0.25 + nextRand() * 0.13;
      const scaleXZ = baseScale;
      const scaleY = baseScale * 0.75;

      this.grassInstances.push({x: gx, y: gy, z: gz, rotY, scaleXZ, scaleY});

      _dummy.position.set(gx, gy, gz);
      _dummy.rotation.set(0, rotY, 0);
      _dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      _dummy.updateMatrix();
      this.grassInstanced.setMatrixAt(i, _dummy.matrix);

      this.grassInstanced.setColorAt(i, tintPalette[i % tintPalette.length]);
    }
    this.grassInstanced.instanceMatrix.needsUpdate = true;
    if (this.grassInstanced.instanceColor) {
      this.grassInstanced.instanceColor.needsUpdate = true;
    }
    this.grassInstanced.computeBoundingSphere();
    this.group.add(this.grassInstanced);
    this.disposables.push(grassGeo, grassMat);

    // Subtle micro-moss bumps (#648A64 to #759875), mostly outside clearance zone
    const moundBaseColor = new THREE.Color('#648A64');
    const moundTipColor = new THREE.Color('#759875');
    for (let i = 0; i < moundCount; i++) {
      const angle = nextRand() * Math.PI * 2;
      const radius = 3.2 + Math.pow(nextRand(), 0.85) * 10.5;
      const mx = Math.cos(angle) * radius;
      const mz = Math.sin(angle) * radius;
      const my = getMeadowHeightAt(mx, mz);

      _dummy.position.set(mx, my, mz);
      _dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
      const baseScale = 0.25 + nextRand() * 0.13;
      _dummy.scale.set(baseScale, baseScale * 0.75, baseScale);
      _dummy.updateMatrix();
      this.mossMoundInstanced.setMatrixAt(i, _dummy.matrix);

      _color.copy(moundBaseColor).lerp(moundTipColor, nextRand());
      this.mossMoundInstanced.setColorAt(i, _color);
    }
    this.mossMoundInstanced.instanceMatrix.needsUpdate = true;
    if (this.mossMoundInstanced.instanceColor) {
      this.mossMoundInstanced.instanceColor.needsUpdate = true;
    }
    this.mossMoundInstanced.computeBoundingSphere();
    this.group.add(this.mossMoundInstanced);
    this.disposables.push(moundGeo, moundMat);

    // Distant tiny wildflowers outside the 3.5m clearance zone
    for (let i = 0; i < flowerCount; i++) {
      const angle = nextRand() * Math.PI * 2;
      const radius = clearanceRadius + 0.3 + nextRand() * 9.0;
      const fx = Math.cos(angle) * radius;
      const fz = Math.sin(angle) * radius;
      const fy = getMeadowHeightAt(fx, fz);

      _dummy.position.set(fx, fy, fz);
      _dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
      const s = 0.45 + nextRand() * 0.25;
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.flowerInstanced.setMatrixAt(i, _dummy.matrix);

      if (i % 3 === 0) {
        _color.set('#e5cb78');
      } else {
        _color.set('#f4f2eb');
      }
      this.flowerInstanced.setColorAt(i, _color);
    }
    this.flowerInstanced.instanceMatrix.needsUpdate = true;
    if (this.flowerInstanced.instanceColor) {
      this.flowerInstanced.instanceColor.needsUpdate = true;
    }
    this.flowerInstanced.computeBoundingSphere();
    this.group.add(this.flowerInstanced);
    this.disposables.push(flowerGeo, flowerMat);

    // 4. Multi-Elevation Cloud Field (6 Puffy Clouds at Y: 6..14, Z: -10..-25, Scale: 0.6..1.4)
    this.buildMultiElevationCloudField();

    // 5. Composite Pastoral Perimeter Props (Wooden Fence + Claymation Meadow Trees)
    this.buildPastoralPerimeter();
  }

  private buildHorizonParallaxRidges(): void {
    // Midground Ridge at Z: -16.5
    const midRidgeGeo = new THREE.PlaneGeometry(58, 16, 64, 18);
    midRidgeGeo.rotateX(-Math.PI / 2);
    const midPos = midRidgeGeo.attributes.position;
    for (let i = 0; i < midPos.count; i++) {
      const x = midPos.getX(i);
      const z = midPos.getZ(i);
      const arch = Math.cos((z / 8) * Math.PI * 0.5);
      const wave =
        Math.sin(x * 0.14 + 0.8) * 1.45 +
        Math.cos(x * 0.28 - 0.5) * 0.65 -
        (x * x) * 0.004;
      midPos.setY(i, -2.6 + Math.max(0, arch) * (2.2 + wave));
    }
    midRidgeGeo.computeVertexNormals();
    const midRidgeMat = new THREE.MeshStandardMaterial({
      color: '#8BA88B',
      roughness: 0.95,
      metalness: 0.0,
      fog: true,
    });
    applyHorizonMistFeather(midRidgeMat, 12.0, 26.0, 14.0, 28.0);
    const midRidgeMesh = new THREE.Mesh(midRidgeGeo, midRidgeMat);
    midRidgeMesh.position.set(-4.5, -0.4, -16.5);
    midRidgeMesh.receiveShadow = true;
    this.group.add(midRidgeMesh);

    // Far Horizon Ridge at Z: -24.5 with paler sage #9CB69C catching the volumetric distance fog
    const farRidgeGeo = new THREE.PlaneGeometry(76, 20, 72, 18);
    farRidgeGeo.rotateX(-Math.PI / 2);
    const farPos = farRidgeGeo.attributes.position;
    for (let i = 0; i < farPos.count; i++) {
      const x = farPos.getX(i);
      const z = farPos.getZ(i);
      const arch = Math.cos((z / 10) * Math.PI * 0.5);
      const wave =
        Math.cos(x * 0.11 - 0.4) * 2.1 +
        Math.sin(x * 0.23 + 1.1) * 0.85 -
        (x * x) * 0.003;
      farPos.setY(i, -3.2 + Math.max(0, arch) * (3.6 + wave));
    }
    farRidgeGeo.computeVertexNormals();
    const farRidgeMat = new THREE.MeshStandardMaterial({
      color: '#9CB69C',
      roughness: 0.96,
      metalness: 0.0,
      fog: true,
    });
    applyHorizonMistFeather(farRidgeMat, 14.0, 28.0, 16.0, 32.0);
    const farRidgeMesh = new THREE.Mesh(farRidgeGeo, farRidgeMat);
    farRidgeMesh.position.set(3.5, -0.2, -24.5);
    this.group.add(farRidgeMesh);

    this.disposables.push(midRidgeGeo, midRidgeMat, farRidgeGeo, farRidgeMat);
  }

  private buildMultiElevationCloudField(): void {
    const cloudPuffGeo = new THREE.IcosahedronGeometry(0.85, 2);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.9,
      metalness: 0.0,
      fog: true,
    });
    this.disposables.push(cloudPuffGeo, cloudMat);

    // 6 distinct clouds across Y: 6..14, Z: -10..-25, Scale: 0.6..1.4
    const cloudSpecs = [
      {x: -11.5, y: 6.8, z: -11.5, scale: 1.35, speed: 0.32},
      {x: 6.2, y: 7.6, z: -13.0, scale: 1.4, speed: 0.26},
      {x: -3.5, y: 9.8, z: -17.5, scale: 1.05, speed: 0.21},
      {x: 13.5, y: 11.2, z: -19.5, scale: 0.9, speed: 0.18},
      {x: -16.0, y: 12.6, z: -22.5, scale: 0.72, speed: 0.14},
      {x: 2.0, y: 13.6, z: -24.5, scale: 0.62, speed: 0.12},
    ];

    const puffLayout = [
      {dx: 0, dy: 0.18, dz: 0, sx: 1.45, sy: 0.95, sz: 1.1},
      {dx: -0.95, dy: -0.08, dz: 0.12, sx: 1.1, sy: 0.78, sz: 0.92},
      {dx: 0.98, dy: -0.05, dz: -0.08, sx: 1.15, sy: 0.82, sz: 0.95},
      {dx: -0.42, dy: 0.42, dz: -0.15, sx: 0.95, sy: 0.85, sz: 0.9},
      {dx: 0.48, dy: 0.36, dz: 0.18, sx: 0.9, sy: 0.78, sz: 0.85},
      {dx: -1.65, dy: -0.18, dz: 0.05, sx: 0.76, sy: 0.62, sz: 0.75},
      {dx: 1.68, dy: -0.16, dz: -0.04, sx: 0.78, sy: 0.64, sz: 0.75},
    ];

    for (const spec of cloudSpecs) {
      const cloudGroup = new THREE.Group();
      cloudGroup.position.set(spec.x, spec.y, spec.z);
      cloudGroup.scale.setScalar(spec.scale);
      cloudGroup.userData = {
        speed: spec.speed,
        baseY: spec.y,
      };

      for (const p of puffLayout) {
        const puff = new THREE.Mesh(cloudPuffGeo, cloudMat);
        puff.position.set(p.dx, p.dy, p.dz);
        puff.scale.set(p.sx, p.sy, p.sz);
        puff.castShadow = false;
        puff.receiveShadow = true;
        cloudGroup.add(puff);
      }

      this.cloudGroups.push(cloudGroup);
      this.group.add(cloudGroup);
    }
  }

  public updateClouds(elapsedTime: number, deltaTime = 0.016): void {
    // 1. Gentle coherent wind sway on soft bent-blade grass clusters (< 5° threshold)
    for (let i = 0; i < this.grassInstances.length; i++) {
      const g = this.grassInstances[i];
      _dummy.position.set(g.x, g.y, g.z);
      _dummy.rotation.set(
        Math.cos(elapsedTime * 1.1 + g.z * 0.8) * 0.04,
        g.rotY,
        Math.sin(elapsedTime * 1.4 + g.x * 0.8 + g.z * 0.5) * 0.06,
      );
      _dummy.scale.set(g.scaleXZ, g.scaleY, g.scaleXZ);
      _dummy.updateMatrix();
      this.grassInstanced.setMatrixAt(i, _dummy.matrix);
    }
    this.grassInstanced.instanceMatrix.needsUpdate = true;

    // 2. Drift multi-elevation clouds across the sky along the X-axis
    for (let i = 0; i < this.cloudGroups.length; i++) {
      const cloud = this.cloudGroups[i];
      const speed = (cloud.userData.speed as number) || 0.2;
      const baseY = (cloud.userData.baseY as number) || cloud.position.y;
      cloud.position.x += speed * deltaTime;
      cloud.position.y = baseY + Math.sin(elapsedTime * 0.55 + i * 1.3) * 0.14;
      if (cloud.position.x > 26) {
        cloud.position.x = -26;
      }
    }
  }

  private buildPastoralPerimeter(): void {
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x8d6e63,
      roughness: 0.85,
      metalness: 0.04,
    });
    const trunkClayMat = new THREE.MeshStandardMaterial({
      color: 0x8d6e63,
      roughness: 0.88,
      metalness: 0.04,
    });
    const foliageSageMat = new THREE.MeshStandardMaterial({
      color: 0x6e936e,
      roughness: 0.85,
      metalness: 0.05,
    });

    const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 8);
    const postCapGeo = new THREE.SphereGeometry(0.08, 8, 8);

    this.disposables.push(
      postMat,
      trunkClayMat,
      foliageSageMat,
      postGeo,
      postCapGeo,
    );

    const buildFenceSegment = (points: THREE.Vector3[], targetGroup: THREE.Group) => {
      // 1. Spawn Vertical Posts at EVERY point (0 to points.length - 1)
      for (let i = 0; i < points.length; i++) {
        const postGroup = new THREE.Group();

        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = 0.45;
        post.castShadow = true;
        post.receiveShadow = true;

        const cap = new THREE.Mesh(postCapGeo, postMat);
        cap.position.y = 0.9;
        cap.castShadow = true;
        cap.receiveShadow = true;

        postGroup.add(post, cap);
        postGroup.position.copy(points[i]);
        targetGroup.add(postGroup);
      }

      // 2. Span Rails EXACTLY between consecutive pairs (post[i] to post[i+1])
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];

        for (const railY of [0.35, 0.65]) {
          const startRail = new THREE.Vector3(start.x, start.y + railY, start.z);
          const endRail = new THREE.Vector3(end.x, end.y + railY, end.z);
          const distance = startRail.distanceTo(endRail);
          const midpoint = new THREE.Vector3()
            .addVectors(startRail, endRail)
            .multiplyScalar(0.5);

          const railGeo = new THREE.CylinderGeometry(0.035, 0.035, distance, 8);
          // Rotate cylinder onto local Z-axis so rail.lookAt(endRail) aligns the span from startRail to endRail
          railGeo.rotateX(Math.PI / 2);
          this.disposables.push(railGeo);

          const rail = new THREE.Mesh(railGeo, postMat);
          rail.position.copy(midpoint);
          rail.lookAt(endRail);
          rail.castShadow = true;
          rail.receiveShadow = true;
          targetGroup.add(rail);
        }
      }
    };

    const fenceRadius = 7.2;
    const leftFenceAngles = [-2.5, -2.3, -2.1, -1.9];
    const rightFenceAngles = [-1.2, -1.0, -0.8, -0.6];

    for (const angleGroup of [leftFenceAngles, rightFenceAngles]) {
      const segmentPoints = angleGroup.map((angle) => {
        const fx = Math.cos(angle) * fenceRadius;
        const fz = Math.sin(angle) * fenceRadius;
        const fy = getMeadowHeightAt(fx, fz);
        return new THREE.Vector3(fx, fy, fz);
      });
      buildFenceSegment(segmentPoints, this.group);
    }

    // 1. Trunk: Short, slightly tapered cylinder in warm matte clay brown (#8D6E63)
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8);
    trunkGeo.translate(0, 0.35, 0);

    // 2. Foliage: Shared unit sphere scaled per puff (0.28 to 0.42 radii)
    const foliagePuffGeo = new THREE.SphereGeometry(1.0, 18, 16);
    this.disposables.push(trunkGeo, foliagePuffGeo);

    // Cauliflower / Fluffy Wool-Cloud Cluster configuration (7 interlocking spheres):
    // - 1 central core sphere (r = 0.42)
    // - 5 radial perimeter spheres (r = 0.28 - 0.35) at angle = i * (2*PI / 5), radius ~0.22..0.24 with vertical jitter
    // - 1 top crown sphere (r = 0.32, Y + 0.25)
    const perimeterRadii = [0.34, 0.31, 0.35, 0.29, 0.33];
    const perimeterYJitter = [-0.04, 0.05, -0.02, 0.06, -0.03];
    const perimeterDist = [0.23, 0.21, 0.24, 0.22, 0.23];

    const treeSpots = [
      {x: -5.8, z: -5.6, scale: 1.15, rotY: 0.42},
      {x: -7.4, z: -3.6, scale: 0.92, rotY: 1.85},
      {x: 6.2, z: -5.8, scale: 1.2, rotY: 3.1},
      {x: 7.6, z: -3.4, scale: 0.86, rotY: 4.55},
      {x: -0.9, z: -8.2, scale: 1.06, rotY: 2.35},
    ];

    for (let tIdx = 0; tIdx < treeSpots.length; tIdx++) {
      const spot = treeSpots[tIdx];
      const ty = getMeadowHeightAt(spot.x, spot.z);
      const treeGroup = new THREE.Group();
      treeGroup.position.set(spot.x, ty, spot.z);
      treeGroup.scale.setScalar(spot.scale);
      treeGroup.rotation.y = spot.rotY;

      // Trunk mesh
      const trunk = new THREE.Mesh(trunkGeo, trunkClayMat);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // Central anchor point at the top of the trunk
      const foliageAnchor = new THREE.Group();
      foliageAnchor.position.set(0, 0.82, 0);

      // Central core sphere (r = 0.42)
      const corePuff = new THREE.Mesh(foliagePuffGeo, foliageSageMat);
      corePuff.scale.setScalar(0.42);
      corePuff.castShadow = true;
      corePuff.receiveShadow = true;
      foliageAnchor.add(corePuff);

      // 5 radial perimeter spheres (r = 0.28 - 0.35)
      for (let i = 0; i < 5; i++) {
        const angle = i * ((Math.PI * 2) / 5) + tIdx * 0.25;
        const dist = perimeterDist[i];
        const r = perimeterRadii[(i + tIdx) % perimeterRadii.length];
        const dy = perimeterYJitter[(i + tIdx) % perimeterYJitter.length];

        const perimPuff = new THREE.Mesh(foliagePuffGeo, foliageSageMat);
        perimPuff.position.set(Math.cos(angle) * dist, dy, Math.sin(angle) * dist);
        perimPuff.scale.setScalar(r);
        perimPuff.castShadow = true;
        perimPuff.receiveShadow = true;
        foliageAnchor.add(perimPuff);
      }

      // 1 top crown sphere (r = 0.32, offset slightly upwards Y + 0.25)
      const crownPuff = new THREE.Mesh(foliagePuffGeo, foliageSageMat);
      crownPuff.position.set(0.03, 0.25, -0.02);
      crownPuff.scale.setScalar(0.32);
      crownPuff.castShadow = true;
      crownPuff.receiveShadow = true;
      foliageAnchor.add(crownPuff);

      // 1 lower-side cushion puff (r = 0.28) for 8-sphere organic fullness
      const cushionAngle = tIdx * 1.3 + 0.6;
      const cushionPuff = new THREE.Mesh(foliagePuffGeo, foliageSageMat);
      cushionPuff.position.set(
        Math.cos(cushionAngle) * 0.16,
        0.14,
        Math.sin(cushionAngle) * 0.16,
      );
      cushionPuff.scale.setScalar(0.3);
      cushionPuff.castShadow = true;
      cushionPuff.receiveShadow = true;
      foliageAnchor.add(cushionPuff);

      treeGroup.add(foliageAnchor);
      this.group.add(treeGroup);
    }
  }

  public dispose(): void {
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables = [];
  }
}
