import * as THREE from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import puffyCloudSvgRaw from '@assets/logos/puffy_cloud_vector.svg?raw';

const BEVEL_SIZE_M = 0.012;
const BEVEL_THICKNESS_M = 0.015;
const EXTRUDE_DEPTH_M = 0.10;

/**
 * Target 2D core width in meters before bevel expansion.
 * With `bevelSize = 0.012` on each side, final bounding width is ~0.60m.
 */
const TARGET_CORE_WIDTH_M = 0.60 - 2 * BEVEL_SIZE_M;

/**
 * Extracts and normalizes the authentic Puffy cloud SVG silhouette into an
 * upright, meter-scaled `THREE.Shape` centered at (0, 0).
 */
function loadAuthenticCloudShape(): THREE.Shape {
  const loader = new SVGLoader();
  const svgData = loader.parse(puffyCloudSvgRaw);

  const rawShapes: THREE.Shape[] = [];
  for (const path of svgData.paths) {
    rawShapes.push(...SVGLoader.createShapes(path));
  }

  if (rawShapes.length === 0) {
    throw new Error('HeroCloudletGuide: Failed to extract THREE.Shape from puffy_cloud_vector.svg');
  }

  // Sample the authentic vector contour at high fidelity and flip SVG +Y down -> Three.js +Y up
  const rawPoints = rawShapes[0].getPoints(64);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of rawPoints) {
    const yUp = -pt.y;
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (yUp < minY) minY = yUp;
    if (yUp > maxY) maxY = yUp;
  }

  const rawWidth = Math.max(maxX - minX, 1e-5);
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const meterScale = TARGET_CORE_WIDTH_M / rawWidth;

  const scaledPoints = rawPoints.map(
    (pt) => new THREE.Vector2((pt.x - centerX) * meterScale, (-pt.y - centerY) * meterScale),
  );

  return new THREE.Shape(scaledPoints);
}

/**
 * `hero_cloudlet_guide_v1` — 3D Puffy Hero Guide Cloudlet.
 * Molded from the authentic Puffy Cloud vector silhouette with a matte
 * peach-fuzz micro-fiber PBR material and weightless idle breathing motion.
 */
export class HeroCloudletGuide {
  public readonly group = new THREE.Group();
  public readonly mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshPhysicalMaterial>;

  private readonly geometry: THREE.ExtrudeGeometry;
  private readonly material: THREE.MeshPhysicalMaterial;

  constructor() {
    this.group.name = 'hero_cloudlet_guide_v1_group';
    this.group.position.set(0, 0, 0);

    const cloudShape = loadAuthenticCloudShape();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: EXTRUDE_DEPTH_M, // 10cm depth
      bevelEnabled: true,
      bevelSegments: 6, // Smooth round edge
      steps: 1,
      bevelSize: BEVEL_SIZE_M, // Small bevel prevents inner crevices from collapsing
      bevelThickness: BEVEL_THICKNESS_M, // Soft pillowed border
      curveSegments: 32,
    };

    this.geometry = new THREE.ExtrudeGeometry(cloudShape, extrudeSettings);
    this.geometry.center();
    this.geometry.computeVertexNormals();

    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#FAF7F2'), // Warm linen / cloud white
      roughness: 0.94, // Deep matte cotton
      metalness: 0.0,
      clearcoat: 0.0,
      // Micro-fiber grazing scattering:
      sheen: 1.0,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#FFFFFF'),
      // Subtle subsurface light penetration:
      transmission: 0.08,
      thickness: 0.2,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'hero_cloudlet_guide_v1';
    this.mesh.position.set(0, 0, 0);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.group.add(this.mesh);
  }

  /**
   * Applies subtle weightless floating & breathing oscillation at center stage.
   */
  public update(elapsedTime: number, applyBreathingScale = true): void {
    const time = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    this.mesh.position.y = Math.sin(time * 1.5) * 0.04;
    if (applyBreathingScale) {
      const breath = 1.0 + Math.sin(time * 2.0) * 0.025;
      this.mesh.scale.set(breath, breath, breath);
    }
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
  }
}
