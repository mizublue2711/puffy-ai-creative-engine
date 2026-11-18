# CENTRALIZED ASSET VAULT PIPELINE PROTOCOL (CAVP-v2.0)
**Universal Component Casting, Mesh Isolation & Multi-Target Asset Specification**  
*Applicable Targets: Interactive WebGL (Three.js), Craft Studio Pass B, and Automated 2D Graphics*

---

## 1. Executive Protocol Mandate & Scope

This protocol establishes the single, authoritative technical standard for authoring, registering, organizing, and consuming 3D and 2D brand assets across the repository. Every human engineer and AI worker (including autonomous agents, coding assistants, and sub-agents) must read and strictly adhere to this protocol before creating, exporting, editing, or referencing any logo, badge, textile material, or mattress component.

The protocol reconciles the demands of real-time WebGL rendering with high-resolution 2D marketing compositing by enforcing a dual-consumption pipeline. It guarantees zero visual distortion, deterministic file discovery, and instantaneous brand substitution without breaking runtime shader compilation.

---

## 2. Core Operating Principles

### 2.1. Vector as Immutable Geometric Truth
The input vector asset (`.svg`) serves as the immutable geometric definition of all brand typography, contours, and emblems.
* Autonomous agents and workers are strictly prohibited from redrawing, synthesizing, or approximating paths or fonts.
* Vector assets function strictly as alpha stencils and height drivers for procedural displacement, stitching generation, and material masking in MaterialCraft and TextureCraft.

### 2.2. Enforceable 2:1 Aspect Ratio (Anti-Distortion Standard)
Mattress badges and brand labels possess an inherent rectangular proportion.
* All texture maps and render outputs for rectangular decals must strictly adhere to a **2:1 aspect ratio** (e.g., $2048 \times 1024$ or $4096 \times 2048$).
* **Strict Prohibition**: Baking rectangular vector emblems into 1:1 square canvas textures (e.g., $2048 \times 2048$) is classified as a critical pipeline failure. Square textures force artists to artificially stretch UV coordinates in Three.js, causing isolated 2D extractions to appear squashed and disfigured.

### 2.3. PBR Albedo Safety Clamp (No Pure White)
Real-time physical lighting breaks when surface albedo reaches pure `#FFFFFF`.
* For any white embroidery, satin thread, or mattress quilting, maximum reflectance must be clamped between 80% and 85% (hexadecimal range: `#DCE4EC` to `#EDF2F7`).
* In Three.js material configurations, set `color: new THREE.Color('#E2E8F0')` and ensure `renderer.toneMapping = THREE.ACESFilmicToneMapping` with `toneMappingExposure = 1.0`.

---

## 3. Standard Output Artifact Package (6-File Contract)

To balance WebGL runtime lightweight efficiency with high-fidelity embroidery details, every badge or component cast via MaterialCraft or TextureCraft must output exactly six standardized files within its designated package:

| File Name | Format | Color Space | Pipeline Consumer & Operational Function |
| :--- | :--- | :--- | :--- |
| `01_baseColor.png` | PNG-32 (Alpha) | sRGB | Delit diffuse albedo. Mapped to Three.js `material.map`. Strictly zero baked cast shadows. |
| `02_normal.png` | PNG-24/32 | Linear | OpenGL Tangent Space Normal (+Y up). Recreates embossed bevels, micro-stitching, and textile relief. |
| `03_roughness.png` | PNG-8/24 (Grayscale) | Linear | Roughness distribution: Matte fabric base substrate versus lustrous satin sheen threads. |
| `04_height.png` | PNG-16/24 (Grayscale) | Linear | Micro-elevation height displacement map for procedural embossing depth. |
| `05_ambientOcclusion.png` | PNG-8/24 (Grayscale) | Linear | Contact ambient occlusion in embroidery crevices and stitch perimeters. |
| `06_beauty_render_4k.png` | PNG-32 (100% Alpha) | sRGB | **2D Banner & Slot Fallback**: 4K front orthographic master render with clean alpha transparency cutout. |

---

## 4. Centralized Directory Architecture & Mirror Protocol

Historical asset fragmentation—where files were scattered across ad-hoc directories—is permanently deprecated. The repository operates under a strict two-tier directory model: Master Vault vs. Webapp Public Mirror.

### 4.1. Master Vault (Source of Truth)
All source vectors, procedural `.mcmat` files, and raw 4K PBR texture stacks reside permanently in:
```
shared_assets/lego/components/<component_id>/
├── source.svg
├── material.mcmat
├── 01_baseColor.png
├── 02_normal.png
├── 03_roughness.png
├── 04_height.png
├── 05_ambientOcclusion.png
└── 06_beauty_render_4k.png
```

### 4.2. Webapp Public Mirror & Plug-and-Play Brand Slots
Web browsers cannot access files outside `webapp/public/`. Assets required by the runtime application must be mirrored into deterministic public slots:
* **Active Brand Decals**: `webapp/public/assets/branding/`
  * `badge_cloud.png`
  * `badge_lux.png`
  * `badge_royal.png`
* **WebGL PBR Textures**: `webapp/public/textures/badge/` (Stores the active 5-layer PBR maps for real-time Three.js rendering).

---

## 5. Three.js Runtime Integration & Mesh Isolation Protocol

To resolve the root cause of 3D capture failures (where Pass B returned empty images because the badge was baked into the mattress skin), the brand badge must exist as an independent, identifiable mesh element.

### 5.1. Geometric Construction & Precise Placement
1. **Geometry**: Use `THREE.PlaneGeometry(0.12, 0.06)` adhering to the physical metric dimensions ($12\text{ cm} \times 6\text{ cm}$) and the exact 2:1 ratio.
2. **Deterministic Mesh Naming**: The mesh must be assigned an immutable name:
   ```typescript
   badgeMesh.name = 'BrandBadgePlane';
   ```
3. **Offsetting**: Position the badge plane with an elevation delta of $+0.001\text{ m}$ ($1\text{ mm}$) along the outward normal of the mattress border. Enable `polygonOffset: true` and `polygonOffsetFactor: -1.0` in the material to eliminate Z-fighting.

### 5.2. Material Configuration
```typescript
const badgeMaterial = new THREE.MeshPhysicalMaterial({
  map: baseColorTexture,          // THREE.SRGBColorSpace
  normalMap: normalTexture,       // THREE.NoColorSpace
  normalScale: new THREE.Vector2(1.2, 1.2),
  roughnessMap: roughnessTexture, // THREE.NoColorSpace
  aoMap: aoTexture,               // THREE.NoColorSpace
  aoMapIntensity: 1.0,
  sheen: 1.0,                     // Microfiber thread scattering
  sheenRoughness: 0.4,
  sheenColor: new THREE.Color(0xffffff),
  transparent: true,
  polygonOffset: true,
  polygonOffsetFactor: -1.0
});
```

### 5.3. Synchronous Two-Pass Studio Capture Dock
When the user captures a perspective camera angle from the 3D bedroom:
1. **Pass A (Full Environment)**: Render the entire scene (room, lighting, mattress, linens).
2. **Pass B (Isolated 3D Badge Perspective)**:
   * Temporarily hide all scene meshes except `BrandBadgePlane` and its parent transformation nodes.
   * Retain active scene directional lights to maintain photorealistic specular reflection on the embroidery.
   * Set `renderer.setClearColor(0x000000, 0)` for complete alpha channel transparency.
   * Render with the active perspective camera: the resulting image captures the badge with authentic perspective foreshortening and orientation.
   * Restore all scene object visibilities immediately following capture.

---

## 6. Plug-and-Play Brand Slot Architecture (1-Minute Rebranding)

The application code must never hardcode specific brand model filenames. All components consume assets via a centralized registry abstraction.

### 6.1. Registry Contract (`brandConfig.ts`)
```typescript
export const BRAND_BADGE_SLOTS = {
  lux: '/assets/branding/badge_lux.png',
  cloud: '/assets/branding/badge_cloud.png',
  royal: '/assets/branding/badge_royal.png',
} as const;

export type MattressBrandVariant = keyof typeof BRAND_BADGE_SLOTS;

export const getBrandBadgeUrl = (variant: string = 'lux'): string => {
  const key = variant.toLowerCase() as MattressBrandVariant;
  return BRAND_BADGE_SLOTS[key] || BRAND_BADGE_SLOTS.lux;
};
```

### 6.2. 60-Second Brand Switching Procedure
To rebrand the entire 3D showroom and Craft Studio to an alternate manufacturer (e.g., Tempur, Casper):
1. Place the new brand's transparent 2:1 PNG renders into `webapp/public/assets/branding/` using the standard slot names (`badge_cloud.png`, `badge_lux.png`, `badge_royal.png`).
2. Refresh the browser. Both 3D Bedroom, camera capture, and Craft Studio automatically consume the updated brand identity without modifying application source code.

---

## 7. Texture Budget Quotas & Seamless Tiling Protocol

To prevent repository bloat, eliminate Git LFS threshold warnings (< 50 MB), and avoid GPU VRAM exhaustion on client browsers, repeating patterns must adhere to strict modular quotas:

| Component Class | Target Ratio | Master Resolution | Max File Size (.mcmat) | Max Packed Maps | Mandatory Metadata |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Class A: Micro-Weave & Tiling Fill** | 1:1 (Square) | $512 \times 512$ or $1024 \times 1024$ | $< 2.5\text{ MB}$ | $< 500\text{ KB}$ / map | `physical_unit_meters: [w, h]` |
| **Class B: Longitudinal Bands & Borders** | 4:1 or 2:1 (Strip) | $2048 \times 512$ or $2048 \times 1024$ | $< 6.0\text{ MB}$ | $< 1.0\text{ MB}$ / map | `physical_unit_meters: [w, h]` |
| **Class C: Decal Badges & Brand Patches** | 2:1 (Bounded) | $2048 \times 1024$ (Non-repeating) | $< 8.0\text{ MB}$ | $< 1.5\text{ MB}$ / map | `anchor_point`, `decal_scale` |
| **Class D: Straps & Vertical Handles** | 1:4 (Vertical) | $512 \times 2048$ | $< 4.0\text{ MB}$ | $< 800\text{ KB}$ / map | `physical_unit_meters: [w, h]` |

---

## 8. Production Prototype Lockdown & Safety Gateway

### 8.1. Frozen Mattress Prototypes
The core mattress models registered in `shared_assets/lego/REGISTRY.json` are frozen:
* **Cloud** (Puffy Cloud Mattress)
* **Lux** (Puffy Lux Hybrid)
* **Royal** (Puffy Royal Hybrid)

Their underlying internal 10-layer anatomy, primary geometries, and base mattress shaders are read-only production black boxes.

### 8.2. Zero-Tolerance Prohibitions
1. **No Geometry Deletion**: Do not decimate, deform, or delete the base mattress meshes.
2. **No Arbitrary Renaming**: Do not alter asset paths registered in `REGISTRY.json`.
3. **Escalation Protocol**: If an assigned task appears to require modifying locked mattress models, the agent must halt and request explicit user confirmation before proceeding.

---

## 9. Worker Pre-Flight Checklist & Acceptance Criteria

Before marking any asset casting, texture update, or UI integration task complete, the worker must verify every item:

| Verification Check | Pass Criteria | Verification Method |
| :--- | :--- | :--- |
| **Aspect Ratio Integrity** | Image dimensions strictly equal 2:1 ($W = 2H \pm 0.5\%$). | Inspection via image metadata / Node script. |
| **PBR Albedo Range** | Pure `#FFFFFF` is absent; maximum brightness $\le 85\%$. | Pixel histogram check on `01_baseColor.png`. |
| **6-File Package Completeness** | Exactly 6 files exist in `shared_assets/lego/components/<id>/`. | Directory listing check. |
| **Deterministic Mesh Name** | Badge mesh has `obj.name === 'BrandBadgePlane'`. | Scene graph inspection in Three.js runtime. |
| **Public Mirror Alignment** | Matching files are copied to `webapp/public/assets/branding/`. | Static asset file path check. |
| **Zero Build Regressions** | `npm --prefix webapp run build` passes with 0 TypeScript errors. | Terminal compilation execution. |
