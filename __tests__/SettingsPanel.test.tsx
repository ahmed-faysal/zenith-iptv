import { describe, it, expect, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "@/components/SettingsPanel";
import { getPrefs, setPrefs } from "@/lib/storage";

beforeEach(() => localStorage.clear());

const langs = ["English", "Spanish"];
const countries = ["GB", "US"];

describe("SettingsPanel", () => {
  it("renders a checkbox for each available language and country", () => {
    render(<SettingsPanel languages={langs} countries={countries} onClose={() => {}} />);
    expect(screen.getByLabelText("English")).toBeInTheDocument();
    expect(screen.getByLabelText("Spanish")).toBeInTheDocument();
    // Country labels show full name + code; match by the full name fragment
    expect(screen.getByRole("checkbox", { name: /United Kingdom/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /United States/i })).toBeInTheDocument();
  });

  it("pre-checks options already in saved prefs", () => {
    setPrefs({ languages: ["English"], countries: ["US"] });
    render(<SettingsPanel languages={langs} countries={countries} onClose={() => {}} />);
    expect(screen.getByLabelText("English")).toBeChecked();
    expect(screen.getByLabelText("Spanish")).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /United States/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /United Kingdom/i })).not.toBeChecked();
  });

  it("toggles an option with the Enter key (remote OK button)", async () => {
    render(<SettingsPanel languages={["English"]} countries={[]} onClose={() => {}} />);
    const english = screen.getByLabelText("English");
    english.focus();
    await userEvent.keyboard("{Enter}");
    expect(english).toBeChecked();
  });

  it("saves the checked selection and closes", async () => {
    let closed = false;
    render(
      <SettingsPanel languages={langs} countries={countries} onClose={() => { closed = true; }} />
    );
    await userEvent.click(screen.getByLabelText("Spanish"));
    await userEvent.click(screen.getByRole("checkbox", { name: /United Kingdom/i }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getPrefs()).toEqual({ languages: ["Spanish"], countries: ["GB"] });
    expect(closed).toBe(true);
  });

  it("closes on the Escape key (Back) without saving", async () => {
    let closed = false;
    render(
      <SettingsPanel languages={langs} countries={countries}
        onClose={() => { closed = true; }} />
    );
    await userEvent.keyboard("{Escape}");
    expect(closed).toBe(true);
  });

  it("closes on the webOS Back keyCode (461)", () => {
    let closed = false;
    render(
      <SettingsPanel languages={langs} countries={countries}
        onClose={() => { closed = true; }} />
    );
    fireEvent.keyDown(window, { keyCode: 461 });
    expect(closed).toBe(true);
  });

  it("restores focus to the opener when it closes", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Settings</button>
          {open && (
            <SettingsPanel languages={["English"]} countries={[]}
              onClose={() => setOpen(false)} />
          )}
        </div>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Settings" });
    opener.focus();
    await userEvent.click(opener);
    expect(screen.getByRole("button", { name: "Close settings" })).toHaveFocus(); // modal grabbed focus
    await userEvent.keyboard("{Escape}");
    expect(opener).toHaveFocus(); // returned on close
  });
});
