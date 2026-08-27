#!/usr/bin/env python3
"""Batch 2 items 6-7 (agent I-2): inject new i18n keys into messages/ar.json
+ messages/en.json. Purely ADDITIVE — no removals, no edits to existing keys.

Covers:
  - contact form: whatsapp field, project-type chips, prefill templates
  - contact page: wa.me greeting, social-proof metric badges
  - keys agent I-3 (wave 2) will consume: miniAgent input/convert CTA,
    simulator completion CTA, compact language-toggle a11y label,
    404 recovery heading.
"""
import json

AR = '/home/z/my-project/messages/ar.json'
EN = '/home/z/my-project/messages/en.json'

ar = json.load(open(AR, encoding='utf-8'))
en = json.load(open(EN, encoding='utf-8'))


def reinsert(d, key, value, after):
    """Re-insert `key` right after `after` preserving a readable order."""
    assert key not in d, f'{key} already present'
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == after:
            out[key] = value
    if key not in out:
        out[key] = value
    return out


# ------------------------------------------------ pages.contact.channels ----
for d, greeting in (
    (ar, 'مرحباً إيليرا! أرغب بالحديث عن مشروع.'),
    (en, "Hi Elyra! I'd like to talk about a project."),
):
    d['pages']['contact']['channels']['whatsapp']['greeting'] = greeting

# ---------------------------------------------------- pages.contact.form ----
FORM_AR = {
    'projectTypeLabel': 'نوع المشروع',
    'projectTypes': {
        'store': 'متجر ذكي',
        'booking': 'منصة حجوزات',
        'agent': 'وكيل AI',
        'dashboard': 'لوحة تحكم',
        'websites': 'مواقع',
        'automation': 'أتمتة',
    },
    'whatsapp': 'واتساب (اختياري)',
    'whatsappPlaceholder': '+963 9XX XXX XXX',
    'whatsappHint': 'اختياري — للتواصل الأسرع معك',
    'prefill': {
        'serviceIdea': 'أرغب ببناء {service}: {idea}',
        'ideaOnly': 'أرغب ببناء: {idea}',
        'serviceOnly': 'أرغب ببناء {service}.',
    },
}
FORM_EN = {
    'projectTypeLabel': 'Project type',
    'projectTypes': {
        'store': 'Smart Store',
        'booking': 'Booking Platform',
        'agent': 'AI Agent',
        'dashboard': 'Dashboard',
        'websites': 'Websites',
        'automation': 'Automation',
    },
    'whatsapp': 'WhatsApp (optional)',
    'whatsappPlaceholder': '+963 9XX XXX XXX',
    'whatsappHint': 'Optional — for faster replies',
    'prefill': {
        'serviceIdea': "I'd like to build: {service} — {idea}",
        'ideaOnly': "I'd like to build: {idea}",
        'serviceOnly': "I'd like to build: {service}.",
    },
}
for d, add in ((ar, FORM_AR), (en, FORM_EN)):
    form = d['pages']['contact']['form']
    for k, v in add.items():
        assert k not in form, f'form.{k} already present'
        form[k] = v

# -------------------------------------------- pages.contact.socialProof ----
ar['pages']['contact']['socialProof'] = {
    'metrics': {
        'lamsa': {
            'company': 'متجر لمسة',
            'value': '+140%',
            'label': 'معدل التحويل',
        },
        'aqar': {
            'company': 'منصة عقار بلس',
            'value': '+85%',
            'label': 'زيارات عضوية',
        },
    },
}
en['pages']['contact']['socialProof'] = {
    'metrics': {
        'lamsa': {
            'company': 'Lamsa Store',
            'value': '+140%',
            'label': 'conversion rate',
        },
        'aqar': {
            'company': 'Aqar Plus',
            'value': '+85%',
            'label': 'organic visits',
        },
    },
}

# ---------------------------------- bento.ai.mini (consumed by I-3, #8) ----
ar['bento']['ai']['mini']['inputPlaceholder'] = 'اكتب سؤالك هنا…'
ar['bento']['ai']['mini']['convertCta'] = 'حوّل هذا إلى طلب'
en['bento']['ai']['mini']['inputPlaceholder'] = 'Type your question here…'
en['bento']['ai']['mini']['convertCta'] = 'Turn this into a request'

# --------------------------- simulator completion (consumed by I-3, #9) ----
ar['simulator']['completionTitle'] = 'جاهز لتدفق يخدم عملك؟'
ar['simulator']['completionCta'] = 'اطلب نظامًا مشابهًا'
en['simulator']['completionTitle'] = 'Ready for a flow that serves your business?'
en['simulator']['completionCta'] = 'Order a similar system'

# ----------------- compact mobile language toggle (consumed by I-3, #11) ----
ar['nav']['languageToggleCompact'] = 'تبديل اللغة'
en['nav']['languageToggleCompact'] = 'Switch language'

# -------------------------- 404 recovery heading (consumed by I-3, #16) ----
ar['common'] = reinsert(
    ar['common'], 'notFoundRecoveryTitle', 'أين تريد المتابعة؟', 'notFoundDesc'
)
en['common'] = reinsert(
    en['common'], 'notFoundRecoveryTitle', 'Where would you like to go?', 'notFoundDesc'
)

for path, data in ((AR, ar), (EN, en)):
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {path}')
