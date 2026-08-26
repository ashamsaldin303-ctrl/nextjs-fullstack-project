#!/bin/bash
# UI-3 verification script — starts dev server (it is currently down after a
# concurrent agent's crash), runs all browser checks, then stops only its own PID.
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

# ---------- 1) HOME (AR, desktop): initial layout ----------
$AB open http://localhost:3000/ ; sleep 4
$AB set viewport 1440 1560
$AB eval 'window.scrollTo(0, 4200)' ; sleep 3
$AB eval '(() => { const el = document.querySelector("[aria-labelledby=\"sim-title\"]"); if (!el) return "NOT MOUNTED"; el.scrollIntoView({block:"start"}); return "mounted h=" + el.offsetHeight })()'
sleep 1
$AB screenshot $D/01-home-initial.png
echo "=== HOME_INITIAL_DOM"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")), badges: [...s.querySelectorAll("span[aria-hidden]")].map(x => x.textContent).filter(t => /^[A-Z]{2,}$/.test(t||"")).join(","), logPlaceholder: s.querySelector("[role=log]").innerText, payloadEvent: s.querySelector("pre").innerText.split("\n")[1].trim(), roleLog: s.querySelector("[role=log]").getAttribute("role"), ariaLiveOff: s.querySelector("[role=log]").getAttribute("aria-live"), dirLtr: s.querySelector("[role=log]").getAttribute("dir") }) })()'

# ---------- 2) HOME: run -> mid-run ----------
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button")].find(x => x.textContent.includes("جرّب")); b.click(); return "clicked" })()'
sleep 0.9
$AB screenshot $D/02b-home-midrun.png
echo "=== HOME_MIDRUN_DOM"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ packet: !!s.querySelector(".elyra-packet"), stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")), logLines: s.querySelector("[role=log]").innerText.split("\n") }) })()'

# ---------- 3) HOME: completion ----------
sleep 5.5
$AB screenshot $D/03-home-completed.png
echo "=== HOME_COMPLETED_DOM"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")), logLines: s.querySelector("[role=log]").innerText.split("\n"), nodeFlash: !!s.querySelector(".elyra-node-flash"), replay: [...s.querySelectorAll("button")].some(b => b.textContent.includes("إعادة")) }) })()'

# ---------- 4) /services/automation: scenario switching ----------
$AB open http://localhost:3000/services/automation ; sleep 4
$AB eval 'window.scrollTo(0, 2600)' ; sleep 3
$AB eval '(() => { const el = document.querySelector("[aria-labelledby=\"sim-title\"]"); if (!el) return "NOT MOUNTED"; el.scrollIntoView({block:"start"}); return "mounted" })()'
sleep 1
echo "=== AUTO_PICKERS"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ pickers: [...s.querySelectorAll("button[aria-pressed]")].map(b => b.textContent + ":" + b.getAttribute("aria-pressed")) }) })()'
$AB screenshot $D/06-automation-initial.png
# switch to paymentReminder
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button[aria-pressed]")].find(x => x.textContent.includes("تذكير")); b.click(); return "switched paymentReminder" })()'
sleep 1.5
echo "=== AUTO_PAYMENT_BADGES"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ badges: [...s.querySelectorAll("span[aria-hidden]")].map(x => x.textContent).filter(t => /^[A-Z]{2,}$/.test(t||"")).join(","), stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")), logCleared: s.querySelector("[role=log]").innerText, payloadLine2: s.querySelector("pre").innerText.split("\n")[1].trim(), endpoint: [...s.querySelectorAll("h3")].find(h => h.textContent.includes("الحمولة")).parentElement.querySelector("span").textContent }) })()'
$AB screenshot $D/07-automation-payment.png
# switch to weeklyReport and RUN it
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button[aria-pressed]")].find(x => x.textContent.includes("تقرير")); b.click(); return "switched weeklyReport" })()'
sleep 1.5
echo "=== AUTO_WEEKLY_BADGES"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ badges: [...s.querySelectorAll("span[aria-hidden]")].map(x => x.textContent).filter(t => /^[A-Z]{2,}$/.test(t||"")).join(","), payloadLine2: s.querySelector("pre").innerText.split("\n")[1].trim() }) })()'
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button")].find(x => x.textContent.includes("جرّب")); b.click(); return "run clicked" })()'
sleep 1
$AB screenshot $D/08-automation-weekly-midrun.png
sleep 5.5
echo "=== AUTO_WEEKLY_LOG"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ logLines: s.querySelector("[role=log]").innerText.split("\n"), stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")) }) })()'
$AB screenshot $D/09-automation-weekly-done.png

# ---------- 5) /en check ----------
$AB open http://localhost:3000/en ; sleep 4
$AB eval 'window.scrollTo(0, 4200)' ; sleep 3
$AB eval '(() => { const el = document.querySelector("[aria-labelledby=\"sim-title\"]"); if (!el) return "NOT MOUNTED"; el.scrollIntoView({block:"start"}); return "mounted" })()'
sleep 1
echo "=== EN_INITIAL_DOM"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ dir: document.documentElement.getAttribute("dir"), stats: [...s.querySelectorAll("dl > div")].map(d => d.innerText.replace(/\n/g," | ")), logHeader: [...s.querySelectorAll("h3")].map(h => h.textContent).join(" / "), logPlaceholder: s.querySelector("[role=log]").innerText, endpoint: [...s.querySelectorAll("h3")].find(h => h.textContent.includes("Payload")).parentElement.querySelector("span").textContent }) })()'
$AB eval '(() => { const b = [...document.querySelectorAll("[aria-labelledby=\"sim-title\"] button")].find(x => x.textContent.includes("Run") || x.textContent.includes("Try")); b.click(); return "clicked" })()'
sleep 1
$AB screenshot $D/10-en-midrun.png
sleep 5.5
echo "=== EN_COMPLETED_DOM"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); return JSON.stringify({ logLines: s.querySelector("[role=log]").innerText.split("\n"), nodeOrder: [...s.querySelectorAll("[aria-labelledby=\"sim-title\"] .elyra-mono")].filter(x => /^[A-Z]/.test(x.textContent)).map(x => x.textContent).join(","), firstNodeLeftVsLast: (() => { const nodes = [...s.querySelectorAll("div.absolute.-translate-x-1\\/2")]; if (nodes.length < 2) return "n/a"; const r1 = nodes[0].getBoundingClientRect(); const r2 = nodes[nodes.length-1].getBoundingClientRect(); return r1.left < r2.left ? "LTR-flow" : "RTL-flow" })() }) })()'
$AB screenshot $D/11-en-completed.png

# ---------- 6) Mobile 390x844 (AR home) ----------
$AB open http://localhost:3000/ ; sleep 4
$AB set viewport 390 844
$AB eval 'window.scrollTo(0, 4200)' ; sleep 3
$AB eval '(() => { const el = document.querySelector("[aria-labelledby=\"sim-title\"]"); if (!el) return "NOT MOUNTED"; el.scrollIntoView({block:"start"}); return "mounted" })()'
sleep 1
echo "=== MOBILE_DOM"
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); const stage = s.querySelector("[role=region]"); const grid = s.querySelector("[role=log]").closest(".grid"); return JSON.stringify({ stageScrollsX: stage.scrollWidth > stage.clientWidth, scrollW: stage.scrollWidth, clientW: stage.clientWidth, gridCols: getComputedStyle(grid).gridTemplateColumns.split(" ").length, statsCols: getComputedStyle(s.querySelector("dl")).gridTemplateColumns.split(" ").length, hintVisible: [...s.querySelectorAll("p")].some(p => p.textContent.includes("اسحب") && getComputedStyle(p).display !== "none") }) })()'
$AB screenshot $D/12-mobile-stage.png
$AB eval '(() => { const s = document.querySelector("[aria-labelledby=\"sim-title\"]"); const grid = s.querySelector("[role=log]").closest(".grid"); grid.scrollIntoView({block:"start"}); return "ok" })()'
sleep 1
$AB screenshot $D/13-mobile-panels.png

# ---------- 7) console errors ----------
echo "=== BROWSER_ERRORS"
$AB errors
echo "=== DONE — stopping my server pid $SRV"
kill $SRV 2>/dev/null
