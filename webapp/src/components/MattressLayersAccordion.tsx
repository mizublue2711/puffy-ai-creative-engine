import { useState } from "react";
import type { PdpLayer, ViewportMode } from "../types/pdp";

interface MattressLayersAccordionProps {
  layers: PdpLayer[];
  viewport: ViewportMode;
}

export function MattressLayersAccordion({
  layers,
  viewport,
}: MattressLayersAccordionProps) {
  const [activeLayerNumber, setActiveLayerNumber] = useState<number>(
    layers[0]?.layer_number ?? 1
  );
  const isMobile = viewport === "mobile";

  return (
    <section
      className={`layers-section ${isMobile ? "mobile" : "desktop"}`}
      aria-label="6-Layer Mattress Cross-Section"
    >
      <div className="layers-header">
        <span className="layers-eyebrow">Inside the 12&Prime; Hybrid Profile</span>
        <h2 className="layers-title">6-Layer Cloud &amp; Coil Architecture</h2>
        <p className="layers-subtitle">
          Select any layer in the cross-section or breakdown to inspect its
          cooling, pressure-relief, and spinal support engineering.
        </p>
      </div>

      <div className="layers-layout">
        <div className="layers-diagram-card">
          <div className="diagram-label-top">
            <span>Top Sleep Surface</span>
            <span>12.0&Prime; Total Profile</span>
          </div>

          <div
            className="layers-stack"
            role="listbox"
            aria-label="Interactive Mattress Cross-Section Diagram"
          >
            {layers.map((layer) => {
              const isActive = layer.layer_number === activeLayerNumber;
              const isCoils = layer.layer_number === 5;
              const isCover = layer.layer_number === 1;
              return (
                <button
                  key={layer.layer_number}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`diagram-layer layer-n-${layer.layer_number} ${
                    isActive ? "active" : ""
                  } ${isCoils ? "coils" : ""} ${isCover ? "cover" : ""}`}
                  onClick={() => setActiveLayerNumber(layer.layer_number)}
                >
                  <span className="diagram-layer-num">
                    0{layer.layer_number}
                  </span>
                  <span className="diagram-layer-name">{layer.name}</span>
                  <span className="diagram-layer-thickness">
                    {layer.thickness}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="diagram-label-bottom">
            <span>Foundational Base</span>
            <span>Zero-Sag Support</span>
          </div>
        </div>

        <div className="layers-accordion">
          {layers.map((layer) => {
            const isExpanded = layer.layer_number === activeLayerNumber;
            return (
              <div
                key={layer.layer_number}
                className={`accordion-item ${isExpanded ? "expanded" : ""}`}
              >
                <button
                  type="button"
                  className="accordion-trigger"
                  aria-expanded={isExpanded}
                  onClick={() => setActiveLayerNumber(layer.layer_number)}
                >
                  <div className="accordion-trigger-left">
                    <span className="accordion-index">
                      Layer {layer.layer_number}
                    </span>
                    <span className="accordion-name">{layer.name}</span>
                  </div>
                  <div className="accordion-trigger-right">
                    <span className="accordion-thickness">{layer.thickness}</span>
                    <span className="accordion-chevron" aria-hidden="true">
                      {isExpanded ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="accordion-panel">
                    <p className="accordion-summary">{layer.summary}</p>
                    <div className="accordion-benefit-pill">
                      <span className="benefit-dot" aria-hidden="true" />
                      <span>{layer.benefit}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
