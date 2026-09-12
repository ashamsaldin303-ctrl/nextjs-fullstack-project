/**
 * CITY-1 · Landmark registry data for the interactive city model.
 *
 * Extracted VERBATIM from the authored upload (upload/3D-model.html
 * `register(...)` calls) — names, categories, spec rows, occupancy values,
 * labels and descriptions are the exact authored strings. Each entry adds
 * an `en` block with faithful English translations (name / cat / desc /
 * spec labels + values) so the info panel renders bilingually; the
 * in-world signboards keep baking the Arabic text regardless of locale.
 *
 * The order of this array IS the registry order — the engine assigns
 * NODE codes (BC-100 … BC-117) by registration sequence, so entries must
 * not be reordered.
 */

export interface LandmarkSpec {
  /** Arabic display name (baked into the in-world signboard too). */
  name: string
  /** Arabic category line shown under the panel title. */
  cat: string
  /** Bounding footprint used by the selection box / dimension lines (m). */
  w: number
  d: number
  h: number
  /** Optional focus height for the camera target (m). */
  fy?: number
  /** Optional ring elevation for the dimension group (defaults to 0). */
  ringY?: number
  /** Optional selection-ring radius (defaults to max(w,d)/2 + 3.5). */
  ringR?: number
  /** Optional focus distance override for the camera (m). */
  fdist?: number
  /** Dynamic nodes (the train) — selection box + camera follow it. */
  dynamic?: boolean
  /** Occupancy percentage (0–100) for the striped bar. */
  occ?: number
  /** Occupancy label override (AR). */
  occLab?: string
  /** Arabic description paragraph. */
  desc: string
  /** Arabic spec rows — exact authored [label, value] pairs. */
  specs: [string, string][]
  /** English translation block. */
  en: {
    name: string
    cat: string
    desc: string
    occLab?: string
    specs: [string, string][]
  }
  /** Sector override (the train is registered at 0,0 but belongs to C). */
  sector?: string
}

export const CITY_LANDMARKS: LandmarkSpec[] = [
  // ---- 1 · برج المدينة (city tower) ----
  {
    name: 'برج المدينة',
    cat: 'ناطحة سحاب · معلم المدينة',
    w: 17,
    d: 17,
    h: 53,
    specs: [
      ['الطوابق', '15'],
      ['الارتفاع', '53 م'],
      ['المساحة المبنية', '2,400 م²'],
      ['سنة الإنشاء', '1987'],
      ['الاستخدام', 'مكتبي · تجاري · مراقبة'],
    ],
    occ: 86,
    desc: 'معلم المدينة الأشهر؛ قاعدة تجارية من طابقين بواجهات زجاجية ومظلات، تحمل ثلاث كتل زجاجية متدرجة تنتهي بهوائي اتصالات بمنارة حمراء.',
    en: {
      name: 'City Tower',
      cat: 'Skyscraper · City Landmark',
      desc: 'The city’s most famous landmark; a two-story retail base with glass facades and awnings carries three stepped glass volumes, ending in a communications antenna with a red beacon.',
      specs: [
        ['Floors', '15'],
        ['Height', '53 m'],
        ['Built Area', '2,400 m²'],
        ['Year Built', '1987'],
        ['Use', 'Office · Retail · Observation'],
      ],
    },
  },
  // ---- 2 · السوق التجاري (central market) ----
  {
    name: 'السوق التجاري',
    cat: 'تجاري · قطاع التجزئة',
    w: 17,
    d: 13,
    h: 8,
    specs: [
      ['الطوابق', '2'],
      ['الارتفاع', '8 م'],
      ['المساحة', '1,850 م²'],
      ['افتتاح', '1994'],
      ['المحلات', '34 متجراً'],
    ],
    occ: 92,
    desc: 'سوق مركزي بقاعة تجارية مسقفة بمناور علوية، وصف محلات خارجي بمظلات مخططة يضم مخبزاً ومقهى ومكتبة وزهوراً وحلويات.',
    en: {
      name: 'Central Market',
      cat: 'Commercial · Retail',
      desc: 'A central market with a skylit retail hall and an outdoor shop row under striped awnings — a bakery, café, bookstore, florist and sweets shop.',
      specs: [
        ['Floors', '2'],
        ['Height', '8 m'],
        ['Area', '1,850 m²'],
        ['Opened', '1994'],
        ['Stores', '34 shops'],
      ],
    },
  },
  // ---- 3 · متحف المدينة (city museum) ----
  {
    name: 'متحف المدينة',
    cat: 'ثقافي · متحف',
    w: 15,
    d: 11,
    h: 11,
    specs: [
      ['الطوابق', '2 + قبة'],
      ['الارتفاع', '11 م'],
      ['مساحة العرض', '1,100 م²'],
      ['افتتاح', '1978'],
      ['المقتنيات', '12,400 قطعة'],
    ],
    occ: 64,
    desc: 'بهو استقبال برواق أعمدة حجرية، وقاعة عرض رئيسية تعلوها قبة جيوديسية زجاجية تضيء المقتنيات بضوء النهار.',
    en: {
      name: 'City Museum',
      cat: 'Cultural · Museum',
      desc: 'A reception hall with a stone colonnade and a main gallery crowned by a glass geodesic dome that floods the exhibits with daylight.',
      specs: [
        ['Floors', '2 + dome'],
        ['Height', '11 m'],
        ['Exhibition Area', '1,100 m²'],
        ['Opened', '1978'],
        ['Collection', '12,400 pieces'],
      ],
    },
  },
  // ---- 4 · المجمع السكني الشرقي (eastern residential complex) ----
  {
    name: 'المجمع السكني الشرقي',
    cat: 'سكني · 3 أبراج',
    w: 20,
    d: 20,
    h: 26,
    specs: [
      ['الطوابق', '19 إجمالاً'],
      ['أقصى ارتفاع', '26 م'],
      ['الوحدات', '96 شقة'],
      ['الإنشاء', '2003'],
      ['المرافق', 'فناء · موقف'],
    ],
    occ: 78,
    desc: 'ثلاثة أبراج سكنية بأحجام متدرجة تحيط بفناء داخلي مشترك، مع مداخل زجاجية بارزة على الواجهة الجنوبية.',
    en: {
      name: 'Eastern Residential Complex',
      cat: 'Residential · 3 Towers',
      desc: 'Three residential towers of stepped sizes around a shared inner courtyard, with projecting glass entrances on the southern facade.',
      specs: [
        ['Floors', '19 total'],
        ['Tallest', '26 m'],
        ['Units', '96 apartments'],
        ['Built', '2003'],
        ['Amenities', 'Courtyard · Parking'],
      ],
    },
  },
  // ---- 5 · الحديقة المركزية (central park) ----
  {
    name: 'الحديقة المركزية',
    cat: 'مساحة عامة · ترفيه',
    w: 19,
    d: 19,
    h: 6,
    fy: 3,
    specs: [
      ['المساحة', '441 م²'],
      ['الأشجار', '8 أشجار'],
      ['أطول شجرة', '6 م'],
      ['افتتاح', '1971'],
      ['المرافق', 'نافورة · بحيرة · ممرات'],
    ],
    occ: 45,
    occLab: 'متوسط الازدحام',
    desc: 'قلب المدينة الأخضر؛ بحيرة بحافة حجرية ونافورة رذاذ وممرات مرصوفة متقاطعة تلتقي عند الساحة الدائرية المركزية.',
    en: {
      name: 'Central Park',
      cat: 'Public Space · Recreation',
      desc: 'The city’s green heart; a lake with a stone rim, a spray fountain, and paved crossing paths that meet at the central circular plaza.',
      occLab: 'Average crowding',
      specs: [
        ['Area', '441 m²'],
        ['Trees', '8 trees'],
        ['Tallest Tree', '6 m'],
        ['Opened', '1971'],
        ['Amenities', 'Fountain · Lake · Paths'],
      ],
    },
  },
  // ---- 6 · فندق المدينة (city hotel) ----
  {
    name: 'فندق المدينة',
    cat: 'ضيافة · 4 نجوم',
    w: 9,
    d: 13,
    h: 24,
    specs: [
      ['الطوابق', '7'],
      ['الارتفاع', '24 م'],
      ['الغرف', '112'],
      ['افتتاح', '1999'],
      ['المرافق', 'قاعة مؤتمرات'],
    ],
    occ: 71,
    occLab: 'إشغال الغرف',
    desc: 'فندق المدينة الأول؛ مدخل بظلة زجاجية وأعمدة، وسارية علم على السطح، وإطلالة كاملة على الساحة المركزية.',
    en: {
      name: 'City Hotel',
      cat: 'Hospitality · 4 Stars',
      desc: 'The city’s first hotel; an entrance with a glass canopy and columns, a rooftop flagpole, and a full view over the central square.',
      occLab: 'Room occupancy',
      specs: [
        ['Floors', '7'],
        ['Height', '24 m'],
        ['Rooms', '112'],
        ['Opened', '1999'],
        ['Amenities', 'Conference hall'],
      ],
    },
  },
  // ---- 7 · مبنى الأعمال (business building) ----
  {
    name: 'مبنى الأعمال',
    cat: 'مكتبي',
    w: 11,
    d: 11,
    h: 18,
    specs: [
      ['الطوابق', '6'],
      ['الارتفاع', '18 م'],
      ['المساحة', '860 م²'],
      ['الإنشاء', '2008'],
      ['المستأجرون', '11 شركة'],
    ],
    occ: 94,
    desc: 'مبنى مكاتب بواجهة زجاجية كاملة وشعار بارز على السطح يطل على شارع المتحف.',
    en: {
      name: 'Business Building',
      cat: 'Office',
      desc: 'An office building with a full glass facade and a rooftop logo, overlooking Museum Street.',
      specs: [
        ['Floors', '6'],
        ['Height', '18 m'],
        ['Area', '860 m²'],
        ['Built', '2008'],
        ['Tenants', '11 companies'],
      ],
    },
  },
  // ---- 8 · المستشفى العام (general hospital) ----
  {
    name: 'المستشفى العام',
    cat: 'صحي · مستشفى عام',
    w: 12,
    d: 12,
    h: 7.5,
    specs: [
      ['الطوابق', '3'],
      ['الارتفاع', '7.5 م'],
      ['الأسرّة', '180'],
      ['افتتاح', '1984'],
      ['المرافق', 'مسطحة إسعاف جوية'],
    ],
    occ: 63,
    occLab: 'إشغال الأسرّة',
    desc: 'جناحا علاج يربطهما جسر خدمي، مع مدخل طوارئ منفصل وسيارة إسعاف مخصصة ومسطحة إسعاف جوية تُعلَّم بحرف H فوق الجناح الشمالي.',
    en: {
      name: 'General Hospital',
      cat: 'Health · Public Hospital',
      desc: 'Two treatment wings joined by a service bridge, with a separate emergency entrance, a dedicated ambulance, and an H-marked air-ambulance helipad above the northern wing.',
      occLab: 'Bed occupancy',
      specs: [
        ['Floors', '3'],
        ['Height', '7.5 m'],
        ['Beds', '180'],
        ['Opened', '1984'],
        ['Amenities', 'Air-ambulance helipad'],
      ],
    },
  },
  // ---- 9 · سينما المدينة (city cinema) ----
  {
    name: 'سينما المدينة',
    cat: 'ترفيه · سينما',
    w: 14,
    d: 10,
    h: 10.5,
    specs: [
      ['الصالات', '4'],
      ['الارتفاع', '10.5 م'],
      ['المقاعد', '520'],
      ['افتتاح', '1996'],
      ['الشاشات', 'IMAX · رقمية'],
    ],
    occ: 58,
    desc: 'واجهة ببرج لوحة عمودي وشريط marquee بأضواء؛ أقدم صالة عرض في المدينة وأكثرها ازدحاماً في عطلات نهاية الأسبوع.',
    en: {
      name: 'City Cinema',
      cat: 'Entertainment · Cinema',
      desc: 'A facade with a vertical sign tower and a lit marquee strip; the city’s oldest theatre — and its busiest on weekends.',
      specs: [
        ['Halls', '4'],
        ['Height', '10.5 m'],
        ['Seats', '520'],
        ['Opened', '1996'],
        ['Screens', 'IMAX · Digital'],
      ],
    },
  },
  // ---- 10 · الحي السكني (residential neighborhood) ----
  {
    name: 'الحي السكني',
    cat: 'سكني · وحدات متصلة',
    w: 19,
    d: 13,
    h: 5.6,
    specs: [
      ['الوحدات', '10'],
      ['الطوابق', '2'],
      ['الارتفاع', '5.6 م'],
      ['الإنشاء', '2011'],
      ['المساحة', '480 م²'],
    ],
    occ: 96,
    desc: 'صف وحدات سكنية متصلة بواجهات متنوعة وحدائق أمامية صغيرة وسياج منخفض يحاذي الزقاق.',
    en: {
      name: 'Residential Neighborhood',
      cat: 'Residential · Row Houses',
      desc: 'A row of connected homes with varied facades, small front gardens, and a low fence along the alley.',
      specs: [
        ['Units', '10'],
        ['Floors', '2'],
        ['Height', '5.6 m'],
        ['Built', '2011'],
        ['Area', '480 m²'],
      ],
    },
  },
  // ---- 11 · مدرسة المدينة (city school) ----
  {
    name: 'مدرسة المدينة',
    cat: 'تعليمي',
    w: 13,
    d: 12,
    h: 7,
    specs: [
      ['الطوابق', '2'],
      ['الارتفاع', '7 م'],
      ['الطلاب', '640'],
      ['افتتاح', '1979'],
      ['المرافق', 'ملعب سلة · ساحة'],
    ],
    occ: 81,
    occLab: 'نسبة الحضور',
    desc: 'مبنى على شكل حرف L بساحة لعب غربية وملعب كرة سلة بحلقة برتقالية وسارية علم عند المدخل الشمالي.',
    en: {
      name: 'City School',
      cat: 'Education',
      desc: 'An L-shaped building with a western play yard, a basketball court with an orange hoop, and a flagpole at the northern entrance.',
      occLab: 'Attendance rate',
      specs: [
        ['Floors', '2'],
        ['Height', '7 m'],
        ['Students', '640'],
        ['Opened', '1979'],
        ['Amenities', 'Basketball court · Yard'],
      ],
    },
  },
  // ---- 12 · المركز الرياضي (sports center) ----
  {
    name: 'المركز الرياضي',
    cat: 'رياضي',
    w: 19,
    d: 19,
    h: 7.5,
    specs: [
      ['المنشآت', 'قاعة + ملعب'],
      ['مساحة الملعب', '2,100 م²'],
      ['أعمدة الإنارة', '4'],
      ['افتتاح', '2005'],
      ['الفعاليات', '36 سنوياً'],
    ],
    occ: 74,
    desc: 'قاعة رئيسية وملعب خارجي مضيء بخطوط أرضية قياسية ومرميين، محاط بأعمدة إنارة رباعية.',
    en: {
      name: 'Sports Center',
      cat: 'Sports',
      desc: 'A main hall and a lit outdoor field with standard court markings and two goals, ringed by four floodlight masts.',
      specs: [
        ['Facilities', 'Hall + Field'],
        ['Field Area', '2,100 m²'],
        ['Light Masts', '4'],
        ['Opened', '2005'],
        ['Events', '36 per year'],
      ],
    },
  },
  // ---- 13 · برج الأعمال الغربي (western business tower) ----
  {
    name: 'برج الأعمال الغربي',
    cat: 'مكتبي · واجهة زجاجية',
    w: 10.5,
    d: 10.5,
    h: 37,
    specs: [
      ['الطوابق', '10'],
      ['الارتفاع', '37 م'],
      ['المساحة', '1,540 م²'],
      ['الإنشاء', '2015'],
      ['المميز', 'مسطحة طائرات عمودية'],
    ],
    occ: 88,
    desc: 'أحدث أبراج المدينة؛ كتلة زجاجية بقمة تقنية ومسطحة طائرات عمودية تُعلَّم بحرف H فوق أعلى نقطة.',
    en: {
      name: 'Western Business Tower',
      cat: 'Office · Glass Facade',
      desc: 'The city’s newest tower; a glass volume with a technical crown and an H-marked helicopter pad at its highest point.',
      specs: [
        ['Floors', '10'],
        ['Height', '37 m'],
        ['Area', '1,540 m²'],
        ['Built', '2015'],
        ['Highlight', 'Helicopter pad'],
      ],
    },
  },
  // ---- 14 · مبنى البلدية (city hall) ----
  {
    name: 'مبنى البلدية',
    cat: 'حكومي · إدارة',
    w: 12,
    d: 12,
    h: 13,
    specs: [
      ['الطوابق', '3 + قبة'],
      ['الارتفاع', '13 م'],
      ['المساحة', '1,300 م²'],
      ['افتتاح', '1969'],
      ['الأقسام', '14 قسماً'],
    ],
    occ: 90,
    desc: 'أقدم مباني المدينة الإدارية؛ رواق أعمدة كلاسيكي على الواجهة الشرقية وقبة نحاسية مؤكسدة فوق قاعة المجلس وسارية علم على السطح.',
    en: {
      name: 'City Hall',
      cat: 'Government · Administration',
      desc: 'The city’s oldest administrative building; a classical colonnade on the eastern facade, an oxidized copper dome above the council chamber, and a rooftop flagpole.',
      specs: [
        ['Floors', '3 + dome'],
        ['Height', '13 m'],
        ['Area', '1,300 m²'],
        ['Opened', '1969'],
        ['Departments', '14 departments'],
      ],
    },
  },
  // ---- 15 · المكتبة العامة (public library) ----
  {
    name: 'المكتبة العامة',
    cat: 'ثقافي · مكتبة',
    w: 12,
    d: 9,
    h: 7,
    specs: [
      ['الطوابق', '2'],
      ['الارتفاع', '7 م'],
      ['المساحة', '880 م²'],
      ['افتتاح', '1983'],
      ['الكتب', '210,000'],
    ],
    occ: 55,
    desc: 'رواق أعمدة أمامي بثلاثة أعمدة وعتب بارز؛ تضم قاعة قراءة مركزية وأرشيفاً رقمياً في الطابق العلوي.',
    en: {
      name: 'Public Library',
      cat: 'Cultural · Library',
      desc: 'A front colonnade of three columns with a deep lintel; it houses a central reading hall and a digital archive on the upper floor.',
      specs: [
        ['Floors', '2'],
        ['Height', '7 m'],
        ['Area', '880 m²'],
        ['Opened', '1983'],
        ['Books', '210,000'],
      ],
    },
  },
  // ---- 16 · المنطقة الصناعية (industrial zone) ----
  {
    name: 'المنطقة الصناعية',
    cat: 'صناعي · لوجستي',
    w: 19,
    d: 19,
    h: 12,
    specs: [
      ['المنشآت', 'مستودعان + خزان'],
      ['الارتفاع', '12 م (المدخنة)'],
      ['المساحة', '2,600 م²'],
      ['افتتاح', '1992'],
      ['العمال', '120 عاملاً'],
    ],
    occ: 40,
    occLab: 'الطاقة التشغيلية',
    desc: 'مستودعات لوجستية ببوابات تحميل وخزان وقود أفقي ومدخنة طوب بارتفاع 12 متراً، وسياج محيطي ببوابة أمن.',
    en: {
      name: 'Industrial Zone',
      cat: 'Industrial · Logistics',
      desc: 'Logistics warehouses with loading bays, a horizontal fuel tank, a 12-meter brick chimney, and a perimeter fence with a security gate.',
      occLab: 'Operating capacity',
      specs: [
        ['Facilities', '2 warehouses + tank'],
        ['Height', '12 m (chimney)'],
        ['Area', '2,600 m²'],
        ['Opened', '1992'],
        ['Workers', '120 workers'],
      ],
    },
  },
  // ---- 17 · محطة المدينة المعلقة (elevated city station) ----
  {
    name: 'محطة المدينة المعلقة',
    cat: 'نقل عام · محطة معلقة',
    w: 4.2,
    d: 7,
    h: 3.5,
    ringY: 8.5,
    fy: 10,
    specs: [
      ['المنصة', 'على ارتفاع 9 م'],
      ['المصعد', 'زجاجي مزدوج الخدمة'],
      ['التدفق', '4,200 راكب/يوم'],
      ['افتتاح', '2009'],
      ['الخط', 'المركزي المعلق'],
    ],
    occ: 70,
    occLab: 'تدفق الذروة',
    desc: 'محطة معلقة على الخط المركزي؛ منصة زجاجية السقف فوق شارع المدينة، يخدمها مصعد زجاجي متحرك وجسر معلق.',
    en: {
      name: 'Elevated City Station',
      cat: 'Public Transit · Elevated Station',
      desc: 'An elevated station on the central line; a glass-roofed platform above City Street, served by a moving glass elevator and a suspended bridge.',
      occLab: 'Peak flow',
      specs: [
        ['Platform', '9 m above ground'],
        ['Elevator', 'Double-service glass'],
        ['Flow', '4,200 passengers/day'],
        ['Opened', '2009'],
        ['Line', 'Central Elevated'],
      ],
    },
  },
  // ---- 18 · قطار المدينة المعلق (elevated city train — dynamic node) ----
  {
    name: 'قطار المدينة المعلق',
    cat: 'نقل عام · الخط المركزي',
    w: 2.4,
    d: 20,
    h: 1.9,
    ringY: 8.75,
    ringR: 9,
    fy: 10,
    fdist: 34,
    dynamic: true,
    sector: 'C',
    specs: [
      ['العربات', '3'],
      ['الطول', '20 م'],
      ['السرعة', '26 كم/س'],
      ['السعة', '180 راكباً'],
      ['التشغيل', 'منذ 2009'],
    ],
    occ: 70,
    occLab: 'إشغال الذروة',
    desc: 'قطار معلق بثلاث عربات بيضاء بشريط أزرق يخدم الخط المركزي ذهاباً وإياباً فوق شارع المدينة — انقره وستتبعه الكاميرا.',
    en: {
      name: 'Elevated City Train',
      cat: 'Public Transit · Central Line',
      desc: 'A three-car white elevated train with a blue stripe shuttling back and forth on the central line above City Street — click it and the camera follows.',
      occLab: 'Peak occupancy',
      specs: [
        ['Cars', '3'],
        ['Length', '20 m'],
        ['Speed', '26 km/h'],
        ['Capacity', '180 passengers'],
        ['In Service', 'Since 2009'],
      ],
    },
  },
]
