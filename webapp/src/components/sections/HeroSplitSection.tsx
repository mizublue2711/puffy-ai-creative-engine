import type { PdpData, PdpVariant, ViewportMode } from "../../types/pdp";
import {
  PuffyFloatingHero3D,
  type ActiveTrustOverlay,
} from "../canvas/puffy-hero-3d/PuffyFloatingHero3D";
import { ProductConfigurator } from "../ProductConfigurator";

interface HeroSplitSectionProps {
  data: PdpData;
  selectedVariant: PdpVariant;
  onSelectVariant: (variant: PdpVariant) => void;
  onAddToCart: () => void;
  addedToCart: boolean;
  viewport: ViewportMode;
  activeBadge?: ActiveTrustOverlay;
}

export function HeroSplitSection({
  data,
  selectedVariant,
  onSelectVariant,
  onAddToCart,
  addedToCart,
  viewport,
  activeBadge,
}: HeroSplitSectionProps) {
  const isMobile = viewport === "mobile";

  return (
    <section
      className={`pdp-hero-layout ${isMobile ? "mobile" : "desktop"}`}
      aria-label="Product Hero"
    >
      <div className="hero-split-left-column w-full h-full">
        <PuffyFloatingHero3D
          viewport={viewport}
          selectedSize={selectedVariant.size}
          activeBadge={activeBadge}
        />
      </div>

      <ProductConfigurator
        data={data}
        selectedVariant={selectedVariant}
        onSelectVariant={onSelectVariant}
        onAddToCart={onAddToCart}
        addedToCart={addedToCart}
        viewport={viewport}
      />
    </section>
  );
}
