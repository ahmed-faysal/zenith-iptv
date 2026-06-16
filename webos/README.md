# LG webOS Packaging (Live TV)

This folder packages the app as a **hosted webOS app**: a thin wrapper that opens
the deployed Vercel URL fullscreen on your LG OLED TV. The app code lives on
Vercel — the TV just launches it, so site updates appear with no reinstall.

Your TV already has the **Homebrew Channel** installed, so no root and no
50-hour developer-mode expiry: you can install the `.ipk` and keep it.

## One-time prerequisites (on your computer)

1. Install the webOS CLI:
   ```bash
   npm install -g @webos-tools/cli
   ```
2. Add two placeholder PNG icons in this `webos/` folder (replace with the real
   app logo later — tracked as a future improvement in the spec):
   - `icon.png` — 80×80
   - `largeIcon.png` — 130×130

## Set your deployed URL

After deploying to Vercel (`npx vercel --prod` from the project root), copy the
production URL and replace `https://YOUR-PROJECT.vercel.app` in
[`appinfo.json`](./appinfo.json) with it.

## Build and install the IPK

```bash
# from the project root
ares-package webos/

# install to the TV (replace with your TV's device name from `ares-setup-device`)
ares-install --device <tv-name> com.personal.livetv_1.0.0_all.ipk
```

Alternatively, copy the generated `.ipk` to a USB stick and install it via the
**Homebrew Channel** on the TV.

## Notes

- `type: "web"` + `main: <url>` makes this a hosted app — the TV renders the
  Vercel site in its built-in browser engine, fullscreen.
- Navigation is driven by the TV remote's D-pad (arrow keys) and OK/Back, which
  the app already handles via its focus-navigation hook.
- Expect 15–45s of HLS latency on live streams; this is normal for browser IPTV.
