"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { QualitySelector, type Level } from "./QualitySelector";

type Status = "loading" | "playing" | "error";

export function VideoPlayer({ src, paused = false }: { src: string; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [levels, setLevels] = useState<Level[]>([]);
  const [current, setCurrent] = useState(-1);

  // Apply the user's play/pause intent. For a live stream, resuming lets hls.js
  // catch back up toward the live edge.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    setLevels([]);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels.map((l) => ({ height: l.height })));
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
  }, [src]);

  function selectLevel(i: number) {
    setCurrent(i);
    if (hlsRef.current) hlsRef.current.currentLevel = i;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <video ref={videoRef} style={{ width: "100%", height: "100%" }} controls={false} />
      {status === "loading" && <Centered>Loading…</Centered>}
      {status === "error" && <Centered>Stream unavailable — try another channel</Centered>}
      <div style={{ position: "absolute", bottom: 16, right: 16 }}>
        <QualitySelector levels={levels} current={current} onSelect={selectLevel} />
      </div>
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
