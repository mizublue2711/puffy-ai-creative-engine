import React, { useEffect, useRef } from "react";
import "./ShowroomHeader.css";
import { BrandLogo } from "../../brand/components/BrandLogo";
import { BRAND_TYPOGRAPHY } from "../../brand/tokens/typography";
import { useShowroomViewStore } from "../../store/useShowroomViewStore";
import { useLanguage } from "../../i18n/LanguageContext";

export type ShowroomTab =
  | "interactive"
  | "campaign-renders"
  | "banner-studio"
  | "meadow"
  | "bedroom"
  | "indoor-lab"
  | "studio"
  | "gallery";

export type ShowroomViewMode = ShowroomTab;

interface NavItem {
  id: ShowroomTab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_TABS: NavItem[] = [
  {
    id: "meadow",
    label: "Outdoor",
    icon: (
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: "16px", height: "16px", flexShrink: 0 }}
        aria-hidden="true"
      >
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </svg>
    ),
  },
  {
    id: "bedroom",
    label: "Bedroom",
    icon: (
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: "16px", height: "16px", flexShrink: 0 }}
        aria-hidden="true"
      >
        <path d="M2 17h20" />
        <path d="M2 13h20" />
        <path d="M4 17v3" />
        <path d="M20 17v3" />
        <path d="M4 13V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7" />
        <path d="M8 10h8" />
      </svg>
    ),
  },
  {
    id: "indoor-lab",
    label: "Indoor Lab",
    icon: (
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: "16px", height: "16px", flexShrink: 0 }}
        aria-hidden="true"
      >
        <path d="m12 2 10 5-10 5L2 7l10-5Z" />
        <path d="m2 12 10 5 10-5" />
        <path d="m2 17 10 5 10-5" />
      </svg>
    ),
  },
  {
    id: "studio",
    label: "Craft Studio",
    icon: (
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: "16px", height: "16px", flexShrink: 0 }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="14.31" x2="20.05" y1="8" y2="17.94" />
        <line x1="9.69" x2="21.17" y1="8" y2="8" />
        <line x1="7.38" x2="13.12" y1="12" y2="2.06" />
        <line x1="9.69" x2="3.95" y1="16" y2="6.06" />
        <line x1="14.31" x2="2.83" y1="16" y2="16" />
        <line x1="16.62" x2="10.88" y1="12" y2="21.94" />
      </svg>
    ),
  },
  /*
  // Permanently removed per spec:
  // Key 'gallery' (2D Campaign Renders) is permanently hidden and must NOT be rendered.
  */
];

export interface ShowroomHeaderProps {
  activeTab: ShowroomTab | string;
  onTabChange?: (tab: ShowroomTab) => void;
  onOpenDocs?: () => void;
  onSelectView?: (view: string) => void;
}

export function ShowroomHeader({
  activeTab,
  onTabChange,
  onOpenDocs: _onOpenDocs,
  onSelectView,
}: ShowroomHeaderProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const activeDoor = useShowroomViewStore((st) => st.activeDoor);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const activeTabKey =
      activeDoor === "studio" || activeTab === "banner-studio" || activeTab === "studio"
        ? "studio"
        : activeDoor === "bedroom" || activeTab === "bedroom"
          ? "bedroom"
          : activeDoor === "indoor-lab" || activeTab === "indoor-lab"
            ? "indoor-lab"
            : "meadow";
    const activeBtn = tabButtonRefs.current[activeTabKey];
    activeBtn?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeDoor, activeTab]);

  const getTabLabel = (id: ShowroomTab): string => {
    switch (id) {
      case "meadow":
        return t("navOutdoor");
      case "bedroom":
        return t("navBedroom");
      case "indoor-lab":
        return t("navIndoorLab");
      case "studio":
        return t("navCraftStudio");
      default:
        return id;
    }
  };

  const isTabActive = (tabId: ShowroomTab) => {
    if (activeDoor) {
      if (activeDoor === "studio") return tabId === "studio" || tabId === "banner-studio";
      if (activeDoor === "meadow") return tabId === "meadow" || tabId === "interactive";
      return tabId === activeDoor;
    }
    return activeTab === tabId;
  };

  const handleTabClick = (tabId: ShowroomTab) => {
    switch (tabId) {
      case "meadow":
        onSelectView?.("meadow");
        useShowroomViewStore.getState().selectDoor("meadow");
        onTabChange?.("meadow" as ShowroomTab);
        break;
      case "bedroom":
        onSelectView?.("bedroom");
        useShowroomViewStore.getState().selectDoor("bedroom");
        onTabChange?.("bedroom" as ShowroomTab);
        break;
      case "indoor-lab":
        onSelectView?.("indoor-lab");
        useShowroomViewStore.getState().selectDoor("indoor-lab");
        onTabChange?.("indoor-lab" as ShowroomTab);
        break;
      case "studio":
        onSelectView?.("studio");
        useShowroomViewStore.getState().selectDoor("studio");
        // Preserves the exact callback previously used by Banner Studio
        onTabChange?.("banner-studio" as ShowroomTab);
        break;
      default:
        onSelectView?.(tabId);
        onTabChange?.(tabId);
        break;
    }
  };

  return (
    <header
      className="showroom-header-bar"
      style={{ fontFamily: BRAND_TYPOGRAPHY.fonts.functional }}
    >
      {/* 1. Puffy Logo as Home / Reset */}
      <button
        type="button"
        onClick={() => {
          onSelectView?.("meadow");
          useShowroomViewStore.getState().selectDoor("meadow");
          onTabChange?.("meadow" as ShowroomTab);
        }}
        className="showroom-header-logo-btn"
        title="Puffy Home / Reset (Outdoor Sanctuary)"
        aria-label="Puffy Home - Reset to Outdoor Meadow"
      >
        <BrandLogo width={80} variant="light" className="showroom-brand-logo" />
      </button>

      {/* Subtle Vertical Hairline Separator */}
      <div className="showroom-header-sep" aria-hidden="true" />

      {/* 2. Navigation Tabs (4 Doors) */}
      <nav
        className="showroom-header-nav no-scrollbar"
        role="tablist"
        aria-label="Showroom Doors"
      >
        {NAV_TABS.map((tab) => {
          const active = isTabActive(tab.id);

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabButtonRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active ? "true" : "false"}
              onClick={() => handleTabClick(tab.id)}
              className="showroom-header-tab"
            >
              {tab.icon}
              <span>{getTabLabel(tab.id)}</span>
              {tab.badge && (
                <span className="showroom-header-tab-badge">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Subtle Vertical Hairline Separator */}
      <div className="showroom-header-sep" aria-hidden="true" />

      {/* Language Switcher Capsule Pill */}
      <button
        type="button"
        onClick={toggleLanguage}
        className="showroom-header-lang-btn"
        title={`Switch Language (Current: ${language.toUpperCase()})`}
        aria-label={`Switch Language (Current: ${language.toUpperCase()})`}
      >
        <span>🌐</span>
        <span>{language.toUpperCase()}</span>
      </button>
    </header>
  );
}

export default ShowroomHeader;
