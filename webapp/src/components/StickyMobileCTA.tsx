import type { PdpVariant, ViewportMode } from "../types/pdp";

interface StickyMobileCTAProps {
  viewport: ViewportMode;
  selectedVariant: PdpVariant;
  checkoutLabel: string;
  addedToCart: boolean;
  onCheckout: () => void;
}

export function StickyMobileCTA({
  viewport,
  selectedVariant,
  checkoutLabel,
  addedToCart,
  onCheckout,
}: StickyMobileCTAProps) {
  if (viewport !== "mobile") {
    return null;
  }

  const savings = selectedVariant.original_price - selectedVariant.sale_price;

  return (
    <div
      className="sticky-mobile-cta"
      role="region"
      aria-label="Mobile Quick Checkout"
    >
      <div className="sticky-mobile-info">
        <div className="sticky-mobile-size-row">
          <strong className="sticky-mobile-size">{selectedVariant.size}</strong>
          <span className="sticky-mobile-save">Save ${savings}</span>
        </div>
        <div className="sticky-mobile-price-row">
          <span className="sticky-mobile-sale">
            ${selectedVariant.sale_price.toLocaleString()}
          </span>
          <span className="sticky-mobile-orig">
            ${selectedVariant.original_price.toLocaleString()}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="sticky-mobile-btn"
        onClick={onCheckout}
      >
        {addedToCart ? "Added ✓" : checkoutLabel}
      </button>
    </div>
  );
}
