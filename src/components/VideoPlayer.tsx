"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { Level } from "./QualitySelector";

type Status = "loading" | "playing" | "error";

// Playback surface only. Play/pause, volume, and quality are driven by props so
// the PlayerOverlay (a single control surface) owns the UI; VideoPlayer just
// reflects intent onto the <video>/hls instance and reports available levels up.
export function VideoPlayer({
  src, paused = false, volume = 1, muted = false, currentLevel = -1, onLevels,
}: {
  src: string;
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  currentLevel?: number;
  onLevels?: (levels: Level[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        onLevels?.(data.levels.map((l) => ({ height: l.height })));
        video.play().then(() => setStatus("playing")).catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setStatus("error");
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    }

    // Safari / native HLS
    video.src = src;
    video.addEventListener("loadeddata", () => setStatus("playing"));
    video.addEventListener("error", () => setStatus("error"));
    video.play().catch(() => {});
  }, [src, onLevels]);

  // Reflect play/pause intent. Resuming a live stream lets hls.js catch back up.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused]);

  // Reflect volume / mute (mainly for the desktop browser; TVs use the remote).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  // Reflect the chosen quality level (-1 = Auto/ABR).
  useEffect(() => {
    if (hlsRef.current) hlsRef.current.currentLevel = currentLevel;
  }, [currentLevel]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <video ref={videoRef} style={{ width: "100%", height: "100%" }} controls={false} />
      {status === "loading" && <Centered>Loading…</Centered>}
      {status === "error" && <Centered>Stream unavailable — try another channel</Centered>}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18,
    }}>{children}</div>
  );
}
