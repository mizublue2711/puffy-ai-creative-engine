import { useState } from "react";
import brandTokens from "@config/brand_tokens.json";
import pdpJson from "./data/mock_pdp_puffy_lux.json";
import puffyLogo from "@assets/logos/Puffy_Logo_0.svg";
import badgeCnnFirm from "@assets/badges/cnn_best_firm_2025.svg";
import badgeAdCooling from "@assets/badges/ad_best_cooling_2026.svg";
import badgeConsumerLuxury from "@assets/badges/consumer_mattress_luxury_2027.svg";
import badgeEcoTrial from "@assets/badges/theroundup_eco_mattress_2026.svg";
import badgeAdHybrid from "@assets/badges/ad_best_hybrid_2025.svg";
import { AnnouncementBar } from "./components/AnnouncementBar";
import { HeroGallery } from "./components/HeroGallery";
import { ProductConfigurator } from "./components/ProductConfigurator";
import { TrustProofRibbon } from "./components/TrustProofRibbon";
import { MattressLayersAccordion } from "./components/MattressLayersAccordion";
import { StickyMobileCTA } from "./components/StickyMobileCTA";
import type { PdpData, PdpVariant, ViewportMode } from "./types/pdp";

const pdpData = pdpJson as PdpData;

const BADGE_ASSET_MAP: Record<string, string> = {
  cnn_best_firm_2025: badgeCnnFirm,
  ad_best_cooling_2026: badgeAdCooling,
  consumer_mattress_luxury_2027: badgeConsumerLuxury,
  theroundup_eco_mattress_2026: badgeEcoTrial,
  ad_best_hybrid_2025: badgeAdHybrid,
};

const VIEWPORT_WIDTHS: Record<ViewportMode, number> = {
  desktop: 1440,
  mobile: 390,
};

export function App() {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const defaultVariant =
    pdpData.variants.find((v) => v.is_default) ?? pdpData.variants[0];
  const [selectedVariant, setSelectedVariant] =
    useState<PdpVariant>(defaultVariant);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>(
    pdpData.trust_badges[0]?.id ?? "cnn-firm"
  );
  const [addedToCart, setAddedToCart] = useState<boolean>(false);

  const activeBadgeData =
    pdpData.trust_badges.find((b) => b.id === selectedBadgeId) ??
    pdpData.trust_badges[0];

  const activeBadgeOverlay = activeBadgeData
    ? {
        label: activeBadgeData.label,
        source: activeBadgeData.source,
        src: BADGE_ASSET_MAP[activeBadgeData.asset_key] ?? badgeAdCooling,
      }
    : undefined;

  const isMobile = viewport === "mobile";
  const frameWidth = VIEWPORT_WIDTHS[viewport];
  const { logo_geometry: logoGeo, value_propositions: brandValueProps } =
    brandTokens;

  const handleSelectVariant = (variant: PdpVariant) => {
    setSelectedVariant(variant);
    setAddedToCart(false);
  };

  const handleAddToCart = () => {
    setAddedToCart(true);
  };

  return (
    <div className="sandbox-shell">
      <header className="sandbox-toolbar">
        <div className="toolbar-group">
          <h1 className="toolbar-title">
            {brandTokens.brand} Creative Engine — Interactive Sandbox
          </h1>
          <span className="drift-pill">
            Zero Product Drift · Mock Cutout Active
          </span>
        </div>

        <div className="toolbar-group">
          <div
            className="viewport-switcher"
            role="group"
            aria-label="Viewport Switcher"
          >
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
            {pdpData.trust_badges.map((badge) => (
              <option key={badge.id} value={badge.id}>
                {badge.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="stage-outer">
        <div
          className={`viewport-frame ${isMobile ? "mobile" : "desktop"}`}
          style={{ width: `${frameWidth}px` }}
          data-viewport={viewport}
        >
          <AnnouncementBar
            announcement={pdpData.announcement}
            viewport={viewport}
          />

          <header className={`pdp-header ${isMobile ? "mobile" : "desktop"}`}>
            <div
              className="logo-clearspace"
              title={logoGeo.clear_space_rule}
              style={{ padding: `${logoGeo.minimum_clear_space_px}px` }}
            >
              <img
                src={puffyLogo}
                alt={brandTokens.brand}
                className="pdp-logo"
                style={{ minWidth: `${logoGeo.minimum_size.width_px}px` }}
              />
            </div>

            {!isMobile && (
              <div className="pdp-nav-meta">
                <span>{brandValueProps.sleep_trial}</span>
                <span aria-hidden="true">·</span>
                <span>{brandValueProps.warranty}</span>
              </div>
            )}
          </header>

          <div className={`pdp-hero-layout ${isMobile ? "mobile" : "desktop"}`}>
            <HeroGallery
              gallery={pdpData.gallery}
              viewport={viewport}
              activeBadge={activeBadgeOverlay}
            />

            <ProductConfigurator
              data={pdpData}
              selectedVariant={selectedVariant}
              onSelectVariant={handleSelectVariant}
              onAddToCart={handleAddToCart}
              addedToCart={addedToCart}
              viewport={viewport}
            />
          </div>

          <TrustProofRibbon
            badges={pdpData.trust_badges}
            viewport={viewport}
          />

          <MattressLayersAccordion
            layers={pdpData.layers}
            viewport={viewport}
          />

          <StickyMobileCTA
            viewport={viewport}
            selectedVariant={selectedVariant}
            checkoutLabel={pdpData.cta.checkout_label}
            addedToCart={addedToCart}
            onCheckout={handleAddToCart}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
