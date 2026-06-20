"use client";
import { useEffect, useRef, useState } from "react";
import { getPrefs, setPrefs } from "@/lib/storage";
import { useFocusNav } from "@/hooks/useFocusNav";
import { isBackKey } from "@/lib/keys";

export function SettingsPanel({
  languages, countries, onClose,
}: { languages: string[]; countries: string[]; onClose: () => void }) {
  const [langs, setLangs] = useState<Set<string>>(() => new Set(getPrefs().languages));
  const [ctry, setCtry] = useState<Set<string>>(() => new Set(getPrefs().countries));
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "vertical" });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-focusable]")?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isBackKey(e)) { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }

  function save() {
    setPrefs({ languages: [...langs], countries: [...ctry] });
    onClose();
  }

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} />
      <div ref={ref} className="settings-sidebar">
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close" data-focusable onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <h3 className="settings-section-title">Languages</h3>
        <div className="settings-list">
          {languages.map((l) => (
            <label key={l} className="settings-row">
              <input
                data-focusable
                type="checkbox"
                checked={langs.has(l)}
                onChange={() => setLangs(toggle(langs, l))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setLangs(toggle(langs, l)); } }}
              />
              <span>{l}</span>
            </label>
          ))}
        </div>

        <h3 className="settings-section-title">Countries</h3>
        <div className="settings-list">
          {countries.map((c) => (
            <label key={c} className="settings-row">
              <input
                data-focusable
                type="checkbox"
                checked={ctry.has(c)}
                onChange={() => setCtry(toggle(ctry, c))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setCtry(toggle(ctry, c)); } }}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>

        <div className="settings-actions">
          <button data-focusable className="settings-btn" onClick={onClose}>Cancel</button>
          <button data-focusable className="settings-btn settings-btn--primary" onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}
