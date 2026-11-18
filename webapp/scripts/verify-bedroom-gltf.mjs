import { createModernGltfBedroomModule } from '../src/components/canvas/puffy-hero-3d/modules/ModernGltfBedroomModule.ts';

globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.lengthComputable = init.lengthComputable ?? false;
    this.loaded = init.loaded ?? 0;
    this.total = init.total ?? 0;
  }
};

console.log('🔍 [SMOKE TEST] Inspecting ModernGltfBedroomModule...');

const positionBuffer = Buffer.alloc(36);
[
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
].forEach((value, index) => positionBuffer.writeFloatLE(value, index * 4));

const gltf = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'ModernBedroom_Structure_0', mesh: 0 }],
  meshes: [{
    primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
  }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }],
  accessors: [{
    bufferView: 0,
    componentType: 5126,
    count: 3,
    type: 'VEC3',
    max: [1, 1, 0],
    min: [0, 0, 0],
  }],
  bufferViews: [{ buffer: 0, byteLength: positionBuffer.length }],
  buffers: [{
    byteLength: positionBuffer.length,
    uri: `data:application/octet-stream;base64,${positionBuffer.toString('base64')}`,
  }],
};
const modelPath = `data:model/gltf+json;base64,${Buffer.from(JSON.stringify(gltf)).toString('base64')}`;

try {
  let resolveLoad;
  let rejectLoad;
  const loadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out loading test GLTF')), 5000);
    resolveLoad = () => {
      clearTimeout(timeout);
      resolve();
    };
    rejectLoad = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
  });

  const module = createModernGltfBedroomModule({
    castShadow: false,
    onLoaded: resolveLoad,
    onError: rejectLoad,
    config: {
      id: 'modern',
      hideMeshes: [],
      mattressAnchor: { position: [0, 0, 0] },
      modelPath,
    },
  });

  if (typeof module.setStyle !== 'function') {
    throw new Error('module.setStyle is not a function');
  }

  await loadPromise;

  module.setStyle('zen', 0);

  let structureColorHex = '';
  module.group.traverse((child) => {
    if (child.isMesh && child.name === 'ModernBedroom_Structure_0') {
      structureColorHex = child.material.color.getHexString().toLowerCase();
    }
  });

  const EXPECTED = 'bdb4a5';
  if (structureColorHex !== EXPECTED) {
    throw new Error(`Wall color mismatch! Got: #${structureColorHex}, Expected: #${EXPECTED}`);
  }

  console.log('✅ PASS: Module verified successfully! Colors and node bindings are correct.');
} catch (err) {
  console.error('❌ FAIL with error:', err instanceof Error ? err.message : err);
  process.exit(1);
}
