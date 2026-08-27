#!/usr/bin/env python3
"""Phase 0: inject new i18n keys for the UI enrichment round (ar + en).
Purely ADDITIVE — no key removals (obsolete keys like bento.ai.mini.response
are pruned in the coordinator's final cleanup after agents land)."""
import json

AR = '/home/z/my-project/messages/ar.json'
EN = '/home/z/my-project/messages/en.json'

ar = json.load(open(AR, encoding='utf-8'))
en = json.load(open(EN, encoding='utf-8'))

# ---------------------------------------------------------------- bento ----
ar['bento']['websites']['mini'] = {
    "title": "جرّب هوية الموقع",
    "hint": "انقر أي لون — تتغير الأزرار والروابط والبطاقات كاملةً في لحظة",
    "brand": "لمسة",
    "nav": ["الجديد", "النسائي", "الإكسسوارات"],
    "search": "ابحث عن قطعة…",
    "kicker": "تشكيلة خريف 2025",
    "heroTitle": "أناقة هادئة، تفاصيل دقيقة",
    "heroSub": "أقمشة طبيعية وخياطة تدوم — قطع تُصنع لتبقى.",
    "heroCta": "تسوّق التشكيلة",
    "heroLink": "شاهد الـ Lookbook",
    "viewers": "يشاهد الآن 122 شخصًا",
    "addToCart": "أضف",
    "palette": ["كحلي", "زمردي", "مرجاني", "عنبري"],
    "activeLabel": "الهوية الحالية",
    "products": [
        {"name": "معطف صوف", "price": "349$", "old": "429$"},
        {"name": "حقيبة جلد", "price": "289$", "old": "359$"},
        {"name": "وشاح كشمير", "price": "119$", "old": "149$"}
    ],
    "footer": "© 2025 لمسة — جميع الحقوق محفوظة"
}
en['bento']['websites']['mini'] = {
    "title": "Try the Site Identity",
    "hint": "Click any color — buttons, links and cards restyle instantly",
    "brand": "Lamsa",
    "nav": ["New In", "Women", "Accessories"],
    "search": "Search for a piece…",
    "kicker": "Autumn 2025 Collection",
    "heroTitle": "Quiet elegance, precise details",
    "heroSub": "Natural fabrics and lasting tailoring — pieces made to stay.",
    "heroCta": "Shop the Collection",
    "heroLink": "View the Lookbook",
    "viewers": "122 people viewing now",
    "addToCart": "Add",
    "palette": ["Cobalt", "Emerald", "Coral", "Amber"],
    "activeLabel": "Current identity",
    "products": [
        {"name": "Wool Coat", "price": "$349", "old": "$429"},
        {"name": "Leather Bag", "price": "$289", "old": "$359"},
        {"name": "Cashmere Scarf", "price": "$119", "old": "$149"}
    ],
    "footer": "© 2025 Lamsa — All rights reserved"
}

ar['bento']['automation']['mini'].update({
    "nodes": ["استلام الطلب", "تحقق وتسجيل", "إشعار الفريق"],
    "saved": "وفّرت 12 دقيقة من العمل اليدوي",
    "runs": "تشغيل ناجح"
})
en['bento']['automation']['mini'].update({
    "nodes": ["Receive order", "Validate & log", "Notify team"],
    "saved": "Saved 12 minutes of manual work",
    "runs": "Run successful"
})

ar['bento']['threeD']['mini'].update({
    "idle": "أو اتركه — سيدور من نفسه"
})
en['bento']['threeD']['mini'].update({
    "idle": "or leave it — it spins on its own"
})

ar['bento']['ai']['mini'].update({
    "retryHint": "انقر مجددًا لإجابة مختلفة",
    "responses": [
        "3 قرارات رئيسية، مهامان موكلتان، وموعد تسليم محدد الخميس القادم. أرسلت الملخص لفريقك ✓",
        "الخلاصة: إطلاق الحملة يوم 12، ميزانية الربع القادم زادت 15%، وأنت مسؤول عن العرض التقديمي ✓",
        "نقطة الخلاف الوحيدة: نظام التسعير — أُجّلت لجلسة الخميس. 3 مهام فورية أُرسلت لأصحابها ✓",
        "اجتماع 47 دقيقة بمشاركة 5 أشخاص. الأبرز: خفض زمن الاستجابة إلى 4 ساعات وتوظيف مصمم جديد ✓",
        "سجّلت 6 مخاطر محتملة ورتّبتها حسب الأثر، مع مسودة خطة تخفيف لكل واحدة في المستند المشترك ✓",
        "أبرز ملاحظة من العميل: يعجبه الاتجاه الجديد لكنه يريد نسخة أدكن — جهّزت مسودة معدّلة للموافقة ✓"
    ]
})
en['bento']['ai']['mini'].update({
    "retryHint": "Click again for a different answer",
    "responses": [
        "3 key decisions, 2 assigned tasks, and a deadline set for next Thursday. Summary sent to your team ✓",
        "The gist: campaign launches on the 12th, next quarter’s budget is up 15%, and you own the deck ✓",
        "One unresolved point: pricing — deferred to Thursday’s session. 3 action items dispatched to owners ✓",
        "47-minute meeting, 5 participants. Highlights: response time cut to 4 hours and a designer to hire ✓",
        "Logged 6 potential risks ranked by impact, each with a mitigation draft in the shared doc ✓",
        "Client’s key note: loves the new direction but wants a darker variant — revised draft ready for approval ✓"
    ]
})

# ------------------------------------------------------------ simulator ----
for d, s in ((ar, {
    "logTitle": "سجل التنفيذ المباشر",
    "payloadTitle": "الحمولة الواردة",
    "stats": {"total": "الزمن الكلي", "steps": "الخطوات", "status": "الحالة"},
    "state": {"idle": "في الانتظار", "running": "قيد التشغيل", "completed": "اكتمل"}
}), (en, {
    "logTitle": "Live Execution Log",
    "payloadTitle": "Incoming Payload",
    "stats": {"total": "Total time", "steps": "Steps", "status": "Status"},
    "state": {"idle": "Idle", "running": "Running", "completed": "Completed"}
})):
    d['simulator'].update(s)

# -------------------------------------------------- workSection scenes ----
ar['workSection']['scenes'] = {
    "site": {
        "announce": "شحن مجاني للطلبات فوق 200$ • إرجاع خلال 30 يومًا",
        "nav": ["الجديد", "التصفح", "الأكثر رواجًا"],
        "search": "ابحث…",
        "viewers": "يشاهد الآن 122 شخصًا",
        "addToCart": "أضف",
        "rating": "4.9",
        "reviews": "312 تقييمًا",
        "footerLinks": ["الدعم", "التوصيل", "الإرجاع", "تواصل معنا"],
        "footerNote": "جميع الحقوق محفوظة"
    },
    "old": {
        "announce": "*** عروض خاصة!!! خصومات حتى 70% سارعوا قبل النفاد ***",
        "nav": ["الرئيسية", "منتجاتنا", "من نحن", "اتصل بنا", "روابط", "خريطة الموقع"],
        "welcome": "أهلًا وسهلًا بكم في موقعنا الإلكتروني المتواضع...",
        "clickHere": "اضغط هنا!!!",
        "counter": "عدد الزوار: 004217",
        "bestViewed": "يُفضَّل عرض الموقع بمتصفح Internet Explorer 6 وبدقة 800×600",
        "construction": "صفحة قيد الإنشاء 🚧 تعود قريبًا إن شاء الله!",
        "items": ["منتج رقم 1", "منتج رقم 2", "منتج رقم 3"]
    },
    "dash": {
        "nav": ["لوحة التحكم", "العمليات", "العملاء", "التقارير", "الإعدادات"],
        "welcome": "مساء الخير، زينب",
        "search": "ابحث في كل شيء…",
        "notifications": "3 إشعارات جديدة",
        "live": "مباشر",
        "kpis": [
            {"label": "إيرادات الشهر", "value": "48,250$", "delta": "+18%"},
            {"label": "عمليات مكتملة", "value": "342", "delta": "+9%"},
            {"label": "بحاجة متابعة", "value": "12", "delta": "−41%"},
            {"label": "عملاء جدد", "value": "67", "delta": "+23%"}
        ],
        "chartTitle": "الأداء — آخر 12 شهرًا",
        "tableTitle": "أحدث العمليات",
        "tableHead": ["المرجع", "الجهة", "المبلغ", "الحالة"],
        "rows": [
            {"ref": "#OP-1043", "party": "شركة الأمل", "amount": "1,240$", "status": "مكتملة"},
            {"ref": "#OP-1042", "party": "مؤسسة النور", "amount": "890$", "status": "معلقة"},
            {"ref": "#OP-1041", "party": "متجر لمسة", "amount": "2,150$", "status": "مكتملة"}
        ]
    },
    "oldDash": {
        "file": "المبيعات_v2_نهائي_حقًّا_نهائي.xls",
        "formula": "=SUM(B2:B14)",
        "warning": "تحذير: 3 صفوف تحتوي أخطاء — التغييرات غير محفوظة!",
        "cols": ["التاريخ", "العميل", "المبلغ", "الحالة"],
        "status": "قيد الانتظار؟"
    }
}
en['workSection']['scenes'] = {
    "site": {
        "announce": "Free shipping over $200 • 30-day returns",
        "nav": ["New In", "Browse", "Trending"],
        "search": "Search…",
        "viewers": "122 people viewing now",
        "addToCart": "Add",
        "rating": "4.9",
        "reviews": "312 reviews",
        "footerLinks": ["Support", "Shipping", "Returns", "Contact"],
        "footerNote": "All rights reserved"
    },
    "old": {
        "announce": "*** SPECIAL OFFERS!!! UP TO 70% OFF — HURRY BEFORE IT ENDS ***",
        "nav": ["Home", "Products", "About Us", "Contact", "Links", "Sitemap"],
        "welcome": "Welcome to our humble website...",
        "clickHere": "CLICK HERE!!!",
        "counter": "Visitors: 004217",
        "bestViewed": "Best viewed in Internet Explorer 6 at 800×600",
        "construction": "Page under construction 🚧 coming soon!",
        "items": ["Product No. 1", "Product No. 2", "Product No. 3"]
    },
    "dash": {
        "nav": ["Overview", "Operations", "Customers", "Reports", "Settings"],
        "welcome": "Good evening, Zeinab",
        "search": "Search everything…",
        "notifications": "3 new notifications",
        "live": "LIVE",
        "kpis": [
            {"label": "Monthly revenue", "value": "$48,250", "delta": "+18%"},
            {"label": "Completed ops", "value": "342", "delta": "+9%"},
            {"label": "Needs follow-up", "value": "12", "delta": "−41%"},
            {"label": "New customers", "value": "67", "delta": "+23%"}
        ],
        "chartTitle": "Performance — last 12 months",
        "tableTitle": "Latest operations",
        "tableHead": ["Ref", "Party", "Amount", "Status"],
        "rows": [
            {"ref": "#OP-1043", "party": "Al-Amal Co.", "amount": "$1,240", "status": "Completed"},
            {"ref": "#OP-1042", "party": "Al-Nour Est.", "amount": "$890", "status": "Pending"},
            {"ref": "#OP-1041", "party": "Lamsa Store", "amount": "$2,150", "status": "Completed"}
        ]
    },
    "oldDash": {
        "file": "sales_v2_FINAL_really_final.xls",
        "formula": "=SUM(B2:B14)",
        "warning": "Warning: 3 rows contain errors — unsaved changes!",
        "cols": ["Date", "Customer", "Amount", "Status"],
        "status": "Pending?"
    }
}

# ------------------------------------------------- per-project mock data ----
# Home (workSection.project1/2) — project1 renders as a site mockup,
# project2 as a dashboard mockup (brand only needed there).
ar['workSection']['project1']['mock'] = {
    "brand": "لمسة",
    "kicker": "تشكيلة خريف 2025",
    "title": "أناقة هادئة، تفاصيل دقيقة",
    "sub": "أقمشة طبيعية وخياطة تدوم — قطع تُصنع لتبقى.",
    "cta": "تسوّق التشكيلة",
    "cards": [
        {"name": "معطف صوف", "price": "349$", "old": "429$"},
        {"name": "حقيبة جلد", "price": "289$", "old": "359$"},
        {"name": "وشاح كشمير", "price": "119$", "old": "149$"}
    ]
}
en['workSection']['project1']['mock'] = {
    "brand": "Lamsa",
    "kicker": "Autumn 2025 Collection",
    "title": "Quiet elegance, precise details",
    "sub": "Natural fabrics and lasting tailoring — pieces made to stay.",
    "cta": "Shop the Collection",
    "cards": [
        {"name": "Wool Coat", "price": "$349", "old": "$429"},
        {"name": "Leather Bag", "price": "$289", "old": "$359"},
        {"name": "Cashmere Scarf", "price": "$119", "old": "$149"}
    ]
}
ar['workSection']['project2']['mock'] = {"brand": "عقار بلس"}
en['workSection']['project2']['mock'] = {"brand": "Aqar Plus"}

# /work page (pages.work.projects.p1..p6)
wp_ar = {
    "p1": {"brand": "لمسة", "kicker": "تشكيلة خريف 2025", "title": "أناقة هادئة، تفاصيل دقيقة",
           "sub": "أقمشة طبيعية وخياطة تدوم — قطع تُصنع لتبقى.", "cta": "تسوّق التشكيلة",
           "cards": [
               {"name": "معطف صوف", "price": "349$", "old": "429$"},
               {"name": "حقيبة جلد", "price": "289$", "old": "359$"},
               {"name": "وشاح كشمير", "price": "119$", "old": "149$"}]},
    "p2": {"brand": "عقار بلس", "kicker": "أحدث العروض", "title": "اعثر على منزلٍ يليق بحياتك",
           "sub": "فلترة ذكية وخرائط حية — من أول نقرة حتى مفاتيح البيت.", "cta": "استكشف العقارات",
           "cards": [
               {"name": "شقة — المزة", "price": "235,000$", "old": ""},
               {"name": "فيلا — بلودان", "price": "540,000$", "old": ""},
               {"name": "مكتب — بزنس", "price": "120,000$", "old": "135,000$"}]},
    "p3": {"brand": "مسار", "kicker": "التسجيل مفتوح", "title": "تعلّم مهارة تغيّر مسارك",
           "sub": "دورات مباشرة وشهادات معتمدة بمتابعة شخصية لكل طالب.", "cta": "ابدأ التعلّم",
           "cards": [
               {"name": "أساسيات UI/UX", "price": "129$", "old": "159$"},
               {"name": "تسويق بالمحتوى", "price": "99$", "old": ""},
               {"name": "إدارة المشاريع", "price": "149$", "old": "189$"}]},
    "p4": {"brand": "بيت الشام", "kicker": "من قلب دمشق", "title": "مذاق البيت، بكرم البيت",
           "sub": "اطلب الآن — يصلك ساخنًا خلال 30 دقيقة.", "cta": "احجز طاولتك",
           "cards": [
               {"name": "منسف شامي", "price": "12$", "old": "15$"},
               {"name": "كبة مقلية", "price": "8$", "old": ""},
               {"name": "بقلاوة بالفستق", "price": "6$", "old": ""}]},
    "p5": {"brand": "فواتير سمارت"},
    "p6": {"brand": "بسّام"},
}
wp_en = {
    "p1": {"brand": "Lamsa", "kicker": "Autumn 2025 Collection", "title": "Quiet elegance, precise details",
           "sub": "Natural fabrics and lasting tailoring — pieces made to stay.", "cta": "Shop the Collection",
           "cards": [
               {"name": "Wool Coat", "price": "$349", "old": "$429"},
               {"name": "Leather Bag", "price": "$289", "old": "$359"},
               {"name": "Cashmere Scarf", "price": "$119", "old": "$149"}]},
    "p2": {"brand": "Aqar Plus", "kicker": "Latest listings", "title": "Find a home worthy of your life",
           "sub": "Smart filters and live maps — from first click to house keys.", "cta": "Explore Properties",
           "cards": [
               {"name": "Apartment — Mezzeh", "price": "$235,000", "old": ""},
               {"name": "Villa — Bloudan", "price": "$540,000", "old": ""},
               {"name": "Office — Business", "price": "$120,000", "old": "$135,000"}]},
    "p3": {"brand": "Masar", "kicker": "Enrollment open", "title": "Learn a skill that changes your path",
           "sub": "Live courses and certified credentials with personal follow-up.", "cta": "Start Learning",
           "cards": [
               {"name": "UI/UX Foundations", "price": "$129", "old": "$159"},
               {"name": "Content Marketing", "price": "$99", "old": ""},
               {"name": "Project Management", "price": "$149", "old": "$189"}]},
    "p4": {"brand": "Beit Al-Sham", "kicker": "From the heart of Damascus", "title": "Home taste, home generosity",
           "sub": "Order now — arrives hot within 30 minutes.", "cta": "Book a Table",
           "cards": [
               {"name": "Shami Mansaf", "price": "$12", "old": "$15"},
               {"name": "Fried Kibbeh", "price": "$8", "old": ""},
               {"name": "Pistachio Baklava", "price": "$6", "old": ""}]},
    "p5": {"brand": "Smart Invoices"},
    "p6": {"brand": "Bassam"},
}
for k, v in wp_ar.items():
    ar['pages']['work']['projects'][k]['mock'] = v
for k, v in wp_en.items():
    en['pages']['work']['projects'][k]['mock'] = v

# ---------------------------------------------------------------- write ----
for path, data in ((AR, ar), (EN, en)):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

# ------------------------------------------------------------- verify ----
def keys(o, prefix=''):
    out = set()
    if isinstance(o, dict):
        for k, v in o.items():
            out |= keys(v, f'{prefix}.{k}' if prefix else k)
    else:
        out.add(prefix)
    return out

ka, ke = keys(ar), keys(en)
print('ar leaf keys:', len(ka), '| en leaf keys:', len(ke))
print('missing in en:', sorted(ka - ke)[:10])
print('missing in ar:', sorted(ke - ka)[:10])
print('PARITY OK' if ka == ke else 'PARITY BROKEN')
