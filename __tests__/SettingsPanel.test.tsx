import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByLabelText("GB")).toBeInTheDocument();
    expect(screen.getByLabelText("US")).toBeInTheDocument();
  });

  it("pre-checks options already in saved prefs", () => {
    setPrefs({ languages: ["English"], countries: ["US"] });
    render(<SettingsPanel languages={langs} countries={countries} onClose={() => {}} />);
    expect(screen.getByLabelText("English")).toBeChecked();
    expect(screen.getByLabelText("Spanish")).not.toBeChecked();
    expect(screen.getByLabelText("US")).toBeChecked();
    expect(screen.getByLabelText("GB")).not.toBeChecked();
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
    await userEvent.click(screen.getByLabelText("GB"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getPrefs()).toEqual({ languages: ["Spanish"], countries: ["GB"] });
    expect(closed).toBe(true);
  });
});
