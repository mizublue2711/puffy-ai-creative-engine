# AGENT.md — Operational Guardrails & Multi-Agent Governance

All human engineers and autonomous coding agents operating within `puffy-ai-creative-engine` must strictly adhere to the following four operational rules. Zero deviation is permitted.

---

## 1. Micro-Ticket Mandate
- **Execution Cap**: No single agent execution step or ticket may exceed **15–20 minutes**.
- **Atomic Decomposition**: Complex features, refactors, or pipeline integrations must be decomposed into small, verifiable atomic tickets stored in `.agent/tasks/` prior to implementation.
- **Single-Responsibility**: Each ticket must target one bounded concern (e.g., one schema, one component, one workflow stage) with explicit acceptance criteria.

---

## 2. Zero Product Drift Rule
- **100% Product Fidelity**: The physical geometry, quilting pattern, piping/stitching, and woven Puffy® badge of the mattress must remain **100% unaltered** across every creative output.
- **Generative AI Boundary**: Generative AI models are strictly restricted to generating or compositing **environmental backdrops** (`assets/environments/`) only.
- **Cutout Provenance**: Programmatic banners (`config/schemas/banner_task.schema.json`) and Remotion video compositions (`config/schemas/remotion_props.schema.json`) must reference verified transparent PNGs in `assets/cutouts/` accompanied by validated `cutout_metadata.schema.json` records.

---

## 3. Cache-Busting & Asset Audit
- **Mandatory Cache Eviction**: Every build and pre-deployment check must purge `node_modules/.vite` to prevent stale asset or token bundling.
- **Bundle Hash Verification**: Before any deployment, run `./scripts/deployment-audit.sh` to validate all JSON configurations/schemas and verify bundle hash mutation.
- **Brand Token Authority**: All colors, typography, logo clear-space rules (`30px` minimum clear space on each side, `0.83 inch` / `80px` minimum width), and value propositions must resolve directly from `config/brand_tokens.json`.

---

## 4. Fresh Session Protocol
- **Context Isolation**: Upon merging or completing an atomic ticket, context must be cleared and a **fresh session** initiated for the next ticket.
- **Handoff Discipline**: Persist only structured, deterministic handoff state in `.agent/tasks/` rather than carrying long conversational histories across tasks, preventing context poisoning and instruction drift.

- Here is the authoritative, unambiguous English directive formatted specifically for `Agent.md`. You can copy and paste this directly into your repository:

---

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

