# Zenith — LG webOS Package

This folder is the **packaged static app** for your LG OLED. The build script
exports the Next.js app as plain HTML/JS, copies it here, and `ares-package`
bundles it into an `.ipk` you install via webOS Dev Manager.

Streams play from your home IP (no Cloudflare datacenter blocks), and the TV's
native HLS pipeline handles playback without CORS restrictions.

---

## Prerequisites (one-time)

1. **Developer Mode** on your TV — sign in at
   `developer.lge.com/develop/sdk-tools/webos-tv-dev-mode-app` and enable it
   from the Dev Mode app on the TV.
2. **webOS CLI** on your Mac:
   ```bash
   npm install -g @webos-tools/cli
   ```
3. **webOS Dev Manager** — you already have this (GUI tool for device setup and
   `.ipk` install).

---

## Step 1 — Register your TV in Dev Manager

Open webOS Dev Manager → **Add Device** → enter your TV's IP address
(Settings → Network → Wi-Fi Connection Info on the TV).
Give it a name like `lg-oled`. Leave port as `9922`.

Verify it works:
```bash
ares-device-info --device lg-oled
```

---

## Step 2 — Build the static export

From the project root:
```bash
bash scripts/build-webos.sh
```

This temporarily moves `src/app/api/` out of the source tree, runs
`next build` with `WEBOS_BUILD=1` (static export mode), copies the output into
`webos/`, then restores the API directory. The `webos/` folder now contains
`index.html` + all assets.

---

## Step 3 — Package

```bash
# from the project root
ares-package webos/ --outdir . --no-minify
```

**`--no-minify` is required.** Without it `ares-package` runs the Next.js output
through its bundled uglify-js, which cannot parse the modern syntax Next 16
emits and fails with `Failed to minify code`. The flag is real but missing from
`ares-package --help`. Nothing is lost — the export is already SWC-minified.

You may also see `ERR! uncaughtException TypeError: rimraf is not a function`
*after* the "Create com.faystech.zenith_..." line. That is a bug in the CLI's
temp-directory cleanup (rimraf v4 changed its export shape), not a packaging
failure — check that the `.ipk` exists and carry on. It also breaks
`ares-package --info`; inspect a package with `ar x <file>.ipk` instead.

This produces `com.faystech.zenith_<version>_all.ipk` in the project root
(the version comes from `webos/appinfo.json` — currently `1.0.2`).

---

## Step 4 — Install via webOS Dev Manager

**Option A — GUI (easiest):**
1. Open webOS Dev Manager
2. Select your TV device
3. Click **Install** → pick `com.faystech.zenith_1.0.2_all.ipk`
4. The app appears in the TV's app list under "Zenith"

**Option B — CLI:**
```bash
ares-install --device lg-oled com.faystech.zenith_1.0.2_all.ipk
ares-launch --device lg-oled com.faystech.zenith
```

---

## Updating the app

After code changes, repeat Steps 2–4. The install overwrites the previous
version; no uninstall needed.

---

## Notes

- **API calls** go to `https://zenith-iptv.vercel.app` (set at build time via
  `NEXT_PUBLIC_API_BASE`). Vercel serves the validated channel catalogue and EPG
  data; streams play directly from the TV. Because the catalogue is data on the
  server, re-running `npm run validate` and pushing updates the TV on its next
  launch — **no rebuild or reinstall needed**. Only app *code* changes (player,
  styles, navigation) require repackaging.
- **Back key** (webOS keyCode 461) is handled throughout — remote navigation
  works without a mouse.
- **Developer Mode** on LG TVs expires every 50 hours unless you refresh it in
  the Dev Mode app. If the app disappears, re-enable Dev Mode and reinstall.
- App ID: `com.faystech.zenith` · Version: `1.0.2` (bump in `webos/appinfo.json`)
