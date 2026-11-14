# Puffy® AI Creative Engine

Programmatic creative pipeline, brand design token system, and interactive PDP/banner preview engine for **Puffy®**, built around strict **Zero Product Drift** guarantees.

## Repository Architecture

```text
.
├── .agent/
│   └── tasks/                  # Task inbox for multi-session handoffs
├── config/
│   ├── brand_tokens.json       # Canonical Puffy brand design tokens
│   └── schemas/                # JSON schemas for downstream pipelines
│       ├── banner_task.schema.json
│       ├── cutout_metadata.schema.json
│       └── remotion_props.schema.json
├── assets/
│   ├── raw_mattress/           # Original unsegmented product inputs
│   ├── cutouts/                # Clean transparent PNG outputs (Zero Product Drift)
│   ├── environments/           # Generative AI bedroom plates (16:9, 1:1, 9:16)
│   └── logos/                  # Brand logo assets
├── pipelines/
│   ├── n8n/                    # Segmentation & ingestion workflows
│   └── remotion/               # Programmatic video composition root
├── webapp/                     # Interactive PDP & layout preview app
├── scripts/
│   └── deployment-audit.sh     # Cache eviction, bundle hash & integrity verification
├── AGENT.md                    # Core operational guardrails & session rules
└── README.md                   # Architecture overview and multi-agent contract
```

## Multi-Agent Contract

1. **Design Token Authority**: All UI, banner, and video layers consume [`config/brand_tokens.json`](config/brand_tokens.json) (`Navy Ink #2B2F44`, `Pure White #FFFFFF`, `Warm Linen #E5E3DF`, `Ocean Teal #067A57`, `Onyx Black #333333`, `PT Serif`, `Mukta`).
2. **Schema Contracts**:
   - [`config/schemas/banner_task.schema.json`](config/schemas/banner_task.schema.json): Programmatic banner and PDP module payloads.
   - [`config/schemas/cutout_metadata.schema.json`](config/schemas/cutout_metadata.schema.json): Cutout provenance and Zero Product Drift verification.
   - [`config/schemas/remotion_props.schema.json`](config/schemas/remotion_props.schema.json): Remotion video composition input properties.
3. **Operational Governance**: All contributors and agents must follow [`AGENT.md`](AGENT.md) (Micro-Ticket Mandate, Zero Product Drift Rule, Cache-Busting & Asset Audit, Fresh Session Protocol).

## Verification

Run the deployment audit script to purge Vite caches and validate all configuration JSON files:

```bash
./scripts/deployment-audit.sh
```
