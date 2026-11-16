import * as THREE from 'three';

interface OpticalFlareLayer {
  texture: THREE.CanvasTexture;
  size: number;
  distance: number;
  baseColor: THREE.Color;
  baseOpacity: number;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
}

export interface DawnLensFlareRig {
  lensflare: THREE.Group;
  update: (
    camera: THREE.Camera,
    sunWorldPos: THREE.Vector3,
    enabled: boolean,
    mattressGroup?: THREE.Object3D | null,
  ) => void;
  dispose: () => void;
}

function createCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Soft radial sun glow (pure white center with smooth feathered falloff, no sharp star spikes). */
function createCoreGlowTexture(size = 256): THREE.CanvasTexture {
  return createCanvasTexture(size, (ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.14, 'rgba(255, 255, 255, 0.72)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.26)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.06)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Soft filled optical bokeh disc with gentle feathered edge (no hard cartoon rim). */
function createSoftDiscTexture(size = 256): THREE.CanvasTexture {
  return createCanvasTexture(size, (ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.48, 'rgba(255, 255, 255, 0.72)');
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.42)');
    grad.addColorStop(0.9, 'rgba(255, 255, 255, 0.12)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Delicate, softly feathered chromatic halo ring. */
function createDelicateRingTexture(size = 256): THREE.CanvasTexture {
  return createCanvasTexture(size, (ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.04)');
    grad.addColorStop(0.74, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(0.84, 'rgba(255, 255, 255, 0.48)');
    grad.addColorStop(0.92, 'rgba(255, 255, 255, 0.16)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Soft radial specular core / fleck. */
function createSpecularCoreTexture(size = 128): THREE.CanvasTexture {
  return createCanvasTexture(size, (ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.32, 'rgba(255, 255, 255, 0.65)');
    grad.addColorStop(0.68, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  });
}

const FLARE_VERTEX_SHADER = /* glsl */ `
  uniform vec2 uScreenPos;
  uniform vec2 uScale;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec2 ndc = position.xy * uScale + uScreenPos;
    gl_Position = vec4(ndc, 0.0, 1.0);
  }
`;

const FLARE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float alpha = tex.a * uOpacity;
    gl_FragColor = vec4(tex.rgb * uColor * alpha, alpha);
  }
`;

/**
 * Creates a Pha5e-style optical lens flare aligned strictly along the
 * sun -> screen-center -> opposite-quadrant optical axis with AdditiveBlending
 * and depthTest disabled so terrain never clips in-lens artifacts.
 */
export function createDawnLensFlare(container?: HTMLElement): DawnLensFlareRig {
  const texGlow = createCoreGlowTexture(256);
  const texDisc = createSoftDiscTexture(256);
  const texRing = createDelicateRingTexture(256);
  const texCore = createSpecularCoreTexture(128);

  const flareSpec = [
    // 1. Core Sun Glow (soft radial gradient, no harsh 4-point star)
    { texture: texGlow, size: 380, distance: 0.0, color: '#FFF5E0', opacity: 0.90 },

    // 2. Near-Sun Warm Bokeh Discs
    { texture: texDisc, size: 150, distance: 0.18, color: '#FDE68A', opacity: 0.28 },
    { texture: texDisc, size: 95, distance: 0.26, color: '#FDBA74', opacity: 0.24 },

    // 3. Mid-Axis Delicate Chromatic Ring & Warm Fleck
    { texture: texRing, size: 195, distance: 0.34, color: '#2DD4BF', opacity: 0.14 },
    { texture: texDisc, size: 75, distance: 0.45, color: '#FB923C', opacity: 0.32 },

    // 4. Dominant Warm Concentric Disc + Nested Inner Electric Core (Pha5e signature)
    { texture: texDisc, size: 450, distance: 0.60, color: '#FF7A3D', opacity: 0.35 },
    { texture: texCore, size: 140, distance: 0.60, color: '#7C83FD', opacity: 0.60 },

    // 5. Soft Outer Rainbow Rings & Specular Anchor
    { texture: texRing, size: 175, distance: 0.82, color: '#C4B5FD', opacity: 0.15 },
    { texture: texDisc, size: 48, distance: 0.82, color: '#E0E7FF', opacity: 0.45 },
    { texture: texCore, size: 22, distance: 0.96, color: '#7DD3FC', opacity: 0.65 },
  ];

  const geometry = new THREE.PlaneGeometry(2, 2);
  const lensflare = new THREE.Group();
  lensflare.name = 'GoldenDawnOpticalFlare';
  lensflare.frustumCulled = false;

  const layers: OpticalFlareLayer[] = flareSpec.map((item, idx) => {
    const baseColor = new THREE.Color(item.color);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: item.texture },
        uColor: { value: baseColor.clone() },
        uOpacity: { value: 0 },
        uScreenPos: { value: new THREE.Vector2() },
        uScale: { value: new THREE.Vector2(0.1, 0.1) },
      },
      vertexShader: FLARE_VERTEX_SHADER,
      fragmentShader: FLARE_FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10000 + idx;
    lensflare.add(mesh);

    return {
      texture: item.texture,
      size: item.size,
      distance: item.distance,
      baseColor,
      baseOpacity: item.opacity,
      material,
      mesh,
    };
  });

  const sunScreenPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const occlusionRaycaster = new THREE.Raycaster();
  let currentOcclusionOpacity = 1.0;
  const viewportHeightFallback = () => Math.max(1, window.innerHeight || 720);
  const viewportWidthFallback = () => Math.max(1, window.innerWidth || 1280);

  const update = (
    camera: THREE.Camera,
    sunWorldPos: THREE.Vector3,
    enabled: boolean,
    mattressGroup?: THREE.Object3D | null,
  ) => {
    if (!enabled) {
      lensflare.visible = false;
      return;
    }

    camera.getWorldDirection(camDir);
    sunDir.subVectors(sunWorldPos, camera.position).normalize();
    const forwardDot = camDir.dot(sunDir);

    if (forwardDot <= 0.0) {
      lensflare.visible = false;
      return;
    }

    // Raycast from camera toward the sun to check if the mattress blocks the line of sight
    let isOccluded = false;
    if (mattressGroup && mattressGroup.visible) {
      occlusionRaycaster.set(camera.position, sunDir);
      const intersects = occlusionRaycaster.intersectObject(mattressGroup, true);
      const sunDist = camera.position.distanceTo(sunWorldPos);
      isOccluded = intersects.length > 0 && intersects[0].distance < sunDist;
    }

    const targetOcclusion = isOccluded ? 0.0 : 1.0;
    currentOcclusionOpacity += (targetOcclusion - currentOcclusionOpacity) * 0.1;

    sunScreenPos.copy(sunWorldPos).project(camera);
    const distFromCenter = Math.hypot(sunScreenPos.x, sunScreenPos.y);
    const screenFade = THREE.MathUtils.clamp(1.0 - (distFromCenter - 0.5) / 0.8, 0, 1);
    const forwardFade = THREE.MathUtils.smoothstep(forwardDot, 0.0, 0.25);
    const flareVisibility = screenFade * forwardFade * currentOcclusionOpacity;

    if (flareVisibility <= 0.002) {
      lensflare.visible = false;
      return;
    }

    lensflare.visible = true;

    const vw = container?.clientWidth || viewportWidthFallback();
    const vh = container?.clientHeight || viewportHeightFallback();
    const invAspect = vh / Math.max(1, vw);

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      // Strict optical axis: 0.0 = sun, 0.5 = screen center, 1.0 = opposite quadrant
      const axisScale = 1.0 - layer.distance * 2.0;
      layer.material.uniforms.uScreenPos.value.set(
        sunScreenPos.x * axisScale,
        sunScreenPos.y * axisScale,
      );

      const scaleY = layer.size / vh;
      layer.material.uniforms.uScale.value.set(scaleY * invAspect, scaleY);
      layer.material.uniforms.uOpacity.value = layer.baseOpacity * flareVisibility;
    }
  };

  const dispose = () => {
    geometry.dispose();
    const disposedTextures = new Set<THREE.Texture>();
    for (let i = 0; i < layers.length; i++) {
      layers[i].material.dispose();
      if (!disposedTextures.has(layers[i].texture)) {
        layers[i].texture.dispose();
        disposedTextures.add(layers[i].texture);
      }
    }
  };

  return {
    lensflare,
    update,
    dispose,
  };
}
