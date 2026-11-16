import "./ShowroomHeader.css";
import { BrandLogo } from "../../brand/components/BrandLogo";
import { BRAND_COLORS } from "../../brand/tokens/colors";
import { BRAND_TYPOGRAPHY } from "../../brand/tokens/typography";

export type ShowroomTab = "interactive" | "campaign-renders" | "banner-studio";
export type ShowroomViewMode = ShowroomTab;

interface NavItem {
  id: ShowroomTab;
  label: string;
  icon: string;
  badge?: string;
}

const NAV_TABS: NavItem[] = [
  { id: "interactive", label: "3D Interactive", icon: "☁️" },
  { id: "campaign-renders", label: "2D Campaign Renders", icon: "🖼️" },
  { id: "banner-studio", label: "Banner Studio", icon: "🎨", badge: "NEW" },
];

interface ShowroomHeaderProps {
  activeTab: ShowroomTab;
  onTabChange: (tab: ShowroomTab) => void;
  onOpenDocs: () => void;
}

export function ShowroomHeader({
  activeTab,
  onTabChange,
  onOpenDocs,
}: ShowroomHeaderProps) {
  return (
    <header
      className="showroom-navbar"
      style={{
        backgroundColor: BRAND_COLORS.navyInk,
        fontFamily: BRAND_TYPOGRAPHY.fonts.functional,
        overflow: "hidden",
      }}
    >
      <div className="showroom-brand">
        <BrandLogo width={80} variant="light" className="showroom-brand-logo" />
        <span className="showroom-brand-title">
          PUFFY SHOWROOM <span className="showroom-brand-sep">/</span> CREATIVE LAB
        </span>
      </div>

      <nav
        className="showroom-nav-tabs"
        role="tablist"
        aria-label="Showroom View Mode"
      >
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`nav-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.badge && <span className="tab-pill-badge">{tab.badge}</span>}
          </button>
        ))}
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
