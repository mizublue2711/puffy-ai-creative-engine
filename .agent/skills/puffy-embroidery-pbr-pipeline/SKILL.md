---
name: puffy-embroidery-pbr-pipeline
description: >-
  End-to-end autonomous 3D material and texture pipeline connecting MaterialCraft and TextureCraft
  (via MCP servers or CLI) to take a Puffy® logo/badge mask, synthesize raised 3D embroidery materials,
  assign and mask them onto 3D meshes, bake/export PBR maps (BaseColor, Normal, Roughness, Height, AO),
  and prepare assets + material bindings for Three.js.
---

# Puffy® 3D Embroidery & PBR Pipeline (MaterialCraft → TextureCraft → Three.js)

Use this skill whenever the user asks to generate raised 3D embroidery materials, convert a Puffy® logo or badge mask into procedural/3D textures, bake PBR maps (Normal, Roughness, Height, AO), or export 3D textured assets for Three.js.

## 0. Tooling & Access Roots

* **Binaries**:
  * MaterialCraft CLI: `/Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/materialcraft-cli` (v0.4.1)
  * TextureCraft CLI: `/Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/texturecraft-cli` (v0.6.1)
* **MCP Servers** (configured in `~/.gemini/config/mcp_config.json` with `--read-root` & `--write-root` set to `/Users/macbookpro/.gemini/antigravity/scratch`):
  * `materialcraft`: `graph_new`, `library_list`, `node_add`, `node_connect`, `node_param`, `bitmap_import`, `material_export`, `outputs_export`, `view_render`, `command_run`, `command_batch`, `session_inspect`, etc.
  * `texturecraft`: `project_new`, `project_open`, `project_save`, `bake`, `material_load`, `resource_import`, `paint_stroke`, `textures_export`, `mesh_export`, `viewport_render`, `command_run`, `command_batch`, `session_inspect`, etc.
* **Live GUI Bridge (optional)**: If the user asks to watch edits live in the desktop apps, launch `/Applications/MaterialCraft.app/Contents/MacOS/MaterialCraft --control 7878` and `/Applications/TextureCraft.app/Contents/MacOS/TextureCraft --control 7879` and bridge via `mcp --bridge <port>`. Otherwise run headless MCP or CLI directly.

---

## Stage 1: Input Mask Preparation & Puffy® Brand Alignment

1. **Locate the source logo/badge & brand tokens**:
   * Read `/Users/macbookpro/.gemini/antigravity/scratch/puffy-ai-creative-engine/config/brand_tokens.json` for authoritative Puffy® colors:
     * **Navy Ink**: `#2B2F44`
     * **Pure White**: `#FFFFFF`
     * **Warm Linen**: `#E5E3DF`
     * **Ocean Teal**: `#067A57`
     * **Onyx Black**: `#333333`
   * Typical source masks/vectors in `puffy-ai-creative-engine`:
     * `assets/logos/Puffy_Logo_0.svg` / `assets/logos/Puffy_Logo_3.svg`
     * `assets/lego/badges/puffy_royal_badge_master.svg`
     * Or user-supplied high-contrast PNG masks (white = raised embroidery, black = fabric backing).
2. **Enforce Zero Product Drift**:
   * Never alter locked photographic mattress cutouts in `assets/cutouts/`. Use this pipeline to synthesize standalone 3D woven/embroidered badges, textile swatches, packaging labels, or 3D mesh textures.
3. **Prepare mask asset**:
   * If working from SVG, either import directly into MaterialCraft via `command_run` (`file.importVector`) or rasterize to a high-res (2048×2048) crisp grayscale PNG mask (with ≥30px clear space margin matching `logo_geometry.minimum_clear_space_px`) using Pillow/CairoSVG/ImageMagick before importing via `bitmap_import` / `resource_import`.

---

## Stage 2: Raised Embroidery Material Generation (MaterialCraft)

1. **Create or open the MaterialCraft package**:
   * Via MCP: call `graph_new` (`template: "pbr"`, `size: 2048`, `name: "puffy_embroidery"`) or `package_open`.
   * Via CLI:
     ```bash
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/materialcraft-cli new pbr embroidery.sbs --size 2048 --name puffy_embroidery
     ```
2. **Import the Puffy logo mask**:
   * Vector: `command_run` → `file.importVector` (`{"path": "<mask.svg>"}`) + `graph.resource.add`.
   * Bitmap: `bitmap_import` (`path: "<mask.png>"`) + `node_add` (`bitmap`, `colour_space: "Linear"`).
3. **Build the raised embroidery node graph** (`node_add`, `node_connect`, `node_param`):
   * Inspect available atomic nodes if needed (`library_list` or `materialcraft-cli nodes`).
   * **Raised Puff Profile (Height)**:
     * Feed the binary/softened logo mask through `distance` + `blur` (low intensity) + `curve` / `levels` to form a smooth dome/bevel height profile (`0.0` backing, `0.6–1.0` satin stitch ridge).
     * Connect to the graph's `output` node with usage `height`.
   * **Satin Stitch Directional Grain (Normal)**:
     * Generate diagonal/radial thread ridges (e.g., `fx_map` / `pixel_processor` / `directional_blur` + `directional_warp` masked by the logo silhouette) and combine with the puff bevel height.
     * Convert combined height to tangent-space normal using the `normal` node with **`opengl: true`** (required for Three.js `+Y` normal convention). Connect to `output` (`usage: normal`).
   * **Thread Sheen & Fabric Backing (Roughness)**:
     * Map raised embroidery regions to satin polyester/rayon thread sheen (`0.32–0.45`) and surrounding backing fabric (`Warm Linen #E5E3DF` or `Navy Ink #2B2F44`) to matte woven textile roughness (`0.78–0.90`). Connect to `output` (`usage: roughness`).
   * **Crevice Depth (Ambient Occlusion)**:
     * Derive edge/crevice AO around stitch boundaries (`emboss` / inverted edge mask + `levels`) and connect to `output` (`usage: ambientOcclusion`).
   * **Brand Color & Metallic**:
     * Blend thread color (`#FFFFFF` / `#2B2F44` / `#067A57`) over fabric backing color (`#E5E3DF` / `#2B2F44`) using the logo mask → `output` (`usage: baseColor`).
     * Set `metallic` output to `0.0` (dielectric textile thread).
4. **Render & Visually Verify Material**:
   * Render a beauty preview before exporting:
     ```bash
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/materialcraft-cli render embroidery.sbs embroidery_preview.png --scene material_ball --full --hq
     ```
     *(or MCP `view_render`)*.
   * Inspect `embroidery_preview.png` via `read_file`. Confirm crisp bevel edges, stitch directionality, accurate Puffy® brand hex colors, and no tiling/clipping artifacts. Adjust node parameters and re-render if needed.
5. **Export `.mcmat` (for TextureCraft) and/or standalone PBR maps**:
   * MCP `material_export` (or `materialcraft-cli run embroidery.sbs file.exportMaterial '{"path": "puffy_embroidery.mcmat", "size": 2048}'`).
   * Save package (`package_save` as `.mcraft` or `.sbs`).

---

## Stage 3: 3D Assignment, Baking & PBR Export (TextureCraft)

1. **Create or open the 3D TextureCraft project**:
   * Use the target 3D mesh (`.glb`, `.gltf`, `.obj`, `.fbx`, `.usd`) or a built-in swatch (`builtin:plane`, `builtin:rounded_cube`, `builtin:material_ball`):
     ```bash
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/texturecraft-cli new <mesh_or_builtin> puffy_patch.tcraft --resolution 2048
     ```
     *(or MCP `project_new`)*.
2. **Bake Mesh Maps**:
   * Run `bake` via MCP or CLI before driving generators/AO mixing:
     ```bash
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/texturecraft-cli bake puffy_patch.tcraft --resolution 2048 --maps ambientOcclusion,curvature,normal,worldNormal,position,thickness
     ```
3. **Assign Material & Apply Puffy Logo Mask**:
   * Add base textile layer (`layer.add.fill` or `material_load` with a woven linen `.mcmat`).
   * Load the raised embroidery `.mcmat` via `material_load` (or `material.load` command).
   * If the `.mcmat` is not already pre-masked to UV layout, import the Puffy logo mask (`resource_import`) and apply it as a UV fill mask (`mask.add.black` + `effect.add.fill` with `image`, or `layer.add.decal` with `channel: "mask"` for interactive 3D placement).
   * Tune exposed MaterialCraft graph parameters live on the mesh if needed via `material.link.set` + `material.link.cook`.
   * Call `session_inspect` to verify layer stack order, mask attachment, and channel states.
4. **Render Path-Traced QA Check**:
   * Run:
     ```bash
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/texturecraft-cli render puffy_patch.tcraft puffy_3d_qa.png --samples 64
     ```
     *(or MCP `viewport_render`)*.
   * View `puffy_3d_qa.png` via `read_file` to verify lighting response, relief height, thread gloss, and clean edge silhouette.
5. **Export PBR Maps & Optional Textured `.glb`**:
   * **Option A — Separate PBR Maps (Normal, Roughness, Height, AO, BaseColor, Metallic)**:
     ```bash
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/texturecraft-cli export puffy_patch.tcraft ./export_pbr --preset "Document channels + Normal + AO" --format png --size 2048
     ```
     *(Note: verify normal orientation is OpenGL `+Y` when targeting Three.js; `"glTF PBR Metal Roughness"` explicitly uses `NormalOpenGl` and packs `OcclusionRoughnessMetallic`.)*
   * **Option B — glTF / Three.js Packed Maps + `.glb` Mesh**:
     ```bash
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/texturecraft-cli export puffy_patch.tcraft ./export_gltf --preset "glTF PBR Metal Roughness" --format png --size 2048
     /Users/macbookpro/.gemini/antigravity/scratch/artcraft-mcp/bin/texturecraft-cli run puffy_patch.tcraft file.exportMesh '{"path": "./export_gltf/puffy_patch.glb", "format": "glb"}'
     ```
     *(Or call MCP `textures_export` and `mesh_export`.)*

---

## Stage 4: CENTRALIZED ASSET VAULT PIPELINE PROTOCOL (CAVP-v1.0)
**Universal Component Casting & Multi-Target Asset Specification**
*Applicable Targets: Interactive WebGL (Three.js) & Automated 2D Graphics (Python/Pillow)*

### 1. Core Operating Principles
1. **Vector As Immutable Truth (Source of Truth)**:
   * The input vector file (`.svg`) is the absolute and immutable geometric definition of all logos, paths, and patterns.
   * The Agent **MUST NEVER regenerate, redraw, or synthesize** paths or text from scratch.
   * Vectors function strictly as **Alpha Masks / Stencils** for PBR height generation, embossing, and material routing.
2. **Preserve Native Aspect Ratio**:
   * The component bounding box is strictly derived from the vector's `viewBox` (width:height ratio $W:H$).
   * **FORBIDDEN**: Forcing rectangular vector components into a 1:1 square canvas, or mapping them onto cubic `BoxGeometry` meshes. Such distortion is a critical pipeline violation.
3. **Neutral Master Asset (Dual-Consumption)**:
   * Cast assets must be orthographic front-facing with clean, delit albedo (no baked shadows), allowing:
     * **3D Engine (Three.js)**: Real-time dynamic lighting, specular sheen, and contact shadow calculation at 60 FPS.
     * **2D Automation (Python)**: Artifact-free placement, arbitrary rotation, and dynamic contact shadow rendering on marketing banners.
4. **RULE: STRICT PBR ALBEDO SAFETY RANGE (NO PURE #FFFFFF)**:
   * Strictly ban pure `#FFFFFF` for any white fabric, quilt surface, or `baseColor` maps.
   * The maximum allowable brightness for white fabric must be clamped to 80%–85% reflectance (Hex range: `#DCE4EC` to `#EDF2F7`).
   * In Three.js materials, set `color: new THREE.Color('#E2E8F0')` and ensure `renderer.toneMapping = THREE.ACESFilmicToneMapping` with `toneMappingExposure = 1.0`.

### 2. Standard Output Artifact Package (6-File Contract)
Every component cast into `shared_assets/lego/components/<component_id>/` (and mirrored to `webapp/public/textures/badge/` for WebGL) must output **exactly these 6 standard files**:

| File Name | Format | Color Space | Pipeline Consumer & Purpose |
| :--- | :--- | :--- | :--- |
| `01_baseColor.png` | PNG-32 (Alpha) | `sRGB` | Delit albedo surface color (`#16191E` fabric, `#F8FAFC` Puffy, `#D4AF37` ROYAL, `#D8DEE9` silver-white merrow). Used in Three.js `material.map`. Strictly no baked shadows. |
| `02_normal.png` | PNG-24/32 | `Linear / NoColorSpace` | OpenGL Tangent Space Normal (`+Y` up). Recreates puff bevels and thread/surface micro-relief. |
| `03_roughness.png` | PNG-8/24/32 | `Linear / NoColorSpace` | Roughness mask: Matte background substrate (`0.85`) vs. lustrous satin thread/details (`0.35 - 0.40`). |
| `04_height.png` | PNG-16/24/32 | `Linear / NoColorSpace` | Displacement / Bump map: Micro-elevation and geometric relief data (2mm domed puff + merrow). |
| `05_ambientOcclusion.png` | PNG-8/24/32 | `Linear / NoColorSpace` | Contact ambient occlusion in stitch crevices and base contours. |
| `06_beauty_render_4k.png` | PNG-32 (Alpha 100%) | `sRGB` | **2D Banner Exclusive**: 4K (`4096x2048`) front orthographic studio render with lighting + clean alpha cutout. |

### 3. Agent Workflow via ArtCraft MCP / CLI
* **Phase 1 (Mask Isolation)**: Read `viewBox` dimensions and export masks matching native aspect ratio (e.g., 2:1 ratio $\rightarrow$ `2048 x 1024` or `4096 x 2048`).
* **Phase 2 (MaterialCraft Graph)**: Build procedural substrate (woven fabric, leather, or synthetic base) and detail material (satin threads with anisotropic sheen). Export as `.mcmat` (`puffy_badge.mcmat`).
* **Phase 3 (TextureCraft Bake & Render)**: Apply `.mcmat` through extracted masks. Apply bevel/height displacement. Bake GPU maps (`normal`, `ambientOcclusion`, `curvature`). Execute `texturecraft-cli render <project.tcraft> 06_beauty_render_4k.png --samples 64` to produce `06_beauty_render_4k.png` with clean transparency.

### 4. Client Integration Specifications

#### 4.1. Three.js WebGL Runtime (`MattressAnatomy.ts` & `FloatingWoolPad.ts`)
1. **Geometry**:
   * Use `THREE.PlaneGeometry(width, height, segments, segments)` or `THREE.DecalGeometry`.
   * Maintain physical real-world metric dimensions (e.g., `0.12m x 0.06m` for 12cm x 6cm tags) placed flush at `0.001m` offset, calling `preparePBRGeometry(geometry)` for `uv2` and tangents.
   * **Do not use thick `BoxGeometry`** for flat surface tags/decals.
2. **Material Configuration (`THREE.MeshPhysicalMaterial`)**:
   ```ts
   import * as THREE from 'three';

   const loader = new THREE.TextureLoader();
   const baseColorMap = loader.load('/textures/badge/01_baseColor.png');
   baseColorMap.colorSpace = THREE.SRGBColorSpace;

   const normalMap = loader.load('/textures/badge/02_normal.png');
   normalMap.colorSpace = THREE.NoColorSpace;

   const roughnessMap = loader.load('/textures/badge/03_roughness.png');
   roughnessMap.colorSpace = THREE.NoColorSpace;

   const aoMap = loader.load('/textures/badge/05_ambientOcclusion.png');
   aoMap.colorSpace = THREE.NoColorSpace;

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
     transparent: true,
     alphaTest: 0.5,
   });
   ```

#### 4.2. Python 2D Banner Automation Pipeline (`scripts/badge_banner_compositor.py`)
* Ingest only `06_beauty_render_4k.png`.
* Downscale using `Image.Resampling.LANCZOS` for maximum clarity without aliasing.
* Generate dynamic contact drop shadow from the alpha mask using `ImageFilter.GaussianBlur` without degrading fabric grain.

### 5. Quality Gates & Acceptance Criteria (`shared_assets/lego/REGISTRY.json`)
Before registering any component into `shared_assets/lego/REGISTRY.json`, verify:
* **Aspect Ratio**: Output image dimensions strictly match vector `viewBox` ratio within `0.5%`.
* **Albedo Neutrality**: `01_baseColor.png` contains zero baked hard shadows or non-ambient lighting gradients.
* **Alpha Integrity**: `06_beauty_render_4k.png` has a fully transparent background outside component boundaries.
* **Registry Entry**: Component ID, source SVG path, physical scale (meters), and artifact paths are committed to `shared_assets/lego/REGISTRY.json`.
* **Build Gate**: `npx tsc --noEmit` (root and `webapp/tsconfig.json`) returns `0` errors.

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
