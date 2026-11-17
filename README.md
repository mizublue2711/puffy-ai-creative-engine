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
QUAN TRỌNG!!!
SƠ ĐỒ ĐIỀU KHIỂN CÁC TẦNG MENU (MENU CONTROL HIERARCHY)

[ TẦNG 0: GLOBAL APP NAVBAR ] (ShowroomHeader.tsx)
  │  Mục đích: Điều hướng cấp cao nhất của toàn bộ Webapp
  │  Nút điều khiển: [ ☁ 3D Interactive ] | [ 🖼 2D Campaign Renders ] | [ 🎨 Banner Studio ]
  │
  ├──► Nếu chọn "2D Campaign Renders" ──► Mở [ShowroomGallery2D.tsx] (Xem ảnh banner, 4K PBR, zoom lightbox)
  │
  └──► Nếu chọn "3D Interactive" ───────► Mở KHÔNG GIAN 3D TỔNG THỂ
            │
            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      TẦNG 1: SPATIAL SCENE ROUTER & TRANSITION                         │
│                                                                                        │
│   [ TRẠNG THÁI A: MEADOW / HERO 3D ]         [ TRẠNG THÁI B: BEDROOM SANCTUARY ]       │
│   (PuffyFloatingHero3D.tsx)                   (BedroomSanctuaryScene.tsx)              │
│   - Đồi cỏ & đàn cừu (SheepFlockEngine)       - Phòng ngủ kiến trúc Nhật/Bắc Âu        │
│   - Tấm đệm mút nổi (FloatingWoolPad)         - Sàn gỗ, rèm cửa, thảm, tranh tường     │
│   - IntroSequence (Mây bay lướt)              - Khung giường, gối, đèn chùm, khăn      │
└──────────────────────────┬─────────────────────────────────┬───────────────────────────┘
                           │                                 │
                           ▼                                 ▼
┌──────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│       MENU ĐIỀU KHIỂN TẦNG HERO 3D       │   │      MENU ĐIỀU KHIỂN TẦNG PHÒNG NGỦ     │
│       (PuffyFloatingHero3D.tsx)          │   │      (BedroomConfiguratorDock.tsx)      │
├──────────────────────────────────────────┤   ├─────────────────────────────────────────┤
│ 1. Product Switcher:                     │   │ 1. Bed Frame Selector:                  │
│    • Cloud | Lux | Royal                 │   │    • Kyoto (gỗ thấp kiểu Nhật)          │
│    -> Đổi lõi mút và độ dày đệm          │   │    • Milan (bọc đệm cao cấp)            │
│ 2. Explode / Assemble CTA:               │   │    • Solace (tối giản hiện đại)         │
│    • Bung 10 lớp ruột đệm (GSAP)         │   │ 2. Pillow Count:                        │
│ 3. Camera Angle Selector:                │   │    • 0 | 2 | 4 chiếc gối                │
│    • Hero 45° | Top-Down | Dolly         │   │ 3. Runner Accessory:                    │
│ 4. Scene Transition Button:              │   │    • Bật/Tắt khăn Bed Runner            │
│    • "Enter Bedroom" -> Kích hoạt mây    │   │ 4. Environment Style:                   │
│      bay lướt và đáp xuống phòng ngủ     │   │    • Japandi | Nordic | Mid-Cent | Urban│
└──────────────────────────────────────────┘   └─────────────────────────────────────────┘
                           │                                 │
                           ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        TẦNG 2: STATE & LOGIC LAYER (STORE)                             │
│                              (useBedroomConfigStore.ts)                                │
│                                                                                        │
│   Lưu trữ trạng thái toàn cục:                                                        │
│   - `activeMattress`: 'cloud' | 'lux' | 'royal'                                        │
│   - `activeBedFrame`: 'kyoto' | 'milan' | 'solace'                                     │
│   - `activeEnvironment`: 'japandi' | 'nordic' | 'mid-century' | 'urban'                │
│   - `activeItems`: { 'puffy-bed-runner': boolean, 'puffy-pillow-pair': boolean, ... }   │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   TẦNG 3: ENGINE NỘI SUY ĐỒ HỌA 3D (THREE.JS / GSAP)                   │
│                                                                                        │
│   - Dynamic Crown Calculation: getMountedMattressCrownY()                              │
│   - GSAP Material Tweens: updateBedRunnerTheme(), Room boundary color palette          │
│   - Three.js Imperative Mesh: Mattress, Pillows, Bed Frame, Runner, Curtains           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
