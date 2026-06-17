---
name: tv-remote-ux
description: Use when designing, building, or reviewing UI for this TV/living-room app — any component a user navigates with a D-pad remote, including focus states, layout, typography, animations, color, and navigation patterns.
---

# TV Remote UX

## Overview

This app runs on a living-room TV driven by a D-pad remote (Up/Down/Left/Right/OK/Back). Every design and implementation decision must work **without a mouse, touch, or keyboard**. Web and mobile UX conventions apply only where they align with this constraint.

**Core principle:** On a TV, focus state IS the UX. If you can't see where you are, nothing else matters.

Sources: Amazon Fire TV, Android TV / Google TV, Apple TV HIG, Samsung Smart TV, Roku, LG webOS TV developer docs.

---

## The Non-Negotiables

### 1. Focus state is sacred

Every focusable element must have an **unmistakable** focused appearance — visible from 3 metres on a degraded TV panel. All three signals together: **scale + ring + brightness**.

```css
/* Minimum viable focus */
[data-focusable]:focus {
  outline: 3px solid #fff;
  outline-offset: 4px;
  transform: scale(1.08);   /* 1.05–1.10 range */
  filter: brightness(1.15);
  z-index: 1;               /* prevent neighbour clipping */
  transition: transform 80ms ease, filter 80ms ease;
}
```

Rules:
- Never strip focus visibility with `outline: none`
- Never use colour alone — TV panel contrast varies wildly
- Always ensure sufficient padding around the element so the ring isn't clipped
- After app launch and after any idle period, an element **must** be in focus — never leave focus in an undefined state

### 2. Two-axis grid must be predictable

The user builds a mental map of the grid from the first keypress. Break it → remote feels broken. (Fire TV, Android TV, Apple TV all mandate this.)

- **Vertical axis** = traverse categories (rows); **Horizontal axis** = browse items within a category
- `data-row` on every row container; `data-focusable` on every card
- `useGridFocus` handles ArrowUp/ArrowDown cross-row with column-index preservation — don't bypass it with custom keydown handlers
- **No asymmetric, diagonal, or overlapping layouts** — they make the next-focus direction unpredictable
- Navigation order should **loop**: from the last item in a row, ArrowRight wraps to the first item (and vice versa)
- Every control must be reachable in ≤ a few D-pad presses — test all paths with a keyboard before shipping

### 3. Every screen has an unambiguous Back

- **Escape** and **Backspace** (while not actively editing text) navigate back
- Dead-ends are critical bugs — same severity as a broken feature
- Back button: **never** gate with confirmation dialogs on exit; **never** show an on-screen Exit button (hardware back button handles exit)
- `router.push("/")` is the minimum; deep stacks need `router.back()`

### 4. Initial focus on every screen/panel load

No mouse to click "start here". First focusable element must receive focus as soon as content renders.

- `useGridFocus(ref, ready)` handles this via the `ready` flag
- Modals/panels (ChannelSidebar, SettingsPanel): focus first item on open via `useEffect(() => { firstItemRef.current?.focus(); }, [isOpen])`

---

## Safe Area & Layout

TVs crop edges (overscan). Official minimums differ by platform — use the largest to be safe:

| Platform | Horizontal margin | Vertical margin |
|----------|------------------|-----------------|
| LG webOS (official) | 20px | 20px |
| Android TV / Fire TV (5% rule) | 96px | 54px |
| **Use this** (safe across all) | **54px** | **40px** |

- Keep all focusable elements and critical text within these margins
- Always landscape orientation; use horizontal space aggressively
- Use two-axis layout: rows of horizontally scrollable cards, navigated vertically
- **No ActionBar, pull-down menus, ViewPager, or bottom navigation** — these are mobile patterns

### Card sizing & aspect ratios

Official Android TV card aspect ratios:

| Ratio | Use case |
|-------|----------|
| **16:9** | Video thumbnails, channel cards (primary) |
| **1:1** | Logos, icons, square art |
| **2:3** | Portrait art (movies, shows) |

- 20dp/px spacing between cards (Android TV spec)
- 4-column layout: ~196dp per card at 1080p (≈ 196px at 1x)
- Compact/overlay cards: add a semi-transparent dark scrim behind any text overlay so text remains readable regardless of background image

---

## Typography & Legibility (3-metre rule)

Viewing distance is ~3m (10ft). Fire TV official minimums:

| Role | Minimum | At 1080p |
|------|---------|---------|
| Label / meta | 14sp | **28px** |
| Body / descriptions | 16px | 16px |
| Card titles | 18px | 18px |
| Row headings | 22px+ | 22px+ |
| Player overlays | 24px+ | 24px+ |

Rules (Android TV + Fire TV guidelines):
- **Dark backgrounds** — TV panels are brighter than desktop; dark themes are preferred and create a cinematic experience
- **High contrast** — WCAG AA (4.5:1) is the floor; aim for AAA (7:1) for text over video
- **Simple sans-serif** only (Roboto, Inter, system-ui) — no decorative, display, or thin-weight fonts
- **Avoid font weights < 400** — thin strokes disappear at distance
- Break text into short, scannable chunks — users don't read on TV

---

## Color

From Fire TV and Android TV / Google TV guidelines:

- **Dark theme is strongly preferred** — creates immersive, cinematic experience; reduces eye strain at distance
- **Less saturated colours** than desktop designs — TV screens have higher inherent contrast
- **Cool tones perform better** (blue, purple, grey) than warm tones (red, orange) on TV panels
- Build palette around 5 roles: Primary (key actions), Secondary (supporting), Tertiary (accents/inputs), Surface (backgrounds), Outline (dividers)
- **Content-based dynamic colour**: extract a seed colour from the current channel logo/thumbnail and derive the accent — creates an immersive "channel atmosphere"
- Focus ring / highlight: white (#ffffff) or a high-chroma primary on dark background; never a low-contrast colour

---

## Animation & Performance

TV browsers (webOS Chromium, Fire TV Silk) are significantly slower than desktop Chrome.

| Type | Budget |
|------|--------|
| Focus ring/scale transition | ≤ 80ms |
| Panel slide-in | 150–220ms |
| Page transition | 200–300ms |

- `transform` and `opacity` only — never animate `width`, `height`, `top`, `left` (causes layout reflow)
- Add `will-change: transform` on animated cards if jank appears
- Keep animations **purposeful** — every motion should confirm an action or communicate state, not just decorate
- **No scroll-triggered effects, parallax, or cursor-following** — none of these exist on a remote
- Prefer CSS `transition` over JS animation libraries for simple moves

---

## Remote Key Handling

From Samsung Tizen, Android TV, and LG webOS specs:

| Key | `e.key` | `e.keyCode` | Notes |
|-----|---------|-------------|-------|
| Arrow keys | ArrowUp/Down/Left/Right | 37–40 | Auto-detected; no registration needed |
| Enter / OK | Enter | 13 | Activates focused element |
| Back (webOS) | `'unidentified'` or GoBack | **461** (0x1CD) | webOS-specific; NOT Escape |
| Back / Escape (non-webOS) | Escape | 27 | Samsung, Fire TV, Android TV |
| Backspace | Backspace | 8 | Back when not editing; edit when in text field |
| Media keys | varies | varies | May need platform registration (Samsung Tizen) |

**webOS Back button is keyCode 461** — critical for LG TV:

```typescript
function onKey(e: KeyboardEvent) {
  const isBack = e.key === "Escape" || e.key === "GoBack" || e.keyCode === 461;
  const isBackspace = e.key === "Backspace" && document.activeElement !== inputRef.current;
  if (isBack || isBackspace) router.push("/");
}
```

Additional rules:
- **Always check both `e.key` and `e.keyCode`** — webOS sometimes returns `'unidentified'` for `e.key` on media/function keys; fall back to `e.keyCode`
- Listen at the container level where possible, not on every individual element
- Remote OK sends `Enter`, **not** Space — checkboxes/toggles must handle `onKeyDown` for `"Enter"`
- Never show on-screen buttons that duplicate remote keys (Back, Play, etc.)

---

## LG webOS & OLED-Specific (LG C3)

### Magic Remote — dual-mode remote

The LG Magic Remote works in two modes simultaneously:

- **Pointer mode**: laser pointer / gyro cursor, acts like a mouse — focus follows the cursor
- **5-way D-pad mode**: standard arrow + OK navigation; pressing any arrow key switches from pointer mode to D-pad mode

**You must support both modes.** There is no API to disable pointer mode. D-pad navigation must work perfectly because users can switch modes at any time. Don't assume pointer-mode clicks will always be available.

### webOS browser engine

- webOS 23 (C3, 2023): Chromium-based, roughly equivalent to mid-era Chromium. Exact version varies.
- Include `-webkit-` vendor prefixes alongside standard CSS (e.g. `-webkit-transform`, `-webkit-animation`) — older webOS versions require them
- **Avoid Tailwind CSS v4** — known to break completely on webOS (styles don't apply). Use Tailwind v3 or plain CSS.
- Treat performance as mobile-constrained: reduce DOM size, avoid layout thrash, compress images

### OLED burn-in (important for LG C3 specifically)

LG OLED panels can develop permanent burn-in from static bright elements displayed for long periods.

**Rules for this app:**
- **Avoid persistent bright logos/badges** in fixed screen positions — the channel category labels, row titles, and TopBar buttons sit in the same spot every session
- Keep static UI elements **dark or low-luminance** where possible (dark theme helps significantly)
- LG's auto **Screen Shift / Pixel Shift** moves the image 2–3px periodically — don't fight it with `position: fixed` elements that the TV can't shift
- The player view (full-screen video) is safe — the content itself is always changing
- If adding a persistent HUD or overlay (e.g. a "now playing" banner), make it dismissible or auto-hide after a few seconds

---

## What NOT to bring from web/mobile skills

| Convention | Why it breaks on TV |
|-----------|---------------------|
| Asymmetric / grid-breaking layouts | D-pad next-focus direction becomes unpredictable |
| Bottom navigation bar | Mobile pattern; remote handles app navigation |
| Hover states as primary affordance | No pointer/hover on D-pad |
| Touch target size (44×44px) | Irrelevant — cards are large for visual browsing |
| Infinite scroll | No scroll gesture; use row caps + Search |
| Custom cursors, drag & drop | No pointer on TV |
| Decorative / thin fonts | Illegible at 3m |
| Modal without focus trap | Remote escapes the modal, gets lost |
| Confirmation dialog on exit | Official guideline: don't gate exit with confirmations |
| Gradient-heavy web aesthetics | Busy backgrounds make text illegible on TV panels |

---

## Navigation Patterns

### Home — row grid
`useGridFocus` on container; `useFocusNav` horizontal within each `data-row`. TopBar is the first `data-row`.

### TopBar
`useFocusNav` with `orientation: "horizontal"` for Search ↔ Settings. ArrowDown from TopBar → first channel row.

### Search
- `autoFocus` on input
- ArrowDown from input → first `[data-focusable]` in results
- ArrowUp from results → input
- Backspace (input empty) / Escape → Home

### Modals / panels (ChannelSidebar, SettingsPanel)
- Focus first item on open
- `useFocusNav` vertical within panel
- Escape / Back closes; return focus to the element that opened it

### Player (WatchView)
- Escape / Backspace → Home
- ArrowLeft opens ChannelSidebar; ArrowRight closes it
- `F` toggles favourite

---

## Quick Reference

```
New view checklist:
  □ useGridFocus wired (initial focus + cross-row ArrowUp/Down)
  □ data-row on every row; data-focusable on every card
  □ :focus styles: scale(1.05-1.10) + outline + brightness
  □ Back route handles Escape AND keyCode 461 (webOS) AND GoBack
  □ Safe area margins: >=54px sides, >=40px top/bottom
  □ Font sizes: labels >=28px, body >=16px, card titles >=18px
  □ Dark background, high-contrast text (>=4.5:1)
  □ Animations: transform/opacity only, <=250ms
  □ No static bright elements in fixed positions (OLED burn-in)

New interactive element checklist:
  □ tabIndex=0 (or native button/a)
  □ data-focusable attribute
  □ :focus style (not just :hover)
  □ onKeyDown handler for Enter (not just onClick)
  □ Part of a data-row (so grid nav reaches it)
  □ Key handler uses e.keyCode fallback (webOS unidentified keys)
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Focus ring invisible on dark card | `outline-offset: 4px` + white ring + `z-index: 1` |
| ArrowDown skips rows / wrong row | `data-row` must be on the direct row element, not a wrapper |
| Settings/modal unreachable | Wrap in its own `data-row` or dedicated focus management |
| Backspace exits while user is typing | Guard: `document.activeElement === inputRef.current && q !== ""` |
| Panel opens but focus stays behind | `useEffect(() => firstItemRef.current?.focus(), [isOpen])` |
| Checkboxes/toggles don't respond to remote OK | Add `onKeyDown={(e) => e.key === "Enter" && toggle()}` |
| Text overlays unreadable on bright thumbnails | Add dark gradient scrim behind text |
| Layout fine on desktop, cut off on TV | Apply 96px / 54px safe margins; test at 1920×1080 |
| Focus lost after loading state resolves | Pass `ready` flag to `useGridFocus`; re-focus on state change |
