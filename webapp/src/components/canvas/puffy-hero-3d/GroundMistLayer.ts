import * as THREE from 'three';

const MIST_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MIST_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec2 uSeedOffset;

  varying vec2 vUv;

  // Compact 2D Simplex noise (Ashima / Ian McEwan)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
     -0.577350269189626,
      0.024390243902439
    );
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uvBase = vUv + uSeedOffset;
    float n1 = snoise(uvBase * 3.5 + vec2(uTime * 0.05, uTime * 0.02));
    float n2 = snoise(uvBase * 6.8 - vec2(uTime * 0.03, uTime * 0.04));
    float noise = smoothstep(-0.15, 0.8, n1 * 0.65 + n2 * 0.35);

    // Soft circular fade so plane edges never clip visibly
    float radialMask = 1.0 - smoothstep(0.1, 0.5, length(vUv - vec2(0.5)));

    float alpha = noise * radialMask * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function createSoftMistRibbonTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.68)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

interface MistRibbonEntry {
  texture: THREE.CanvasTexture;
  phase: number;
  speedX: number;
  speedY: number;
}

/**
 * Dual-layer ground-level morning mist (surface haze) plus a 3-plane valley
 * mist blanket softening ground contacts and obliterating the horizon ridge seam.
 */
export class GroundMistLayer {
  public readonly group: THREE.Group;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly shaderMaterials: THREE.ShaderMaterial[] = [];
  private readonly basicMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly ribbons: MistRibbonEntry[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'MorningGroundMistLayer';

    // 1. Dual drifting Simplex-noise surface haze sheets
    const hazeGeo = new THREE.PlaneGeometry(35, 35, 1, 1);
    this.geometries.push(hazeGeo);

    // Meadow ground base at (0,0) is -0.82m; place sheets at +0.18m and +0.42m above turf
    const layerConfigs = [
      { y: -0.64, opacity: 0.28, rotY: 0.0, seed: new THREE.Vector2(0.0, 0.0), color: '#FDFBF7' },
      { y: -0.40, opacity: 0.22, rotY: 0.72, seed: new THREE.Vector2(4.3, 2.1), color: '#FDFBF7' },
    ];

    for (let i = 0; i < layerConfigs.length; i++) {
      const cfg = layerConfigs[i];
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(cfg.color) },
          uOpacity: { value: cfg.opacity },
          uSeedOffset: { value: cfg.seed },
        },
        vertexShader: MIST_VERTEX_SHADER,
        fragmentShader: MIST_FRAGMENT_SHADER,
        blending: THREE.NormalBlending,
        transparent: true,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(hazeGeo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = cfg.rotY;
      mesh.position.y = cfg.y;
      mesh.renderOrder = 2 + i;
      this.group.add(mesh);
      this.shaderMaterials.push(material);
    }

    // 2. Ground-hugging dense mist blanket (3 soft organic mist planes across low valleys)
    const ribbonConfigs = [
      // Dense mist ribbon between foreground meadow and midground ridge to soften the horizon seam
      { w: 46, h: 20, x: 0, y: -0.37, z: -11.5, opacity: 0.45, phase: 0.0, speedX: 0.012, speedY: 0.008 },
      // Mid-valley mist hugging sheep legs, fence posts, and tree bases
      { w: 28, h: 20, x: -3.5, y: -0.60, z: -3.2, opacity: 0.34, phase: 1.7, speedX: -0.01, speedY: 0.006 },
      // Foreground-right mist softening grass and hillside drop-off
      { w: 26, h: 18, x: 4.0, y: -0.62, z: 2.2, opacity: 0.30, phase: 3.1, speedX: 0.009, speedY: -0.007 },
    ];

    for (let i = 0; i < ribbonConfigs.length; i++) {
      const rc = ribbonConfigs[i];
      const geo = new THREE.PlaneGeometry(rc.w, rc.h, 1, 1);
      const tex = createSoftMistRibbonTexture(256);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: '#EDE9DF',
        transparent: true,
        opacity: rc.opacity,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(rc.x, rc.y, rc.z);
      mesh.renderOrder = 4 + i;
      this.group.add(mesh);

      this.geometries.push(geo);
      this.basicMaterials.push(mat);
      this.ribbons.push({
        texture: tex,
        phase: rc.phase,
        speedX: rc.speedX,
        speedY: rc.speedY,
      });
    }
  }

  public update(elapsedTime: number): void {
    const t = elapsedTime * 0.04;
    for (let i = 0; i < this.shaderMaterials.length; i++) {
      this.shaderMaterials[i].uniforms.uTime.value = t;
    }
    for (let i = 0; i < this.ribbons.length; i++) {
      const r = this.ribbons[i];
      r.texture.offset.x = Math.sin(elapsedTime * 0.15 + r.phase) * r.speedX;
      r.texture.offset.y = Math.cos(elapsedTime * 0.12 + r.phase) * r.speedY;
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    for (let i = 0; i < this.shaderMaterials.length; i++) {
      this.shaderMaterials[i].dispose();
    }
    for (let i = 0; i < this.basicMaterials.length; i++) {
      this.basicMaterials[i].dispose();
    }
    for (let i = 0; i < this.ribbons.length; i++) {
      this.ribbons[i].texture.dispose();
    }
  }
}
