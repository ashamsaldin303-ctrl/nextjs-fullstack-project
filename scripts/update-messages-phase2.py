#!/usr/bin/env python3
"""Phase 2 content enrichment — updates ar.json & en.json in place."""
import json

AR_PATH = '/home/z/my-project/messages/ar.json'
EN_PATH = '/home/z/my-project/messages/en.json'


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


AR = load(AR_PATH)
EN = load(EN_PATH)

# ----------------------------------------------------------------------
# 1) Sound toggle labels (common.sound)
# ----------------------------------------------------------------------
AR['common']['sound'] = {
    'enable': 'تشغيل المؤثرات الصوتية',
    'disable': 'كتم المؤثرات الصوتية',
}
EN['common']['sound'] = {
    'enable': 'Enable sound effects',
    'disable': 'Mute sound effects',
}

# ----------------------------------------------------------------------
# 2) /work — six projects across six industries + services lists (§6.1)
# ----------------------------------------------------------------------
AR['pages']['work']['projects'] = {
    'p1': {
        'title': 'متجر «لمسة» للأزياء',
        'category': 'مواقع',
        'type': 'تجارة إلكترونية',
        'desc': 'من قالب بطيء وباهت إلى تجربة تسوّق فاخرة تُشبه زيارة البوتيك — حتى على شاشة الجوال.',
        'services': ['هوية بصرية وتجربة تسوّق', 'متجر ثنائي اللغة', 'بوابة دفع محلية', 'ربط المخزون والشحن'],
        'metrics': ['+140% معدل التحويل', '×2.3 سرعة التحميل', '−45% ترك السلة'],
    },
    'p2': {
        'title': 'منصة «عقار بلس»',
        'category': 'مواقع',
        'type': 'منصة عقارية',
        'desc': 'لوحة إعلانات مزدحمة صارت منصة استكشاف سلسة بخرائط حية وفلاتر ذكية تفهم ما يبحث عنه المشتري.',
        'services': ['بحث تفاعلي بخرائط حية', 'حسابات للوسطاء', 'لوحة إدارة الإعلانات', 'تنبيهات آلية بالعقارات الجديدة'],
        'metrics': ['+85% زيارات عضوية', '60% مدة بقاء أطول'],
    },
    'p3': {
        'title': 'أكاديمية «مسار» التعليمية',
        'category': 'مواقع',
        'type': 'منصة تعليمية',
        'desc': 'من ملفات PDF مبعثرة إلى أكاديمية رقمية تدير التعلّم كاملًا — من التسجيل حتى إصدار الشهادة.',
        'services': ['منصة دورات واشتراكات', 'بث دروس مباشر', 'اختبارات وشهادات آلية', 'لوحة متابعة للطلاب'],
        'metrics': ['4200 طالب في أول فصل', '+68% إكمال الدورات', '−75% أعمال إدارية يدوية'],
    },
    'p4': {
        'title': 'مطعم «بيت الشام»',
        'category': 'مواقع',
        'type': 'موقع + حجوزات وطلبات',
        'desc': 'قائمة ورقية وحجز هاتفي تحوّلا إلى تجربة رقمية كاملة: الحجز فوري، والطلب يصل المطبخ لحظة تأكيده.',
        'services': ['قائمة رقمية تفاعلية', 'حجز طاولات فوري', 'طلبات استلام وتوصيل', 'تنبيهات مطبخ تلقائية'],
        'metrics': ['70% من الحجوزات أونلاين', '+35% طلبات الاستلام'],
    },
    'p5': {
        'title': 'نظام «فواتير سمارت»',
        'category': 'أتمتة',
        'type': 'منظومة فوترة SaaS',
        'desc': 'إصدار يدوي كان يستهلك يومًا كاملًا صار منظومة ذاتية: تُصدر، وتتابع، وتُذكّر — دون لمسة بشرية.',
        'services': ['إصدار فواتير آلي', 'تذكيرات سداد متدرجة', 'مزامنة مع نظام محاسبي', 'تقارير مالية شهرية'],
        'metrics': ['−90% وقت الإصدار', 'صفر فواتير متأخرة منذ 8 أشهر'],
    },
    'p6': {
        'title': 'استوديو «بصمة» الإبداعي',
        'category': 'أتمتة',
        'type': 'أتمتة وكالة إبداعية',
        'desc': 'وكالة تصميم غرقت في الرسائل والموافقات، فبنينا لها خط إنتاج رقميًا يدير المشروع من البريف حتى التسليم.',
        'services': ['استقبال الطلبات وتأهيلها', 'مسارات موافقات ومسودات', 'تسليم أصول منظّم', 'فوترة بالمشاريع'],
        'metrics': ['×2 مشاريع تُسلَّم شهريًا', '−14 ساعة تنسيق أسبوعيًا'],
    },
}

EN['pages']['work']['projects'] = {
    'p1': {
        'title': 'Lamsa Fashion Store',
        'category': 'Websites',
        'type': 'E-commerce',
        'desc': "From a sluggish off-the-shelf template to a boutique-grade shopping experience — even on mobile.",
        'services': ['Brand identity & shopping UX', 'Bilingual storefront', 'Local payment gateway', 'Inventory & shipping sync'],
        'metrics': ['+140% Conversion Rate', '×2.3 Load Speed', '−45% Cart Abandonment'],
    },
    'p2': {
        'title': 'Aqar Plus Platform',
        'category': 'Websites',
        'type': 'Real-estate Platform',
        'desc': 'A cluttered listings board became a smooth discovery platform with live maps and filters that understand buyers.',
        'services': ['Interactive map search', 'Agent accounts', 'Listings dashboard', 'Automated new-listing alerts'],
        'metrics': ['+85% Organic Visits', '60% Longer Sessions'],
    },
    'p3': {
        'title': 'Masar Academy',
        'category': 'Websites',
        'type': 'Education Platform',
        'desc': 'From scattered PDFs to a full digital academy managing learning end to end — enrollment to certificates.',
        'services': ['Courses & subscriptions', 'Live lesson streaming', 'Automated quizzes & certificates', 'Student progress dashboard'],
        'metrics': ['4,200 Students in First Term', '+68% Course Completion', '−75% Manual Admin Work'],
    },
    'p4': {
        'title': 'Beit Al-Sham Restaurant',
        'category': 'Websites',
        'type': 'Site + Bookings & Orders',
        'desc': 'A paper menu and phone-only bookings became a complete digital experience: instant reservations, orders straight to the kitchen.',
        'services': ['Interactive digital menu', 'Instant table booking', 'Pickup & delivery orders', 'Automated kitchen alerts'],
        'metrics': ['70% of Bookings Online', '+35% Pickup Orders'],
    },
    'p5': {
        'title': 'Smart Invoicing System',
        'category': 'Automation',
        'type': 'SaaS Billing System',
        'desc': 'Manual invoicing that ate a full day is now a self-running system: it issues, tracks, and reminds — with zero human touch.',
        'services': ['Automated invoice issuing', 'Escalating payment reminders', 'Accounting system sync', 'Monthly financial reports'],
        'metrics': ['−90% Issuance Time', 'Zero Overdue Invoices for 8 Months'],
    },
    'p6': {
        'title': 'Bassam Creative Studio',
        'category': 'Automation',
        'type': 'Creative Agency Automation',
        'desc': 'A design agency drowning in messages and approvals got a digital production line — brief to delivery, fully managed.',
        'services': ['Client intake & qualification', 'Approval & draft workflows', 'Organized asset delivery', 'Project-based billing'],
        'metrics': ['×2 Projects Delivered Monthly', '−14 Hours of Coordination Weekly'],
    },
}

# ----------------------------------------------------------------------
# 3) /about — team bios + new agency numbers (§6.2)
# ----------------------------------------------------------------------
AR['pages']['about']['team']['members'] = {
    'm1': {
        'name': 'أحمد الرفاعي',
        'role': 'المؤسس · مهندس أنظمة',
        'bio': 'ثماني سنوات في هندسة المنصات قبل إيليرا؛ يؤمن أن أفضل كود هو الذي لا تحتاج لقراءته مرتين.',
    },
    'm2': {
        'name': 'سارة قباني',
        'role': 'مديرة التصميم',
        'bio': 'تصمّم الواجهة كمحادثة صامتة مع المستخدم — كل بكسل جملة، وكل مسافة بيضاء تنفّس.',
    },
    'm3': {
        'name': 'محمد عيسى',
        'role': 'مهندس أتمتة n8n',
        'bio': 'بنى أكثر من 90 تدفقًا آليًا لعملاء في ست دول؛ يكرر أن الروتين خطأ بشري لا قدَر.',
    },
    'm4': {
        'name': 'ليلى حداد',
        'role': 'استراتيجية تجربة المستخدم',
        'bio': 'تسأل «لماذا؟» خمس مرات قبل كل «كيف» — وهكذا تُبنى التجارب التي تبقى في الذاكرة.',
    },
}
EN['pages']['about']['team']['members'] = {
    'm1': {
        'name': 'Ahmad Al-Rifai',
        'role': 'Founder · Systems Engineer',
        'bio': 'Eight years building platforms before Elyra; believes the best code is the kind you never have to read twice.',
    },
    'm2': {
        'name': 'Sara Qabbani',
        'role': 'Design Director',
        'bio': 'Designs interfaces as silent conversations with the user — every pixel a sentence, every whitespace a breath.',
    },
    'm3': {
        'name': 'Mohammad Issa',
        'role': 'n8n Automation Engineer',
        'bio': 'Built 90+ automation flows for clients across six countries; insists routine is a human mistake, not fate.',
    },
    'm4': {
        'name': 'Layla Haddad',
        'role': 'UX Strategist',
        'bio': 'Asks "why?" five times before any "how" — that is how experiences that stick get built.',
    },
}

AR['pages']['about']['numbers'] = {
    'kicker': 'أرقام الوكالة',
    'title': 'قصيرة، لكنها تتحدث',
    'years': {'value': 5, 'suffix': '', 'label': 'سنوات خبرة تراكمية'},
    'projects': {'value': 120, 'suffix': '+', 'label': 'مشروعًا منجزًا'},
    'automations': {'value': 90, 'suffix': '+', 'label': 'تدفقًا آليًا مُنفَّذًا'},
    'clients': {'value': 80, 'suffix': '+', 'label': 'عميلًا سعيدًا'},
}
EN['pages']['about']['numbers'] = {
    'kicker': 'Agency Numbers',
    'title': 'Short, but It Speaks',
    'years': {'value': 5, 'suffix': '', 'label': 'Years of Combined Experience'},
    'projects': {'value': 120, 'suffix': '+', 'label': 'Projects Delivered'},
    'automations': {'value': 90, 'suffix': '+', 'label': 'Automation Flows Built'},
    'clients': {'value': 80, 'suffix': '+', 'label': 'Happy Clients'},
}

# ----------------------------------------------------------------------
# 4) Testimonials — deeper quotes + company field + a fourth (§6.3)
# ----------------------------------------------------------------------
AR['testimonials']['items'] = {
    'first': {
        'quote': 'طلبت موقعًا فاستلمتُ علامة رقمية كاملة. خلال ثلاثة أشهر من الإطلاق ارتفع التحويل 140% وتراجع ترك السلة إلى النصف تقريبًا. الفريق لا يسأل «ماذا تريد؟» بل «ماذا تريد أن يشعر عميلك؟» — وهذا غيّر كل شيء.',
        'name': 'ريم الحلبي',
        'role': 'مؤسِّسة',
        'company': 'متجر لمسة',
    },
    'second': {
        'quote': 'نظام الأتمتة وفّر على فريقي أكثر من 60 ساعة شهريًا. الفواتير تصدر نفسها والتذكيرات تصل قبل أن نسأل عنها — ولأول مرة ينتهي شهرنا المحاسبي في يوم واحد بدل خمسة.',
        'name': 'خالد النجار',
        'role': 'مدير عمليات',
        'company': 'شركة أفق',
    },
    'third': {
        'quote': 'احترافية نادرة: تسليم قبل الموعد بأسبوعين، وأداء Lighthouse فوق 95. التفاصيل التي لم أطلبها صارت اليوم أول ما يذكره عملاؤنا عن منصتنا.',
        'name': 'لينا مراد',
        'role': 'مديرة تسويق',
        'company': 'منصة عقار بلس',
    },
    'fourth': {
        'quote': 'انتقلنا من ملفات مبعثرة إلى منصة تدير 4200 طالب دون موظف إداري واحد. دعمهم بعد الإطلاق ليس وعودًا — بل تقرير تحسينات شهري يصل قبل أن نطلبه.',
        'name': 'عمر السعدي',
        'role': 'مدير تقني',
        'company': 'أكاديمية مسار',
    },
}
EN['testimonials']['items'] = {
    'first': {
        'quote': 'I asked for a website and received a complete digital brand. Within three months of launch, conversion was up 140% and cart abandonment dropped by nearly half. The team never asks "what do you want?" — they ask "what should your customer feel?" That changed everything.',
        'name': 'Reem Al-Halabi',
        'role': 'Founder',
        'company': 'Lamsa Store',
    },
    'second': {
        'quote': "The automation system saves my team 60+ hours every month. Invoices issue themselves and reminders go out before we think of them — and for the first time, our accounting month closes in one day instead of five.",
        'name': 'Khaled Al-Najjar',
        'role': 'Operations Manager',
        'company': 'Ofoq Company',
    },
    'third': {
        'quote': 'Rare professionalism: delivered two weeks early with Lighthouse scores above 95. The details I never asked for are now the first thing our customers mention about our platform.',
        'name': 'Lina Murad',
        'role': 'Marketing Director',
        'company': 'Aqar Plus',
    },
    'fourth': {
        'quote': 'We went from scattered files to a platform managing 4,200 students without a single admin employee. Their post-launch support is not promises — it is a monthly improvement report that arrives before we ask.',
        'name': 'Omar Al-Saadi',
        'role': 'Technical Director',
        'company': 'Masar Academy',
    },
}

# ----------------------------------------------------------------------
# 5) Service pages prose — "what's included" / "how we work" (§6.4)
# ----------------------------------------------------------------------
AR['pages']['websites']['prose'] = {
    'kicker': 'بلا مفاجآت',
    'title': 'ماذا تشمل، وكيف نعمل',
    'included': {
        'title': 'ماذا تشمل كل مشاريعنا؟',
        'desc': 'كل موقع نسلّمه — مهما كان حجمه — يخرج بالأساسيات نفسها: أداء 90+ على Lighthouse، وتحسين تقني لمحركات البحث، وثنائية اللغة عربية/إنجليزية، ومعايير وصول WCAG 2.1 AA، ولوحة تحكم يستطيع فريقك إدارتها دون مبرمج، وتحليلات مهيأة من اليوم الأول. هذه ليست إضافات مدفوعة؛ إنها أرضية لا نساوم عليها.',
    },
    'process': {
        'title': 'كيف نعمل معك؟',
        'desc': 'نبدأ بجلسة اكتشاف نفهم فيها جمهورك وأهدافك قبل الحديث عن الشكل، ثم نموذج تفاعلي تجربه بيدك قبل كتابة أي سطر نهائي. أثناء البناء ترى التقدم أسبوعيًا وتوجّهه فورًا — لا مفاجآت في يوم التسليم. وبعد الإطلاق نبقى قريبين: مراقبة أداء، وتحسينات دورية، وموقع يكبر مع أعمالك.',
    },
}
EN['pages']['websites']['prose'] = {
    'kicker': 'No Surprises',
    'title': "What's Included, and How We Work",
    'included': {
        "title": "What's included in every project?",
        'desc': "Every site we deliver — whatever its size — ships with the same foundation: 90+ Lighthouse performance, technical SEO, Arabic/English bilingual support, WCAG 2.1 AA accessibility, a dashboard your team can run without a developer, and analytics configured from day one. These are not paid add-ons; they are baselines we never compromise.",
    },
    'process': {
        'title': 'How do we work with you?',
        'desc': 'We start with a discovery session about your audience and goals — before talking about looks — then an interactive prototype you try with your own hands before a single line is written. During the build you see progress weekly and steer it immediately: no launch-day surprises. After launch we stay close: performance monitoring, iterative improvements, and a site that grows with your business.',
    },
}

AR['pages']['automation']['prose'] = {
    'kicker': 'شفافية كاملة',
    'title': 'ماذا تشمل، وكيف نعمل',
    'included': {
        'title': 'ماذا تشمل كل مشاريعنا؟',
        'desc': 'كل نظام أتمتة نبنيه يأتي موثقًا بالكامل مع مخططات تدفق واضحة، واختبارات تشغيل قبل التسليم، وسجلات مراقبة تُريك كل ما يحدث لحظة بلحظة، ونسخ احتياطية لكل تدفق يمكن استعادتها بنقرة. الأتمتة التي لا تفهمها هي أتمتة لا تملكها — لذلك نسلّمك الملكية كاملة مع تدريب لفريقك.',
    },
    'process': {
        'title': 'كيف نعمل معك؟',
        'desc': 'نبدأ بجرد كامل لأدواتك وروتينك اليومي: ما يتكرر، وما يُنسى، وما يستهلك الوقت. نرسم التدفقات المقترحة ونراجعها معك قبل بنائها، ثم ننفذها على مراحل — كل تدفق يُختبر وحده قبل ربطه بما بعده. وعند التسليم يبقى النظام ملكك بالكامل، مع خيار صيانة شهرية إن رغبت.',
    },
}
EN['pages']['automation']['prose'] = {
    'kicker': 'Full Transparency',
    'title': "What's Included, and How We Work",
    'included': {
        "title": "What's included in every project?",
        'desc': 'Every automation system we build ships fully documented with clear flow diagrams, dry-run tests before delivery, monitoring logs that show everything as it happens, and restorable backups for every flow. An automation you do not understand is one you do not own — so we hand over full ownership with training for your team.',
    },
    'process': {
        'title': 'How do we work with you?',
        'desc': 'We start with a full audit of your tools and daily routine: what repeats, what gets forgotten, what eats time. We sketch the proposed flows and review them with you before building, then implement in stages — each flow tested alone before linking to the next. At delivery the system is fully yours, with an optional monthly maintenance plan.',
    },
}

save(AR_PATH, AR)
save(EN_PATH, EN)
print('✅ messages updated')

# Quick parity sanity check
def keys(d, prefix=''):
    out = set()
    for k, v in d.items():
        p = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            out |= keys(v, p)
        else:
            out.add(p)
    return out

ar_keys, en_keys = keys(AR), keys(EN)
print(f'AR keys: {len(ar_keys)}, EN keys: {len(en_keys)}')
missing_en = ar_keys - en_keys
missing_ar = en_keys - ar_keys
print('Missing in EN:', sorted(missing_en) if missing_en else 'none')
print('Missing in AR:', sorted(missing_ar) if missing_ar else 'none')
