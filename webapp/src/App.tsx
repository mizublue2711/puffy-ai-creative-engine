import { useState } from "react";
import brandTokens from "@config/brand_tokens.json";
import mockMattress from "@assets/catalog/mattresses/puffy-lux-hybrid/cutout_angle45_1200x720.png";
import mockBedroom from "@assets/catalog/mattresses/puffy-lux-hybrid/hero_nordic-bedroom_1920x1080.png";
import puffyLogo from "@assets/logos/Puffy_Logo_0.svg";
import badgeCooling from "@assets/catalog/trust-badges/awards/badge_ad-best-cooling-2026_vector.svg";
import badgeHybrid from "@assets/catalog/trust-badges/awards/badge_ad-best-hybrid-2025_vector.svg";
import badgeFirm from "@assets/catalog/trust-badges/awards/badge_cnn-best-firm-2025_vector.svg";
import badgeEco from "@assets/catalog/trust-badges/awards/badge_theroundup-eco-mattress-2026_vector.svg";

type ViewportMode = "desktop" | "mobile";

interface TrustBadgeOption {
  id: string;
  label: string;
  sublabel: string;
  src: string;
}

const TRUST_BADGES: TrustBadgeOption[] = [
  {
    id: "ad_best_cooling_2026",
    label: "Best Cooling Mattress 2026",
    sublabel: "Architectural Digest",
    src: badgeCooling,
  },
  {
    id: "ad_best_hybrid_2025",
    label: "Best Hybrid Mattress 2025",
    sublabel: "Architectural Digest",
    src: badgeHybrid,
  },
  {
    id: "cnn_best_firm_2025",
    label: "Best Firm Support 2025",
    sublabel: "CNN Underscored",
    src: badgeFirm,
  },
  {
    id: "theroundup_eco_mattress_2026",
    label: "Top Eco Mattress 2026",
    sublabel: "TheRoundup",
    src: badgeEco,
  },
];

const VIEWPORT_WIDTHS: Record<ViewportMode, number> = {
  desktop: 1440,
  mobile: 390,
};

export function App() {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>(TRUST_BADGES[0].id);

  const activeBadge =
    TRUST_BADGES.find((item) => item.id === selectedBadgeId) ?? TRUST_BADGES[0];

  const isMobile = viewport === "mobile";
  const frameWidth = VIEWPORT_WIDTHS[viewport];
  const { colors, value_propositions: valueProps, logo_geometry: logoGeo } = brandTokens;

  return (
    <div className="sandbox-shell">
      <header className="sandbox-toolbar">
        <div className="toolbar-group">
          <h1 className="toolbar-title">
            {brandTokens.brand} Creative Engine — Interactive Sandbox
          </h1>
          <span className="drift-pill">Zero Product Drift · Mock Cutout Active</span>
        </div>

        <div className="toolbar-group">
          <div className="viewport-switcher" role="group" aria-label="Viewport Switcher">
            <button
              type="button"
              className={`viewport-btn ${viewport === "desktop" ? "active" : ""}`}
              onClick={() => setViewport("desktop")}
            >
              Desktop 1440px
            </button>
            <button
              type="button"
              className={`viewport-btn ${viewport === "mobile" ? "active" : ""}`}
              onClick={() => setViewport("mobile")}
            >
              Mobile 390px
            </button>
          </div>

          <select
            aria-label="Trust Badge Overlay"
            className="badge-select"
            value={selectedBadgeId}
            onChange={(e) => setSelectedBadgeId(e.target.value)}
          >
            {TRUST_BADGES.map((badge) => (
              <option key={badge.id} value={badge.id}>
                {badge.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="stage-outer">
        <div
          className="viewport-frame"
          style={{ width: `${frameWidth}px` }}
          data-viewport={viewport}
        >
          <div className="pdp-header">
            <div
              className="logo-clearspace"
              title={logoGeo.clear_space_rule}
              style={{ padding: `${logoGeo.minimum_clear_space_px}px` }}
            >
              <img
                src={puffyLogo}
                alt="Puffy"
                className="pdp-logo"
                style={{ minWidth: `${logoGeo.minimum_size.width_px}px` }}
              />
            </div>
            <div className="pdp-nav-meta">
              {valueProps.sleep_trial} · {valueProps.warranty}
            </div>
          </div>

          <section
            className={`hero-section ${isMobile ? "mobile" : "desktop"}`}
            style={{ backgroundImage: `url(${mockBedroom})` }}
          >
            <div className="hero-scrim" />
            <div className="hero-grid">
              <div>
                <div className="eyebrow">
                  {valueProps.aesthetic_tone_of_voice[0]} ·{" "}
                  {valueProps.aesthetic_tone_of_voice[3]}
                </div>
                <h2 className="hero-headline">
                  Sleep Like You&rsquo;re Floating on a Cloud
                </h2>
                <p className="hero-body">
                  {valueProps.craftsmanship.join(" · ")}. Crafted for pillowy volume
                  and effortless spinal alignment every night.
                </p>
                <div className="cta-cluster">
                  <a
                    href="#shop-puffy"
                    className="puffy-cta"
                    style={{
                      backgroundColor: colors.primary.ocean_teal.hex,
                      color: colors.primary.pure_white.hex,
                    }}
                  >
                    Shop Puffy Cloud
                  </a>
                </div>
              </div>

              <div className="product-stage">
                <img
                  src={mockMattress}
                  alt="Puffy Mattress Cutout"
                  className="mattress-cutout"
                />
                <div className="trust-overlay">
                  <img src={activeBadge.src} alt={activeBadge.label} />
                  <div className="trust-overlay-text">
                    <strong>{activeBadge.label}</strong>
                    <span>{activeBadge.sublabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={`value-strip ${isMobile ? "mobile" : "desktop"}`}>
            <div className="value-card">{valueProps.sleep_trial}</div>
            <div className="value-card">{valueProps.warranty}</div>
            <div className="value-card">{valueProps.craftsmanship[0]}</div>
            <div className="value-card">{valueProps.craftsmanship[1]}</div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
