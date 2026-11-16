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

4. **RULE: STRICT PBR ALBEDO SAFETY RANGE (NO PURE #FFFFFF)**:
   - Strictly ban pure `#FFFFFF` for any white fabric, quilt surface, or `baseColor` maps.
   - The maximum allowable brightness for white fabric must be clamped to 80%–85% reflectance (Hex range: `#DCE4EC` to `#EDF2F7`).
   - In Three.js materials, set `color: new THREE.Color('#E2E8F0')` and ensure `renderer.toneMapping = THREE.ACESFilmicToneMapping` with `toneMappingExposure = 1.0`.

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

---

## ADDENDUM: TEXTURE BUDGET QUOTA & SEAMLESS TILING PROTOCOL (CAVP-ADDENDUM-v1.1)

### 1. The Core Principle: "Bake Atomic Tile — Multiply at Runtime"
To prevent repository bloat, eliminate Git LFS threshold warnings (< 50 MB), and avoid GPU VRAM exhaustion on client browsers, **no asset shall ever be baked as a monolithic, full-scale continuous canvas** (e.g., entire mattress walls, full floors, or room-spanning wall plaster).
All repeating patterns, textile weaves, quilting, and wood grains must be authored as **compact, seamless tiling unit cells** in MaterialCraft / TextureCraft and tiled dynamically in Three.js via `THREE.RepeatWrapping`.

### 2. Standardized Aspect Ratios & Quota Limits by Component Class
| Component Class | Target Ratio | Master Resolution | Max Disk Size (.mcmat) | Max Packed Maps (WebP/KTX2) | Mandatory Registry Metadata |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Class A: Micro-Weave & Tiling Fill** | **1:1 (Square)** | `512 x 512` or `1024 x 1024` | `< 2.5 MB` | `< 500 KB / map` | `physical_unit_meters: [w, h]` |
| **Class B: Longitudinal Bands & Borders**| **4:1 or 2:1 (Strip)** | `2048 x 512` or `2048 x 1024` | `< 6.0 MB` | `< 1.0 MB / map` | `physical_unit_meters: [w, h]` |
| **Class C: Decal Badges & Brand Patches** | **2:1 (Bounded)** | `2048 x 1024` (Non-repeating) | `< 8.0 MB` | `< 1.5 MB / map` | `anchor_point`, `decal_scale` |
| **Class D: Straps & Vertical Handles** | **1:4 (Vertical)** | `512 x 2048` | `< 4.0 MB` | `< 800 KB / map` | `physical_unit_meters: [w, h]` |

> **Strict Quota Gate:** Any single `.mcmat` file exceeding **10.0 MB** or individual texture map exceeding **2.0 MB** will be rejected automatically by CI/CD pre-commit hooks.

### 3. Dynamic Runtime Metric Calculation (Prevent Squashing)
Do not hardcode arbitrary integers into `repeat.set()`. Always compute texture repeat factors dynamically from physical metric dimensions:
```typescript
// Metric Calculation Standard:
const repeatX = meshPhysicalWidth / componentMetadata.physical_unit_meters[0];
const repeatY = meshPhysicalHeight / componentMetadata.physical_unit_meters[1];

texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = componentMetadata.is_strip ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
texture.repeat.set(repeatX, repeatY);
```

### 4. Immediate Remediation & Pre-Bake Safety Gate
- **Pre-Bake Sanity Check**: If a target surface exceeds `1.0m x 1.0m` in 3D space, it is strictly illegal to bake as one canvas. It must be decomposed into a Class A or Class B modular tile.
- **Purge Monolithic Commits**: Any uncompressed `.mcmat` or texture exceeding 50 MB must be stripped from Git history using `git rm --cached` before rebaking.

- 
# 🚨 5 CRITICAL DIRECTIVE: PRODUCTION MATTRESS PROTOTYPE LOCKDOWN

## A. STATUS: LOCKED & IMMUTABLE (PRODUCTION-FROZEN)
The core mattress prototypes registered in `shared_assets/lego/REGISTRY.json` are **officially completed, approved, and frozen**:
- **`Cloud`** (Puffy Cloud Mattress)
- **`Lux`** (Puffy Lux Hybrid)
- **`Royal`** (Puffy Royal Hybrid)

Their visual aesthetics, 3D meshes/geometry, PBR texture maps (Albedo, Normal, Roughness, Height, AO), shader parameters, physical dimensions, anchor points, and internal 10-layer anatomy structures are strictly **PRODUCTION-READY**.

---

## B. STRICT PROHIBITIONS FOR ALL AGENTS & WORKERS
Unless explicitly instructed by the User with an authorized bypass, **ALL AGENTS MUST ADHERE TO THE FOLLOWING ZERO-TOLERANCE RULES**:

1. **DO NOT MODIFY GEOMETRY OR MESHES**: Never alter, optimize, decimate, subdivide, or deform the 3D meshes of `Cloud`, `Lux`, or `Royal`.
2. **DO NOT MODIFY MATERIALS OR SHADERS**: Never change color palettes, hex codes, PBR texture bindings, roughness/metalness values, or custom shader code associated with these three models.
3. **DO NOT OVERWRITE OR RENAME ASSETS**: Never touch, delete, rename, or overwrite files in `shared_assets/lego/components/` or textures assigned to these models.
4. **DO NOT ALTER REGISTRY BINDINGS**: Never modify the coordinate anchors, UV placements, scale factors, or SKU identifiers defined in `shared_assets/lego/REGISTRY.json`.
5. **NO UNINTENDED SIDE EFFECTS**: When implementing room environments (e.g., Bedroom, Meadow), camera animations, lighting rigs, or UI controls, you must treat the mattress models as **READ-ONLY BLACK BOXES**.

---

## C. MANDATORY STOP-AND-ASK PROTOCOL (ESCALATION GATEWAY)
If any assigned task (e.g., UI refactoring, camera spline tuning, dynamic lighting, layer exploding) appears to require changes to `Cloud`, `Lux`, or `Royal`:

1. **HALT IMMEDIATELY**: Do not attempt to refactor or "fix" the mattress code.
2. **DO NOT ASSUME OR ESTIMATE**: Never make autonomous modifications to locked assets.
3. **ESCALATE TO THE USER**: Post an explicit warning in the chat before executing any command:

> **"⚠️ LOCKDOWN VIOLATION ALERT:** The requested task requires modifying the production-frozen mattress prototype `[Cloud / Lux / Royal]` at file `[path/to/file]`. According to `Agent.md`, this model is locked. Please confirm whether you explicitly authorize this modification before I proceed."

D. **AWAIT WRITTEN CONFIRMATION**: Only proceed if the user grants unambiguous, explicit written consent.
