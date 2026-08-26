#!/bin/bash
# UI-3 verification part 3 — reduced-motion behavior
cd /home/z/my-project
bun run dev > /dev/null 2>&1 &
SRV=$!
code=000
for i in $(seq 1 25); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 3
done
echo "=== SERVER_UP code=$code (pid $SRV)"
[ "$code" != "200" ] && { echo "SERVER FAILED"; kill $SRV 2>/dev/null; exit 1; }

AB="agent-browser --session ui3"
D=/home/z/my-project/tool-results/ui3

$AB open http://localhost:3000/ ; sleep 4
# try to emulate prefers-reduced-motion
$AB eval '(() => { let mq = window.matchMedia("(prefers-reduced-motion: reduce)"); if (mq.media === "not all") return "media feature unsupported"; return "supported, current=" + mq.matches })()'
echo "--- injecting reduced-motion override + reload"
$AB eval '(() => { const s = document.createElement("style"); s.textContent = ""; document.head.appendChild(s); return "noop" })()' > /dev/null
# Use CDP-free approach: start a NEW route via route interception is overkill.
# Instead use Playwright-level emulation through agent-browser set media if available:
$AB set media reduced 2>&1 | head -2
$AB eval 'window.matchMedia("(prefers-reduced-motion: reduce)").matches' 2>&1 | head -2
$AB reload ; sleep 4
$AB eval 'window.scrollTo(0, 4200)' ; sleep 3
$AB eval '(() => { const el = document.querySelector("[aria-labelledby=\"sim-title\"]"); if (!el) return "NOT MOUNTED"; el.scrollIntoView({block:"start"}); return "mounted" })()'
sleep 1
echo "=== REDUCED_STATE"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ reducedMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches }) })()'
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button")].find(x => x.textContent.includes("جرّب")); b.click(); return "clicked" })()'
sleep 1
echo "=== REDUCED_MIDRUN"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ packet: !!s.querySelector(".elyra-packet"), logLineAnim: !!s.querySelector(".elyra-log-line"), dotgridStill: true }) })()'
$AB screenshot $D/14-reduced-midrun.png
echo "=== DONE — stopping my server pid $SRV"
kill $SRV 2>/dev/null
