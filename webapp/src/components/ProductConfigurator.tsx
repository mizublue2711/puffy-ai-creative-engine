import type { PdpData, PdpVariant, ViewportMode } from "../types/pdp";

interface ProductConfiguratorProps {
  data: PdpData;
  selectedVariant: PdpVariant;
  onSelectVariant: (variant: PdpVariant) => void;
  onAddToCart: () => void;
  addedToCart: boolean;
  viewport: ViewportMode;
}

export function ProductConfigurator({
  data,
  selectedVariant,
  onSelectVariant,
  onAddToCart,
  addedToCart,
  viewport,
}: ProductConfiguratorProps) {
  const isMobile = viewport === "mobile";
  const savings = selectedVariant.original_price - selectedVariant.sale_price;

  return (
    <section
      className={`product-configurator ${isMobile ? "mobile" : "desktop"}`}
      aria-label="Product Configuration"
    >
      <div className="config-eyebrow">{data.tagline}</div>

      <h1 className="config-title">{data.name}</h1>

      <div className="config-rating-row">
        <span className="rating-stars" aria-label={`Rated ${data.rating.score} out of ${data.rating.max_score}`}>
          {data.rating.score.toFixed(1)} ★
        </span>
        <span className="rating-sep" aria-hidden="true">·</span>
        <span className="rating-reviews">{data.rating.review_count_label}</span>
      </div>

      <p className="config-description">{data.description}</p>

      <div className="config-price-block">
        <div className="price-main-row">
          <span className="price-sale">${selectedVariant.sale_price.toLocaleString()}</span>
          <span className="price-original">
            ${selectedVariant.original_price.toLocaleString()}
          </span>
          <span className="price-savings-pill">Save ${savings.toLocaleString()}</span>
        </div>
        <div className="price-subnote">
          Includes {data.announcement.free_gift_label}
        </div>
      </div>

      <div className="config-size-section">
        <div className="size-header-row">
          <span className="size-label">Select Size</span>
          <span className="size-dimensions">
            {selectedVariant.size} · {selectedVariant.dimensions}
          </span>
        </div>

        <div className="size-grid" role="radiogroup" aria-label="Mattress Size">
          {data.variants.map((variant) => {
            const isSelected = variant.id === selectedVariant.id;
            const variantSavings = variant.original_price - variant.sale_price;
            return (
              <button
                key={variant.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`size-option-btn ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectVariant(variant)}
              >
                <span className="size-option-name">{variant.size}</span>
                <span className="size-option-price">
                  ${variant.sale_price.toLocaleString()}
                </span>
                <span className="size-option-save">Save ${variantSavings}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="config-cta-wrap">
        <button
          type="button"
          className="puffy-primary-cta"
          onClick={onAddToCart}
        >
          {addedToCart
            ? `Added ${selectedVariant.size} to Cart ✓`
            : `${data.cta.primary_label} — $${selectedVariant.sale_price.toLocaleString()}`}
        </button>
        {addedToCart && (
          <p className="cta-confirmation" role="status">
            {selectedVariant.size} {data.name} + {data.announcement.free_gift_label} reserved in your bag.
          </p>
        )}
      </div>

      <ul className="config-value-props" aria-label="Value Propositions">
        {data.value_propositions.map((prop) => (
          <li key={prop.id} className="value-prop-item">
            <span className="value-prop-check" aria-hidden="true">✓</span>
            <div className="value-prop-text">
              <strong>{prop.title}</strong>
              <span>{prop.subtitle}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
