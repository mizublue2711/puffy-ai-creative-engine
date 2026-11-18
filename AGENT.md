# AGENT.md — Operational Guardrails & Multi-Agent Governance
All human engineers and autonomous coding agents operating within `puffy-ai-creative-engine` must strictly adhere to the following operational rules. Zero deviation is permitted.

---

### 1. Micro-Ticket Mandate
* **Execution Cap**: No single agent execution step or ticket may exceed **15–20 minutes**.
* **Atomic Decomposition**: Complex features, refactors, or pipeline integrations must be decomposed into small, verifiable atomic tickets stored in `.agent/tasks/` prior to implementation.
* **Single-Responsibility**: Each ticket must target one bounded concern (e.g., one schema, one component, one workflow stage) with explicit acceptance criteria.

---

### 2. Zero Product Drift & Central Asset Vault Authority
* **100% Product Fidelity**: The physical geometry, quilting pattern, piping/stitching, and woven brand badge of the mattress must remain **100% unaltered** across every creative output.
* **Central Asset Authority**: All textures, PBR maps, and branding badges MUST comply with the rules established in `CENTRALIZED_ASSET_VAULT_PIPELINE_PROTOCOL.md`.
* **Generative AI Boundary**: Generative AI models are strictly restricted to generating or compositing **environmental backdrops** (`assets/environments/`) only.
* **Cutout Provenance**: Programmatic banners (`config/schemas/banner_task.schema.json`) and Remotion video compositions (`config/schemas/remotion_props.schema.json`) must reference verified transparent PNGs in `assets/cutouts/` accompanied by validated `cutout_metadata.schema.json` records.
* **Brand Token Authority**: All colors, typography, logo clear-space rules (minimum 30px clear space, 80px / 0.83 inch minimum width), and value propositions must resolve directly from `config/brand_tokens.json` and `webapp/src/config/brandConfig.ts`.

---

### 3. Production Mattress Prototype Lockdown (Summary Directive)
* **Status**: **LOCKED & IMMUTABLE (PRODUCTION-FROZEN)**.
* The core mattress prototypes (**Cloud**, **Lux**, **Royal**) registered in `shared_assets/lego/REGISTRY.json` are officially completed, approved, and frozen.
* **Strict Prohibitions**:
  1. **Do Not Modify Geometry/Meshes**: Never alter, optimize, decimate, subdivide, or deform the 3D meshes of Cloud, Lux, or Royal.
  2. **Do Not Modify Materials/Shaders**: Never alter color palettes, hex codes, PBR texture bindings, or shader parameters.
  3. **Do Not Overwrite or Rename Assets**: Never touch or rename files in `shared_assets/lego/components/`.
  4. **Do Not Alter Registry Bindings**: Coordinate anchors, UV placements, and scale factors are locked.
* **Stop-and-Ask Escalation**: If any task appears to require modifying these prototypes, immediately halt and request explicit user confirmation.
* 📖 **Full Technical Protocol & PBR Stack Contracts**: For detailed 6-file texture contracts, aspect ratio gates, and 3D mesh naming conventions (`BrandBadgePlane`), consult:
  👉 **`CENTRALIZED_ASSET_VAULT_PIPELINE_PROTOCOL.md`** (Mandatory pre-reading for all asset tasks).

---

### 4. Active 3D Runtimes & Anti-Ghost File Protocol
Never edit, delete, or assume file roles without reverse-tracing from the active scene graphs. The project maintains two verified active 3D viewports:
1. **Showroom Hero 3D Viewport**: `webapp/src/components/canvas/puffy-hero-3d/PuffyFloatingHero3D.tsx` -> `sceneModuleRef.current`
2. **Bedroom Sanctuary 3D Viewport**: `webapp/src/components/canvas/bedroom/BedroomSanctuaryScene.tsx` (Host of `SceneCaptureDock` and interactive mattress configurations).

**Mandatory Pre-Edit Verification**:
* Prove that any target mesh, light, or material actually exists in one of the two active Three.js scene graphs above.
* Output the exact file path and line number where the active object is instantiated before applying edits.
* Verify clean compilation with `npm --prefix webapp run build` after every modification. Zero tolerance for unmounted mock components or broken imports.

---

### 5. Mandatory UI Localization & Language Integrity
#### A. Default Language & Terminology
* **English (US) is the STRICT DEFAULT language** across the entire UI and codebase.
* All button labels, tooltips, modal headers, status indicators, and metrics must use professional American bedding and industrial design terminology (e.g., *"Explode 10 Layers"*, *"Assemble Mattress"*, *"Modern Bedroom Sanctuary"*, *"Composite Brand Logo"*).
* Never use clumsy or literal machine translations.

#### B. Zero Hardcoded Strings
* ❌ **FORBIDDEN**: Never hardcode raw string literals directly inside `.tsx`, `.jsx`, `.ts`, or template files (e.g., `<div>Phòng ngủ</div>` or `<span>Bóc 10 lớp</span>` will trigger a build rejection).
* ❌ **NO AD-HOC MIXED LANGUAGES**: Never introduce untranslated non-English strings into component templates.

#### C. Centralized i18n Workflow
Whenever adding, renaming, or refactoring ANY UI text string, all agents MUST register keys simultaneously in `webapp/src/i18n/translations.ts`:
```typescript
export const TRANSLATIONS = {
  en: {
    featureAction: "Composite Brand Logo",
  },
  vi: {
    featureAction: "Ghép Logo Thương Hiệu",
  }
} as const;
```
* **Component Consumption**: Always reference strings dynamically via the hook:
  ```tsx
  const { t } = useLanguage();
  return <button>{t('featureAction')}</button>;
  ```
* **Pre-Completion Audit**: Verify that toggling between EN and VI switches 100% of visible labels with zero missing keys, raw fallbacks, or layout distortion.

---

### 6. Cache-Busting & Fresh Session Protocol
* **Mandatory Cache Eviction**: Every build and pre-deployment check must purge `node_modules/.vite` to prevent stale asset or token bundling.
* **Bundle Hash Verification**: Before deployment, run `./scripts/deployment-audit.sh` to validate all JSON schemas and verify bundle hash mutation.
* **Context Isolation**: Upon merging or completing an atomic ticket, context must be cleared and a fresh session initiated for the next task.
* **Handoff Discipline**: Persist only structured, deterministic handoff state in `.agent/tasks/` rather than carrying bloated conversational history, preventing instruction drift and context poisoning.
