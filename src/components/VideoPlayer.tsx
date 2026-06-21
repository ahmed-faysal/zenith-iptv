"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { Level } from "./QualitySelector";
import { hlsConfig, planRecovery, nextSource, type FatalKind, type RecoveryState } from "@/lib/player";

type Status = "loading" | "playing" | "error";

// Playback surface only. Play/pause, volume, and quality are driven by props so
// the PlayerOverlay owns the UI. Given several candidate URLs for the channel,
// it plays the first and silently advances to the next when one fails — only
// showing "Stream unavailable" once every source is exhausted. Keyed by channel
// id upstream, so it remounts (source index back to 0) on a channel change.
export function VideoPlayer({
  srcs, paused = false, volume = 1, muted = false, currentLevel = -1, onLevels,
}: {
  srcs: string[];
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  currentLevel?: number;
  onLevels?: (levels: Level[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Bounded fatal-error recovery budget; reset per source + on successful play.
  const recovery = useRef<RecoveryState>({ network: 0, media: 0 });
  const [sourceIdx, setSourceIdx] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  // Distinct from `status`: a mid-playback stall while already playing.
  const [buffering, setBuffering] = useState(false);

  useEffect(() => {
    const src = srcs[sourceIdx] ?? srcs[0];
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    setBuffering(false);
    recovery.current = { network: 0, media: 0 };
    // A source that fails before it ever starts is dead -> advance immediately;
    // one that dies mid-playback gets planRecovery first.
    let started = false;

    // Move to the next source, or surface the error when none are left.
    const fail = () => {
      const next = nextSource(sourceIdx, srcs.length);
      if (next === null) setStatus("error");
      else setSourceIdx(next);
    };

    // Hard cap: a source that neither plays nor errors within 15s is treated as
    // dead (covers servers that accept the connection but never respond).
    const timer = setTimeout(() => { if (!started) fail(); }, 15_000);

    if (Hls.isSupported()) {
      const hls = new Hls(hlsConfig());
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        onLevels?.(data.levels.map((l) => ({ height: l.height })));
        video.play().then(() => { started = true; setStatus("playing"); }).catch(() => {});
      });
      // A buffered fragment means recovery (if any) worked — refresh the budget.
      hls.on(Hls.Events.FRAG_BUFFERED, () => { recovery.current = { network: 0, media: 0 }; });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return; // non-fatal errors self-heal
        if (!started) { fail(); return; } // dead source -> next source
        const kind: FatalKind =
          data.type === Hls.ErrorTypes.NETWORK_ERROR ? "network"
          : data.type === Hls.ErrorTypes.MEDIA_ERROR ? "media"
          : "other";
        const { action, state } = planRecovery(kind, recovery.current);
        recovery.current = state;
        if (action === "restartLoad") hls.startLoad();
        else if (action === "recoverMedia") hls.recoverMediaError();
        else fail();
      });
      return () => { clearTimeout(timer); hls.destroy(); hlsRef.current = null; };
    }

    // Safari / native HLS
    video.src = src;
    const onLoaded = () => { started = true; setStatus("playing"); };
    const onErr = () => fail();
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onErr);
    video.play().catch(() => {});
    return () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onErr);
    };
  }, [sourceIdx, srcs, onLevels]);

  // Buffering indicator: `waiting` stalls, `playing`/`canplay` resume. Native
  // media events, so they cover both the hls.js and Safari paths. Attached once.
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
      {status === "loading" && (
        <Centered>{sourceIdx > 0 ? "Trying another source…" : "Loading…"}</Centered>
      )}
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
