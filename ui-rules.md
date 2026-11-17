# UI & DESIGN SYSTEM RULES (FOR AI AGENTS / CLINE)
> **SUPREME MANDATE**: This project is a high-end WebGL 3D Showroom styled after Apple VisionOS / Cybernetic Minimalist design. Every UI dock, floating pill, and control menu MUST strictly adhere to this visual standard. NEVER bloat paddings, NEVER use square corners, and NEVER stack items vertically inside horizontal capsule sub-docks.

---

## 1. CSS MECHANISM & ARCHITECTURE RULES
- **Core Reality**: The UI controls (such as `BedroomConfiguratorDock.tsx`) use **scoped Native CSS files (`.css`)**, e.g., `BedroomConfiguratorDock.css`.
- **STRICT DIRECTIVES**:
  - DO NOT inject arbitrary Tailwind utility classes into components that import standalone `.css` files unless Tailwind processing is verified for that component.
  - ALWAYS reuse the pre-existing native class conventions already established in the CSS file:
    - Group Wrapper: `.bedroom-stepper-group`
    - Section Label: `.bedroom-stepper-label`
    - Button Track / Segment Container: `.bedroom-stepper-segments`
    - Segment Button: `.bedroom-stepper-btn`
  - Active / Selected State: Control states via semantic HTML attributes: `data-selected="true"` or `aria-pressed="true"`.

---

## 2. COLOR PALETTE & GLASSMORPHISM SPEC

| Component | Color / CSS Value | Visual Intent |
| :--- | :--- | :--- |
| **Dock Capsule Background** | `rgba(18, 20, 26, 0.82)` or `rgba(0, 0, 0, 0.75)` | Premium tinted dark acrylic glass (never flat solid grey) |
| **Backdrop Filter** | `backdrop-filter: blur(20px) saturate(160%)` | Smooth blurring of the underlying 3D WebGL scene |
| **Hairline Border** | `1px solid rgba(255, 255, 255, 0.12)` | Crisp, ultra-thin luminescent outer boundary |
| **Active Button (Selected)** | Background `#FFFFFF` (Pure White) \| Text `#000000` (Pitch Black) | High-contrast focal point (never muddy grey) |
| **Inactive Button (Unselected)** | Background `transparent` \| Text `rgba(255, 255, 255, 0.6)` \| Hover `#FFFFFF` | Recedes gracefully into the dark glass track |
| **Inner Segment Track** | `rgba(0, 0, 0, 0.40)` or `rgba(255, 255, 255, 0.05)` | Sunken dark pill track housing child options |
| **Active Toggle (ON)** | `rgba(16, 185, 129, 0.85)` or `#2D6A4F` (Emerald Green) | Compact active state for binary toggles (e.g. Runner: ON) |
| **Dividers** | `1px` wide, `rgba(255, 255, 255, 0.12)` | Subtle vertical separators between functional groups |

---

## 3. CORNER RADIUS & CAPSULE INVARIANT
- **EVERY BUTTON AND CONTAINER FOLLOWS THE "CAPSULE PILL" LAW**:
  - Corner radius: `border-radius: 9999px` (or `rounded-full`).
- **STRICT FORBIDDEN PATTERNS**:
  - NEVER use rectangular, boxy, or square corners (`rounded-none`, `rounded-sm`, `rounded-md`).
  - NEVER wrap a sub-group in an oversized rectangular bordered container box.

---

## 4. TYPOGRAPHY & MICRO-SIZING SPEC
In spatial 3D environments, text must remain crisp, restrained, and unobtrusive to viewport geometry:

- **Font Family**: Clean geometric modern sans-serif (`Inter`, `SF Pro Display`, `system-ui`).
- **Group Labels (e.g., "SET:", "MATTRESS:")**:
  - Font Size: `10px` – `11px`.
  - Font Weight: `500` or `600`, `letter-spacing: 0.05em`, `text-transform: uppercase`.
  - Color: `rgba(255, 255, 255, 0.5)`.
- **Segment Buttons (e.g., Cloud, Lux, Royal)**:
  - Font Size: `11px` – `12px` (STRICTLY FORBIDDEN: large 14px–16px fonts).
  - Font Weight: `500` (Inactive) / `600` (Active).
  - Button Height: Fixed `26px` (e.g., `h-[26px]`).
  - Button Internal Padding: `padding: 2px 10px` (or `px-2.5 py-1`).

---

## 5. SINGLE HORIZONTAL ROW INVARIANT
- **STRICTLY NO VERTICAL STACKING**:
  - Never place a label on top of buttons (`flex-col` is strictly prohibited in sub-docks).
  - All functional clusters: `[Label: Buttons] | [Label: Buttons] | [Toggle] | [Counter]` MUST line up along **ONE SINGLE HORIZONTAL ROW** (`display: inline-flex; align-items: center; gap: 8px;`).
- **Total Capsule Dock Height**: Locked between `40px` and `44px` (`h-10` to `h-11`). It must never bloat vertically to obscure the bed view.

---

## 6. CLICK HANDLING & STATE BINDING SAFEGUARDS
- Every button `onClick` must prevent unintended bubbling:
  ```tsx
  onClick={(e) => {
    e.stopPropagation();
    setMattress(variant);
  }}
  ```
- Always perform case-insensitive comparisons to prevent frozen button states:
  ```tsx
  const isSelected = String(activeMattress || '').toLowerCase() === variant.toLowerCase();
  ```
