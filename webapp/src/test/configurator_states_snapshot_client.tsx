import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBedroomSanctuaryScene } from '../components/canvas/bedroom/BedroomSanctuaryScene.tsx';
import {
  BEDROOM_CONFIGURABLE_ITEMS,
  BEDROOM_REGISTRY,
} from '../components/canvas/bedroom/BedroomRegistry.ts';
import { FloatingWoolPad } from '../components/canvas/puffy-hero-3d/FloatingWoolPad.ts';
import { BedroomConfiguratorDock } from '../components/ui/BedroomConfiguratorDock.tsx';
import { useBedroomConfigStore } from '../store/useBedroomConfigStore.ts';

declare global {
  interface Window {
    __CONFIGURATOR_TEST__?: {
      ready: boolean;
      setCamera: (pos: [number, number, number], target: [number, number, number]) => void;
      setStoreState: (partial: Record<string, unknown>) => void;
      renderFrame: () => void;
      captureWebGLDataURL: () => string;
      getTelemetry: () => {
        meshCount: number;
        registryKeys: string[];
        configurableKeys: string[];
        geometries: number;
        textures: number;
      };
    };
  }
}

function countSceneMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      count += 1;
    }
  });
  return count;
}

async function initConfiguratorTestHarness() {
  const width = 1600;
  const height = 1000;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.display = 'block';
  document.body.appendChild(canvas);

  const uiRootEl = document.createElement('div');
  uiRootEl.id = 'configurator-ui-root';
  document.body.appendChild(uiRootEl);
  const reactRoot = createRoot(uiRootEl);
  reactRoot.render(React.createElement(BedroomConfiguratorDock, { bottomOffset: 24 }));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EFEAE1');
  scene.fog = new THREE.FogExp2('#EFEAE1', 0.012);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const woolPad = new FloatingWoolPad(maxAniso);
  woolPad.setFloatingEnabled(false, 0.238);
  woolPad.update(0, 0.016);

  const mattressDockGroup = new THREE.Group();
  mattressDockGroup.name = 'DockedPuffyMattressGroup';
  mattressDockGroup.add(woolPad.group);

  const sanctuary = createBedroomSanctuaryScene({
    floatingWoolPad: woolPad,
    mattressWidth: 2.15,
    mattressLength: 2.55,
    castShadow: true,
    sunLightIntensity: 2.6,
    initialStyle: 'nordic-coastal',
  });
  woolPad.setFloatingEnabled(false, 0.238);
  sanctuary.dockMattress(mattressDockGroup);
  scene.add(sanctuary.group);

  const camera = new THREE.PerspectiveCamera(48, width / height, 0.05, 100);
  camera.position.set(1.65, 1.25, 1.55);
  camera.lookAt(0, 0.65, -0.2);

  // Initial warm-up render
  renderer.render(scene, camera);

  window.__CONFIGURATOR_TEST__ = {
    ready: true,
    setCamera: (pos, target) => {
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.lookAt(target[0], target[1], target[2]);
      camera.updateMatrixWorld();
    },
    setStoreState: (partial) => {
      useBedroomConfigStore.setState(partial as Partial<ReturnType<typeof useBedroomConfigStore.getState>>);
    },
    renderFrame: () => {
      scene.updateMatrixWorld(true);
      renderer.render(scene, camera);
    },
    captureWebGLDataURL: () => {
      scene.updateMatrixWorld(true);
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    getTelemetry: () => {
      scene.updateMatrixWorld(true);
      return {
        meshCount: countSceneMeshes(scene),
        registryKeys: Object.keys(BEDROOM_REGISTRY),
        configurableKeys: Object.keys(BEDROOM_CONFIGURABLE_ITEMS),
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
  };
}

initConfiguratorTestHarness().catch((err) => {
  console.error('Configurator test harness failed:', err);
});
