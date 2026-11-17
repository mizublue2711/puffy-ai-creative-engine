# UI & DESIGN SYSTEM PROTOCOL (UI-RULES.MD)
> **SUPREME MANDATE**: This project is a flagship WebGL 3D Spatial Showroom styled after Apple VisionOS and Cybernetic Minimalist design. Every UI dock, floating pill, modal, and HUD control menu MUST strictly adhere to this architectural and visual standard. Never bloat paddings, never use square corners on pills, never stack items vertically inside horizontal capsule sub-docks, and never compromise state wiring.

---

## 1. STRICT BOUNDARY & NON-NEGOTIABLE PROTOCOL RULES (THE IRON LAWS)

### 1.1. Pure Styling & Layout Only (No Logic Tampering)
- **Zero Logic Refactoring**: Do NOT touch, rename, rewrite, or refactor any event handler functions, Zustand stores, state declarations, Three.js scene code, rendering loops, or GSAP animation timelines.
- **Scope Isolation**: You are strictly constrained to visual attributes, CSS utility classes, inline styling, and JSX structural wrappers. If a task asks for UI restyling, touching application logic or 3D engine math is an immediate protocol violation.

### 1.2. Preserve 100% Wiring & Event Contracts
- **Preserve All Bindings**: Every single `onClick`, `onChange`, `onSubmit`, `type="button"`, `data-active`, `data-selected`, and semantic ARIA attribute must remain 100% intact.
- **Explicit Functional Whitelist**: Never disconnect or rename critical state bindings, including but not limited to:
  - `handleToggleExplode`
  - `handleResetCamera`
  - `handleSetCameraPreset`
  - `handleToggleBedroomMode`
  - `handleSelectEcoModel`
  - `setMattress`, `setBedFrame`, and active scene dispatchers.
- **Event Propagation Safety**: All interactive button handlers must preserve stopPropagation safeguards where present:
  ```tsx
  onClick={(e) => {
    e.stopPropagation();
    handlerFunction(payload);
  }}
  ```

### 1.3. Zero System Emojis (SVG Vector Line Art Only)
- **Strict Ban on Raw Emojis**: Eliminate all raw Unicode system emojis (e.g., 🎥, 🌲, 🛏️, 💥, 📦, ☁️, ⚙️, 🐑, 🔬). They look amateurish, render inconsistently across operating systems, and break high-end spatial aesthetics.
- **Mandatory SVG Standard**: Replace all icons with clean, brand-compliant SVG vector line art:
  - `stroke-width`: `1.5px` (or `1.25px` for micro-HUD indicators).
  - `viewBox`: `"0 0 24 24"`.
  - `fill`: `"none"`.
  - `stroke`: `"currentColor"`.
  - `stroke-linecap`: `"round"`.
  - `stroke-linejoin`: `"round"`.
  - Dimensions: `14px` x `14px` to `16px` x `16px` within docks and segmented capsules.

---

## 2. CSS MECHANISM & COMPONENT SCOPING

- **Recognize Component CSS Reality**: Components like `BedroomConfiguratorDock.tsx` use **scoped Native CSS (`.css`)**, e.g., `BedroomConfiguratorDock.css`.
- **Directives**:
  - DO NOT inject random utility classes that require an unverified Tailwind processor into native `.css`-scoped components.
  - ALWAYS inspect and reuse the established class naming convention:
    - Group Container: `.bedroom-stepper-group`
    - Section Label: `.bedroom-stepper-label`
    - Segment Track: `.bedroom-stepper-segments`
    - Segment Button: `.bedroom-stepper-btn`
  - Active/Selected State: Drive selections via semantic data attributes (`data-selected="true"`, `data-active="true"`, or `aria-pressed="true"`).

---

## 3. COLOR PALETTE & GLASSMORPHISM SPEC

| Component / Layer | Value / CSS Standard | Visual Intent |
| :--- | :--- | :--- |
| **Dock Capsule Background** | `rgba(18, 20, 26, 0.82)` or `rgba(0, 0, 0, 0.75)` | Tinted dark acrylic glass; never opaque or muddy solid grey |
| **Backdrop Filter** | `backdrop-filter: blur(20px) saturate(160%)` | Apple VisionOS optical refraction over the 3D scene |
| **Hairline Border** | `1px solid rgba(255, 255, 255, 0.12)` | Crisp, ultra-thin luminescent outer boundary |
| **Active Pill (Selected)** | Background `#FFFFFF` (Pure White) \| Text `#000000` | Highest contrast anchor; immediately visible |
| **Inactive Pill (Unselected)** | Background `transparent` \| Text `rgba(255, 255, 255, 0.6)` \| Hover `#FFFFFF` | Gracefully blends into the underlying dark acrylic |
| **Sunken Segment Track** | `rgba(0, 0, 0, 0.40)` or `rgba(255, 255, 255, 0.05)` | Recessed dark slot housing option buttons |
| **Active Accent / Toggle** | `rgba(16, 185, 129, 0.85)` or `#2D6A4F` (Emerald Green) | Compact active state for toggles (e.g. Runner: ON) |
| **Vertical Separator** | `1px` wide, `rgba(255, 255, 255, 0.12)` | Subtle hair dividers separating distinct functional groups |

---

## 4. CORNER RADIUS & CAPSULE INVARIANT

- **Capsule Law**: Every button, segmented pill, and dock enclosure follows `border-radius: 9999px` (or `rounded-full`).
- **FORBIDDEN PATTERNS**:
  - NEVER use rectangular, boxy, or square buttons (`rounded-none`, `rounded-sm`, `rounded-md`).
  - NEVER wrap child groups in standalone rectangular bordered boxes.

---

## 5. TYPOGRAPHY & MICRO-SIZING SPEC

- **Font Family**: Modern clean geometric sans-serif (`Inter`, `SF Pro Display`, `system-ui`).
- **Group Labels ("SET:", "MATTRESS:", "RUNNER:")**:
  - Font Size: `10px` – `11px`.
  - Weight & Tracking: `font-weight: 600`, `letter-spacing: 0.05em`, `text-transform: uppercase`.
  - Color: `rgba(255, 255, 255, 0.45)`.
- **Option Buttons (e.g., Cloud, Lux, Royal, Kyoto)**:
  - Font Size: `11px` – `12px` (STRICT BAN on oversized 14px–16px fonts).
  - Button Height: Fixed `26px` (e.g., `h-[26px]`).
  - Padding: `padding: 2px 10px` (or `px-2.5 py-1`).

---

## 6. SINGLE HORIZONTAL ROW INVARIANT

- **STRICTLY NO VERTICAL STACKING**:
  - Never place a label above buttons within sub-docks (`flex-col` is forbidden in horizontal controls).
  - All functional modules: `[Label: Buttons] | [Label: Buttons] | [Toggle] | [Counter]` MUST line up along **ONE SINGLE HORIZONTAL ROW** (`display: inline-flex; align-items: center; gap: 8px;`).
- **Capsule Dock Height**: Locked between `40px` and `44px` (`h-10` to `h-11`). It must never expand vertically to block canvas visibility.

---

## 7. SCENE-AWARE LIFECYCLE & DOM HYGIENE

- **Zero Zombie Docks**: Controls dedicated to a specific scene (such as `BedroomConfiguratorDock`) must NEVER linger when transitioning to other views (e.g., Meadow / Đồi Cừu or Layer Cutaway 3D Lab).
- **Safe Conditional Rendering**:
  ```tsx
  if (currentTab !== 'bedroom') {
    return null;
  }
  ```
- **State Normalization**: When matching active item variants, always apply safe case normalization:
  ```tsx
  const isSelected = String(activeState || '').toLowerCase() === variant.toLowerCase();
  ```
