#!/bin/bash
# UI-3 verification part 2 — /services/automation scenario switching (server died mid-run before)
cd /home/z/my-project
bun run dev > /dev/null 2>&1 &
SRV=$!
code=000
for i in $(seq 1 25); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/services/automation 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 3
done
echo "=== SERVER_UP code=$code (pid $SRV)"
[ "$code" != "200" ] && { echo "SERVER FAILED"; kill $SRV 2>/dev/null; exit 1; }

AB="agent-browser --session ui3"
D=/home/z/my-project/tool-results/ui3

$AB open http://localhost:3000/services/automation ; sleep 4
$AB set viewport 1440 1560
$AB eval 'window.scrollTo(0, 2600)' ; sleep 3
$AB eval '(() => { const el = document.querySelector("[aria-labelledby=\"sim-title\"]"); if (!el) return "NOT MOUNTED"; el.scrollIntoView({block:"start"}); return "mounted" })()'
sleep 1
echo "=== AUTO_PICKERS"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ pickers: [...s.querySelectorAll("button[aria-pressed]")].map(b => b.textContent + ":" + b.getAttribute("aria-pressed")) }) })()'
$AB screenshot $D/06-automation-initial.png
echo "=== RUN NEWORDER FIRST (mid-run badges + packet)"
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button")].find(x => x.textContent.includes("جرّب")); b.click(); return "clicked" })()'
sleep 0.9
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ packet: !!s.querySelector(".elyra-packet"), badges: [...s.querySelectorAll("span[aria-hidden]")].map(x => x.textContent).filter(t => /^[A-Z]{2,}$/.test(t||"")).join(",") }) })()'
sleep 5.5
echo "=== SWITCH TO paymentReminder (log must clear)"
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button[aria-pressed]")].find(x => x.textContent.includes("تذكير")); b.click(); return "switched paymentReminder" })()'
sleep 1.5
echo "=== AUTO_PAYMENT_STATE"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ badges: [...s.querySelectorAll("span[aria-hidden]")].map(x => x.textContent).filter(t => /^[A-Z]{2,}$/.test(t||"")).join(","), stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")), logCleared: s.querySelector("[role=log]").innerText, payloadLine2: s.querySelector("pre").innerText.split("\n")[1].trim(), endpoint: [...s.querySelectorAll("h3")].find(h => h.textContent.includes("الحمولة")).parentElement.querySelector("span").textContent }) })()'
$AB screenshot $D/07-automation-payment.png
echo "=== SWITCH TO weeklyReport + RUN"
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button[aria-pressed]")].find(x => x.textContent.includes("تقرير")); b.click(); return "switched weeklyReport" })()'
sleep 1.5
echo "=== AUTO_WEEKLY_STATE"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ badges: [...s.querySelectorAll("span[aria-hidden]")].map(x => x.textContent).filter(t => /^[A-Z]{2,}$/.test(t||"")).join(","), payloadLine2: s.querySelector("pre").innerText.split("\n")[1].trim(), endpoint: [...s.querySelectorAll("h3")].find(h => h.textContent.includes("الحمولة")).parentElement.querySelector("span").textContent }) })()'
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button")].find(x => x.textContent.includes("جرّب")); b.click(); return "run clicked" })()'
sleep 1
$AB screenshot $D/08-automation-weekly-midrun.png
sleep 5.5
echo "=== AUTO_WEEKLY_DONE"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ logLines: s.querySelector("[role=log]").innerText.split("\n"), stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")), nodeFlash: !!s.querySelector(".elyra-node-flash") }) })()'
$AB screenshot $D/09-automation-weekly-done.png
echo "=== BROWSER_ERRORS"
$AB errors
echo "=== DONE — stopping my server pid $SRV"
kill $SRV 2>/dev/null
