# CLAUDE.md — قواعد التشغيل الدائمة لمشروع Elyra

> ملف القواعد لكل وكيل يعمل على هذا المستودع (المصدر: حلقة AGENT-PACK، قرار D9).
> سجل القرارات الكامل: `/home/z/pack-plan.md` (عقد الحلقة — خارج المستودع). الأقراص العميقة (الظهر، النشر، الويبهوك): `README.md`. الحزمة البحثية المستقدمة: `agent-pack/`.

## 1) حقائق المكدس — تُقرأ ولا تُفترض من جديد

- Next.js 16 App Router: **كل** الصفحات والتخطيط الجذري تحت `src/app/[locale]/layout.tsx` — لا يوجد `src/app/layout.tsx` غير مترجم؛ و`global-error.tsx` في جذر `src/app/`.
- الوسيط هو `src/proxy.ts` (ملف next-intl في Next.js 16) — **ليس `middleware.ts`**؛ لا تنشئ واحداً.
- نقطة الكتابة الوحيدة في الموقع: `POST /api/leads` (`src/app/api/leads/route.ts`) — Zod + إعادة الحساب الخادمية + Prisma + rate-limit ثنائي الطبقة. لا مسار كتابة آخر إطلاقاً.
- الحركة: **framer-motion** (+`MotionConfig reducedMotion="user"` في `src/components/layout/motion-config.tsx`) و**three/R3F** بتحميل مؤجل (idle/near-viewport). **لا GSAP** (D1)؛ **Lenis هو المُنعِّم العام الوحيد** (`<SmoothScroll/>` يُركَّب في `src/app/[locale]/layout.tsx` — مقفول منذ REF-2 Phase A، ووضع duration-mode ‏0.8s cubic-out منذ MODEL-5). `scroll-behavior: smooth` **ممنوع** — `globals.css` يثبّت `auto` صراحةً كي يبقى التنعيم بيد Lenis وحده (double-easing صنف الخطأ الممنوع)؛ التنعيم ليس عبر `useSpring`/lerp، والتمرير البرمجي عبر `lenisScrollTo` فقط (نظام الكاتب الواحد).
- i18n: next-intl — العربية RTL افتراضية بلا بادئة، الإنجليزية `/en`؛ الكتالوجان `messages/{ar,en}.json` بتكافؤ مفاتيح كامل.
- الخطوط **Inter** (لاتيني) + **Cairo** (عربي) + **JetBrains Mono** — واللواء الأزرق `#0071E3` وعائلته (`src/lib/brand-colors.ts`) — قرارات مالك ملزمة **لا تُبدَّل ولا تُمس**.
- المصدر الوحيد لبيانات التواصل: `src/lib/site-config.ts` (لا تزال placeholders — انظر §6).

## 2) الأوامر الإلزامية — بوابات كل تسليم قبل إعلان «تم»

```bash
bunx tsc --noEmit                      # 0 أخطاء (يكافئ bun run typecheck)
bun run lint                           # 0 أخطاء / 0 تحذيرات (قواعد React 19 الصارمة)
node scripts/check-i18n-parity.js      # GREEN — تكافؤ كامل، العدد كما يطبعه السكربت (لا مفاتيح جديدة بلا موافقة)
node scripts/check-slop.mjs            # exit 0 — بوابة Anti-Slop المؤتمتة (D12)
node scripts/check-secrets.mjs         # exit 0 — **قبل أي push** حصراً (D11)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # 200 (خادم dev — لا تقتله أبداً)
```

- الحدود: **0 / 0 / GREEN** (tsc / lint / parity) — عدد مفاتيح parity كما يطبعه السكربت (حالياً 739/739). أي انحراف = التسليم غير منجز.
- فحوص إضافية عند مساس الحركة/الأداء/الإحساس: `node scripts/verify-performance.mjs` (يشمل الآن baseline FPS تحت 4x CPU throttle — D13) و`node scripts/verify-sensory.mjs` و`bun scripts/verify-api.mjs`.
- **لا `bun run build` في هذه البيئة أبداً** (سياسة الصندوق الرمل) — القياس الإنتاجي مُغلَّف في `scripts/lighthouse-prod.sh` لبيئة تسمح بالبناء.

## 3) الحظر الصريحة (خطوط حمراء)

- **لا بناء إنتاجي ولا dependencies جديدة ولا CI** (لا `.github/`) — كل الأتمتة سكربتات محلية بصفر deps تعمل بـ `node` مجرداً.
- **لا purple / indigo / violet / fuchsia** في classnames أو CSS (اللوحة زرقاء حصراً) — `check-slop.mjs` يفشل التسليم عندها.
- **لا letter-spacing على العربية إطلاقاً** (لا سالباً ولا موجباً) — الجزر اللاتينية فقط عبر `lang="en" dir="ltr"`؛ الحارس unlayered في `globals.css` يظل أقوى من أي وصفة.
- **تقسيم النص العربي بالكلمات أو الأسطر فقط** — تقسيم الحروف ممنوع منعاً باتاً (يكسر اتصال الحروف).
- **الحركة compositor-only**: `transform`/`opacity` (و`clip-path` عند الحاجة). الاستثناءات الموثقة **المغلقة** (D23): محور `wght`، ظل `card-hover-lift`/box-shadow المعلنة، ونبضة `:focus-visible` (W1-06). لا يُفتح استثناء جديد إلا بقرار موثق.
- **لا أسرار في argv أو echo** — لا توكن ولا مفاتيح في أوامر shell أو مخرجاتها؛ المسح الإجباري قبل أي push: `node scripts/check-secrets.mjs`.
- **لا تعديل أرقام الحاسبة أو أرقام KPI** بصياغة تسويقية جديدة (المحتوى التجاري قرار مالك عبر i18n values فقط — parity يبقى GREEN بلا صافي مفاتيح جديد).
- ملف `src/app/globals.css` مالك-واحد: داخل الموجلة الواحدة يعدّله وكيل واحد تسلسلياً.

## 4) بروتوكول worklog (مضغوط)

- `worklog.md` سرد append-only لكل وكيل: قسم `Task ID / Agent / Work Log / Stage Summary` — **أعد قراءة tail قبل الإدراج** (وحدة كتابة واحدة؛ عند سباق أعد المحاولة مرة).
- البوابات تُلصق حرفياً في Stage Summary (النص الخام للمخرجات، لا «نجح»).
- الحدود 0/0/GREEN ثابتة (عدد parity كما يطبعه السكربت — حالياً 739/739)؛ أي مفتاح i18n جديد يطلب موافقة منسّق وتحديث العدد هنا وفي الخطة.
- المستودع عام — لا تُدرج في worklog قيماً سرية ولا توكنات تجريبية حقيقية (صِفها بالشكل لا بالمحتوى).

## 5) اصطلاح PRD (توصية للمهام الوظيفية الجديدة)

ثلاثة أسطر قبل Work Log للمهام الوظيفية الجديدة (موجة/فيشة كاملة) — **توصية**، لا شرط تسليم:

```
Problem: <الجملة الواحدة>
Success Metrics: <قياس قابل للتحقق>
Acceptance: <معيار القبول الحاسم>
```

(تعديل truth-sync — AUDIT-B10: كانت الصياغة «كل مهمة M/L» قاعدةً إلزامية بلا أي التزام فعلي في السجل (0/179 مدخل)، فأُعيد ضبطها توصيةً موجّهة إلى حيث تفيد: المهام الوظيفية الجديدة. القصد — تفكيك المشكلة قبل التنفيذ — باقٍ كما هو.)

## 6) القرارات المستقرة — لا تُعاد مناقشتها (التفصيل في pack-plan.md)

- **D3 — Inter يبقى** خط الهوية اللاتيني (محور wght مربوط بالسرعة، 900 للـ watermark، جزر tracking سالبة).
- **D4 — تراتبية لحظة التوقيع (توثق ولا تُحذف):** silk WebGL hero = signature؛ grain + cursor = ambient؛ bento/capability-scene/before-after = widgets محتوى؛ intro = كوريغرافيا دخول.
- **D17 — سياسة em-dash:** فواصل العناوين والـ signature («— Elyra») تبقى؛ الكثافة سياسة ذوق تُدار تحريرياً — **لا سكربت استبدال آلي**.
- **D26 — الجوائز:** لا تقديم أي جائزة قبل استبدال placeholders في `src/lib/site-config.ts` ببيانات تواصل حقيقية — الخطة الكاملة في `docs/awards-plan.md`.
- **D13/D27 — قياس أولاً:** أرقام الحزمة الكمية (90KB gz، 55/45fps) استشارية تُقاس فعلياً — ليست بوابات؛ القياس في `scripts/lighthouse-prod.sh` (gz) و`verify-performance.mjs` (FPS).
- بوابة الإغلاق المعتمدة من الحزمة: `agent-pack/QA-CHECKLISTS.md` §1+§2+§5+§7 (مع تصحيحي G1-A: عدد النتائج الحقيقي 865، والـ Anti-Slop Audit 18 بنداً فعلياً).

## 7) قوانين التصميم المستقرة (خلاصة الموجات W1–W4)

- **الحركة:** منحنى واحد `cubic-bezier(0.16,1,0.3,1)` + `--dur-fast/base/slow` ‏180/280/480ms لطبقة UI؛ السلم السينمائي 500–900ms مقصود (نظام الطبقتين — D22).
- **radius:** pill=9999 · md=12 · lg=14 (الافتراضي) · xl=18 · 2xl=24 — لا `rounded-3xl` (≡ 2xl حرفياً بالـ calc).
- **grain:** بلاطة 240px · opacity ‏3% · numOctaves 2 · flicker 8 خطوات (قيم REF-2 Phase D المُعاد ضبطها) — لا يرتفع فوق 8% على الفاتح أبداً.
- **تايبوغرافي عربي:** جسم 17px عبر `html:lang(ar) { font-size: 106.25% }` · kicker عربي `word-spacing: 0.3em` + وزن 600 · ثلاث قيم line-height فقط (1.3 / 1.8 / 2.05) · `text-pretty` للفقرات الطويلة.
- **الظلال:** ~90% بلا ظل · بطاقات العمل بظلين طبقيين خفيفين (`card-lift-hover`) · لا `shadow-xl` جماعية على البطاقات.
- **الـ hero:** المحتوى فوق الطية يُرسم من الخادم (keyframes CSS بلا انتظار hydration)؛ Three.js لا يُحمّل إلا بعد idle/اقتراب من الشاشة.

## 8) قاعدة التصحيح الذاتي (1-d/38 — حرفياً)

«أي خطأ يتكرر مرتين في worklog → سطر جديد هنا»

- كل استثناء موثق في الكود يجب أن يقابله بند هنا (التعليق المتروك في worklog وحده ليس توثيقاً).
