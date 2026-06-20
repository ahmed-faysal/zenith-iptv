"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { Level } from "./QualitySelector";
import { hlsConfig, planRecovery, type FatalKind, type RecoveryState } from "@/lib/player";

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
  // Bounded fatal-error recovery budget; reset per channel + on successful play.
  const recovery = useRef<RecoveryState>({ network: 0, media: 0 });
  const [status, setStatus] = useState<Status>("loading");
  // Distinct from `status`: a mid-playback stall (network hiccup on a live
  // stream) while already playing. The initial load shows "Loading…" via
  // `status`, so we only surface the spinner once playback has started.
  const [buffering, setBuffering] = useState(false);

  // Hard cap: if the stream hasn't started within 15s, give up. Covers
  // unresponsive servers that never fire an error (hls.js stays silent).
  useEffect(() => {
    const t = setTimeout(
      () => setStatus((s) => (s === "loading" ? "error" : s)),
      15_000,
    );
    return () => clearTimeout(t);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    setBuffering(false);
    recovery.current = { network: 0, media: 0 }; // fresh budget per channel

    if (Hls.isSupported()) {
      const hls = new Hls(hlsConfig());
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        onLevels?.(data.levels.map((l) => ({ height: l.height })));
        video.play().then(() => setStatus("playing")).catch(() => {});
      });
      // A buffered fragment means recovery (if any) worked — refresh the budget.
      hls.on(Hls.Events.FRAG_BUFFERED, () => { recovery.current = { network: 0, media: 0 }; });
      // Fatal errors: try a bounded recovery before surfacing "unavailable".
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return; // non-fatal errors self-heal
        const kind: FatalKind =
          data.type === Hls.ErrorTypes.NETWORK_ERROR ? "network"
          : data.type === Hls.ErrorTypes.MEDIA_ERROR ? "media"
          : "other";
        const { action, state } = planRecovery(kind, recovery.current);
        recovery.current = state;
        if (action === "restartLoad") hls.startLoad();
        else if (action === "recoverMedia") hls.recoverMediaError();
        else setStatus("error");
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    }

    // Safari / native HLS
    video.src = src;
    video.addEventListener("loadeddata", () => setStatus("playing"));
    video.addEventListener("error", () => setStatus("error"));
    video.play().catch(() => {});
  }, [src, onLevels]);

  // Buffering indicator: `waiting` fires when playback stalls for data;
  // `playing`/`canplay` signal it has resumed. These are native media events,
  // so they cover both the hls.js and Safari paths. Attached once — the
  // <video> element is stable across src changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setBuffering(true);
    const onResume = () => setBuffering(false);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onResume);
    video.addEventListener("canplay", onResume);
    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onResume);
      video.removeEventListener("canplay", onResume);
    };
  }, []);

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
      {status === "playing" && buffering && (
        <Centered><span className="ltv-spinner" role="status" aria-label="Buffering" /></Centered>
      )}
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
