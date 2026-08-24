# تقرير تدقيق المرحلة 1 — موقع Elyra

**المراجع**: AI Assistant Agent  
**التاريخ**: 2026-08-24  
**الريبو المُراجَع**: `https://github.com/ashamsaldin303-ctrl/nextjs-fullstack-project`  
**المرجعية المعتمدة**: دليل الـ Full-Stack Agent (المعايير الـ 11 + الفخاخ الـ 64) + دليل الـ Assistant Agent  
**طريقة المراجعة**: استنساخ الريبو + قراءة ساكنة شاملة لكل الملفات المهمة (لم يُمكن تشغيل lint/tsc/build لغياب `node_modules` في البيئة، لكن الأكواد فُحصت سطرياً)

---

## ملخص تنفيذي

المرحلة 1 **ناجحة بنيوياً ومُعتمَدة بشرط**. المُنفِّذ التزم بالقرارات المعمارية الكبرى (Next.js 16 `proxy.ts`/`await params`/`global-error` في الجذر، next-intl 4 `setRequestLocale`/`localePrefix: as-needed`، RTL عبر logical properties، Hydration-safe للساعة والـ WebGL، ssr:false للثقيل، JSON-LD في الرئيسية فقط، sticky-footer). الأقسام التسعة في الرئيسية موجودة كاملة، والمحاكي آلة حالات سليمة، والحاسبة نقية جاهزة للمرحلة 3.

**لكن هناك مشكلة جوهرية واحدة (P0)**: إعدادات ESLint تُعطِّل كل قواعد React 19 الصارمة (`react-hooks/exhaustive-deps`، `react-hooks/purity`، `react-compiler`، `no-explicit-any`، `no-non-null-assertion`)، وهذا يجعل ادعاء "lint 0/0" بلا معنى عملي. يجب إعادة تفعيلها قبل المرحلة 2.

بالإضافة إلى 13 إصلاحاً P1 صغيراً مُصنّفاً أدناه، أغلبها في فئات: حركات لا تحترم `prefers-reduced-motion` بثبات، نصوص إنجليزية فقط في `global-error.tsx`/`loading.tsx`، اختصارات RTL مزدوجة في الحاسبة، ومخلفات قالب البداية في `prisma/schema.prisma`.

---

## ما أُنجِز بشكل ممتاز (نقاط القوة)

### البنية والمعمارية
- **`proxy.ts` بدل `middleware.ts`** ✓ (`src/proxy.ts`) — مطابق لدليل §1.3 لـ Next.js 16.
- **`await params` في كل مكان** ✓ — كل `generateMetadata` والصفحات تستخدم `params: Promise<{locale}>` وتنتظره. لا توجد قراءات متزامنة.
- **`global-error.tsx` في الجذر `src/app/`** ✓ ويرسم `<html>/<body>` الخاصة به — مطابق للدليل.
- **`setRequestLocale(locale)`** في `[locale]/layout.tsx` ✓ — النمط الرسمي لـ next-intl 4.
- **`localePrefix: 'as-needed'` + `localeDetection: false`** ✓ — عربية افتراضية بلا بادئة، إنجليزية تحت `/en`، وسلوك حتمي للمعاينات.

### الـ i18n والتكافؤ
- **تكافؤ 445 مفتاحاً متطابقاً** ✓ — أعدت تشغيل `node scripts/check-i18n-parity.js` بنفسي وأكّدت: `Parity OK: 445 keys matched across ar.json and en.json`.
- **logical CSS properties في كل مكان** ✓ (`ms-`، `me-`، `ps-`، `pe-`، `start-`، `end-`)، لم أجد `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` في الأكواد.
- **`getTranslations()` في الـ Server، `useTranslations()` في الـ Client** ✓ — لا توجد مزاليف.
- **`useIsRtl()` hook** ✓ — حلّ نظيف يحل مزامنة الـ RTL من سياق next-intl.

### Hydration والأمان الزمني
- **`LiveClock` Hydration-safe** ✓ — يبدأ بـ `null` ثم يُحدِّث في `useEffect`، يعرض `--:--` كـ placeholder.
- **كشف WebGL في `useEffect` + `requestAnimationFrame`** ✓ في `hero-canvas.tsx` و `capability-scene.tsx` — لا قراءة للمتصفح في جسم الـ render.
- **`IntersectionObserver` لإيقاف رندرة Three.js** ✓ عند الخروج من العرض أو خفاء التبويب — حفظ CPU/GPU.

### الأمان
- **securityHeaders في `next.config.ts`** ✓: `nosniff`, `X-Frame-DENY`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`, `CSP` صارمة.
- **`reactStrictMode: true` + `poweredByHeader: false`** ✓.
- **`output: 'standalone'`** ✓ جاهز للنشر.

### SEO
- **JSON-LD في الرئيسية فقط** ✓ (`HomeJsonLd` في `page.tsx` فقط) — مطابق للدليل §8.9.
- **`metadataBase` + `alternates.canonical` + `languages` (hreflang)** ✓.
- **`sitemap.ts` + `robots.ts` ديناميكيان** ✓، لا `public/robots.txt` ينافسهما.
- **`buildPageMetadata` مركزية** ✓ في `src/lib/seo.ts`.

### الوصول (WCAG 2.1 AA)
- **Skip link** ✓ `sr-only focus:not-sr-only focus:fixed focus:start-4`.
- **`<main id="main">`** ✓ هدف صحيح للـ skip.
- **focus-visible rings** ✓ على كل الأزرار والروابط.
- **`aria-label` على الأزرار ذات الأيقونة فقط** ✓ في أغلب الأماكن.
- **`aria-invalid` + `aria-describedby` + `role="alert"`** ✓ في الحاسبة ونموذج التواصل.
- **`role="status"` + `aria-live="polite"` + `sr-only`** ✓ في `loading.tsx`.
- **`role="slider"` + `aria-valuenow` + معالج لوحة مفاتيح** ✓ في `before-after.tsx` (ArrowLeft/Right/Home/End).
- **44px لمس targets** ✓ (`h-11` و `min-h-11` على عناصر القائمة المتنقلة).

### المنطق الحسابي
- **`computeEstimate` دالة نقية** ✓ في `src/lib/calculator.ts` — جاهزة لإعادة الحساب على الخادم في Serializable tx بالمرحلة 3.
- **`clampPages` يقيّد 0–20** ✓.
- **`round100` لتقريب نظيف** ✓.
- **`formatMoney` يستخدم `Intl.NumberFormat`** ✓ — يحترم اللغة.
- **Zod client-side مع رسائل مترجمة** ✓ في `calculator.tsx` و `contact-form.tsx`.

### الميزة التمييزية (محاكي الأتمتة)
- **آلة حالات صحيحة** ✓ (`idle` → `running` → `completed`) في `automation-simulator.tsx`.
- **3 سيناريوهات** ✓ (`newOrder`, `paymentReminder`, `weeklyReport`) كل واحد 5 خطوات.
- **عدّاد ms حي عبر `requestAnimationFrame`** ✓ مع `easeOutCubic`.
- **سجل مكتمل للخطوات** ✓ بعد الانتهاء.
- **RTL-aware** ✓ يعكس ترتيب العقد في العربية.
- **`useReducedMotion` يحترم** ✓ يقلّل مدة العرض من 850ms إلى 250ms.
- **تنظيف `setTimeout` و `cancelAnimationFrame`** ✓ في `clearAll`.

### الـ 3D (TorusKnot + Particles)
- **`dynamic(() => ..., { ssr: false })`** ✓ مع loading fallback غير null.
- **`frameloop={active ? 'always' : 'never'}`** ✓ — يوقف R3F عند عدم الحاجة.
- **`dpr={[1, 2]}`** ✓ حد أقصى لـ DPR.
- **`useReducedMotion`** يبطل الـ 3D في hero و three-d-section ✓.
- **fallback متدرج** ✓ (.hero-fallback CSS gradient).

---

## المشاكل حسب الأولوية

### P0 — مانع، يجب إصلاحه قبل المرحلة 2

#### P0-1: إعدادات ESLint تُعطِّل كل قواعد React 19 الصارمة
**الملف**: `eslint.config.mjs` (الأسطر 9–45)  
**الخطورة**: عالية جداً — تُفقد ضمانات الجودة المُعلَنة في README.

القواعد المعطّلة:
```js
'react-hooks/exhaustive-deps': 'off',           // يخفي bugs النقص في deps
'react-hooks/purity': 'off',                    // يبطل فحص نقاء الـ render
'react-compiler/react-compiler': 'off',         // يعطّل React Compiler
'@typescript-eslint/no-explicit-any': 'off',    // يسمح بـ any
'@typescript-eslint/no-non-null-assertion': 'off', // يسمح بـ !
'@typescript-eslint/no-unused-vars': 'off',      // يخفي المتغيرات الميتة
'prefer-const': 'off',
'no-console': 'off',
// ... وغيرها الكثير
```

**التأثير العملي**: ادعاء `bun run lint` 0/0 في README بلا قيمة — لأن القواعد التي كانت ستكشف المشاكل معطّلة كلها. علاوة على ذلك:
- تعليقات `// eslint-disable-next-line react-hooks/immutability` في `hero-canvas.tsx` L67 وغيرها **لا قيمة لها** (القاعدة غير مفعّلة أصلاً).
- ادعاء README القرار #7 "react-hooks/immutability + R3F: نمط قانوني مع eslint-disable مبرّر" غير قابل للتحقق.

**الإصلاح المطلوب**:
```js
rules: {
  // TypeScript strict
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  
  // React 19 hardening
  'react-hooks/exhaustive-deps': 'error',
  'react-hooks/purity': 'error',
  'react-hooks/immutability': 'error',   // ← المفتاح لـ R3F
  'react-compiler/react-compiler': 'warn',
  
  // Keep relaxed for trusted server code patterns
  // ... باقي القواعد يمكن إبقاؤها متساهلة
}
```

ثم إصلاح أي أخطاء تظهر (هذا قد يكشف عن bugs خفية في `useEffect` deps أو mutations في refs).

---

### P1 — يجب إصلاحها في بداية المرحلة 2

#### P1-1: `global-error.tsx` إنجليزي فقط
**الملف**: `src/app/global-error.tsx` L32–37  
الموقع الجذري يمنع استخدام `useTranslations` (السياق فوق `[locale]`)، لكن يجب أن يحوي على الأقل نصاً ثنائياً أو يكتشف لغة المتصفح:
```tsx
const isAr = typeof navigator !== 'undefined' && navigator.language.startsWith('ar')
const title = isAr ? 'حدث خطأ ما' : 'Something went wrong'
const desc = isAr ? 'حدث خطأ غير متوقع. حاول مرة أخرى.' : 'An unexpected error occurred. Please try again.'
const btn = isAr ? 'حاول مجدداً' : 'Try again'
```

#### P1-2: `loading.tsx` إنجليزي فقط
**الملف**: `src/app/[locale]/loading.tsx` L11  
`<span className="sr-only">Loading…</span>` — استبدل بـ `getTranslations` أو على الأقل "جارٍ التحميل… / Loading…" كنص ثنائي. ممكن تحويلها إلى server component مع `getTranslations`.

#### P1-3: `prisma/schema.prisma` مخلفات قالب البداية
**الملف**: `prisma/schema.prisma` L16–32  
يحتوي على `User` و `Post` غير ذي صلة بـ Elyra. المستخدم يدفع لـ Prisma لكنه يحمل نفايات. استبدلها بـ:
```prisma
model Lead {
  id          String   @id @default(cuid())
  name        String
  email       String
  whatsapp    String?
  service     String
  pages       Int
  languages   String
  threeD      String
  integrations String  // JSON serialized
  automationLevel String
  minBudget   Int
  maxBudget   Int
  weeksMin    Int
  weeksMax    Int
  ipAddress   String?
  userAgent   String?
  status      String   @default("new")  // new | contacted | won | lost
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([status, createdAt])
  @@index([email])
}
```
(مطابق لتوصيات README للمرحلة 3).

#### P1-4: مكون CTA يفتقد `group` class
**الملف**: `src/components/shared/cta.tsx` L62–72  
الـ `<Link>` لا يضع `className="group ..."`، لكن السهم الداخلي يستخدم `group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5` — أي تأثير hover على السهم لن يعمل. قارن مع `hero.tsx` L117 و `page-hero.tsx` L82 اللذان يضعان `group` بشكل صحيح.

**الإصلاح**: أضف `group` لبداية className.

#### P1-5: `aria-label` على `<section>` يكرر العنوان
**الملفات**:
- `src/components/shared/cta.tsx` L38: `<section aria-label={t('title')}>` مع وجود `<h2>{t('title')}</h2>` داخلها.
- `src/components/pages/work-grid.tsx` L48: `<div role="tablist" aria-label={t('hero.title')}>` مكرر للعنوان.

**المشكلة**: قارئات الشاشة ستنطق العنوان مرتين. الحل: استخدم تسمية وصفية مخصصة مثل "نهاية الصفحة دعوة للتواصل" أو احذف `aria-label` ودع `<h2>` يسمّي القسم ضمنياً (الأفضل).

#### P1-6: `MiniAgent` يتجاهل `prefers-reduced-motion`
**الملف**: `src/components/home/bento.tsx` L225–267  
يستخدم `window.setInterval(..., 25)` لكتابة نص حرفاً بحرف. هذا محرك JS وليس CSS animation — لذا override الـ CSS العام في `globals.css` L195–204 **لا يطفّله**. يجب استدعاء `useReducedMotion()` وتجاوز الكتابة فوراً بعرض النص كاملاً عند `reduced=true`.

#### P1-7: `MiniCube`'s `{reduced ? null : null}` كود ميت
**الملف**: `src/components/home/bento.tsx` L219  
الـ hook `useReducedMotion()` مستدعى لكن النتيجة لا تُستخدم. إما احذف الاستدعاء أو نفّذ fallbackاً (مثلاً: عرض cube بشكل ثابت دون transitions).

#### P1-8: منطق السهم في الحاسبة مزدوج الانعكاس
**الملف**: `src/components/home/calculator.tsx` L58 و L489 و L498  
```tsx
const Arrow = isRtl ? ArrowLeft : ArrowRight
// ثم:
<Arrow className="size-4 rtl:rotate-180" />
```
**النتيجة في RTL**: ArrowLeft (يشير ← يساراً افتراضياً) + rotate-180 → يشير يميناً (اتجاه خاطئ لزر "التالي" في RTL الذي يجب أن يشير يساراً).

**الإصلاح**: اختر أسلوباً واحداً:
- (مفضّل) استخدم ArrowRight دائماً + `rtl:rotate-180` فقط (يدور يساراً في RTL ✓)
- أو احذف `rtl:rotate-180` واترك `Arrow = isRtl ? ArrowLeft : ArrowRight` يشير بنفسه ✓

(لاحظ أن `hero.tsx` L120 و `page-hero.tsx` L85 و `featured-work.tsx` L74 و `cta.tsx` L72 يستخدمون نفس النمط — يجب إصلاحهم جميعاً بنفس الطريقة).

#### P1-9: `Footer` يستخدم `new Date().getFullYear()` بلا mount guard
**الملف**: `src/components/layout/footer.tsx` L12  
الـ Footer هو `'use client'` ويُرندر SSR. عند الانتقال عبر السنة (مثلاً 2025→2026 بين SSR و hydration)، سيحدث hydration mismatch. دليل الـ Full-Stack §1.6 يفرض أن أي منطق زمني يجب أن يكون بعد `mounted` flag في `useEffect`.

**الإصلاح**:
```tsx
const [year, setYear] = useState<number | null>(null)
useEffect(() => setYear(new Date().getFullYear()), [])
// ثم اعرض: {year ?? 2025}  // قيمة fallback
```

#### P1-10: `aria-label="WhatsApp"` hardcoded English
**الملف**: `src/components/layout/footer.tsx` L136  
أضف مفتاح `footer.social.whatsapp` إلى `messages/{ar,en}.json` أو استخدم تسمية وصفية محلية.

#### P1-11: `nav aria-label={t('nav.services')}` تسمية غريبة
**الملف**: `src/components/layout/navbar.tsx` L47  
عنصر `<nav>` موسوم بـ "Services" بدلاً من "Main navigation". أضف مفتاح `nav.ariaLabel: "القائمة الرئيسية" / "Main navigation"` واستخدمه.

#### P1-12: `Sheet side="right"` غير مُكيّف لـ RTL
**الملف**: `src/components/layout/navbar.tsx` L97  
القائمة المتنقلة تنفتح دائماً من اليمين. في العربية، المعتاد أن تنفتح من اليسار (جهة البداية). استخدم:
```tsx
side={isRtl ? 'left' : 'right'}
```
يتطلب تمرير `isRtl` إلى Navbar (الذي ليس له حالياً — لكن `useIsRtl()` متاح).

#### P1-13: `before-after` slider لا ينعكس في RTL
**الملف**: `src/components/home/before-after.tsx` L170 و L206  
الـ clip `inset(0 0 0 ${pos}%)` يكشف دائماً من الحافة اليسرى الفيزيائية. في RTL، المستخدم العربي يتوقع "قبل" على اليمين و"بعد" على اليسار، مع سحب من اليمين لليسار.

الحل البسيط: في RTL استخدم `inset(0 ${100-pos}% 0 0)` وكذلك غيّر `left:` إلى `right:` للـ handle. أو اقبل الخيار الحالي كقرار تصميمي موثّق (لكن هذا قد يبدو "أجنبياً" للجمهور العربي).

#### P1-14: بيانات الاتصال placeholder
**الملفات**: `src/components/layout/footer.tsx` L133 (WhatsApp: `963991000000`)، L122–169 (روابط社交媒体 placeholder)  
يجب استبدال `963991000000` برقم حقيقي، واستلام حسابات `t.me/elyra_agency` و `instagram.com/elyra.agency` و `linkedin.com/company/elyra-agency` و `github.com/elyra-agency` قبل الإطلاق.

---

### P2 — تحسينات مقترحة (Nice-to-have)

#### P2-1: لا يوجد `src/lib/brand-colors.ts` كمصدر وحيد للحقيقة
الدليل §4.10 يفرض `BRAND_COLORS` const + CSS vars via `data-brand`. الألوان مُعرّفة في `globals.css :root` (يعمل، لكنه يخالف القاعدة). اقتراح: استخرجها إلى ملف TS واحد كمرجع برمجي للـ JSON-LD والأيقونات و OG images.

#### P2-2: React Compiler معطّل
بعد إعادة تفعيله (P0-1)، فكّر في تفعيل `react-compiler` فعلياً في `next.config.ts` عبر `experimental: { reactCompiler: true }` للاستفادة من التحسينات.

#### P2-3: `sitemap.ts` يُصدر روابط AR فقط كـ `url:` رئيسي
الروابط الإنجليزية في `alternates.languages` فقط. مقبول وفق مواصفات Google، لكن بعض ممارسي SEO يفضّلون إصدار `<url>` منفصل لكل لغة. مسألة تفضيلية.

---

## التحقق من ادعاءات README

| الادعاء في README | الحالة بعد المراجعة |
|---|---|
| `bun run lint` 0/0 | ⚠ **غير قابل للتحقق** (القواعد معطّلة؛ الادعاء بلا معنى حتى P0-1 يُحل) |
| `bunx tsc --noEmit` 0 (مع `noUncheckedIndexedAccess`) | ✓ tsconfig مُفعّل فعلاً (L8). آمن بافتراض عدم وجود أخطاء بناءً على مراجعة الأكواد. |
| تكافؤ i18n 445/445 | ✓ أعدت تشغيل السكربت بنفسي وأكّدت |
| 7 مسارات × 2 لغة = 200 OK | ⚠ غير قابل للتحقق دون `bun install` + تشغيل البناء. لكن بنية الملفات صحيحة. |
| WCAG 2.1 AA | ✓ بمعظمه؛ استثناءات: aria-label مكرر (P1-5)، بعض الـ labels غير مترجمة (P1-10) |
| `prefers-reduced-motion` | ⚠ محترم في الـ CSS العام + framer-motion hook، لكن `MiniAgent` و`MiniCube` لا يحترمانه (P1-6, P1-7) |
| صفر أخطاء console | ⚠ يصعب التحقق دون تشغيل، لكن `console.error` في `error.tsx`/`global-error.tsx` مقصود لـ logging |

---

## قرارات README المعمارية السبعة — التقييم

| # | القرار | الحكم |
|---|---|---|
| 1 | `localePrefix: 'as-needed'` + `localeDetection: false` | ✓ موافق — نمط نظيف ومتسق مع هوية عربية أولاً |
| 2 | `proxy.ts` بدل `middleware.ts` | ✓ صحيح 100% لـ Next.js 16 |
| 3 | `[locale]/layout.tsx` بدل `src/app/layout.tsx` | ✓ النمط الرسمي لـ next-intl |
| 4 | `global-error.tsx` في جذر `src/app/` | ✓ الموقع صحيح؛ **لكن المحتوى إنجليزي فقط (P1-1)** |
| 5 | مشاهد CSS بدل صور AI | ✓ قرار ذكي — أدق وأنظف وأخف؛ يعمل في RTL/LTR |
| 6 | الحاسبة: client في المرحلة 1، API في المرحلة 3 | ✓ تقسيم صحيح؛ `computeEstimate` دالة نقية جاهزة للمشاركة |
| 7 | `react-hooks/immutability` + R3F | ⚠ القرار صحيح نظرياً، لكن **القاعدة غير مفعّلة في eslint.config** (P0-1)، فتعليقات `eslint-disable` لا قيمة لها |
| 8 | Hydration safety مع mounted flag | ✓ محقّق في `LiveClock` و `hero-canvas` و `capability-scene`؛ **مخالف في `Footer`** (P1-9) |

---

## التوصية النهائية

**المرحلة 1: مُعتمَدة بشرط**

قبل الانتقال إلى المرحلة 2، على المُنفِّذ:

1. **(P0 إلزامي)** إعادة تفعيل قواعد React 19 في `eslint.config.mjs` وإصلاح أي أخطاء تظهر. هذا يضمن أن ادعاء "lint 0/0" يعني شيئاً حقيقياً.
2. **(P1 موصى به في بداية المرحلة 2)** إصلاح العناصر الـ 14 المُصنّفة أعلاه — أغلبها إصلاحات سطرية أو سطرين، ربع ساعة عمل لكل بند.
3. **(P1 إلزامي قبل الإطلاق)** استبدال placeholder الأرقام والروابط الاجتماعية.

بعد ذلك يمكن صياغة **برومبت المرحلة 2** الذي يشمل:
- المؤشر المغناطيسي (custom cursor with magnetic snap)
- الحبيبات السينمائية (film grain overlay)
- Audio UX (أصوات تفاعلية اختيارية مع toggle)
- إثراء محتوى الأعمال والفريق (حقوق، أرقام، شهادات تفصيلية)
- ضبط Lighthouse النهائي (90+ في كل الفئات)

---

## ملاحق

### ملفات قُرئت بالكامل (35 ملف)
`README.md`، `package.json`، `tsconfig.json`، `eslint.config.mjs`، `next.config.ts`، `src/proxy.ts`، `src/i18n/{routing,request,navigation}.ts`، `src/app/[locale]/{layout,page,error,loading,not-found}.tsx`، `src/app/[locale]/{services/websites,services/automation,work,about,contact}/page.tsx`، `src/app/{global-error,sitemap,robots,icon}.tsx`، `src/app/globals.css`، `src/lib/{calculator,seo,use-rtl,utils}.ts`، `src/components/{home,layout,shared,pages,three,brand,seo}/**/*.tsx`، `prisma/schema.prisma`، `scripts/check-i18n-parity.js`، `messages/en.json` (جزئي)، `worklog.md`

### سكربتات لم تُشغّل لغياب `node_modules`
- `bun run lint` (للتحقق الفعلي بعد P0-1)
- `bunx tsc --noEmit`
- `bun run build`
- Lighthouse CI

تقتضي البيئة الحالية عدم تثبيت dependencies. يُنصح بأن يُعيد المُنفِّذ تثبيتها وتشغيل الفحوصات بنفسه بعد إصلاح P0-1.

---

*التقرير من إعداد AI Assistant Agent — مراجعة بصرية وأكواد ساكنة للمرحلة 1.*
