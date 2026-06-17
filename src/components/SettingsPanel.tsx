"use client";
import { useEffect, useRef, useState } from "react";
import { getPrefs, setPrefs } from "@/lib/storage";
import { useFocusNav } from "@/hooks/useFocusNav";

// Pick-lists derived from the loaded channels — no typing required on a TV
// remote. Languages/countries are the distinct values present in the catalogue.
export function SettingsPanel({
  languages, countries, onClose,
}: { languages: string[]; countries: string[]; onClose: () => void }) {
  const [langs, setLangs] = useState<Set<string>>(() => new Set(getPrefs().languages));
  const [ctry, setCtry] = useState<Set<string>>(() => new Set(getPrefs().countries));
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "vertical" });

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-focusable]")?.focus();
  }, []);

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }

  function save() {
    setPrefs({ languages: [...langs], countries: [...ctry] });
    onClose();
  }

  const listStyle: React.CSSProperties = { maxHeight: 160, overflowY: "auto", margin: "6px 0 16px", display: "flex", flexDirection: "column", gap: 4 };
  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={ref} style={{ background: "#111", padding: 24, borderRadius: 12, width: 360, maxHeight: "80vh", overflowY: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Settings</h2>

        <h3 style={{ marginBottom: 0 }}>Languages</h3>
        <div style={listStyle}>
          {languages.map((l) => (
            <label key={l} style={rowStyle}>
              <input
                data-focusable
                type="checkbox"
                checked={langs.has(l)}
                onChange={() => setLangs(toggle(langs, l))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setLangs(toggle(langs, l)); } }}
              />
              {l}
            </label>
          ))}
        </div>

        <h3 style={{ marginBottom: 0 }}>Countries</h3>
        <div style={listStyle}>
          {countries.map((c) => (
            <label key={c} style={rowStyle}>
              <input
                data-focusable
                type="checkbox"
                checked={ctry.has(c)}
                onChange={() => setCtry(toggle(ctry, c))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setCtry(toggle(ctry, c)); } }}
              />
              {c}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button data-focusable onClick={onClose} style={{ padding: "8px 16px" }}>Cancel</button>
          <button data-focusable onClick={save} style={{ padding: "8px 16px", background: "#4da3ff", color: "#fff", border: "none", borderRadius: 8 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
