import "./ShowroomHeader.css";

export type ShowroomViewMode = "3d" | "2d";

interface ShowroomHeaderProps {
  activeView: ShowroomViewMode;
  onChangeView: (view: ShowroomViewMode) => void;
  onOpenDocs: () => void;
}

export function ShowroomHeader({
  activeView,
  onChangeView,
  onOpenDocs,
}: ShowroomHeaderProps) {
  return (
    <header className="showroom-navbar">
      <div className="showroom-brand">
        <span className="showroom-brand-dot" aria-hidden="true" />
        <span className="showroom-brand-title">
          PUFFY SHOWROOM <span className="showroom-brand-sep">/</span> CREATIVE LAB
        </span>
      </div>

      <nav
        className="showroom-segmented-control"
        role="tablist"
        aria-label="Showroom View Mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "3d"}
          className={`showroom-segment-btn ${activeView === "3d" ? "is-active" : ""}`}
          onClick={() => onChangeView("3d")}
        >
          <span aria-hidden="true">☁️</span>
          <span>3D Interactive</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeView === "2d"}
          className={`showroom-segment-btn ${activeView === "2d" ? "is-active" : ""}`}
          onClick={() => onChangeView("2d")}
        >
          <span aria-hidden="true">🖼️</span>
          <span>2D Campaign Renders</span>
        </button>
      </nav>

      <div className="showroom-nav-links">
        <button
          type="button"
          className="showroom-nav-link"
          onClick={onOpenDocs}
        >
          Documentation
        </button>
        <a
          href="https://github.com/puffy-ai/puffy-ai-creative-engine"
          target="_blank"
          rel="noopener noreferrer"
          className="showroom-nav-link"
        >
          GitHub Repo
        </a>
      </div>
    </header>
  );
}
