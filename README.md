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
│   ├── raw_mattress/           # Original unsegmented / raw product inputs
│   ├── cutouts/                # Clean transparent PNG outputs (Zero Product Drift)
│   ├── catalog/                # Clean processed catalog assets
│   ├── environments/           # Generative AI bedroom plates (16:9, 1:1, 9:16)
│   ├── logos/                  # Brand logo assets
│   └── manifest.json           # Automated asset metadata & checksum manifest
├── pipelines/
│   ├── n8n/                    # Segmentation & ingestion workflows
│   └── remotion/               # Programmatic video composition root
├── webapp/                     # Interactive PDP & layout preview app
├── scripts/
│   ├── shadow_engine.py        # Triple-Layer Alpha Shadow Engine (Transparent PNG, NumPy + Pillow)
│   ├── grid_normalizer.py      # 75% Canonical Grid & 15% safe bottom-margin normalizer
│   ├── run_pipeline.py         # Unified 3-in-1 CLI runner + manifest updater
│   └── deployment-audit.sh     # Cache eviction, bundle hash & integrity verification
├── .github/workflows/
│   └── process_assets.yml      # Auto-process raw assets on commit via GitHub Actions
├── AGENT.md                    # Core operational guardrails & session rules
└── README.md                   # Architecture overview and multi-agent contract
```

## Python 3-in-1 Asset Pipeline

Run the pure-Python Zero-Drift pipeline (requires only `pillow` and `numpy`, no GPU):

```bash
# Process a single cutout PNG
python3 scripts/run_pipeline.py \
  --input assets/cutouts/mock_mattress.png \
  --output assets/catalog/processed/mock_mattress_hero.png

# Batch-process all raw inputs and update assets/manifest.json
python3 scripts/run_pipeline.py \
  --input assets/raw_mattress \
  --output assets/catalog/processed \
  --manifest assets/manifest.json \
  --json
```

## Kiến trúc mở rộng (Scalability Pitch)

- **Tầng 1 — Core Engine (Zero-Drift & Zero-Cost)**: Toàn bộ lõi xử lý ảnh (`scripts/shadow_engine.py`, `scripts/grid_normalizer.py`, `scripts/run_pipeline.py`) được viết bằng **Python thuần** (chỉ dùng `Pillow` + `NumPy`), đóng gói thành CLI chạy cục bộ hoặc tự động qua **GitHub Actions CI/CD** (`.github/workflows/process_assets.yml`). Thiết kế này đảm bảo tốc độ xử lý **`< 0.08s`/ảnh**, **chi phí `$0`** (không GPU, không API trả phí) và **Zero Product Drift** — tuyệt đối không làm trôi màu nệm, đường may hay cấu trúc sản phẩm.
- **Tầng 2 — Orchestration Ready (Docker / n8n / Dify)**: Các module Python được thiết kế tách biệt đầu vào/đầu ra và hỗ trợ xuất metadata JSON (`--json`), sẵn sàng đóng gói thành **Docker container / API microservice** để **n8n** gọi trực tiếp qua **Webhook** hoặc **Dify** điều phối khi Puffy cần mở rộng sang quy trình xuất bản **hàng nghìn biến thể creative tự động mỗi ngày**.

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
