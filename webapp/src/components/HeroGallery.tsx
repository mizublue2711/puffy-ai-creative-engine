import { useState } from "react";
import mockMattress from "@assets/cutouts/mock_mattress.png";
import mockBedroom from "@assets/environments/mock_bedroom_nordic.png";
import type { PdpGalleryItem, ViewportMode } from "../types/pdp";

interface ActiveTrustOverlay {
  label: string;
  source: string;
  src: string;
}

interface HeroGalleryProps {
  gallery: PdpGalleryItem[];
  viewport: ViewportMode;
  activeBadge?: ActiveTrustOverlay;
}

export function HeroGallery({
  gallery,
  viewport,
  activeBadge,
}: HeroGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const activeItem = gallery[activeIndex] ?? gallery[0];
  const isLifestyle = activeItem?.view_type === "lifestyle";
  const isMobile = viewport === "mobile";

  return (
    <div className={`hero-gallery ${isMobile ? "mobile" : "desktop"}`}>
      <div className="gallery-stage">
        <div
          className={`gallery-backdrop-nordic ${isLifestyle ? "visible" : ""}`}
          style={{ backgroundImage: `url(${mockBedroom})` }}
          aria-hidden="true"
        />
        <div
          className={`gallery-backdrop-studio ${!isLifestyle ? "visible" : ""}`}
          aria-hidden="true"
        />

        <div className="gallery-cutout-wrap">
          <div
            className={`mattress-contact-shadow ${isLifestyle ? "lifestyle" : "studio"}`}
            aria-hidden="true"
          />
          <img
            src={mockMattress}
            alt={activeItem?.alt ?? "Puffy Lux Hybrid Mattress unaltered studio cutout"}
            className={`gallery-mattress-cutout ${isLifestyle ? "lifestyle" : "studio"}`}
          />
        </div>

        <div className="gallery-drift-badge">
          <span className="drift-dot" aria-hidden="true" />
          <span>Zero Product Drift</span>
        </div>

        {activeBadge && (
          <div className="gallery-trust-overlay">
            <img src={activeBadge.src} alt={activeBadge.label} />
            <div className="gallery-trust-text">
              <strong>{activeBadge.label}</strong>
              <span>{activeBadge.source}</span>
            </div>
          </div>
        )}
      </div>

      <div className="gallery-controls">
        <div className="gallery-switcher" role="tablist" aria-label="Product View Angle">
          {gallery.map((item, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`gallery-tab-btn ${isSelected ? "active" : ""}`}
                onClick={() => setActiveIndex(idx)}
              >
                <span className="gallery-tab-thumb">
                  <img
                    src={item.view_type === "lifestyle" ? mockBedroom : mockMattress}
                    alt=""
                  />
                </span>
                <span className="gallery-tab-label">{item.label}</span>
              </button>
            );
          })}
        </div>
        <p className="gallery-caption">{activeItem?.caption}</p>
      </div>
    </div>
  );
}
