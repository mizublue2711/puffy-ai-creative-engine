import React, { useState } from 'react';
import { useBedroomConfigStore } from '../../../../store/useBedroomConfigStore';
import { BedroomRoomId } from '../../../../config/bedroomRooms.config';

export const BedroomRoomSwitcher: React.FC = () => {
  const activeRoomId = useBedroomConfigStore((state) => state.activeRoomId || 'classic');
  const setRoomId = useBedroomConfigStore((state) => state.setRoomId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const rooms: { id: BedroomRoomId; label: string }[] = [
    { id: 'classic', label: 'Classic Sanctuary' },
    { id: 'modern', label: 'Modern Minimalist' },
  ];

  return (
    <div
      className="bedroom-stepper-segments inline-flex items-center p-0.5 bg-black/40 border border-white/10 rounded-full backdrop-blur-md select-none"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 4px',
        backgroundColor: 'rgba(0, 0, 0, 0.40)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: '9999px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <span
        className="bedroom-stepper-label bedroom-room-switcher-label pl-2 pr-1 text-xs text-white/70 font-medium hidden sm:inline"
        style={{
          color: 'rgba(255, 255, 255, 0.70)',
          fontSize: '11.5px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          paddingLeft: '6px',
          paddingRight: '2px',
        }}
      >
        Room:
      </span>
      {rooms.map((room) => {
        const isSelected = activeRoomId === room.id;
        const isHovered = hoveredId === room.id && !isSelected;
        return (
          <button
            key={room.id}
            type="button"
            data-selected={isSelected ? 'true' : 'false'}
            aria-pressed={isSelected}
            onMouseEnter={() => setHoveredId(room.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => {
              e.stopPropagation();
              setRoomId(room.id);
            }}
            className={`bedroom-stepper-btn ${
              isSelected
                ? 'bg-white text-zinc-900 shadow-sm font-medium rounded-full px-3 py-1 text-xs'
                : 'text-white/60 hover:text-white hover:bg-white/10 font-medium rounded-full px-3 py-1 text-xs transition-all'
            }`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '24px',
              padding: '0 10px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11.5px',
              lineHeight: '1',
              fontWeight: isSelected ? 600 : 500,
              backgroundColor: isSelected
                ? '#ffffff'
                : isHovered
                  ? 'rgba(255, 255, 255, 0.10)'
                  : 'transparent',
              color: isSelected
                ? '#18181b'
                : isHovered
                  ? '#ffffff'
                  : 'rgba(255, 255, 255, 0.60)',
              boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.20)' : 'none',
              transition: 'all 0.16s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {room.label}
          </button>
        );
      })}
    </div>
  );
};



