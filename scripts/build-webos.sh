#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# All API routes are dynamic Route Handlers — incompatible with static export.
# The webOS app never calls them directly (it points at the Vercel deployment
# via NEXT_PUBLIC_API_BASE, and NEXT_PUBLIC_STREAM_PROXY_ENABLED=0), so we
# move the entire api/ directory out during the build, then restore it.
API_DIR="src/app/api"
API_BACKUP="$(mktemp -d /tmp/zenith-api.XXXXXX)"
mv "$API_DIR" "$API_BACKUP/api"
cleanup() { mv "$API_BACKUP/api" "$API_DIR"; rmdir "$API_BACKUP" 2>/dev/null || true; }
trap cleanup EXIT

WEBOS_BUILD=1 \
  NEXT_PUBLIC_API_BASE=https://zenith-iptv.vercel.app \
  NEXT_PUBLIC_STREAM_PROXY_ENABLED=0 \
  npm run build

# Copy the static export into the webOS package directory.
# appinfo.json, icon.png, and largeIcon.png already live in webos/
# and are not produced by next build — they won't be overwritten.
cp -r out/. webos/

echo ""
echo "✓ Static export copied to webos/"
echo ""
echo "Next steps:"
echo "  Package:  ares-package webos/ --outdir ."
echo "  Install:  ares-install com.faystech.zenith_1.0.0_all.ipk"
echo "  Launch:   ares-launch com.faystech.zenith"
