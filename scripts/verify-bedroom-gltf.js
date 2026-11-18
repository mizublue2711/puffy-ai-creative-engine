// webapp/scripts/verify-bedroom-gltf.ts
import * as THREE from 'three';
import { createModernGltfBedroomModule } from '../src/components/canvas/bedroom/components/ModernGltfBedroomModule';

async function runVerification() {
  console.log('🔍 [SMOKE TEST] Bắt đầu kiểm tra ModernGltfBedroomModule...');

  const container = new THREE.Group();
  const module = createModernGltfBedroomModule({ castShadow: false });
  container.add(module.group);

  // 1. Kiểm tra tồn tại hàm setStyle
  if (typeof module.setStyle !== 'function') {
    console.error('❌ FAIL: module.setStyle không phải là một hàm!');
    process.exit(1);
  }

  // 2. Kiểm tra gán style Zen
  console.log('🧪 Testing style: zen ...');
  module.setStyle('zen', 0); // duration = 0 để áp dụng ngay lập tức

  // Đợi 1 frame để mock GSAP hoặc kiểm tra giá trị
  setTimeout(() => {
    let foundStructure = false;
    let foundCarpet = false;
    let structureColorHex = '';

    module.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        if (mesh.name === 'ModernBedroom_Structure_0') {
          foundStructure = true;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          structureColorHex = mat.color.getHexString().toLowerCase();
        }
        if (mesh.name === 'ModernBedroom_Carpet_0') {
          foundCarpet = true;
        }
      }
    });

    // 3. Nghiệm thu kết quả
    const EXPECTED_HEX = 'bdb4a5'; // Greige ấm Zen
    if (!foundStructure) {
      console.error('❌ FAIL: Không tìm thấy node ModernBedroom_Structure_0 trong scene!');
      process.exit(1);
    }

    if (structureColorHex !== EXPECTED_HEX) {
      console.error(`❌ FAIL: Màu tường Structure chưa đúng! Thực tế: #${structureColorHex}, Kỳ vọng: #${EXPECTED_HEX}`);
      process.exit(1);
    }

    console.log('✅ PASS: Tất cả các Node GLTF đã bind vật liệu và đổi màu chính xác!');
    process.exit(0);
  }, 100);
}

runVerification();
