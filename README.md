# Elyra — الموقع الرسمي

الموقع الرسمي لوكالة **Elyra** الرقمية (إيليرا) — مواقع فائقة الجمال وأنظمة أتمتة ذكية بـ n8n.

> **المرحلة 3 مكتملة** — الظهر الكامل (API + Prisma + ويبهوك n8n موقّع) + إصلاحات الأداء الإنتاجي + توثيق النشر.
>
> **المرحلة 2 مكتملة** — طبقة الإحساس (مؤشر مغناطيسي + حبيبات سينمائية + Audio UX) + إثراء المحتوى + React Compiler + hreflang.
>
> **المرحلة 1 مكتملة** — التأسيس + الصفحة الرئيسية (9 أقسام) + صفحتا الخدمتين + work / about / contact + كل معايير الجودة.

## البنية التقنية

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5** (strict, noUncheckedIndexedAccess)
- **Tailwind CSS 4** + **shadcn/ui** (نمط New York)
- **next-intl 4** — عربية (RTL، افتراضي، URLs نظيفة) + إنجليزية (LTR، `/en`)
- **Framer Motion** للحركات + **Three.js / React Three Fiber** للـ 3D (تحميل ديناميكي)
- **Prisma 6** + SQLite (جاهز للمرحلة 3) · **Zod 4** للتحقق

## خريطة الموقع

| المسار | الوصف |
|---|---|
| `/` | الصفحة الرئيسية (9 أقسام) |
| `/services/websites` | مسار بناء المواقع + مشهد 3D تفاعلي |
| `/services/automation` | مسار الأتمتة + محاكي بسيناريوهات متعددة |
| `/work` | الأعمال (فلترة + 6 بطاقات قبل/بعد) |
| `/about` | من نحن (القصة + القيم + الفريق + أرقام) |
| `/contact` | تواصل (قنوات + نموذج + حاسبة) |

اللغة العربية افتراضية بلا بادئة، الإنجليزية تحت `/en`.

## القرارات المعمارية الموثقة

1. **`localePrefix: 'as-needed'` + `localeDetection: false`**: العربية لغة افتراضية بلا بادئة (URLs نظيفة، تجربة عربية أولاً)، الإنجليزية تحت `/en`. يحقق متطلب البيئة «المستخدم يرى `/`» مباشرة. كشف الهيدر معطّل لسلوك حتمي في المعاينات.

2. **`proxy.ts` بدل `middleware.ts`** (Next.js 16): file المستوى الأعلى لـ next-intl middleware. لا يوجد `src/middleware.ts`.

3. **التخطيط الجذري في `[locale]/layout.tsx`** (لا يوجد `src/app/layout.tsx`): كل الصفحات تحت `[locale]`، والتخطيط يملك `<html lang dir>` + الخطوط + Navbar + Footer (sticky) + Toaster. هذا النمط الرسمي لـ next-intl.

4. **`global-error.tsx`** في جذر `src/app/` (لا داخل `[locale]`)، يرسم `<html>/<body>` خاصة به — حسب دليل §1.3.

5. **مشاهد CSS بدل صور AI**: «قبل/بعد» بطاقات مكوّنة من مشاهد CSS تجريدية (متجر/منصة/لوحة بيانات) — أدق وأنظف وأخف من صور AI المولّدة، وتعمل في RTL و LTR.

6. **الحاسبة (المرحلة 1 = واجهة كاملة، المرحلة 3 = الخلفية)**: المعالج بثلاث خطوات يعمل بالكامل client-side (اختيار الخدمة، الميزات، عرض التقدير مع `computeEstimate` في `lib/calculator.ts`). إرسال الطلب يعرض حالة نجاح محلية. الـ API route + Prisma + ويبهوك n8n موقّع — في المرحلة 3 (لن يُخترع قبل أوانه).

7. **الأمان من أخطاء Hydration**: كل منطق زمني (ساعة حية، عدّادات، كشف WebGL) بعد `mount` عبر `useEffect` + flag. القيم العددية في messages تُقرأ عبر `t.raw()` (لا `t()` الذي يتوقع نصاً).

8. **`react-hooks/immutability` + R3F**: Three.js uniforms تُطفر في `useFrame` (نمط R3F القانوني) مع `eslint-disable` مبرّر. مشهد القدرة 3D يطفّر `group.current.rotation` مباشرة (مسموح) بدل طفر ref حالة داخلية.

## قرارات المرحلة 2 (طبقة الإحساس)

9. **ثنائية `global-error.tsx`**: الموقع الجذري فوق `[locale]` فلا يتوفر سياق next-intl — يُكتشف لغة المتصفح عبر `useSyncExternalStore` بعد الـ mount (لا `setState` داخل `useEffect`)، والـ SSR يعرض الإنجليزية دائماً (حتمية hydration).

10. **ESLint الصارم بكناري**: إعادة تفعيل قواعد React 19 (`exhaustive-deps`/`purity`/`immutability`/`no-explicit-any`/`no-non-null-assertion`/`react-compiler`) — أي اختراق مستقبلي للقواعد يُرفض عند المراجعة (خط أحمر).

11. **نمط `useSyncExternalStore` للقيم الزمنية/اللغة**: سنة الفوتر ولغة global-error وصوت المرحلة 2 تُقرأ كلها عبر `useSyncExternalStore` مع server snapshot حتمي — أفضل من `useEffect + setState` الذي يخالف `react-hooks/set-state-in-effect`. `getServerYear` يقرأ `new Date().getFullYear()` ديناميكياً.

12. **إصلاحات icon/robots**: `/icon` كان 404 لأن هاش المحتوى في query لا في المسار فلم يستثنه matcher الـ next-intl؛ `/robots.txt` كان 500 بسبب تعارض ملف قالب في `public/` مع النسخة الديناميكية — حُذف الثابت.

13. **المؤشر المغناطيسي — rAF واحد بلا إعادة رسم React**: الطبقتان (نقطة 6px + حلقة 32px بـ lerp 0.2) تُحرّكان بتعديل DOM مباشر عبر refs داخل حلقة `requestAnimationFrame` واحدة على مستوى التطبيق. الجذب نحو مراكز عناصر `data-cursor="magnet"` (مسافة، لا جهة — RTL/LTR محايد). يُخفى المؤشر الأصلي فقط عند (`pointer: fine` + بلا reduced-motion) بحارس CSS مزدوج، والطبقات فوق Sheet/Dialog (z-200) لأن الأصلي مخفي، و`mix-blend-difference` يضمن الرؤية على الفاتح والداكن.

14. **الحبيبات السينمائية — CSS خالص ثابت**: طبقة `feTurbulence` SVG واحدة كـ data-URI (0 JS) على مستوى الـ layout، شفافية 3.5%، ثابتة غير متحركة (قرار أداء نهائي)، تُخفى عند الطباعة، وتحمل z-90 فوق كل المحتوى لأن الغرين السينمائي موحد فوق كل شيء.

15. **Audio UX — Web Audio API فقط بلا ملفات**: أصوات مركّبة (oscillators + envelopes) بمكوّن `lib/sound.ts` — مطفأة افتراضاً مع `localStorage` (`elyra:sound`) عبر external store، وAudioContext كسول عند أول إيماءة، وفشل هادئ دائماً. الأصوات لأحداث المؤشر فقط (`pointerover`/`pointerdown` مندّمان على مستوى المستند) — لا صوت للوحة المفاتيح أبداً.

16. **React Compiler مفعّل**: خيار المستوى الأعلى `reactCompiler: true` في Next.js 16 (تخرّج من `experimental`) مع `babel-plugin-react-compiler` — ونتيجة lint تبقى 0/0.

17. **sitemap/metadata بـ hreflang كامل**: كل مسار يُصدر `<url>` واحداً مع `alternates.languages` (ar / en / x-default) — وتوصية next-intl الرسمية مُطبّقة في `sitemap.ts` و`seo.ts` و`layout.tsx`.

## قرارات المرحلة 3 (الظهر + الأداء + النشر)

18. **إعادة الحساب الخادمية دائماً**: `POST /api/leads` يستورد `computeEstimate` من `lib/calculator.ts` (لا نسخ) ويحسب الميزانية/المدة من خيارات المعالج فقط. حقول أرقام العميل المعروفة (`minBudget`/`maxBudget`/`weeksMin`/`weeksMax`/`estimate`) تُجرد قبل التحقق الصارم (دفاع مزدوج: العميل المزوّر يُتجاهل ولا يُخزن له رقم)، وكل حقل آخر غير معروف ← 400 قاطع.

19. **الحصر في الذاكرة**: `lib/rate-limit.ts` — نافذة انزلاقية 60 ثانية × 5 طلبات/IP في `Map` مع تنظيف دوري يمنع تسرّب الذاكرة (خادم Node واحد standalone). الرد 429 يحمل `Retry-After` ورسالة مترجمة (ترويسة `x-elyra-locale` → fallback إلى accept-language → العربية).

20. **نمط الويبهوك وأمانه**: توقيع HMAC-SHA256 على `timestamp.nonce.body` بمفتاح 32+ محرفاً من متغيرات بيئة فقط. عند غيابهما: تعطيل هادئ بسطر سجل واحد. التسليم best-effort بعد نجاح التخزين (fire-and-forget — الطلب يبقى 201)، مهلة 5 ثوانٍ بـ AbortController، وإعادة محاولة واحدة عند فشل الشبكة فقط. الوصفة الكاملة للاستقبال في n8n أدناه.

21. **قرارات الأداء (§4)**: (أ) محتوى فوق الطية في الرئيسية وPageHero يُرسم من الخادم بمدخل CSS-only (`hero-enter` keyframes تبدأ عند أول رسم — بلا انتظار hydration) — بصمة framer القديمة (`opacity:0` inline) اختفت من HTML الخادم؛ (ب) `HeroCanvas` يؤجّل تحميل Three.js حتى `requestIdleCallback` (مهلة 2.5s) أو أول تفاعل، و`CapabilityScene` حتى اقتراب قسمها من الشاشة؛ (ج) `Reveal` أعيد كتابته بـ IntersectionObserver + CSS (بلا framer) لكل الاستخدامات البسيطة مع بقاء framer للمتخصصات فقط (الحاسبة/المحاكي/methodology) — صفحات مثل /about و/work و/services/websites لم تعد تحمّل framer في حزمة JS المبدئية؛ (د) فلترة /work أصبحت CSS keyframes بدل AnimatePresence (قرار أداء موثّق — الوظيفة ذاتها).

22. **فخ HOSTNAME في standalone**: موثّق كاملاً في قسم Deployment أدناه (حلقة 307 مع `HOSTNAME=127.0.0.1` — التوصية `0.0.0.0`).

## قرارات Hotfix 01 (إغلاق فجوات الإطلاق)

23. **تأجيل المحاكي (H-4 — الخيار أ)**: `SimulatorLazy` يغلّف `AutomationSimulator` بـ `next/dynamic` بلا SSR + `IntersectionObserver` (rootMargin 400px) — الحزمة والترطيب لا يحدثان إلا عند اقتراب القسم من الشاشة، مع placeholder بنفس إيقاع القسم (داكن + min-h) لضمان صفر CLS. اختير على تقسيم الحزم لأنه صفر مخاطرة هيكلية وأثره مساوٍ (المصدر الرئيسي لـ TBT الرئيسية 690ms هو ترطيب المحاكي أساساً). مثبت أيضاً في صفحة `/services/automation`.

24. **CLS أثناء الـ streaming (H-1)**: رفع fallback التحميل من `min-h-[60vh]` إلى `min-h-[100svh]` — الفوتر يخرج من الإطار المرئي أثناء تدفق المحتوى، فتُستثنى إزاحته من قياس CLS نهائياً (المشكلة كانت حكراً على الصفحات العربية لأن /en يتدفق بشكل مختلف).

25. **`.env.example` في الريبو (H-2)**: قاعدة `.env*` في gitignore كانت تبتلع القالب — أُضيف استثناء `!.env.example` وأُعيد إنشاؤه بالمسار **المطلق** لقاعدة البيانات.

26. **توثيق فخ مسار DB النسبي (H-3)**: قسم Deployment يشرح أن `file:./db/custom.db` تعمل في dev فقط، مع جدول البيئتين ومثال standalone مباشر.

## معايير الجودة المحققة

| المعيار | الحالة |
|---|---|
| `bun run lint` | ✓ 0 أخطاء / 0 تحذيرات (قواعد React 19 الصارمة مفعّلة) |
| `bunx tsc --noEmit` | ✓ 0 أخطاء (مع `noUncheckedIndexedAccess`) |
| تكافؤ i18n (ar/en) | ✓ 499 مفتاحاً متطابقاً |
| جميع المسارات (×2 لغة) | ✓ 200 OK |
| تحقق في المتصفح | ✓ رسم + تفاعلات + RTL/LTR + responsive + sticky footer |
| أخطاء console/hydration | ✓ صفر |
| WCAG 2.1 AA | focus-visible, aria-label, keyboard (before/after slider), 44px targets |
| `prefers-reduced-motion` | ✓ محترم في كل ميزة حركية (بما فيها المؤشر المغناطيسي — يُخفى كلياً) |
| API الأمني | ✓ 13/13 (Zod 400 · تجاهل أرقام مزوّرة · 429+Retry-After · توقيعات HMAC) |

## المهام المرحلية

- **كل المراحل الثلاث مكتملة.** ما تبقّى بيد صاحب المشروع: بيانات التواصل الحقيقية في `site-config.ts` · إعداد n8n الفعلي بالوصفة أعلاه · النطاق والاستضافة · تشغيل `scripts/lighthouse-prod.sh` في بيئة بناء.

## قيود بيئة التنفيذ (مهم للمراجعة)

- **البناء الإنتاجي (`bun run build`) غير مسموح في هذه البيئة** (سياسة الصندوق الرمل) — التحقق تم عبر خادم التطوير + lint + tsc + فحص المتصفح الفعلي. أرقام Lighthouse للوضع التطويري غير ممثلة للإنتاج (React بوضع dev وغير مضغوط) وتوثّق كمثل.
- أرقام التواصل في `src/lib/site-config.ts` ما تزال placeholder بانتظار صاحب المشروع.

## الظهر (المرحلة 3)

### `POST /api/leads` — نقطة النهاية الوحيدة

| الحالة | المعنى |
|---|---|
| `201` | خُزّن. الرد: `{ "reference": "cuid8" }` — أول 8 محارف من معرّف السجل |
| `400` | فشل Zod — أخطاء الحقول مترجمة (اعتماداً على `x-elyra-locale`) |
| `429` | تجاوز 5 طلبات/دقيقة/IP — ترويسة `Retry-After` بالثواني |
| `500` | خطأ عام بلا تفاصيل — التفاصيل لسجل الخادم فقط |

مصدران للطلبات على النقطة نفسها: `source: "calculator"` (كل إجابات المعالج) و`source: "contact-form"` (نموذج التواصل مع `message`) — التمييز محفوظ داخل JSON عمود `integrations` (`{ source, items }`).

### سيناريو الويبهوك

يُطلق بعد نجاح التخزين (لا قبله) وبصمت تام عند الفشل. الترويسات: `X-Elyra-Signature` (`sha256=<hex>`) · `X-Elyra-Timestamp` (ثواني unix) · `X-Elyra-Nonce` (UUID).

### وصفة التحقق في n8n (Code Node)

انسخها كما هي في عقدة Code قبل أي منطق للـ workflow (النمط من دليل §9):

```js
const crypto = require('node:crypto')

const SECRET = process.env.N8N_WEBHOOK_SECRET || '<ضع-السر-هنا>'
const MAX_SKEW_SEC = 300        // ± 5 دقائق
const NONCE_TTL_MS = 10 * 60_000 // 10 دقائق

// 1) خزّن الـ nonces المستهلكة (idempotency) — memory أو Redis في الإنتاج
if (!globalThis.__elyraNonces) globalThis.__elyraNonces = new Map()
const seen = globalThis.__elyraNonces

module.exports = function verify(req) {
  const sig = req.headers['x-elyra-signature']
  const ts = req.headers['x-elyra-timestamp']
  const nonce = req.headers['x-elyra-nonce']
  if (!sig || !ts || !nonce) return { ok: false, reason: 'missing-headers' }

  // 2) حداثة الطابع الزمني
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_SEC)
    return { ok: false, reason: 'stale-timestamp' }

  // 3) HMAC — timingSafeEqual (لا === أبداً)
  const body = req.rawBody                        // الجسم الخام كما وصل
  const expected = 'sha256=' + crypto
    .createHmac('sha256', SECRET)
    .update(`${ts}.${nonce}.${body}`)
    .digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  const sigOk = a.length === b.length && crypto.timingSafeEqual(a, b)
  if (!sigOk) return { ok: false, reason: 'bad-signature' }

  // 4) منع إعادة التشغيل
  const now = Date.now()
  for (const [n, t] of seen) if (now - t > NONCE_TTL_MS) seen.delete(n)
  if (seen.has(nonce)) return { ok: false, reason: 'nonce-reused' }
  seen.set(nonce, now)

  return { ok: true }
}
```

> ملاحظة: في n8n، استخدم `$input.rawBody` أو ما يكافئه حسب نسختك، وتأكد من عدم إعادة ترميز JSON قبل التحقق (التوقيع على السلسلة الخام).

## Deployment

### فخ `HOSTNAME` في الخادم المستقل (مهم!)

تشغيل خادم standalone مع `HOSTNAME=127.0.0.1` حصرياً يسبب **حلقة 307 لانهائية** على مسارات اللغة الافتراضية: Next يبني روابط إعادة الكتابة بصيغة `localhost`، وعند مخالفة HOSTNAME تتسرّب إعادة الكتابة كتوجيه — مطابق للحالة المفتوحة upstream: `vectorize-io/hindsight#1926` (Next 16.2.x).

| وضع التشغيل | النتيجة |
|---|---|
| `HOSTNAME=127.0.0.1` | ❌ حلقة 307 على مسارات اللغة الافتراضية |
| `HOSTNAME=0.0.0.0` | ✅ (المعيار في Docker — يعمل مع CORS/بروكيات الحاوية) |
| `HOSTNAME=localhost` | ✅ محلياً فقط |
| `next start` | ✅ (لا يمرّ عبر standalone) |

**التوصية**: في Docker/VPS استخدم دائماً `HOSTNAME=0.0.0.0` (كما في Dockerfile المرفق).

### فخ مسار قاعدة البيانات النسبي في standalone (مهم!)

`DATABASE_URL="file:./db/custom.db"` (صيغة التطوير) تجعل **كل كتابة تفشل بـ 500** على الخادم standalone — المسار النسبي يُحل من دليل العمل الجاري، وهو يختلف عن دليل حزمة standalone، فتنشأ قاعدة بيانات/مسار خاطئ لا يصل إليه Prisma. المسار النسبي يعمل في `bun run dev` فقط.

| البيئة | `DATABASE_URL` الصحيحة |
|---|---|
| تطوير | `file:./db/custom.db` (أو المطلق للمشروع المحلي) |
| standalone / Docker | `file:/app/db/custom.db` — **مسار مطلق دائماً** |

مثال الخادم المباشر (بلا Docker): `DATABASE_URL=file:/var/lib/elyra/custom.db` مع ضمان صلاحية الكتابة للمستخدم المشغِّل.

### Docker

```bash
# البناء — NEXT_PUBLIC_SITE_URL إلزامي وقت البناء (canonical/SEO)
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://elyra.agency -t elyra .

# التشغيل — قاعدة البيانات في volume
 docker run -p 3000:3000 \
  -e DATABASE_URL=file:/app/db/custom.db \
  -e N8N_WEBHOOK_URL=https://n8n.example.com/webhook/elyra-leads \
  -e N8N_WEBHOOK_SECRET=<openssl rand -hex 32> \
  -v elyra-db:/app/db elyra
```

راجع `.env.example` لكل المتغيرات وتوثيقها. **قبل أول إطلاق**: شغّل `bun scripts/clean-leads.ts` أو `--dry-run` لضمان خلو قاعدة البيانات من بيانات الاختبار.

## الأوامر

```bash
bun run dev                              # خادم التطوير (المنفذ 3000)
bun run lint                             # فحص الجودة (القواعد الصارمة)
bunx tsc --noEmit                        # فحص الأنواع
node scripts/check-i18n-parity.js        # فحص تكافؤ الترجمات
bun run db:push                          # دفع schema
bun scripts/verify-api.mjs               # التحقق الأمني الكامل للـ API (13 فحصاً)
node scripts/verify-performance.mjs      # فحص إصلاحات الأداء (10 فحوص)
node scripts/verify-sensory.mjs          # فحص طبقة الإحساس (16 فحصاً)
bash scripts/lighthouse-prod.sh          # قياس Lighthouse إنتاجي (بيئة تسمح بالبناء)
bun scripts/clean-leads.ts [--dry-run]   # تنظيف بيانات الاختبار قبل النشر
```

## بنية المجلدات

```
src/
├── app/[locale]/          # كل الصفحات + layout + loading + error + not-found
│   ├── page.tsx           # الرئيسية (9 أقسام)
│   ├── services/{websites,automation}/
│   ├── work/ about/ contact/
├── app/global-error.tsx   # المعالج الجذري
├── app/{sitemap,robots,icon}.ts
├── components/
│   ├── home/              # hero, bento, simulator, before-after, calculator...
│   ├── layout/            # navbar, footer, language-switcher, live-clock
│   ├── shared/            # reveal, section-heading, page-hero, cta, service-prose
│   ├── sensory/           # magnetic-cursor, film-grain, sound-toggle (المرحلة 2)
│   ├── three/             # capability-scene (R3F)
│   ├── brand/             # logo
│   ├── pages/             # work-grid, contact-form
│   └── seo/               # home-json-ld
├── i18n/                  # routing, request, navigation
├── lib/                   # calculator, sound, rate-limit, n8n-webhook, api-i18n,
│                          # seo, site-config, use-rtl, use-reduced-motion, db, utils
├── app/api/leads/route.ts # نقطة الكتابة الوحيدة (Zod + إعادة حساب + Prisma + 429)
└── proxy.ts               # next-intl middleware (Next.js 16)
messages/{ar,en}.json      # 499 مفتاحاً متطابقاً
```

---

صُنع بشغفٍ وقهوةٍ كثيرة. © 2025 إيليرا.
