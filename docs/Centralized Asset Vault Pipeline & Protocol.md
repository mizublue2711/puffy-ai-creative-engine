# CENTRALIZED ASSET VAULT PIPELINE PROTOCOL (CAVP-v1.0)
**Universal Component Casting & Multi-Target Asset Specification**  
*Applicable Targets: Interactive WebGL (Three.js) & Automated 2D Graphics (Python/Pillow)*

---

## 1. CORE OPERATING PRINCIPLES

1. **Vector As Immutable Truth (Source of Truth)**:
   - The input vector file (`.svg`) is the absolute and immutable geometric definition of all logos, paths, and patterns.
   - The Agent **MUST NEVER regenerate, redraw, or synthesize** paths or text from scratch.
   - Vectors function strictly as **Alpha Masks / Stencils** for PBR height generation, embossing, and material routing.

2. **Preserve Native Aspect Ratio**:
   - The component bounding box is strictly derived from the vector's `viewBox` (width:height ratio $W:H$).
   - **FORBIDDEN**: Forcing rectangular vector components into a 1:1 square canvas, or mapping them onto cubic `BoxGeometry` meshes. Such distortion is a critical pipeline violation.

3. **Neutral Master Asset (Dual-Consumption)**:
   - Cast assets must be orthographic front-facing with clean, delit albedo (no baked shadows), allowing:
     - **3D Engine (Three.js)**: Real-time dynamic lighting, specular sheen, and contact shadow calculation at 60 FPS.
     - **2D Automation (Python)**: Artifact-free placement, arbitrary rotation, and dynamic contact shadow rendering on marketing banners.

---

## 2. STANDARD OUTPUT ARTIFACT PACKAGE (6-FILE CONTRACT)

Every component cast into `shared_assets/lego/components/<component_id>/` must output exactly these 6 standard files:

| File Name | Format | Color Space | Pipeline Consumer & Purpose |
| :--- | :--- | :--- | :--- |
| `01_baseColor.png` | PNG-32 (Alpha) | `sRGB` | Delit albedo surface color. Used in Three.js `material.map`. Strictly no baked shadows. |
| `02_normal.png` | PNG-24/32 | `Linear / NoColorSpace` | OpenGL Tangent Space Normal (+Y up). Recreates puff bevels and thread/surface micro-relief. |
| `03_roughness.png` | PNG-8/24 (Grayscale) | `Linear / NoColorSpace` | Roughness mask: Matte background substrate vs. lustrous satin thread/details. |
| `04_height.png` | PNG-16/24 (Grayscale) | `Linear / NoColorSpace` | Displacement / Bump map: Micro-elevation and geometric relief data. |
| `05_ambientOcclusion.png`| PNG-8/24 (Grayscale) | `Linear / NoColorSpace` | Contact ambient occlusion in stitch crevices and base contours. |
| `06_beauty_render_4k.png` | PNG-32 (Alpha 100%) | `sRGB` | **2D Banner Exclusive**: 4K front orthographic studio render with lighting + clean alpha cutout. |

---

## 3. AGENT WORKFLOW VIA ARTCRAFT MCP / CLI

[Master Vector .SVG] │ ├─────────────────────────────────────────┐ ▼ ▼ [Phase 1: Mask Isolation] [Phase 2: Substrate & Thread Shader] Extract Grayscale Alpha Masks at W:H Build PBR material (.mcmat) via MaterialCraft │ │ └────────────────────┬────────────────────┘ ▼ [Phase 3: GPU Baking & Embossing] Apply displacement & bake maps via TextureCraft │ ┌────────────────────┴────────────────────┐ ▼ ▼ [Target A: 3D Runtime Integration] [Target B: 2D Graphic Automation]
Geometry: PlaneGeometry (W:H thin) - Read 06_beauty_render_4k.png
Material: MeshPhysicalMaterial - Pillow Lanczos resize + Soft Shadow

### Execution Details:
* **Phase 1 (Mask Preparation)**: Read `viewBox` dimensions and export masks matching native aspect ratio (e.g. 2:1 ratio $\rightarrow$ `2048 x 1024` or `4096 x 2048`).
* **Phase 2 (MaterialCraft Graph)**: Build procedural substrate (woven fabric, leather, or synthetic base) and detail material (satin threads with anisotropic sheen). Export as `.mcmat`.
* **Phase 3 (TextureCraft Bake & Render)**: Apply `.mcmat` through extracted masks. Apply bevel/height displacement. Bake GPU maps (`normal`, `ambientOcclusion`). Execute `render` command to produce `06_beauty_render_4k.png` with clean transparency.

---

## 4. CLIENT INTEGRATION SPECIFICATIONS

### 4.1. Three.js WebGL Runtime
1. **Geometry**:
   - Use `THREE.PlaneGeometry(width, height, segments, segments)` or `THREE.DecalGeometry`.
   - Maintain physical real-world metric dimensions (e.g., `0.12m x 0.06m` for 12cm x 6cm tags).
   - **Do not use thick `BoxGeometry`** for flat surface tags/decals.
2. **Material Configuration**:
   ```typescript
   const material = new THREE.MeshPhysicalMaterial({
     map: baseColorMap,              // colorSpace: THREE.SRGBColorSpace
     normalMap: normalMap,          // colorSpace: THREE.NoColorSpace
     normalScale: new THREE.Vector2(1.2, 1.2),
     roughnessMap: roughnessMap,    // colorSpace: THREE.NoColorSpace
     aoMap: aoMap,                  // colorSpace: THREE.NoColorSpace
     aoMapIntensity: 1.0,
     sheen: 1.0,                    // Microfiber / thread scattering
     sheenRoughness: 0.4,
     sheenColor: new THREE.Color(0xffffff),
     polygonOffset: true,           // Prevents Z-fighting on mattress surfaces
     polygonOffsetFactor: -1.0,
     transparent: true
   });
4.2. Python 2D Banner Automation Pipeline
Ingest only 06_beauty_render_4k.png.
Downscale using Image.Resampling.LANCZOS for maximum clarity without aliasing.
Generate dynamic contact drop shadow from the alpha mask using ImageFilter.GaussianBlur.

5. QUALITY GATES & ACCEPTANCE CRITERIA
Before registering any component into shared_assets/lego/REGISTRY.json, verify:
[ ] Aspect Ratio: Output image dimensions strictly match vector viewBox ratio within 0.5%.
[ ] Albedo Neutrality: 01_baseColor.png contains zero baked hard shadows or non-ambient lighting gradients.
[ ] Alpha Integrity: 06_beauty_render_4k.png has a fully transparent background outside component boundaries.
[ ] Registry Entry: Component ID, source SVG path, physical scale (meters), and artifact paths are committed to REGISTRY.json.
