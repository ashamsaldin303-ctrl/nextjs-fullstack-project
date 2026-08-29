#!/usr/bin/env bash
# ==========================================================================
# Elyra — Production Lighthouse measurement (Phase 3, prompt §4.4)
#
# This sandbox FORBIDS `bun run build` (dev-server-only policy), so the
# production measurement is packaged here to run in any environment where
# builds are allowed (CI, a local machine, the deployment host).
#
# Usage:
#   bash scripts/lighthouse-prod.sh              # full run, all routes ×2 locales
#   CHROME_PATH=/path/to/chrome bash scripts/...
#
# Requirements: bun, a Chrome/Chromium binary, network access to npm (for
# lighthouse, cached after first install).
# ==========================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
OUT_DIR="${OUT_DIR:-./lighthouse-results}"
CHROME="${CHROME_PATH:-}"   # auto-detected if empty

# --- Chrome discovery -----------------------------------------------------
if [[ -z "$CHROME" ]]; then
  for c in \
    /home/z/.cache/ms-playwright/chromium-*/chrome-linux64/chrome \
    /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser; do
    if [[ -x "$c" ]]; then CHROME="$c"; break; fi
  done
fi
if [[ -z "$CHROME" ]]; then
  echo "✗ No Chrome/Chromium found — set CHROME_PATH=/path/to/chrome" >&2
  exit 1
fi
echo "• Chrome: $CHROME"

# --- Build ----------------------------------------------------------------
echo "• Building production bundle…"
bun run build

# --- Serve (standalone, HOSTNAME trap avoided — see README Deployment) ----
echo "• Starting production server (HOSTNAME=0.0.0.0 PORT=3000)…"
NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 bun .next/standalone/server.js &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

# Wait for readiness
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "$BASE_URL/"; then break; fi
  sleep 1
done
curl -sf -o /dev/null "$BASE_URL/" || { echo "✗ Server did not start" >&2; exit 1; }

# --- Warm all routes (compile-free measurement) ---------------------------
ROUTES=("/" "/work" "/about" "/contact" "/services/websites" "/services/automation" \
        "/en" "/en/work" "/en/about" "/en/contact" "/en/services/websites" "/en/services/automation")
for r in "${ROUTES[@]}"; do
  curl -sf -o /dev/null "$BASE_URL$r" || echo "  (warm: $r failed)"
done

# --- Measure ---------------------------------------------------------------
mkdir -p "$OUT_DIR"
echo "• Running Lighthouse on ${#ROUTES[@]} routes…"
# Lighthouse resolves via bunx's package cache (fetched from npm on first
# use — network required once). It is intentionally NEVER `bun add`-ed
# here (L6-R5 P3): a measurement run must not mutate package.json/bun.lock.
bunx lighthouse --version >/dev/null 2>&1 \
  || echo "  (lighthouse not in the bunx cache yet — the first measurement below will fetch it)"

printf "%-24s %6s %6s %6s %6s %8s %8s %8s\n" "route" "perf" "a11y" "bp" "seo" "LCP" "TBT" "CLS"
FAILED=0
for r in "${ROUTES[@]}"; do
  name=$(echo "$r" | sed 's|^/||; s|/|_|g; s|^$|home|; s|^en$|en_home|; s|^en_|en_|')
  [[ -z "$name" ]] && name="home"
  out="$OUT_DIR/lh-$name.json"
  bunx lighthouse "$BASE_URL$r" \
    --output=json --output-path="$out" \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage" \
    --only-categories=performance,accessibility,best-practices,seo \
    --max-wait-for-load=60000 --quiet >/dev/null 2>&1 || true
  if [[ -f "$out" ]]; then
    python3 - "$out" "$r" << 'PY'
import json, sys
d = json.load(open(sys.argv[1]))
c = d.get('categories', {})
a = d.get('audits', {})
def sc(k): return round((c.get(k, {}).get('score') or 0) * 100)
def ms(k):
    v = a.get(k, {}).get('numericValue')
    return f"{v/1000:.2f}s" if v is not None else "—"
perf = sc('performance')
flag = '' if perf >= 90 else '  ← BELOW 90'
print(f"{sys.argv[2]:<24} {sc('performance'):>6} {sc('accessibility'):>6} {sc('best-practices'):>6} {sc('seo'):>6} {ms('largest-contentful-paint'):>8} {ms('total-blocking-time'):>8} {a.get('cumulative-layout-shift',{}).get('displayValue','—'):>8}{flag}")
PY
  else
    echo "$r  FAILED"
    FAILED=1
  fi
done

# --- Initial JS size -------------------------------------------------------
echo ""
echo "• Initial JS (first-load chunks of /):"
python3 - << 'PY'
import json, urllib.request, re
try:
    html = urllib.request.urlopen('http://localhost:3000/').read().decode()
    scripts = re.findall(r'src="(/_next/static/[^"]+\.js)"', html)
    total = 0
    for s in scripts:
        try:
            total += len(urllib.request.urlopen('http://localhost:3000' + s).read())
        except Exception:
            pass
    print(f"  {len(scripts)} chunks, {total/1024:.0f} KB (uncompressed transfer)")
except Exception as e:
    print('  measurement failed:', e)
PY

echo ""
echo "Done. Reports saved to $OUT_DIR/"
exit $FAILED
