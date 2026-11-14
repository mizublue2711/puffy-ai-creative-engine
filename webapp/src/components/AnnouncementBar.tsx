import { useEffect, useState } from "react";
import type { PdpAnnouncement, ViewportMode } from "../types/pdp";

interface AnnouncementBarProps {
  announcement: PdpAnnouncement;
  viewport: ViewportMode;
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

export function AnnouncementBar({ announcement, viewport }: AnnouncementBarProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(
    announcement.countdown_seconds
  );

  useEffect(() => {
    setSecondsLeft(announcement.countdown_seconds);
  }, [announcement.countdown_seconds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : announcement.countdown_seconds));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [announcement.countdown_seconds]);

  const isMobile = viewport === "mobile";

  return (
    <div
      className={`announcement-bar ${isMobile ? "mobile" : "desktop"}`}
      role="region"
      aria-label="Promotional Announcement"
    >
      <div className="announcement-left">
        <span className="announcement-badge">{announcement.promo_badge}</span>
        <span className="announcement-message">{announcement.message}</span>
      </div>

      <div className="announcement-right">
        <span className="announcement-timer" aria-label="Sale countdown timer">
          <span className="timer-label">Ends in</span>
          <strong className="timer-digits">{formatCountdown(secondsLeft)}</strong>
        </span>
        <span className="announcement-gift">{announcement.free_gift_label}</span>
      </div>
    </div>
  );
}
