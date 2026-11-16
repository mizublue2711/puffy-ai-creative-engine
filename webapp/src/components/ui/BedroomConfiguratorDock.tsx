import React, { useSyncExternalStore } from 'react';
import {
  getBedroomConfigRegistryVersion,
  getConfigurableBedroomItems,
  subscribeBedroomConfigRegistry,
  type BedroomDockCategory,
  type BedroomDockItemConfig,
} from '../canvas/bedroom/BedroomRegistry.ts';
import {
  useBedroomConfigStore,
  type PillowCountOption,
} from '../../store/useBedroomConfigStore.ts';
import './BedroomConfiguratorDock.css';

export interface BedroomConfiguratorDockProps {
  /** Distance from viewport bottom in pixels (default: 24px) */
  bottomOffset?: number;
}

const CATEGORY_META: Array<{
  id: BedroomDockCategory;
  label: string;
  alwaysShow?: boolean;
}> = [
  { id: 'bedding', label: 'Bedding', alwaysShow: true },
  { id: 'lighting', label: 'Lights', alwaysShow: true },
  { id: 'landscape', label: 'Garden', alwaysShow: true },
  { id: 'walls', label: 'Walls', alwaysShow: false },
];

function CategoryIcon({ category }: { category: BedroomDockCategory }) {
  switch (category) {
    case 'bedding':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M3 10.5V7.2A1.7 1.7 0 0 1 4.7 5.5h10.6A1.7 1.7 0 0 1 17 7.2v3.3M2.5 14.5v-3A1.5 1.5 0 0 1 4 10h12a1.5 1.5 0 0 1 1.5 1.5v3M3 14.5h14M5 10V8.2a.7.7 0 0 1 .7-.7h3.1a.7.7 0 0 1 .7.7V10m1 0V8.2a.7.7 0 0 1 .7-.7h3.1a.7.7 0 0 1 .7.7V10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'lighting':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2.5v2M6.5 13.5h7M7.5 16h5M6.2 11a4.5 4.5 0 1 1 7.6 0c-.6.7-1 1.5-1.1 2.5H7.3c-.1-1-.5-1.8-1.1-2.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'landscape':
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 16.5V9.5m0 0c0-3.2 2.4-5.5 5.5-5.5 0 3.2-2.3 5.5-5.5 5.5Zm0 2c0-2.8-2.1-4.8-4.8-4.8 0 2.8 2 4.8 4.8 4.8Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'walls':
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect
            x="3.5"
            y="4"
            width="13"
            height="12"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M8.5 4v12M13 4v12"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export const BedroomConfiguratorDock: React.FC<BedroomConfiguratorDockProps> = ({
  bottomOffset = 24,
}) => {
  // Re-render automatically if any new item is dynamically registered in BedroomRegistry.ts
  useSyncExternalStore(
    subscribeBedroomConfigRegistry,
    getBedroomConfigRegistryVersion,
  );

  const {
    activeItems,
    pillowCount,
    activeCategory,
    isDockExpanded,
    toggleItem,
    setPillowCount,
    setActiveCategory,
    toggleDockExpanded,
  } = useBedroomConfigStore();

  const allItems = getConfigurableBedroomItems();
  const visibleCategories = CATEGORY_META.filter(
    (cat) => cat.alwaysShow || allItems.some((item) => item.dockCategory === cat.id),
  );
  const categoryItems = getConfigurableBedroomItems(activeCategory);

  const renderControl = (item: BedroomDockItemConfig) => {
    if (item.variantKey === 'pillowCount' && Array.isArray(item.options)) {
      return (
        <div
          key={item.id}
          className="bedroom-stepper-group"
          role="group"
          aria-label={`${item.shortLabel} count`}
        >
          <span className="bedroom-stepper-label">{item.shortLabel}:</span>
          <div className="bedroom-stepper-segments">
            {item.options.map((opt) => {
              const count = Number(opt) as PillowCountOption;
              const isSelected = pillowCount === count;
              return (
                <button
                  key={String(opt)}
                  type="button"
                  className="bedroom-stepper-btn"
                  data-selected={isSelected ? 'true' : 'false'}
                  aria-pressed={isSelected}
                  onClick={() => setPillowCount(count)}
                >
                  {count}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    const fallback = typeof item.defaultState === 'boolean' ? item.defaultState : true;
    const isOn = activeItems[item.id] ?? fallback;

    return (
      <button
        key={item.id}
        type="button"
        role="switch"
        aria-checked={isOn}
        className="bedroom-toggle-pill"
        data-on={isOn ? 'true' : 'false'}
        onClick={() => toggleItem(item.id)}
      >
        <span>{item.shortLabel}:</span>
        <span className="bedroom-toggle-status">{isOn ? 'ON' : 'OFF'}</span>
      </button>
    );
  };

  return (
    <div
      className="bedroom-config-dock-root"
      style={{ bottom: `${bottomOffset}px` }}
      role="region"
      aria-label="Bedroom Staging Configurator"
    >
      {isDockExpanded && categoryItems.length > 0 && (
        <div className="bedroom-config-drawer">
          {categoryItems.map(renderControl)}
        </div>
      )}

      <div className="bedroom-config-pill-bar" role="tablist" aria-label="Bedroom Categories">
        {visibleCategories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className="bedroom-config-tab"
              data-active={isActive ? 'true' : 'false'}
              onClick={() => {
                if (isActive && !isDockExpanded) {
                  toggleDockExpanded();
                } else {
                  setActiveCategory(cat.id);
                  if (!isDockExpanded) {
                    toggleDockExpanded();
                  }
                }
              }}
            >
              <CategoryIcon category={cat.id} />
              <span>{cat.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className="bedroom-config-collapse-btn"
          data-expanded={isDockExpanded ? 'true' : 'false'}
          aria-label={isDockExpanded ? 'Collapse configurator' : 'Expand configurator'}
          title={isDockExpanded ? 'Collapse configurator' : 'Expand configurator'}
          onClick={toggleDockExpanded}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BedroomConfiguratorDock;
