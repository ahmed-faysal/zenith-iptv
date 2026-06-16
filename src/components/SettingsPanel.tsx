"use client";
import { useState } from "react";
import { getPrefs, setPrefs } from "@/lib/storage";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [langs, setLangs] = useState(getPrefs().languages.join(", "));
  const [ctry, setCtry] = useState(getPrefs().countries.join(", "));

  function save() {
    setPrefs({
      languages: langs.split(",").map((s) => s.trim()).filter(Boolean),
      countries: ctry.split(",").map((s) => s.trim()).filter(Boolean),
    });
    onClose();
  }

  const field = { width: "100%", padding: 10, marginTop: 6, marginBottom: 16, borderRadius: 8, border: "1px solid #333", background: "#161616", color: "#eee" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111", padding: 24, borderRadius: 12, width: 360 }}>
        <h2 style={{ marginTop: 0 }}>Settings</h2>
        <label>Languages (comma-separated)
          <input style={field} value={langs} onChange={(e) => setLangs(e.target.value)} placeholder="English, Spanish" />
        </label>
        <label>Countries (comma-separated codes)
          <input style={field} value={ctry} onChange={(e) => setCtry(e.target.value)} placeholder="GB, US" />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>Cancel</button>
          <button onClick={save} style={{ padding: "8px 16px", background: "#4da3ff", color: "#fff", border: "none", borderRadius: 8 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
