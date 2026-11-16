interface SceneCaptureDockProps {
  isRecording: boolean;
  recordingProgress: number;
  onSnapshot: () => void;
  onRecord: () => void;
  pendingSnapshot?: string | null;
  onDownloadSnapshot?: () => void;
  onOpenInStudio?: () => void;
  onDismissSnapshot?: () => void;
}

const pill: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 16,
  zIndex: 30,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  pointerEvents: 'none',
};

const row: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: 6,
  borderRadius: 999,
  background: 'rgba(30, 28, 26, 0.55)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.18)',
  pointerEvents: 'auto',
};

const btn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: 'none',
  fontSize: 20,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.14)',
  color: '#fff',
};

export function SceneCaptureDock({
  isRecording,
  recordingProgress,
  onSnapshot,
  onRecord,
  pendingSnapshot,
  onDownloadSnapshot,
  onOpenInStudio,
  onDismissSnapshot,
}: SceneCaptureDockProps) {
  return (
    <div style={pill} data-testid="scene-capture-dock">
      {pendingSnapshot && (
        <div
          role="dialog"
          aria-label="Snapshot ready"
          style={{ ...row, flexDirection: 'column', gap: 8, borderRadius: 14, padding: 12, color: '#fff', fontSize: 13 }}
        >
          <img src={pendingSnapshot} alt="Snapshot preview" style={{ width: 180, borderRadius: 8 }} />
          <button type="button" style={{ ...btn, width: 'auto', borderRadius: 999, fontSize: 13, padding: '8px 14px' }} onClick={onDownloadSnapshot}>
            Tải ảnh WebP
          </button>
          <button type="button" style={{ ...btn, width: 'auto', borderRadius: 999, fontSize: 13, padding: '8px 14px', background: '#067A57' }} onClick={onOpenInStudio}>
            Mở trong Banner Studio ➜
          </button>
          <button type="button" style={{ ...btn, width: 'auto', height: 'auto', fontSize: 11, background: 'none', opacity: 0.7 }} onClick={onDismissSnapshot}>
            Đóng
          </button>
        </div>
      )}
      {isRecording && (
        <div
          role="status"
          style={{
            ...row,
            flexDirection: 'column',
            gap: 4,
            borderRadius: 14,
            padding: '8px 12px',
            color: '#fff',
            fontSize: 12,
          }}
        >
          <span>Đang quay Cinematic... {Math.round(recordingProgress * 100)}%</span>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.round(recordingProgress * 100)}%`,
                borderRadius: 2,
                background: '#ff6b6b',
              }}
            />
          </div>
        </div>
      )}
      <div style={row}>
        <button
          type="button"
          style={btn}
          title="Chụp ảnh khoảnh khắc (.webp)"
          aria-label="Chụp ảnh khoảnh khắc (.webp)"
          onClick={onSnapshot}
        >
          📸
        </button>
        <button
          type="button"
          style={{ ...btn, opacity: isRecording ? 0.5 : 1 }}
          title="Quay video Cinematic 360° (.webm)"
          aria-label="Quay video Cinematic 360° (.webm)"
          disabled={isRecording}
          onClick={onRecord}
        >
          🎬
        </button>
      </div>
    </div>
  );
}
