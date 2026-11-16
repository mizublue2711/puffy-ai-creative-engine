import { useEffect, useState } from "react";
import { HeroSplitSection } from "./components/sections/HeroSplitSection";
import {
  ShowroomHeader,
  type ShowroomViewMode,
} from "./components/showroom/ShowroomHeader";
import { ShowroomGallery2D } from "./components/showroom/ShowroomGallery2D";

export function App() {
  const [activeView, setActiveView] = useState<ShowroomViewMode>("3d");
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isDocsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDocsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDocsOpen]);

  return (
    <div className="showroom-shell">
      <ShowroomHeader
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenDocs={() => setIsDocsOpen(true)}
      />

      <main className="showroom-stage">
        <div
          key={activeView}
          className="showroom-view-panel"
          data-view={activeView}
        >
          {activeView === "3d" ? (
            <HeroSplitSection />
          ) : (
            <ShowroomGallery2D />
          )}
        </div>
      </main>

      {isDocsOpen && (
        <div
          className="showroom-docs-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Showroom Documentation"
          onClick={() => setIsDocsOpen(false)}
        >
          <div
            className="showroom-docs-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="showroom-docs-header">
              <div>
                <p className="showroom-docs-kicker">CREATIVE LAB ARCHITECTURE</p>
                <h2 className="showroom-docs-title">
                  Puffy® Virtual Showroom Spec
                </h2>
              </div>
              <button
                type="button"
                className="showroom-docs-close"
                onClick={() => setIsDocsOpen(false)}
                aria-label="Close documentation"
              >
                ✕
              </button>
            </div>

            <div className="showroom-docs-body">
              <section className="showroom-docs-block">
                <h3>3D Interactive Mattress Canvas</h3>
                <p>
                  Built on Three.js WebGL2 with ACES Filmic tone mapping,
                  procedural HDR studio environment lighting, and 4K PBR maps
                  (BaseColor, Normal, Roughness, Height, AO, and anisotropic
                  Sheen) synthesized via MaterialCraft.
                </p>
                <ul>
                  <li>
                    <strong>Explode Layers:</strong> Separates all 10 internal
                    mattress layers for cutaway inspection.
                  </li>
                  <li>
                    <strong>Layer Spec Tooltips:</strong> Opens the interactive
                    10-layer engineering breakdown.
                  </li>
                  <li>
                    <strong>View in Bedroom (XR):</strong> Transitions from the
                    curved-horizon Wool Meadow into a full indoor Bedroom
                    Sanctuary.
                  </li>
                </ul>
              </section>

              <section className="showroom-docs-block">
                <h3>2D Campaign Banner Engine</h3>
                <p>
                  Multi-format editorial renders generated from{" "}
                  <code>pipelines/banner_engine/render.mjs</code> using
                  zero-drift shadowed cutouts across Desktop (1440×900), Square
                  (1080×1080), and Story (1080×1920) viewports.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
