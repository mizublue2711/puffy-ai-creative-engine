import { useState, useCallback } from 'react';
import * as THREE from 'three';

interface CaptureOptions {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  onSnapshotReady?: (dataUrl: string) => void;
}

export function useSceneCapture({ renderer, scene, camera, onSnapshotReady }: CaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  // A. INSTANT PHOTO SNAPSHOT (.webp)
  const takeSnapshot = useCallback(() => {
    if (!renderer || !scene || !camera) return;

    // 1. Force render current view (needed so the drawing buffer is populated for toBlob)
    renderer.render(scene, camera);

    // 2. Export to WebP Blob (quality 0.95)
    renderer.domElement.toBlob(
      (blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);

        if (onSnapshotReady) {
          // Caller decides: download via downloadSnapshotUrl() or open in Banner Studio
          onSnapshotReady(url);
        } else {
          downloadSnapshotUrl(url);
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }

        triggerShutterFlash();
      },
      'image/webp',
      0.95
    );
  }, [renderer, scene, camera, onSnapshotReady]);

  // B. CINEMATIC AUTO-FLY VIDEO RECORDER (.webm)
  const recordCinematicTour = useCallback(
    (onAnimateFlight: (onProgress: (p: number) => void, onComplete: () => void) => void) => {
      if (!renderer || isRecording) return;
      if (typeof MediaRecorder === 'undefined') {
        console.warn('[useSceneCapture] MediaRecorder is not supported in this browser.');
        return;
      }

      const canvas = renderer.domElement;
      const stream = canvas.captureStream(60); // 60 FPS stream

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000, // 8 Mbps HD
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        const link = document.createElement('a');
        link.download = `puffy-cinematic-tour-${Date.now()}.webm`;
        link.href = videoUrl;
        link.click();
        setTimeout(() => URL.revokeObjectURL(videoUrl), 10_000);

        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setRecordingProgress(0);
      };

      recorder.start();
      setIsRecording(true);

      // Trigger the 8-second camera flight animation
      onAnimateFlight(
        (progress) => setRecordingProgress(progress),
        () => {
          if (recorder.state !== 'inactive') recorder.stop();
        }
      );
    },
    [renderer, isRecording]
  );

  return {
    takeSnapshot,
    recordCinematicTour,
    isRecording,
    recordingProgress,
  };
}

export function downloadSnapshotUrl(url: string) {
  const link = document.createElement('a');
  link.download = `puffy-moment-${Date.now()}.webp`;
  link.href = url;
  link.click();
}

// Camera shutter flash micro-animation
function triggerShutterFlash() {
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.inset = '0';
  flash.style.backgroundColor = 'white';
  flash.style.opacity = '0.7';
  flash.style.pointerEvents = 'none';
  flash.style.zIndex = '99999';
  flash.style.transition = 'opacity 0.25s ease-out';
  document.body.appendChild(flash);

  requestAnimationFrame(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 260);
  });
}
