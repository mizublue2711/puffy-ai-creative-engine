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
