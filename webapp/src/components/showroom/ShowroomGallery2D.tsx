import { useEffect, useState, type MouseEvent } from "react";
import "./ShowroomGallery2D.css";
import { useLanguage } from "../../i18n/LanguageContext.tsx";

type BannerCategory = "all" | "campaign" | "lifestyle" | "pbr";

interface GalleryRenderItem {
  id: string;
  title: string;
  subtitle: string;
  dimensions: string;
  aspectLabel: string;
  category: Exclude<BannerCategory, "all">;
  src: string;
  pipelineSource: string;
  highlights: string[];
}

const GALLERY_ITEMS: GalleryRenderItem[] = [
  {
    id: "campaign-desktop-1440x900",
    title: "Cloud Sanctuary — Desktop Hero",
    subtitle: "Wide-format editorial hero banner with shadowed 45° cutout",
    dimensions: "1440 × 900",
    aspectLabel: "16:10 Desktop",
    category: "campaign",
    src: "/banners/puffy-cloud-sanctuary-2026_1440x900.png",
    pipelineSource: "pipelines/banner_engine/out/puffy-cloud-sanctuary-2026_1440x900.png",
    highlights: ["Zero Product Drift Cutout", "PT Serif Headline", "PBR Soft Ground Shadow"],
  },
  {
    id: "campaign-square-1080x1080",
    title: "Cloud Sanctuary — Square Feed",
    subtitle: "1:1 social composition with balanced typography & badge lockup",
    dimensions: "1080 × 1080",
    aspectLabel: "1:1 Square",
    category: "campaign",
    src: "/banners/puffy-cloud-sanctuary-2026_1080x1080.png",
    pipelineSource: "pipelines/banner_engine/out/puffy-cloud-sanctuary-2026_1080x1080.png",
    highlights: ["1:1 Social Safe Area", "Adaptive Contrast", "Crisp Vector Crest"],
  },
  {
    id: "campaign-story-1080x1920",
    title: "Cloud Sanctuary — Vertical Story",
    subtitle: "9:16 mobile full-bleed campaign story render",
    dimensions: "1080 × 1920",
    aspectLabel: "9:16 Story",
    category: "campaign",
    src: "/banners/puffy-cloud-sanctuary-2026_1080x1920.png",
    pipelineSource: "pipelines/banner_engine/out/puffy-cloud-sanctuary-2026_1080x1920.png",
    highlights: ["9:16 Story Safe Zones", "Vertical Focal Stack", "Studio Lighting Match"],
  },
  {
    id: "lifestyle-1200x628",
    title: "Sanctuary Lifestyle — Landscape",
    subtitle: "OpenGraph / Meta landscape placement with ambient depth",
    dimensions: "1200 × 628",
    aspectLabel: "1.91:1 Wide",
    category: "lifestyle",
    src: "/banners/lifestyle_test_1200x628.png",
    pipelineSource: "pipelines/banner_engine/out/lifestyle_test_1200x628.png",
    highlights: ["Editorial Framing", "Warm Linen Palette", "Natural Contact Shadow"],
  },
  {
    id: "lifestyle-1080x1350",
    title: "Sanctuary Lifestyle — Portrait",
    subtitle: "4:5 vertical social feed render",
    dimensions: "1080 × 1350",
    aspectLabel: "4:5 Portrait",
    category: "lifestyle",
    src: "/banners/lifestyle_test_1080x1350.png",
    pipelineSource: "pipelines/banner_engine/out/lifestyle_test_1080x1350.png",
    highlights: ["4:5 Feed Ratio", "Balanced Negative Space", "Color-Matched Bedding"],
  },
  {
    id: "lifestyle-1080x1920",
    title: "Sanctuary Lifestyle — Story",
    subtitle: "Full-height vertical lifestyle composition",
    dimensions: "1080 × 1920",
    aspectLabel: "9:16 Story",
    category: "lifestyle",
    src: "/banners/lifestyle_test_1080x1920.png",
    pipelineSource: "pipelines/banner_engine/out/lifestyle_test_1080x1920.png",
    highlights: ["Full-Bleed Vertical", "Soft Daylight Falloff", "Brand Typography"],
  },
  {
    id: "pbr-badge-4k",
    title: "Puffy® Embroidery Badge — 4K Beauty",
    subtitle: "MaterialCraft synthesized satin-stitch & twill weave macro",
    dimensions: "4096 × 4096",
    aspectLabel: "1:1 4K PBR",
    category: "pbr",
    src: "/textures/badge/06_beauty_render_4k.png",
    pipelineSource: "webapp/public/textures/badge/06_beauty_render_4k.png",
    highlights: ["Raised Thread Normal Map", "Anisotropic Sheen", "4K Stitch Detail"],
  },
  {
    id: "pbr-top-quilt-4k",
    title: "Cloud Top Quilt — 4K Beauty",
    subtitle: "Puff-stitched cooling knit & lofted pillow-top micro-relief",
    dimensions: "4096 × 4096",
    aspectLabel: "1:1 4K PBR",
    category: "pbr",
    src: "/textures/top_quilt/06_beauty_render_4k.png",
    pipelineSource: "webapp/public/textures/top_quilt/06_beauty_render_4k.png",
    highlights: ["Height + AO Maps", "Micro-Fiber Roughness", "Seamless Tileable PBR"],
  },
];

const CATEGORY_FILTERS: Array<{ id: BannerCategory; label: string }> = [
  { id: "all", label: "All Renders" },
  { id: "campaign", label: "Campaign Banners" },
  { id: "lifestyle", label: "Lifestyle Formats" },
  { id: "pbr", label: "4K PBR & Embroidery" },
];

const ZOOM_LEVELS = [1, 1.5, 2, 3];

export function ShowroomGallery2D() {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<BannerCategory>("all");

  const getCategoryFilterLabel = (id: BannerCategory): string => {
    switch (id) {
      case "all":
        return t("galleryAllRenders");
      case "campaign":
        return t("galleryCampaignBanners");
      case "lifestyle":
        return t("galleryLifestylePlacement");
      case "pbr":
        return t("galleryPbrInspection");
      default:
        return id;
    }
  };
  const [inspectedItem, setInspectedItem] = useState<GalleryRenderItem | null>(
    null
  );
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const filteredItems =
    activeCategory === "all"
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((item) => item.category === activeCategory);

  const openInspector = (item: GalleryRenderItem) => {
    setInspectedItem(item);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const closeInspector = () => {
    setInspectedItem(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!inspectedItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeInspector();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectedItem]);

  const handleSetZoom = (nextZoom: number) => {
    setZoomScale(nextZoom);
    if (nextZoom === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragOrigin({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoomScale <= 1) return;
    setPanOffset({
      x: e.clientX - dragOrigin.x,
      y: e.clientY - dragOrigin.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <section
      className="showroom-gallery-2d"
      aria-label="2D Campaign Renders Gallery"
    >
      <div className="gallery-2d-inner">
        <div className="gallery-2d-header">
          <div>
            <p className="gallery-2d-kicker">
              BANNER ENGINE &amp; MATERIALCRAFT PIPELINE
            </p>
            <h2 className="gallery-2d-title">
              2D Campaign Renders &amp; 4K PBR Inspection
            </h2>
          </div>

          <div
            className="gallery-filter-pills"
            role="group"
            aria-label="Filter renders"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`gallery-filter-pill ${activeCategory === cat.id ? "is-active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {getCategoryFilterLabel(cat.id)}
              </button>
            ))}
          </div>
        </div>

        <div className="gallery-grid">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="gallery-card"
              onClick={() => openInspector(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openInspector(item);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Inspect ${item.title} (${item.dimensions})`}
            >
              <div className="gallery-card-media">
                <img
                  src={item.src}
                  alt={item.title}
                  loading="lazy"
                  draggable={false}
                />
                <span className="gallery-card-badge tabular-nums">
                  {item.dimensions}
                </span>
                <span className="gallery-card-zoom-hint">
                  Click to Inspect
                </span>
              </div>

              <div className="gallery-card-body">
                <div className="gallery-card-meta">
                  <span className="gallery-card-aspect">{item.aspectLabel}</span>
                </div>
                <h3 className="gallery-card-title">{item.title}</h3>
                <p className="gallery-card-subtitle">{item.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {inspectedItem && (
        <div
          className="gallery-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Inspecting ${inspectedItem.title}`}
          onClick={closeInspector}
        >
          <div
            className="gallery-lightbox-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gallery-lightbox-topbar">
              <div className="gallery-lightbox-info">
                <h3 className="gallery-lightbox-title">
                  {inspectedItem.title}
                </h3>
                <span className="gallery-lightbox-dims tabular-nums">
                  {inspectedItem.dimensions} · {inspectedItem.aspectLabel}
                </span>
              </div>

              <div className="gallery-lightbox-controls">
                <div className="zoom-pill-group" role="group" aria-label="Zoom level">
                  {ZOOM_LEVELS.map((z) => (
                    <button
                      key={z}
                      type="button"
                      className={`zoom-pill-btn tabular-nums ${zoomScale === z ? "is-active" : ""}`}
                      onClick={() => handleSetZoom(z)}
                    >
                      {z === 1 ? "Fit" : `${Math.round(z * 100)}%`}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="lightbox-close-btn"
                  onClick={closeInspector}
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>

            <div
              className={`gallery-lightbox-stage ${zoomScale > 1 ? "can-pan" : ""} ${isDragging ? "is-dragging" : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={() => handleSetZoom(zoomScale === 1 ? 2 : 1)}
            >
              <img
                src={inspectedItem.src}
                alt={inspectedItem.title}
                draggable={false}
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                }}
              />
            </div>

            <div className="gallery-lightbox-footer">
              <code className="gallery-lightbox-path">
                {inspectedItem.pipelineSource}
              </code>
              <div className="gallery-lightbox-tags">
                {inspectedItem.highlights.map((tag) => (
                  <span key={tag} className="gallery-lightbox-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
