# System Audit: UI Menus, Floating Controls & State Wiring
**Repository:** `puffy-ai-creative-engine`  
**Audit Scope:** `webapp/src/` (`components/canvas/`, `components/showroom/`, `components/ui/`, `store/`, `hooks/`)  
**Mode:** READ-ONLY AUDIT (Zero code modifications made)

---

### 1. INVENTORY OF ALL ACTIVE MENUS & CONTROLS (TABLE)

| Menu Component / Container | Target File & Line Range | UI Buttons / Elements Inside | Visibility Condition (When is it rendered?) |
| :--- | :--- | :--- | :--- |
| **Top-Left Spec & Ecosystem Badge** (`.canvas-top-badge`) | `webapp/src/components/canvas/puffy-hero-3d/PuffyFloatingHero3D.tsx:860-924` | • Kicker, Title, Subtitle readout<br>• Meadow mode: 3 Model pills (`Cloud`, `Lux`, `Royal`)<br>• Bedroom mode: 4 Archetype pills (`Japandi`, `Nordic`, `Mid-Century`, `Urban Loft`) | **Always in DOM**.<br>CSS hides during `introState === "IDLE"` or `"FLYING"`.<br>Model pills render when `currentEnvironment !== "bedroom"`; Archetype pills render when `currentEnvironment === "bedroom"`. |
| **Hero Collapsible Bottom Control Dock** (`.canvas-bottom-dock-wrapper`) | `webapp/src/components/canvas/puffy-hero-3d/PuffyFloatingHero3D.tsx:1293-1369` | • Dock collapse toggle (`▴ Show` / `▾ Hide 3D Controls`)<br>• `💥 Explode 10 Layers` / `📦 Assemble Mattress`<br>• `Reset Camera`<br>• `Layer Spec Tooltips`<br>• Camera Presets: `Tiny Planet 60°`, `Dolly Close-Up`, `Top-Down Cloud`<br>• `Press Wool Pad`<br>• `View in Bedroom (XR)` / `Return to Meadow` | **Always in DOM**.<br>CSS hides during intro (`data-intro-state` `IDLE`/`FLYING`).<br>⚠️ **Leaks into Bedroom & Layer Spec views** (no conditional unmount gate). |
| **Bedroom Staging Configurator Dock** (`<BedroomConfiguratorDock />`) | `webapp/src/components/ui/BedroomConfiguratorDock.tsx:189-309` mounted at `PuffyFloatingHero3D.tsx:1288-1290` | • Category bar: `Bedding`, `Lights`, `Garden`, `Walls`, Collapse/Expand chevron<br>• Drawer (Bedding): `Set` stepper (`Kyoto`, `Milan`, `Solace`), `Mattress` stepper (`Cloud`, `Lux`, `Royal`), `Runner` toggle (ON/OFF), `Pillows` stepper (`0`, `2`, `4`)<br>• Drawer (Lights): `Pendants` (ON/OFF), `Cloud Light` (ON/OFF)<br>• Drawer (Garden): `Zen Garden` (ON/OFF)<br>• Drawer (Walls): Empty / Dead tab | Rendered when `currentEnvironment === "bedroom"`.<br>Stacked above bottom dock (`bottomOffset={isDockCollapsed ? 68 : 104}`). |
| **Craft & Specs Lab Overlay** (`.reference-cutout-preview`) | `webapp/src/components/canvas/puffy-hero-3d/PuffyFloatingHero3D.tsx:938-1251` | • Header actions: `View 3D Slide-Out`, `Return to 3D Scene ✕`<br>• Layer Pill Strip: `‹`, `1..10` numbered tabs, `›`<br>• Live 3D Layer Cutaway Canvas (`LayerCutawayPreview3D`)<br>• Layer info card & benefit icons<br>• Lower Navy Action Bar: 3 Model stop buttons, Firmness snap slider (`0..2`), `Exploded View` toggle switch, `Reset View` button<br>• 4 Metric summary boxes | **Always in DOM**.<br>Toggled via `data-visible={isCraftLabVisible}` and `aria-hidden={!isCraftLabVisible}` when clicking `Layer Spec Tooltips`. |
| **Active-Layer Cutaway HUD Strip** (`.canvas-cutaway-10layer-hud`) | `webapp/src/components/canvas/puffy-hero-3d/PuffyFloatingHero3D.tsx:1262-1285` | • Label: `3D Slide-Out Layer:`<br>• Quick pill buttons `L1` through `L10` | **Always in DOM**.<br>Visible when `isExploded === true` (`data-visible`).<br>⚠️ **Collides with Bedroom Dock** if exploded in bedroom mode. |
| **Scene Capture & Cinematic Dock** (`<SceneCaptureDock />`) | `webapp/src/components/ui/SceneCaptureDock.tsx:46-124` mounted at `PuffyFloatingHero3D.tsx:765-784` | • Bottom-right floating pill: 📸 (Snapshot .webp), 🎬 (Record 360° tour .webm)<br>• Recording progress pill<br>• Pending snapshot modal: `Tải ảnh WebP`, `Mở trong Banner Studio ➜`, `Đóng` | Rendered whenever `introState !== "IDLE"`.<br>⚠️ **Visible across Meadow, Bedroom, and Craft Lab**. |
| **Intro Curtain & Failsafe CTAs** | `webapp/src/components/canvas/puffy-hero-3d/PuffyFloatingHero3D.tsx:787-857` | • `intro-enter-dream-cta`: `Chạm để bước vào giấc mơ · Enter the Dream`<br>• `intro-skip-pill`: `Bỏ qua / Skip`<br>• Morphing HUD interaction hints (Scroll / Drag to Orbit) | Rendered conditionally based on `introState === "IDLE"` or `"FLYING"`. |
| **Trust Badge Floating Overlay** (`.gallery-trust-overlay`) | `webapp/src/components/canvas/puffy-hero-3d/PuffyFloatingHero3D.tsx:927-935` | • Badge image & certification source text | Rendered only if `activeBadge` prop is provided. |
| **Standalone Bedroom Scene Viewport Dock** | `webapp/src/components/canvas/bedroom/BedroomSanctuaryScene.tsx:908-919` | • Secondary fallback `<BedroomConfiguratorDock bottomOffset={24} />`<br>• Secondary `<PuffyBedRunner />` | Rendered only when `<BedroomSanctuaryScene />` is mounted in standalone test mode (`!externalScene`). |
| **Showroom Global Header** (`<ShowroomHeader />`) | `webapp/src/components/showroom/ShowroomHeader.tsx:28-88` mounted at `App.tsx:40-44` | • Brand Logo & Kicker<br>• Navigation Tabs: `☁️ 3D Interactive`, `🖼️ 2D Campaign Renders`, `🎨 Banner Studio`<br>• Header Links: `Documentation` modal button, `GitHub Repo` link | **Always rendered** at top of `App.tsx` shell (`z-index: 100`). |
| **2D Campaign Gallery Filters & Lightbox** (`<ShowroomGallery2D />`) | `webapp/src/components/showroom/ShowroomGallery2D.tsx:205-343` | • Filter pills: `All Renders`, `Campaign Banners`, `Lifestyle Scenarios`, `4K PBR Macros`<br>• Lightbox modal: `Fit`, `100%`, `150%`, `200%` zoom pills, Close `✕` | Rendered when `activeTab === "campaign-renders"`. |

---

### 2. CONTROL WIRING & STATE DESTINATION (WHAT DRIVES WHAT?)

#### A. Controls Dispatching to Zustand Stores

1. **`useBedroomConfigStore` Mutations**:
   - **Curated Set Stepper** (`Kyoto (Zen)`, `Milan (Royal)`, `Solace (Warm)` in `BedroomConfiguratorDock.tsx:218`):
     - Dispatches: `applyCuratedSet(setId)`
     - Mutates: `activeMattress` (`'cloud' | 'royal' | 'lux'`) and `activeBedFrame` (`'kyoto' | 'milan' | 'solace'`).
     - Driven target: Caught by subscriber in `BedroomSanctuaryScene.tsx:617-665` $\rightarrow$ calls `mountBedFrameAndHeadboard(activeBedFrame)` and `applyMattressVariant(activeMattress)`.
   - **Mattress Stepper** (`Cloud`, `Lux`, `Royal` in `BedroomConfiguratorDock.tsx:246`):
     - Dispatches: `setMattress(variant)`
     - Mutates: `activeMattress`.
   - **Pillow Count Stepper** (`0`, `2`, `4` in `BedroomConfiguratorDock.tsx:160`):
     - Dispatches: `setPillowCount(count)`
     - Mutates: `pillowCount` and `activeItems['puffy-pillow-pair']`.
     - Driven target: Subscriber in `BedroomSanctuaryScene.tsx:642` calls `mountPillows(count)`.
   - **Toggles** (`Runner`, `Pendants`, `Cloud Light`, `Zen Garden` in `BedroomConfiguratorDock.tsx:181`):
     - Dispatches: `toggleItem(item.id)`
     - Mutates: `activeItems[item.id]`.
     - Driven target: Subscriber in `BedroomSanctuaryScene.tsx:634-662` mounts/unmounts `mountBedRunner()`, `mountPendantCluster()`, `mountCloudCeilingLight()`, `mountZenCourtyard()`.
   - **Dock Category Tabs** (`Bedding`, `Lights`, `Garden`, `Walls` in `BedroomConfiguratorDock.tsx:276`):
     - Dispatches: `setActiveCategory(cat.id)`, `toggleDockExpanded()`
     - Mutates: `activeCategory`, `isDockExpanded`.
   - **Top-Left Archetype Switcher** (`PuffyFloatingHero3D.tsx:688`):
     - Dispatches: `useBedroomConfigStore.getState().setEnvironment(style)`
     - Mutates: `activeEnvironment`.
   - **Top-Left Model Switcher** (`PuffyFloatingHero3D.tsx:639`):
     - Dispatches: `useBedroomConfigStore.getState().setMattress(modelKey)`
     - Mutates: `activeMattress`.

2. **`useShowroomViewStore` & `useBannerStore` Mutations**:
   - **"Mở trong Banner Studio ➜"** (`SceneCaptureDock.tsx:68`):
     - Dispatches: `useBannerStore.getState().setBackgroundImage(pendingSnapshot)` $\rightarrow$ mutates `backgroundImage`.
     - Dispatches: `useShowroomViewStore.getState().setActiveView("banner-studio")` $\rightarrow$ mutates `activeView`.
   - **Showroom Navigation Tabs** (`ShowroomHeader.tsx:61`):
     - Dispatches: `setActiveView(tab.id)` in `App.tsx:13` $\rightarrow$ mutates `activeView`.

---

#### B. Controls Directly Triggering Three.js Imperative Logic & GSAP

1. **`💥 Explode 10 Layers` / `📦 Assemble Mattress`** (`PuffyFloatingHero3D.tsx:1310`):
   - Invokes: `sceneModuleRef.current?.setExploded(nextExploded)`.
   - Internal target: `WoolMeadowSceneModule.ts` calls `FloatingWoolPad.setAllLayersExplodedStack(nextExploded, true)`, triggering GSAP vertical translation tweens across all 10 mesh layer groups.
2. **`Reset Camera`** (`PuffyFloatingHero3D.tsx:1320`):
   - Invokes: `sceneModuleRef.current?.resetCameraToDefault()`.
   - Internal target: GSAP tween animating `camera.position` back to `(3.4, 2.2, 4.0)` and `controls.target` to `(0, 0.45, 0)`.
3. **Camera Angle Preset Pills** (`PuffyFloatingHero3D.tsx:1342`):
   - Invokes: `sceneModuleRef.current?.setCameraPreset(preset)`.
   - Internal target: GSAP position tweens targeting `hero45` `(3.4, 2.2, 4.0)`, `dollyClose` `(1.6, 1.2, 1.9)`, or `topDown` `(0.01, 5.2, 0.01)`.
4. **`Press Wool Pad`** (`PuffyFloatingHero3D.tsx:1354`):
   - Invokes: `sceneModuleRef.current?.triggerCenterHandPress()`.
   - Internal target: Vertex wave distortion shader uniform / compression pulse on `FloatingWoolPad.ts`.
5. **`View in Bedroom (XR)` / `Return to Meadow`** (`PuffyFloatingHero3D.tsx:1362`):
   - Invokes: `sceneModuleRef.current?.setEnvironmentMode(nextMode)`.
   - Internal target:
     - When switching to `"bedroom"`: hides meadow terrain & flock (`sheepFlock.group.visible = false`), docks `FloatingWoolPad` statically onto slats at $y = 0.24\text{m}$, instantiates `createBedroomSanctuaryScene(...)`, and tweens camera to `(2.8, 1.8, 3.2)`.
     - When switching to `"meadow"`: disposes `bedroomSanctuary`, unhides `meadowTerrain` and `sheepFlock`, re-enables floating animation, and restores meadow camera pose.
6. **Layer Cutaway Pill HUD & Specs Lab Layer Tabs** (`PuffyFloatingHero3D.tsx:1023, 1279`):
   - Invokes: `sceneModuleRef.current?.setActiveLayerIndex(layerIndex)`.
   - Internal target: GSAP horizontal slide-out displacement ($+0.75\text{m}$ along $X$-axis) for the inspected layer mesh.
7. **`📸 Chụp ảnh` & `🎬 Quay video`** (`SceneCaptureDock.tsx:108, 118`):
   - Invokes: `capture.takeSnapshot` (synchronous WebGL buffer read to WebP) and `capture.recordCinematicTour` (binds `MediaRecorder` to canvas stream while `WoolMeadowSceneModule.startCinematicFlight` evaluates a spline path).

---

#### C. Dead Buttons, Mock State & Broken References

1. **Dead Tab: "Walls" in `BedroomConfiguratorDock.tsx:43`**:
   - `CATEGORY_META` registers `{ id: 'walls', label: 'Walls', alwaysShow: true }`.
   - However, **zero components in `BedroomRegistry.ts` are registered with `dockCategory: 'walls'`**.
   - When the user clicks the "Walls" tab, `categoryItems` is empty (`[]`) and `activeCategory === 'bedding'` is false. The drawer check `(categoryItems.length > 0 || activeCategory === 'bedding')` evaluates to false, causing the drawer to instantly collapse and render nothing.
2. **Dead Export: `ROOM_ENVIRONMENT_OPTIONS` in `BedroomConfiguratorDock.tsx:24-33`**:
   - Defines an array for `['japandi', 'nordic-coastal', 'mid-century', 'urban-loft']`.
   - **It is never imported or rendered inside `BedroomConfiguratorDock`**. It is dead code leftover from an incomplete migration.
3. **Ghost Runner Instance in `BedroomSanctuaryScene.tsx:912-917`**:
   - Inside the JSX return of `BedroomSanctuaryScene.tsx`, `<PuffyBedRunner />` is mounted directly in React.
   - However, in production mode, `BedroomSanctuaryScene` is created imperatively as a Three.js `Group` via `createBedroomSanctuaryScene()` inside `WoolMeadowSceneModule.ts:455`, which already mounts its own internal Three.js `BedThrowBlanket` (`throwBlanket = createBedThrowBlanket(...)`).
   - If `<BedroomSanctuaryScene />` is ever mounted as a JSX component, two bed runners are instantiated simultaneously.

---

### 3. THE "GHOST COUPLING" REPORT (WHY DO MENUS LEAK ACROSS SCENES?)

#### Defect 1: The Hero Bottom Dock Never Unmounts in Bedroom Mode
- **Exact Line**: `PuffyFloatingHero3D.tsx:1293-1369`
- **Cause**: The entire `.canvas-bottom-dock-wrapper` is rendered unconditionally. When `currentEnvironment === "bedroom"`, the code renders `<BedroomConfiguratorDock bottomOffset={isDockCollapsed ? 68 : 104} />` directly above it.
- **Why it leaks**: The Hero dock ("Explode 10 Layers", "Reset Camera", "Camera Presets", "Press Wool Pad") remains fully interactive underneath the Bedroom dock. The protocol directive (`docs/🛡️ THE BULLETPROOF UI DOCK PROTOCOL:20`) which specified:
  ```tsx
  if (activeScene !== 'meadow' || isLayerSpecOpen) return null;
  ```
  was never implemented as a conditional guard around `.canvas-bottom-dock-wrapper`.

#### Defect 2: Bottom Dock and Bedroom Dock Float Over the Specs Lab Overlay
- **Exact Line**: `PuffyFloatingHero3D.tsx:938` (`reference-cutout-preview`) vs lines `1288-1369` (Docks)
- **Cause**: In `PuffyFloatingHero3D.css:216`, `.reference-cutout-preview` is assigned `z-index: 11`. However:
  - `.canvas-bottom-dock-wrapper` has `z-index: 20` (`PuffyFloatingHero3D.css:1008`).
  - `.bedroom-config-dock-root` has `z-index: 32` (`BedroomConfiguratorDock.css:5`).
  - `<SceneCaptureDock />` has `z-index: 30` (`SceneCaptureDock.tsx:16`).
- **Why it leaks**: Because all docks have higher `z-index` than the overlay and lack conditional gates on `!isCraftLabVisible`, opening "Layer Spec Tooltips" leaves the Hero Dock, the Bedroom Dock, and the Camera Capture Pill floating on top of the cutaway diagram.

#### Defect 3: Active-Layer Cutaway HUD Collides with Bedroom Dock
- **Exact Line**: `PuffyFloatingHero3D.tsx:1262-1285`
- **Cause**: The Cutaway HUD strip (`.canvas-cutaway-10layer-hud`) is positioned at `bottom: 92px` (`PuffyFloatingHero3D.css:942`) and is gated only by `isExploded`.
- **Why it leaks**: If the user toggles "Explode" while in Bedroom mode, the Cutaway HUD strip renders at `bottom: 92px`, which sits directly on top of `BedroomConfiguratorDock` (`bottom: 104px`), creating unreadable overlapping text and blocked click targets.

#### Defect 4: Model Selection Is Duplicated Across 3 Distinct Menus
- **Locations**:
  1. Top-Left Badge (`PuffyFloatingHero3D.tsx:872-892`): `Cloud`, `Lux`, `Royal` pills.
  2. Specs Lab Lower Navy Panel (`PuffyFloatingHero3D.tsx:1148-1170` & `1176-1216`): Model stop buttons + Firmness slider.
  3. Bedroom Dock Drawer (`BedroomConfiguratorDock.tsx:234-254`): Mattress segment buttons (`Cloud`, `Lux`, `Royal`).
- **Cause**: No unified state machine dictates which tier owns model selection. In Bedroom mode, changing the model in the Bedroom Dock updates `useBedroomConfigStore`, while the Top-Left badge switches to Interior Archetypes, leaving two different controls modifying the mattress state without visual cohesion.

---

### 4. RECOMMENDATION FOR CLEAN STATE-MACHINE SEPARATION

#### A. Duplicated Elements to Eliminate or Consolidate
1. **Mattress Variant Selector**:
   - Currently in: Top-Left Badge, Specs Lab Lower Bar, and Bedroom Dock Bedding Drawer.
   - **Recommendation**: Retain in Top-Left Badge (as the master product selector) and inside the Specs Lab (as the technical firmness slider). Eliminate the secondary Mattress stepper in `BedroomConfiguratorDock.tsx:228-254`, letting the Curated Set buttons drive frame + mattress pairings.
2. **Camera Controls & Presets**:
   - Currently: Hero Dock contains both Explode, Camera Presets, and Scene XR toggle.
   - **Recommendation**: Camera controls (Reset Camera, Dolly, Tiny Planet) belong to a persistent viewport toolbar, not coupled with product layer exploding.
3. **Wall / Theme Selector**:
   - Currently: Top-Left badge renders Bedroom Archetypes, while Bedroom Dock renders a dead "Walls" tab.
   - **Recommendation**: Remove the dead "Walls" tab from `BedroomConfiguratorDock`. Consolidate all Archetype/Theme selection into the Top-Left badge or into a dedicated "Room Style" tab in the Bedroom Dock using the dormant `ROOM_ENVIRONMENT_OPTIONS`.

---

#### B. Proposed Minimal Component Boundary (State-Machine Gating)

```
                              ┌─────────────────────────────┐
                              │     GLOBAL SHARED TIER      │
                              │  - ShowroomHeader (Tabs)    │
                              │  - SceneCaptureDock (Cam)   │
                              │  - Top-Left Spec Badge      │
                              └──────────────┬──────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
       ┌─────────────────────────────┐               ┌─────────────────────────────┐
       │     MEADOW EXCLUSIVE        │               │      BEDROOM EXCLUSIVE      │
       │  (activeScene === 'meadow') │               │  (activeScene === 'bedroom')│
       ├─────────────────────────────┤               ├─────────────────────────────┤
       │ • Hero Bottom Control Dock: │               │ • BedroomConfiguratorDock:  │
       │   - Explode Layers Toggle   │               │   - Curated Set Pairing     │
       │   - Press Wool Pad (Zero-G) │               │   - Bed Runner Toggle       │
       │   - View in Bedroom (XR)    │               │   - Pillow Count Stepper    │
       │   - Layer Spec Tooltips     │               │   - Lighting Toggles        │
       │ • Cutaway HUD Strip (L1-10) │               │   - Zen Garden Toggle       │
       └──────────────┬──────────────┘               │   - Return to Meadow CTA    │
                      │                              └─────────────────────────────┘
                      ▼
       ┌─────────────────────────────┐
       │   SPEC OVERLAY EXCLUSIVE    │
       │    (isLayerSpecOpen)        │
       ├─────────────────────────────┤
       │ • Craft & Specs Lab Overlay │
       │   - 10-Layer Cutaway Canvas │
       │   - Technical Spec Strip    │
       │   - Firmness Snap Slider    │
       │ • (ALL bottom docks UNMOUNT)│
       └─────────────────────────────┘
```

#### Proposed Conditional Rendering Gates:

1. **In `PuffyFloatingHero3D.tsx` (Bottom Dock Wrapper)**:
   ```tsx
   {/* Unmount Hero Bottom Dock when in Bedroom XR mode OR when Craft Lab is open */}
   {currentEnvironment === "meadow" && !isCraftLabVisible && (
     <div className="canvas-bottom-dock-wrapper"> ... </div>
   )}
   ```
2. **In `PuffyFloatingHero3D.tsx` (Bedroom Configurator Dock)**:
   ```tsx
   {/* Mount Bedroom Dock strictly in Bedroom mode when Craft Lab is closed */}
   {currentEnvironment === "bedroom" && !isCraftLabVisible && (
     <BedroomConfiguratorDock bottomOffset={24} />
   )}
   ```
3. **In `PuffyFloatingHero3D.tsx` (Layer Cutaway HUD Strip)**:
   ```tsx
   {/* Cutaway HUD Strip only applies when exploded in Meadow mode without Craft Lab */}
   {currentEnvironment === "meadow" && isExploded && !isCraftLabVisible && (
     <div className="canvas-cutaway-10layer-hud"> ... </div>
   )}
   ```
4. **In `BedroomConfiguratorDock.tsx` (Scene Return Button)**:
   - Add a primary exit button: `"Return to Meadow ☁️"` directly inside the Bedroom Dock pill bar so the user can leave Bedroom mode without relying on the leaked Hero Dock.
5. **In `BedroomConfiguratorDock.tsx` (Dead Tab Cleanup)**:
   - Either populate the `"walls"` tab with `ROOM_ENVIRONMENT_OPTIONS` or remove `{ id: 'walls', label: 'Walls' }` from `CATEGORY_META` to eliminate the dead drawer state.