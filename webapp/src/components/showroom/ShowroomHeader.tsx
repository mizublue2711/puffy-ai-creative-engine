import React, { useState } from "react";
import "./ShowroomHeader.css";
import { BrandLogo } from "../../brand/components/BrandLogo";
import { BRAND_TYPOGRAPHY } from "../../brand/tokens/typography";
import { useShowroomViewStore } from "../../store/useShowroomViewStore";

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
  onOpenDocs,
  onSelectView,
}: ShowroomHeaderProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [isLogoHovered, setIsLogoHovered] = useState<boolean>(false);
  const activeDoor = useShowroomViewStore((st) => st.activeDoor);

  const isTabActive = (tabId: ShowroomTab) => {
    if (tabId === activeDoor) return true;
    if (activeDoor === "studio" && (tabId === "studio" || tabId === "banner-studio")) return true;
    if (activeDoor === "meadow" && (tabId === "meadow" || tabId === "interactive")) return true;
    if (activeTab === tabId) return true;
    return false;
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
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-[#12151D]/70 backdrop-blur-xl border border-white/10 shadow-2xl"
      style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px",
        borderRadius: "9999px",
        backgroundColor: "rgba(18, 21, 29, 0.7)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        fontFamily: BRAND_TYPOGRAPHY.fonts.functional,
      }}
    >
      {/* 1. Puffy Logo as Home / Reset */}
      <button
        type="button"
        onClick={() => {
          onSelectView?.("meadow");
          useShowroomViewStore.getState().selectDoor("meadow");
          onTabChange?.("meadow" as ShowroomTab);
        }}
        className="flex items-center justify-center px-2.5 py-1 rounded-full text-white hover:bg-white/5 transition-all focus:outline-none"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2px 8px",
          borderRadius: "9999px",
          backgroundColor: isLogoHovered ? "rgba(255, 255, 255, 0.05)" : "transparent",
          border: "none",
          cursor: "pointer",
          transition: "all 0.2s ease",
          height: "28px",
          overflow: "hidden",
        }}
        title="Puffy Home / Reset (Outdoor Sanctuary)"
        aria-label="Puffy Home - Reset to Outdoor Meadow"
        onMouseEnter={() => setIsLogoHovered(true)}
        onMouseLeave={() => setIsLogoHovered(false)}
      >
        <BrandLogo width={80} variant="light" className="showroom-brand-logo" />
      </button>

      {/* Subtle Vertical Hairline Separator */}
      <div
        className="w-px h-4 bg-white/10 shrink-0"
        style={{
          width: "1px",
          height: "16px",
          backgroundColor: "rgba(255, 255, 255, 0.12)",
          flexShrink: 0,
        }}
        aria-hidden="true"
      />

      {/* 2. Navigation Tabs (4 Doors) */}
      <nav
        className="flex items-center gap-1.5"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
        role="tablist"
        aria-label="Showroom Doors"
      >
        {NAV_TABS.map((tab) => {
          const active = isTabActive(tab.id);
          const isHovered = hoveredTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleTabClick(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              className={
                active
                  ? "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all"
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: active ? 600 : 500,
                color: active
                  ? "#6ee7b7"
                  : isHovered
                  ? "#ffffff"
                  : "rgba(255, 255, 255, 0.7)",
                backgroundColor: active
                  ? "rgba(16, 185, 129, 0.2)"
                  : isHovered
                  ? "rgba(255, 255, 255, 0.05)"
                  : "transparent",
                borderColor: active ? "rgba(16, 185, 129, 0.4)" : "transparent",
                borderWidth: "1px",
                borderStyle: "solid",
                boxShadow: active
                  ? "0 0 12px rgba(16, 185, 129, 0.2)"
                  : "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    padding: "1px 5px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(16, 185, 129, 0.4)",
                    color: "#ffffff",
                    marginLeft: "2px",
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export default ShowroomHeader;
