import badgeCnnFirm from "@assets/catalog/trust-badges/awards/badge_cnn-best-firm-2025_vector.svg";
import badgeAdCooling from "@assets/catalog/trust-badges/awards/badge_ad-best-cooling-2026_vector.svg";
import badgeConsumerLuxury from "@assets/catalog/trust-badges/awards/badge_consumer-mattress-luxury-2027_vector.svg";
import badgeEcoTrial from "@assets/catalog/trust-badges/awards/badge_theroundup-eco-mattress-2026_vector.svg";
import badgeAdHybrid from "@assets/catalog/trust-badges/awards/badge_ad-best-hybrid-2025_vector.svg";
import type { PdpTrustBadge, ViewportMode } from "../types/pdp";

const BADGE_ASSET_MAP: Record<string, string> = {
  cnn_best_firm_2025: badgeCnnFirm,
  ad_best_cooling_2026: badgeAdCooling,
  consumer_mattress_luxury_2027: badgeConsumerLuxury,
  theroundup_eco_mattress_2026: badgeEcoTrial,
  ad_best_hybrid_2025: badgeAdHybrid,
};

interface TrustProofRibbonProps {
  badges: PdpTrustBadge[];
  viewport: ViewportMode;
}

export function TrustProofRibbon({ badges, viewport }: TrustProofRibbonProps) {
  const isMobile = viewport === "mobile";

  return (
    <section
      className={`trust-proof-ribbon ${isMobile ? "mobile" : "desktop"}`}
      aria-label="Awards and Trust Proof"
    >
      <div className="trust-ribbon-header">
        <span className="trust-ribbon-eyebrow">Recognized Excellence</span>
        <h2 className="trust-ribbon-title">Award-Winning Sleep Engineering</h2>
      </div>

      <div className="trust-ribbon-grid">
        {badges.map((badge) => {
          const iconSrc = BADGE_ASSET_MAP[badge.asset_key] ?? badgeAdCooling;
          return (
            <div key={badge.id} className="trust-badge-card">
              <div className="trust-badge-icon-wrap">
                <img
                  src={iconSrc}
                  alt={badge.label}
                  className="trust-badge-svg"
                />
              </div>
              <div className="trust-badge-meta">
                <strong className="trust-badge-label">{badge.label}</strong>
                <span className="trust-badge-source">{badge.source}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
