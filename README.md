# Elyra — الموقع الرسمي

الموقع الرسمي لوكالة **Elyra** الرقمية (إيليرا) — مواقع فائقة الجمال وأنظمة أتمتة ذكية بـ n8n.

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

## معايير الجودة المحققة

| المعيار | الحالة |
|---|---|
| `bun run lint` | ✓ 0 أخطاء / 0 تحذيرات |
| `bunx tsc --noEmit` | ✓ 0 أخطاء (مع `noUncheckedIndexedAccess`) |
| تكافؤ i18n (ar/en) | ✓ 445 مفتاحاً متطابقاً |
| جميع المسارات (×2 لغة) | ✓ 200 OK |
| تحقق في المتصفح | ✓ رسم + تفاعلات + RTL/LTR + responsive + sticky footer |
| أخطاء console | ✓ صفر |
| WCAG 2.1 AA | focus-visible, aria-label, keyboard (before/after slider), 44px targets |
| `prefers-reduced-motion` | ✓ محترم في كل ميزة حركية |

## المهام المرحلية

- **المرحلة 2** (بأمر لاحق): المؤشر المغناطيسي + الحبيبات السينمائية + Audio UX + إثراء محتوى الأعمال والفريق + ضبط الأداء النهائي.
- **المرحلة 3** (بأمر لاحق): `POST /api/leads` (Zod على الخادم + إعادة حساب الميزانية في Serializable tx + Prisma `Lead` + ويبهوك n8n موقّع HMAC-SHA256 + طابع زمني ±5 دقائق + nonce idempotency) + خاتمة SEO النهائية + تدقيق قائمة الفحص قبل النشر.

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
│   ├── shared/            # reveal, section-heading, page-hero, cta
│   ├── three/             # capability-scene (R3F)
│   ├── brand/             # logo
│   ├── pages/             # work-grid, contact-form
│   └── seo/               # home-json-ld
├── i18n/                  # routing, request, navigation
├── lib/                   # calculator, seo, use-rtl, db, utils
└── proxy.ts               # next-intl middleware (Next.js 16)
messages/{ar,en}.json      # 445 مفتاحاً متطابقاً
```

---

صُنع بشغفٍ وقهوةٍ كثيرة. © 2025 إيليرا.
