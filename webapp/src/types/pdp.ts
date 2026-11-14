export type ViewportMode = "desktop" | "mobile";

export interface PdpVariant {
  id: string;
  size: string;
  dimensions: string;
  sale_price: number;
  original_price: number;
  is_default: boolean;
}

export interface PdpGalleryItem {
  id: string;
  label: string;
  view_type: "cutout" | "lifestyle" | string;
  asset_key: string;
  alt: string;
  caption: string;
}

export interface PdpValueProposition {
  id: string;
  title: string;
  subtitle: string;
}

export interface PdpTrustBadge {
  id: string;
  label: string;
  source: string;
  asset_key: string;
}

export interface PdpLayer {
  layer_number: number;
  name: string;
  thickness: string;
  summary: string;
  benefit: string;
}

export interface PdpAnnouncement {
  promo_badge: string;
  message: string;
  countdown_seconds: number;
  free_gift_label: string;
  free_gift_value: number;
}

export interface PdpData {
  product_id: string;
  name: string;
  tagline: string;
  description: string;
  rating: {
    score: number;
    max_score: number;
    review_count_label: string;
  };
  announcement: PdpAnnouncement;
  gallery: PdpGalleryItem[];
  variants: PdpVariant[];
  value_propositions: PdpValueProposition[];
  trust_badges: PdpTrustBadge[];
  layers: PdpLayer[];
  cta: {
    primary_label: string;
    checkout_label: string;
    bg_color: string;
    text_color: string;
  };
}
