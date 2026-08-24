# Elyra — الموقع الرسمي

الموقع الرسمي لوكالة **Elyra** الرقمية (إيليرا) — مواقع فائقة الجمال وأنظمة أتمتة ذكية بـ n8n.

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

## معايير الجودة المحققة

| المعيار | الحالة |
|---|---|
| `bun run lint` | ✓ 0 أخطاء / 0 تحذيرات (قواعد React 19 الصارمة مفعّلة) |
| `bunx tsc --noEmit` | ✓ 0 أخطاء (مع `noUncheckedIndexedAccess`) |
| تكافؤ i18n (ar/en) | ✓ 478 مفتاحاً متطابقاً |
| جميع المسارات (×2 لغة) | ✓ 200 OK |
| تحقق في المتصفح | ✓ رسم + تفاعلات + RTL/LTR + responsive + sticky footer |
| أخطاء console/hydration | ✓ صفر |
| WCAG 2.1 AA | focus-visible, aria-label, keyboard (before/after slider), 44px targets |
| `prefers-reduced-motion` | ✓ محترم في كل ميزة حركية (بما فيها المؤشر المغناطيسي — يُخفى كلياً) |

## المهام المرحلية

- **المرحلة 3** (بأمر لاحق): `POST /api/leads` (Zod على الخادم + إعادة حساب الميزانية في Serializable tx + Prisma `Lead` + ويبهوك n8n موقّع HMAC-SHA256 + طابع زمني ±5 دقائق + nonce idempotency) + خاتمة SEO النهائية + تدقيق قائمة الفحص قبل النشر.

## قيود بيئة التنفيذ (مهم للمراجعة)

- **البناء الإنتاجي (`bun run build`) غير مسموح في هذه البيئة** (سياسة الصندوق الرمل) — التحقق تم عبر خادم التطوير + lint + tsc + فحص المتصفح الفعلي. أرقام Lighthouse للوضع التطويري غير ممثلة للإنتاج (React بوضع dev وغير مضغوط) وتوثّق كمثل.
- أرقام التواصل في `src/lib/site-config.ts` ما تزال placeholder بانتظار صاحب المشروع.

## الأوامر

```bash
bun run dev                              # خادم التطوير (المنفذ 3000)
bun run lint                             # فحص الجودة
bunx tsc --noEmit                        # فحص الأنواع
node scripts/check-i18n-parity.js        # فحص تكافؤ الترجمات
bun run db:push                          # دفع schema (للمرحلة 3)
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
├── lib/                   # calculator, seo, sound, site-config, use-rtl, db, utils
└── proxy.ts               # next-intl middleware (Next.js 16)
messages/{ar,en}.json      # 478 مفتاحاً متطابقاً
```

---

صُنع بشغفٍ وقهوةٍ كثيرة. © 2025 إيليرا.
