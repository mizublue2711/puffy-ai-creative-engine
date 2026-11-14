# RUNBOOK_HOTFIXES.md — Operational Edge-Cases & Rendering Hotfixes

> Living operational runbook for `puffy-ai-creative-engine`.
> Record real-world pipeline failures, image-compositing edge cases, and verified hotfixes here so agents can diagnose regressions without bloating [`AGENT.md`](../AGENT.md).

---

## HF-001: 360-Degree Black Halo Around Mattress Top & Sides ("Viền đen 360 độ")

- **Affected Component**: [`scripts/shadow_engine.py`](../scripts/shadow_engine.py)
- **Symptom**: Processed product images exhibit a dark fuzzy halo around the top edge and upper side walls of the mattress instead of a clean studio white top with floor-only grounding.
- **Root Cause**:
  1. Extracting the **full** RGBA alpha mask (`alpha_full`) and applying `GaussianBlur(radius=18)` with only a small vertical offset (`+8px`) causes the blurred silhouette to bleed `10–15px` above the top edge and past both sides.
  2. In studio lighting, overhead/front key lights keep the top and upper edges crisp and bright; shadows exist only on the floor contact plane.
- **Hotfix**:
  - **Bottom-Only Alpha Mask**: Zero out the top `80%` of the product alpha mask (`cutoff_line = int(target_h * 0.80)`) and apply a smooth linear gradient ramp across the bottom `20%`.
  - **Perspective Squish**: Stretch width `+6%` (`target_w * 1.06`) and compress height to `35%` (`target_h * 0.35`) for the cast shadow to match a horizontal floor plane.
  - **Dual-Layer Grounding**:
    - Layer 1 (Contact Shadow): `bottom_alpha * 0.85`, `(10, 12, 18, 255)`, `GaussianBlur(radius=2)`.
    - Layer 2 (Perspective Cast Shadow): `bottom_alpha * 0.40`, `(25, 28, 38, 255)`, `GaussianBlur(radius=16)`, anchored at `pos_y + target_h - int(shadow_h * 0.55)`.

---

## HF-002: Rectangular Shadow Clipping & Bottom Canvas Overflow ("Cắt cụt bóng")

- **Affected Component**: [`scripts/shadow_engine.py`](../scripts/shadow_engine.py), [`scripts/grid_normalizer.py`](../scripts/grid_normalizer.py)
- **Symptom**: Soft drop shadows terminate abruptly in a hard rectangular box or get clipped at the bottom edge of the `1024x1024` canvas.
- **Root Cause**:
  1. **Pipeline Order Violation**: Cropping or fitting to the 75% grid *after* generating shadows strips away outer blur pixels.
  2. **Tight Layer Bounds**: Creating the shadow layer at `product_resized.size` (or `(shadow_w, shadow_h)`) and calling `GaussianBlur` directly clips the blur kernel at the layer's own bounding box.
  3. **Insufficient Bottom Margin**: Anchoring too close to the canvas bottom causes the blur radius + vertical offset to exceed `canvas_h`.
- **Hotfix**:
  - Enforce the **Pipeline Golden Rule**: `Cutout -> Fit 75% Grid -> Reserve 15% Safe Bottom Margin -> Render Padded Shadows -> Never Crop After`.
  - Use `_blur_with_padding(layer, blur_radius)` (`pad = max(4, blur_radius * 3)`) before every `GaussianBlur` call and offset `paste()` coordinates by `(-pad, -pad)`.
  - Maintain `bottom_margin_ratio=0.15` in [`scripts/grid_normalizer.py`](../scripts/grid_normalizer.py).

---

## HF-003: `canvas_size` Tuple Arithmetic & `argparse` `%` Formatting Crash

- **Affected Component**: [`scripts/shadow_engine.py`](../scripts/shadow_engine.py), [`scripts/grid_normalizer.py`](../scripts/grid_normalizer.py), [`scripts/run_pipeline.py`](../scripts/run_pipeline.py)
- **Symptom**:
  - `TypeError: can't multiply sequence by non-int of type 'float'` when `canvas_size=(1024, 1024)` is multiplied by `0.75`.
  - `ValueError: badly formed help string` in Python `argparse` when `help="..."` contains an unescaped `%` (e.g., `75%`).
- **Hotfix**:
  - Always normalize `canvas_size` through `resolve_canvas_size(canvas_size) -> (canvas_w, canvas_h)` before arithmetic.
  - Escape literal percent signs in `argparse` `help` strings as `%%` (e.g., `75%%`).

---

## HF-004: White-Canvas Shadow Lock-In Blocking Multi-Background Compositing

- **Affected Component**: [`scripts/shadow_engine.py`](../scripts/shadow_engine.py)
- **Symptom**: Baking shadows onto an opaque white `(255, 255, 255, 255)` canvas prevents downstream PDP banners, Remotion video compositions, and bedroom environment plates from compositing the shadowed mattress cleanly over non-white backgrounds.
- **Hotfix (`export_puffy_transparent_with_shadow`)**:
  - Initialize a 100% transparent RGBA canvas `(0, 0, 0, 0)` and composite all layers with `alpha_composite()`.
  - Use a **Triple-Layer Alpha Shadow** with a `** 1.5` power ramp on the bottom `20%` mask:
    1. **Contact Occlusion**: `alpha * 0.95`, `(5, 5, 8, 255)`, `GaussianBlur(1.5)`
    2. **Ground Cast**: `alpha * 0.68`, `(12, 14, 20, 255)`, `1.08x` width × `0.28x` height, `GaussianBlur(8)`
    3. **Ambient Soft Falloff**: `alpha * 0.38`, `(20, 22, 30, 255)`, `1.15x` width × `0.35x` height, `GaussianBlur(20)`
  - Export with `canvas.save(output_png_path, "PNG", optimize=True)`.

---

## HF-005: Floating Mattress Gap Between Base & Shadow ("Khoảng hở 15–25px / bay lơ lửng")

- **Affected Component**: [`scripts/shadow_engine.py`](../scripts/shadow_engine.py)
- **Symptom**: A visible `15–25px` light gap separates the bottom edge of the mattress from the cast shadow, making the product appear to float.
- **Root Cause**:
  1. When `cast_raw` and `amb_raw` were created at full `target_h` (with the top `75–80%` set to `alpha=0`) and then resized to `(cast_w, cast_h)`, the transparent upper `75–80%` remained inside `cast_h`/`amb_h`, pushing the visible shadow pixels well below `bottom_y`.
  2. `Contact Occlusion` needed tighter bottom weighting (`25%` band with `** 1.8` power ramp) and `+2px` downward overlap at `bottom_y` to lock the seam.
- **Hotfix (`export_puffy_grounded_transparent`)**:
  - Crop `active_band = alpha_full[cutoff:target_h, :] * ramp` (`cutoff = int(target_h * 0.75)`, `power = 1.8`) **before** resizing `cast_raw` (`1.05x` width × `0.22x` height, `blur=7`, `alpha * 0.75`) and `amb_raw` (`1.12x` width × `0.30x` height, `blur=18`, `alpha * 0.40`).
  - Anchor all layers directly to `bottom_y = pos_y + target_h`:
    - `amb_y = bottom_y - int(amb_h * 0.45)`
    - `cast_y = bottom_y - int(cast_h * 0.55)`
    - `occ_y = pos_y + 2` (`alpha * 0.98`, `blur=1.5`)

---

## HF-006: Stair-Step Shadow Banding Between Cast & Ambient Layers ("Gờ giả / bậc thang")

- **Affected Component**: [`scripts/shadow_engine.py`](../scripts/shadow_engine.py)
- **Symptom**: Overlapping discrete `Ground Cast` (`blur=7`) and `Ambient` (`blur=18`) ellipses produces a visible inner ridge ("bậc thang") instead of a smooth studio floor gradient.
- **Hotfix (`export_puffy_realistic_ground_shadow`)**:
  - Replace the two outer discrete layers with a **Single Unified Decay Ground Map** (`_build_unified_ground_map`) computed with vectorized NumPy:
    - Vertical power falloff: `(1 - y / shadow_h) ** 2.2`
    - Horizontal superellipse falloff: `1 - (dist_x / half_span) ** 4.0` inside `half_span`, tapering quadratically outside.
    - Max alpha capped at `115` (`~0.45`) with `GaussianBlur(radius=22)` (padded) and tucked `6px` under `bottom_y` (`shadow_y = bottom_y - 6`).
  - Keep a crisp **Contact Occlusion** seam (`bottom 18%`, `power=2.0`, `alpha * 0.95`, `GaussianBlur(1.8)`) at `(pos_x, pos_y + 1)` with `bottom_margin_ratio=0.16`.

---

## HF-007: Flat Slab Shadow Applied to Multi-Leg Bed Frames / Adjustable Bases

- **Affected Component**: [`scripts/shadow_engine.py`](../scripts/shadow_engine.py)
- **Symptom**: Applying a continuous linear flat-slab shadow across the entire width of a legged bed frame or adjustable base fills the empty air gaps *between* the legs with a solid dark block.
- **Hotfix (`export_puffy_adaptive_shadow`)**:
  - Scan the bottom `5%` alpha slice (`alpha[int(target_h * 0.95):, :]`) and count rising-edge transitions (`leg_count`) across columns where `alpha > 50`.
  - **Scenario A (`leg_count >= 2` — Multi-Leg / Adjustable Base)**:
    - Apply **Leg Contact Occlusion** (`bottom 15%`, `alpha * 0.95`, `GaussianBlur(2)`) so only the leg feet get crisp floor contact without creating a top-edge halo.
    - Add a soft **Underbed Ambient** ellipse (`0.92 * target_w × 0.12 * canvas_h`, max alpha `85`, `GaussianBlur(16)`) positioned at `bottom_y - int(underbed_h * 0.85)`.
  - **Scenario B (`leg_count < 2` — Flat Mattress / Floor-Hugging Frame)**:
    - Apply **Linear Flat Slab** ground shadow (`overhang = 4%`, `shadow_h = 16%`, `GaussianBlur(20)`) + tight `15%` bottom contact occlusion (`power=1.8`, `GaussianBlur(1.8)`).
