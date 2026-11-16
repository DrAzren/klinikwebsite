/**
 * Initial CMS content.
 *
 * Source notes (see docs/CONTENT-VERIFICATION.md):
 *  - Address, phone and email: Klinik Nissa's PDPA registration record (2024).
 *    Re-confirm before launch.
 *  - Service list: provided by the clinic owner in the project brief.
 *  - Doctor qualifications: intentionally EMPTY until verified against MMC/NSR.
 *  - Panels: candidate list only — all "pending_verification" so none show publicly.
 *  - Articles: general health education drafted for clinical review.
 * Everything here is editable in Staff Portal → Content.
 */
import type { CollectionName, SeedItem } from "./types";

const L = (ms: string, en: string) => ({ ms, en });

export const SEED: { [C in CollectionName]: SeedItem<C>[] } = {
  settings: [
    {
      slug: "site",
      status: "published",
      sort: 0,
      data: {
        slug: "site",
        clinicName: "Klinik Nissa",
        altName: "Klinik Dr Azren",
        phone: "+60126081411",
        email: "kliniknissa@gmail.com",
        addressLines: [
          "9697, Ground Floor",
          "Jalan BBN 1/3C, Pusat Bandar Putra Point",
          "71800 Bandar Baru Nilai",
          "Negeri Sembilan, Malaysia",
        ],
        mapQuery: "Klinik Nissa, Jalan BBN 1/3C, Pusat Bandar Putra Point, 71800 Nilai, Negeri Sembilan",
        hours: [],
        social: {},
        logoUrl: "",
        gallery: [],
      },
    },
  ],

  doctors: [
    {
      slug: "dr-azren",
      status: "published",
      sort: 1,
      data: {
        slug: "dr-azren",
        name: "Dr Fakrul Azren bin Azhar",
        shortName: "Dr Azren",
        title: L("Pengasas Klinik Nissa", "Founder, Klinik Nissa"),
        photo: "/images/dr-azren.jpg",
        photoAlt: L("Dr Azren di klinik", "Dr Azren at the clinic"),
        qualifications: "",
        credentialsVerified: false,
        interests: [
          L("Kesihatan mental", "Mental health"),
          L("Kemurungan & keresahan", "Depression & anxiety"),
          L("Pendidikan kesihatan mental", "Mental health education"),
        ],
        bio: L(
          "Dr Azren mengasaskan Klinik Nissa dengan satu keyakinan: kesihatan fizikal dan mental patut dijaga bersama, di tempat yang tenang dan tanpa stigma. Beliau ialah penulis buku “Dr, Saya Boleh Sembuh Ke?” dan berkongsi pendidikan kesihatan mental melalui Spread Positivity.",
          "Dr Azren founded Klinik Nissa on a simple belief: physical and mental health deserve to be cared for together, in a calm place without stigma. Dr Azren is the author of “Dr, Saya Boleh Sembuh Ke?” and shares mental health education through Spread Positivity.",
        ),
        whatsappTopic: "mental",
      },
    },
    {
      slug: "dr-aminah",
      status: "published",
      sort: 2,
      data: {
        slug: "dr-aminah",
        name: "Dr Aminah",
        shortName: "Dr Aminah",
        title: L("Doktor Residen", "Resident Doctor"),
        photo: "",
        qualifications: "",
        credentialsVerified: false,
        interests: [],
        bio: L(
          "Dr Aminah ialah doktor residen di Klinik Nissa, menyediakan penjagaan rawatan am harian untuk pesakit dan keluarga.",
          "Dr Aminah is the resident doctor at Klinik Nissa, providing day-to-day general practice care for patients and families.",
        ),
        whatsappTopic: "gp",
      },
    },
  ],

  services: [
    // ── General practice ──
    svc("general-consultation", "gp", 1, "stethoscope", true,
      L("Konsultasi perubatan am", "General medical consultation"),
      L("Untuk demam, batuk, sakit badan dan penyakit harian.", "For fever, cough, aches and everyday illness."),
      L("Doktor akan mendengar simptom anda, membuat pemeriksaan fizikal dan menerangkan pilihan rawatan dengan jelas. Sijil cuti sakit dikeluarkan jika sesuai dari segi klinikal.",
        "Your doctor will listen to your symptoms, examine you and explain treatment options clearly. Medical certificates are issued where clinically appropriate."),
      [L("Mengalami demam, selesema, sakit tekak atau cirit-birit", "Have a fever, flu, sore throat or diarrhoea"),
       L("Ada kecederaan ringan atau masalah kulit", "Have a minor injury or skin problem"),
       L("Tidak pasti sama ada simptom anda serius", "Are unsure whether your symptoms are serious")],
      [L("Pendaftaran di kaunter dengan MyKad atau kad panel", "Registration at the counter with MyKad or panel card"),
       L("Pemeriksaan tanda vital oleh pembantu klinik", "Vital signs checked by our clinic assistant"),
       L("Konsultasi dan pelan rawatan bersama doktor", "Consultation and treatment plan with the doctor")],
      [faq(L("Perlu temujanji?", "Do I need an appointment?"),
           L("Pesakit tanpa temujanji dialu-alukan. Hubungi kami melalui WhatsApp untuk semak waktu menunggu.", "Walk-ins are welcome. WhatsApp us to check current waiting times."))],
      "gp"),
    svc("chronic-illness", "gp", 2, "heart-pulse", false,
      L("Susulan penyakit kronik", "Chronic illness follow-up"),
      L("Pemantauan berterusan untuk darah tinggi, kencing manis dan kolesterol.", "Ongoing care for blood pressure, diabetes and cholesterol."),
      L("Susulan berkala membantu mengawal penyakit kronik dan mengurangkan risiko komplikasi. Doktor akan menyemak bacaan, keputusan ujian dan ubat-ubatan anda.",
        "Regular follow-up helps keep chronic conditions under control and reduces the risk of complications. Your doctor will review your readings, test results and medicines."),
      [L("Ada darah tinggi, kencing manis atau kolesterol tinggi", "Live with high blood pressure, diabetes or high cholesterol"),
       L("Memerlukan susulan ubat berkala", "Need regular medication reviews"),
       L("Mahu memahami keputusan ujian darah", "Want to understand your blood results")],
      [L("Semakan sejarah dan ubat semasa", "Review of history and current medicines"),
       L("Pemeriksaan dan ujian berkaitan jika perlu", "Examination and relevant tests if needed"),
       L("Pelan susulan dan sasaran yang jelas", "Clear follow-up plan and targets")],
      [faq(L("Perlu bawa apa?", "What should I bring?"),
           L("Bawa senarai atau bekas ubat semasa dan keputusan ujian terdahulu jika ada.", "Bring your current medicines (or a list) and any previous test results."))],
      "gp"),
    svc("health-screening", "gp", 3, "clipboard-check", false,
      L("Saringan kesihatan", "Health screening"),
      L("Pemeriksaan berkala untuk mengesan risiko lebih awal.", "Regular check-ups to catch risks early."),
      L("Saringan kesihatan menilai tanda vital, berat badan dan ujian yang sesuai dengan umur serta faktor risiko anda. Doktor akan menerangkan keputusan dan langkah seterusnya.",
        "Health screening reviews your vital signs, weight and tests suited to your age and risk factors. Your doctor will explain your results and next steps."),
      [L("Belum membuat pemeriksaan kesihatan dalam setahun", "Haven't had a check-up in the past year"),
       L("Ada sejarah keluarga penyakit jantung atau kencing manis", "Have a family history of heart disease or diabetes"),
       L("Memerlukan pemeriksaan untuk majikan", "Need a check-up for your employer")],
      [L("Perbincangan tentang sejarah kesihatan anda", "Discussion of your health history"),
       L("Pemeriksaan fizikal dan ujian yang dipersetujui", "Physical examination and agreed tests"),
       L("Sesi penerangan keputusan", "A results explanation session")],
      [faq(L("Perlu berpuasa?", "Do I need to fast?"),
           L("Bergantung pada ujian. Hubungi kami terlebih dahulu dan kami akan maklumkan.", "It depends on the tests. Contact us beforehand and we'll advise you."))],
      "screening"),
    svc("blood-tests", "gp", 4, "droplet", false,
      L("Ujian darah", "Blood tests"),
      L("Pengambilan sampel darah dan penerangan keputusan.", "Blood sampling with clear results explanation."),
      L("Ujian darah dibuat atas cadangan doktor. Sampel mungkin dihantar ke makmal luar dan keputusan akan diterangkan kepada anda.",
        "Blood tests are arranged on your doctor's advice. Samples may be processed by an external laboratory, and your results will be explained to you."),
      [L("Memerlukan ujian kolesterol, gula atau fungsi organ", "Need cholesterol, sugar or organ-function tests"),
       L("Dalam susulan penyakit kronik", "Are on chronic illness follow-up"),
       L("Diminta oleh doktor untuk ujian lanjut", "Have been asked by a doctor to do further tests")],
      [L("Konsultasi ringkas untuk menentukan ujian", "A brief consultation to decide on tests"),
       L("Pengambilan sampel oleh kakitangan terlatih", "Sampling by trained staff"),
       L("Keputusan diterangkan oleh doktor", "Results explained by the doctor")],
      [faq(L("Berapa lama keputusan siap?", "How long do results take?"),
           L("Bergantung pada jenis ujian. Kami akan memaklumkan anggaran masa semasa lawatan.", "It depends on the test. We'll give you an estimate during your visit."))],
      "gp"),
    svc("vaccination", "gp", 5, "syringe", false,
      L("Vaksinasi", "Vaccination"),
      L("Perlindungan untuk anda dan keluarga.", "Protection for you and your family."),
      L("Doktor akan menilai kesesuaian vaksin berdasarkan umur, kesihatan dan keperluan anda. Sila hubungi kami untuk semak vaksin yang tersedia.",
        "Your doctor will assess which vaccines are suitable for your age, health and needs. Please contact us to check current availability."),
      [L("Merancang perjalanan atau umrah/haji", "Are planning travel, umrah or hajj"),
       L("Memerlukan vaksin untuk pekerjaan", "Need vaccines for work"),
       L("Mahu melengkapkan jadual vaksin dewasa", "Want to catch up on adult vaccinations")],
      [L("Saringan kesesuaian sebelum vaksin", "Suitability check before vaccination"),
       L("Pemberian vaksin dan rekod", "Vaccination and record"),
       L("Pemantauan ringkas selepas suntikan", "Brief observation afterwards")],
      [faq(L("Vaksin apa yang ada?", "Which vaccines are available?"),
           L("Stok berubah dari semasa ke semasa — WhatsApp kami untuk semakan terkini.", "Stock changes from time to time — WhatsApp us for current availability."))],
      "gp"),
    svc("family-healthcare", "gp", 6, "users", false,
      L("Penjagaan kesihatan keluarga", "Family healthcare"),
      L("Satu klinik untuk seisi keluarga.", "One clinic for the whole family."),
      L("Daripada kanak-kanak hingga warga emas, kami menyediakan penjagaan am yang berterusan dan mengenali keluarga anda dari semasa ke semasa.",
        "From children to older adults, we provide continuous general care and get to know your family over time."),
      [L("Mencari klinik keluarga berhampiran Nilai", "Are looking for a family clinic near Nilai"),
       L("Menjaga ibu bapa yang lebih berusia", "Care for older parents"),
       L("Mahu rekod kesihatan keluarga di satu tempat", "Want your family's records in one place")],
      [L("Konsultasi mengikut keperluan setiap ahli", "Consultations for each family member's needs"),
       L("Nasihat pencegahan dan gaya hidup", "Preventive and lifestyle advice"),
       L("Rujukan kepada pakar jika perlu", "Referral to specialists when needed")],
      [],
      "gp"),

    // ── Mental health ──
    svc("mental-health-consultation", "mental", 1, "brain", true,
      L("Konsultasi kesihatan mental", "Mental health consultation"),
      L("Ruang yang selamat untuk bercakap tentang apa yang anda rasa.", "A safe space to talk about how you've been feeling."),
      L("Konsultasi secara sulit bersama doktor untuk memahami simptom anda, menilai keadaan dan berbincang tentang pilihan sokongan serta rawatan yang sesuai.",
        "A confidential consultation with a doctor to understand your symptoms, assess your situation and discuss suitable support and treatment options."),
      [L("Rasa sedih, kosong atau hilang minat untuk tempoh yang lama", "Have felt low, empty or lost interest for a long time"),
       L("Sukar mengawal rasa bimbang", "Find it hard to control worry"),
       L("Tidak pasti dari mana hendak bermula", "Aren't sure where to start")],
      [L("Perbualan tanpa tergesa-gesa dan tanpa menghakimi", "An unhurried, non-judgemental conversation"),
       L("Penilaian menggunakan alat saringan yang diiktiraf jika sesuai", "Assessment using recognised screening tools where appropriate"),
       L("Pelan susulan dan rujukan jika diperlukan", "A follow-up plan and referral if needed")],
      [faq(L("Adakah maklumat saya sulit?", "Is my information confidential?"),
           L("Ya. Maklumat anda dilindungi di bawah kerahsiaan perubatan dan Akta Perlindungan Data Peribadi 2010.", "Yes. Your information is protected by medical confidentiality and the Personal Data Protection Act 2010.")),
       faq(L("Perlukah saya ambil saringan dahulu?", "Should I take the screening first?"),
           L("Tidak wajib, tetapi saringan PHQ-9/GAD-7 percuma boleh membantu anda menerangkan apa yang anda alami.", "It's not required, but the free PHQ-9/GAD-7 screening can help you describe what you've been experiencing."))],
      "mental"),
    svc("depression-anxiety", "mental", 2, "cloud-sun", false,
      L("Penilaian kemurungan & keresahan", "Depression and anxiety assessment"),
      L("Memahami mood dan kebimbangan anda dengan lebih jelas.", "Understand your mood and worries more clearly."),
      L("Doktor akan menilai simptom kemurungan dan keresahan, kesannya terhadap kehidupan harian, serta faktor fizikal yang mungkin berkaitan.",
        "Your doctor will assess symptoms of depression and anxiety, how they affect daily life, and any physical factors that may be involved."),
      [L("Mendapat skor sederhana atau lebih dalam saringan", "Scored moderate or above on a screening"),
       L("Kerja, belajar atau hubungan terjejas", "Find work, study or relationships affected"),
       L("Ahli keluarga risau tentang perubahan diri anda", "Have family who are worried about changes in you")],
      [L("Penilaian sejarah dan simptom", "History and symptom assessment"),
       L("Pemeriksaan fizikal atau ujian jika perlu", "Physical examination or tests if needed"),
       L("Perbincangan pilihan sokongan", "Discussion of support options")],
      [],
      "mental"),
    svc("panic-symptoms", "mental", 3, "wind", false,
      L("Simptom panik", "Panic symptoms"),
      L("Jantung berdebar, sesak nafas, rasa takut tiba-tiba.", "Racing heart, breathlessness, sudden fear."),
      L("Serangan panik boleh terasa sangat menakutkan. Doktor akan memastikan tiada punca fizikal yang serius dan membantu anda memahami serta mengurus simptom ini.",
        "Panic attacks can feel frightening. Your doctor will check for serious physical causes and help you understand and manage these symptoms."),
      [L("Mengalami episod takut yang datang tiba-tiba", "Experience sudden episodes of intense fear"),
       L("Mengelak tempat tertentu kerana bimbang serangan", "Avoid places for fear of an attack"),
       L("Pernah ke kecemasan tetapi keputusan normal", "Have visited the emergency department with normal results")],
      [L("Penilaian simptom dan pencetus", "Assessment of symptoms and triggers"),
       L("Pemeriksaan untuk menolak punca fizikal", "Checks to rule out physical causes"),
       L("Strategi pengurusan dan pelan susulan", "Management strategies and follow-up plan")],
      [faq(L("Bagaimana jika sakit dada?", "What if I have chest pain?"),
           L("Sakit dada yang teruk atau berterusan perlu dinilai segera — hubungi 999 atau pergi ke kecemasan.", "Severe or persistent chest pain needs urgent assessment — call 999 or go to the emergency department."))],
      "mental"),
    svc("mood-disorders", "mental", 4, "waves", false,
      L("Gangguan mood", "Mood disorders"),
      L("Perubahan mood yang ketara dan berulang.", "Marked, recurring changes in mood."),
      L("Penilaian dan susulan untuk perubahan mood yang ketara, termasuk perbincangan tentang rawatan yang sesuai dan rujukan kepada pakar apabila perlu.",
        "Assessment and follow-up for marked mood changes, including discussion of suitable treatment and referral to specialist services when needed."),
      [L("Mengalami tempoh mood sangat rendah atau sangat tinggi", "Have periods of very low or very high mood"),
       L("Perubahan tidur, tenaga atau tingkah laku yang ketara", "Notice major changes in sleep, energy or behaviour"),
       L("Memerlukan susulan berterusan", "Need ongoing follow-up")],
      [L("Penilaian menyeluruh", "Comprehensive assessment"),
       L("Pelan rawatan dan pemantauan", "Treatment and monitoring plan"),
       L("Koordinasi rujukan jika perlu", "Referral coordination when needed")],
      [],
      "mental"),
    svc("sleep-difficulties", "mental", 5, "moon", false,
      L("Masalah tidur", "Sleep difficulties"),
      L("Sukar tidur, kerap terjaga atau tidak segar bangun.", "Trouble sleeping, waking often or waking unrefreshed."),
      L("Masalah tidur sering berkait dengan tekanan, mood atau keadaan fizikal. Doktor akan mencari punca dan mencadangkan langkah yang selamat.",
        "Sleep problems are often linked to stress, mood or physical conditions. Your doctor will look for causes and suggest safe next steps."),
      [L("Sukar tidur hampir setiap malam", "Struggle to sleep most nights"),
       L("Rasa letih walaupun cukup masa tidur", "Feel tired despite enough time in bed"),
       L("Berdengkur kuat atau tercungap ketika tidur", "Snore loudly or gasp during sleep")],
      [L("Perbincangan tabiat dan corak tidur", "Discussion of sleep habits and patterns"),
       L("Saringan punca fizikal dan emosi", "Screening for physical and emotional causes"),
       L("Pelan kebersihan tidur dan susulan", "Sleep hygiene plan and follow-up")],
      [],
      "mental"),

    // ── Weight management ──
    svc("weight-assessment", "weight", 1, "scale", true,
      L("Penilaian berat badan oleh doktor", "Doctor-led weight assessment"),
      L("Bermula dengan memahami, bukan menghakimi.", "Start with understanding, not judgement."),
      L("Penilaian peribadi tentang sejarah berat badan, gaya hidup, tidur, emosi dan keadaan perubatan yang mungkin mempengaruhi berat badan anda.",
        "A personal assessment of your weight history, lifestyle, sleep, emotions and medical conditions that may affect your weight."),
      [L("Sudah mencuba pelbagai cara tanpa hasil berkekalan", "Have tried many approaches without lasting results"),
       L("Risau tentang risiko kesihatan berkaitan berat badan", "Are concerned about weight-related health risks"),
       L("Mahu pelan yang realistik dan selamat", "Want a realistic, safe plan")],
      [L("Pengukuran berat, BMI dan lilitan pinggang", "Weight, BMI and waist measurements"),
       L("Perbincangan matlamat yang realistik", "Discussion of realistic goals"),
       L("Pelan susulan berkala", "Regular follow-up plan")],
      [faq(L("Adakah ini program diet?", "Is this a diet programme?"),
           L("Tidak. Ia penilaian perubatan yang mengambil kira kesihatan anda secara menyeluruh.", "No. It's a medical assessment that looks at your health as a whole."))],
      "weight"),
    svc("bmi-metabolic", "weight", 2, "activity", false,
      L("Penilaian BMI & risiko metabolik", "BMI and metabolic risk evaluation"),
      L("Lebih daripada sekadar nombor di penimbang.", "More than a number on the scale."),
      L("Doktor menilai BMI, lilitan pinggang, tekanan darah dan ujian darah yang berkaitan untuk memahami risiko kencing manis, kolesterol dan penyakit jantung.",
        "Your doctor reviews BMI, waist size, blood pressure and relevant blood tests to understand your risk of diabetes, cholesterol problems and heart disease."),
      [L("Mempunyai BMI tinggi atau lilitan pinggang besar", "Have a high BMI or large waist measurement"),
       L("Ada sejarah keluarga kencing manis", "Have a family history of diabetes"),
       L("Belum pernah membuat ujian darah", "Have never had blood tests")],
      [L("Pengukuran dan ujian yang sesuai", "Measurements and appropriate tests"),
       L("Penerangan tahap risiko anda", "Explanation of your risk level"),
       L("Cadangan langkah seterusnya", "Recommended next steps")],
      [],
      "weight"),
    svc("lifestyle-nutrition", "weight", 3, "leaf", false,
      L("Panduan gaya hidup & pemakanan", "Lifestyle and nutrition guidance"),
      L("Perubahan kecil yang boleh dikekalkan.", "Small changes you can keep."),
      L("Nasihat praktikal tentang pemakanan, aktiviti fizikal, tidur dan pengurusan tekanan yang disesuaikan dengan rutin harian anda.",
        "Practical advice on eating, activity, sleep and stress management tailored to your daily routine."),
      [L("Mahu mula dengan langkah yang mudah", "Want to start with simple steps"),
       L("Bekerja syif atau mempunyai jadual sibuk", "Work shifts or have a busy schedule"),
       L("Makan kerana tekanan atau emosi", "Eat in response to stress or emotions")],
      [L("Semakan rutin harian", "Review of your daily routine"),
       L("Matlamat kecil yang boleh diukur", "Small, measurable goals"),
       L("Susulan untuk menilai kemajuan", "Follow-up to review progress")],
      [],
      "weight"),
    svc("treatment-suitability", "weight", 4, "clipboard-list", false,
      L("Penilaian kesesuaian rawatan perubatan", "Suitability assessment for medical treatment"),
      L("Perbincangan jujur tentang pilihan, risiko dan alternatif.", "An honest discussion of options, risks and alternatives."),
      L("Bagi sesetengah pesakit, doktor mungkin membincangkan sama ada rawatan perubatan sesuai. Keputusan dibuat selepas penilaian penuh, dengan penerangan tentang manfaat, risiko dan alternatif.",
        "For some patients, the doctor may discuss whether medical treatment is suitable. Any decision follows a full assessment, with clear explanation of benefits, risks and alternatives."),
      [L("Telah menjalani penilaian berat badan", "Have completed a weight assessment"),
       L("Mempunyai risiko kesihatan berkaitan berat badan", "Have weight-related health risks"),
       L("Mahu memahami semua pilihan yang ada", "Want to understand all available options")],
      [L("Semakan sejarah perubatan dan ubat semasa", "Review of medical history and current medicines"),
       L("Perbincangan risiko dan kesesuaian", "Discussion of risks and suitability"),
       L("Pemantauan rapi jika rawatan dimulakan", "Close monitoring if treatment begins")],
      [faq(L("Adakah semua orang layak?", "Is everyone eligible?"),
           L("Tidak. Kesesuaian bergantung pada penilaian klinikal individu.", "No. Suitability depends on an individual clinical assessment."))],
      "weight"),

    // ── Other ──
    svc("fomema", "other", 1, "badge-check", false,
      L("Pemeriksaan perubatan FOMEMA", "FOMEMA medical examination"),
      L("Pemeriksaan kesihatan pekerja asing.", "Health examination for foreign workers."),
      L("Pemeriksaan perubatan untuk pekerja asing mengikut keperluan FOMEMA. Sila bawa dokumen yang diperlukan.",
        "Medical examination for foreign workers according to FOMEMA requirements. Please bring the required documents."),
      [L("Majikan pekerja asing", "Employers of foreign workers"),
       L("Pekerja asing yang perlu pemeriksaan tahunan", "Foreign workers due for their examination"),
       L("Agensi pekerjaan", "Employment agencies")],
      [L("Semakan dokumen dan pendaftaran", "Document check and registration"),
       L("Pemeriksaan fizikal dan sampel", "Physical examination and samples"),
       L("Keputusan dihantar melalui sistem FOMEMA", "Results submitted through the FOMEMA system")],
      [faq(L("Dokumen apa diperlukan?", "What documents are needed?"),
           L("Pasport dan slip pendaftaran FOMEMA. Hubungi kami untuk senarai penuh.", "Passport and FOMEMA registration slip. Contact us for the full list."))],
      "screening"),
    svc("hajj-screening", "other", 2, "kaaba", false,
      L("Pemeriksaan kesihatan haji", "Hajj health screening"),
      L("Bersedia dari segi kesihatan untuk ibadah haji.", "Prepare your health for the hajj journey."),
      L("Pemeriksaan kesihatan untuk bakal haji, termasuk penilaian penyakit kronik dan nasihat persediaan kesihatan sebelum berangkat.",
        "Health screening for prospective pilgrims, including review of chronic conditions and advice on preparing your health before departure."),
      [L("Bakal haji yang perlu pemeriksaan", "Prospective pilgrims who need screening"),
       L("Warga emas yang menunaikan haji", "Older adults performing hajj"),
       L("Mereka yang mempunyai penyakit kronik", "Those with chronic conditions")],
      [L("Pemeriksaan fizikal dan ujian berkaitan", "Physical examination and relevant tests"),
       L("Semakan ubat dan penyakit kronik", "Medicine and chronic condition review"),
       L("Nasihat persediaan kesihatan", "Health preparation advice")],
      [],
      "screening"),
  ],

  panels: [
    "AIA", "PMCare", "Etiqa", "Great Eastern", "HealthMetrics", "MedKad", "eMas", "Red Alert", "Perodua", "MAINS", "OneWorks",
  ].map((name, i) => ({
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    status: "published" as const,
    sort: i,
    data: {
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      verification: "pending_verification" as const,
      logoUrl: "",
    },
  })),

  articles: [
    {
      slug: "bila-perlu-jumpa-doktor-kesihatan-mental",
      status: "published",
      sort: 1,
      data: {
        slug: "bila-perlu-jumpa-doktor-kesihatan-mental",
        category: L("Kesihatan mental", "Mental health"),
        readMinutes: 4,
        publishedAt: "2026-11-01",
        title: L("Bila perlu berjumpa doktor tentang kesihatan mental?", "When should you see a doctor about your mental health?"),
        excerpt: L(
          "Anda tidak perlu menunggu sehingga keadaan “cukup teruk”. Ini beberapa tanda bahawa sudah tiba masanya untuk mendapatkan bantuan.",
          "You don't have to wait until things feel “bad enough”. Here are some signs it may be time to reach out.",
        ),
        body: L(
          `Ramai orang menangguhkan bantuan kerana merasakan masalah mereka “tidak cukup serius”. Hakikatnya, sokongan paling berkesan apabila dimulakan awal.

## Tanda-tanda yang wajar diberi perhatian

- Rasa sedih, kosong atau hilang minat hampir setiap hari selama dua minggu atau lebih
- Kebimbangan yang sukar dikawal dan mengganggu tidur atau kerja
- Perubahan ketara pada selera makan, tidur atau tenaga
- Menarik diri daripada keluarga dan rakan
- Sukar memberi tumpuan atau membuat keputusan

## Apa yang berlaku semasa konsultasi?

Doktor akan mendengar, bertanya tentang simptom anda dan menilai sama ada terdapat faktor fizikal yang berkaitan. Anda boleh berkongsi sebanyak mana yang anda selesa. Semua maklumat adalah **sulit**.

## Bila perlu bantuan segera

Jika anda terfikir untuk mencederakan diri atau menamatkan nyawa, jangan tunggu. Hubungi **999** atau pergi ke Jabatan Kecemasan hospital terdekat. Talian **HEAL 15555** juga menyediakan sokongan kesihatan mental.

> Meminta bantuan bukan tanda lemah — ia langkah pertama untuk pulih.`,
          `Many people put off getting help because they feel their problems are “not serious enough”. In reality, support works best when it starts early.

## Signs worth paying attention to

- Feeling low, empty or losing interest nearly every day for two weeks or more
- Worry that is hard to control and affects sleep or work
- Noticeable changes in appetite, sleep or energy
- Withdrawing from family and friends
- Difficulty concentrating or making decisions

## What happens in a consultation?

Your doctor will listen, ask about your symptoms and check whether physical factors may be involved. You can share as much as you are comfortable with. Everything is **confidential**.

## When to get urgent help

If you are thinking about hurting yourself or ending your life, don't wait. Call **999** or go to the nearest hospital Emergency Department. The **HEAL 15555** line also offers mental health support.

> Asking for help is not a sign of weakness — it is the first step towards recovery.`,
        ),
      },
    },
    {
      slug: "memahami-saringan-phq9-gad7",
      status: "published",
      sort: 2,
      data: {
        slug: "memahami-saringan-phq9-gad7",
        category: L("Saringan", "Screening"),
        readMinutes: 3,
        publishedAt: "2026-11-05",
        title: L("Memahami saringan PHQ-9 dan GAD-7", "Understanding the PHQ-9 and GAD-7 screening"),
        excerpt: L(
          "Apa yang diukur oleh soal selidik ini, cara membaca skor, dan kenapa ia bukan diagnosis.",
          "What these questionnaires measure, how to read the score, and why it isn't a diagnosis.",
        ),
        body: L(
          `PHQ-9 dan GAD-7 ialah soal selidik ringkas yang digunakan secara meluas di klinik di seluruh dunia untuk **menyaring** simptom kemurungan dan keresahan.

## PHQ-9

Sembilan soalan tentang mood, minat, tidur, tenaga, selera makan, keyakinan diri, tumpuan dan pergerakan sepanjang dua minggu lalu. Skor antara 0 hingga 27.

## GAD-7

Tujuh soalan tentang kebimbangan dan keresahan. Skor antara 0 hingga 21.

## Membaca skor

Skor yang lebih tinggi menunjukkan simptom yang lebih ketara. Skor 10 ke atas bagi mana-mana soal selidik biasanya bermakna penilaian lanjut oleh doktor adalah wajar.

## Kenapa ia bukan diagnosis

Saringan hanya melihat simptom pada satu masa. Diagnosis memerlukan penilaian penuh oleh doktor yang mengambil kira sejarah, keadaan fizikal dan konteks hidup anda.`,
          `The PHQ-9 and GAD-7 are short questionnaires widely used in clinics worldwide to **screen** for symptoms of depression and anxiety.

## PHQ-9

Nine questions about mood, interest, sleep, energy, appetite, self-worth, concentration and movement over the past two weeks. Scores range from 0 to 27.

## GAD-7

Seven questions about worry and anxiety. Scores range from 0 to 21.

## Reading the score

Higher scores suggest more noticeable symptoms. A score of 10 or more on either questionnaire usually means further assessment by a doctor is worthwhile.

## Why it isn't a diagnosis

Screening only looks at symptoms at one point in time. A diagnosis needs a full assessment by a doctor that considers your history, physical health and life context.`,
        ),
      },
    },
    {
      slug: "bmi-dan-risiko-metabolik",
      status: "published",
      sort: 3,
      data: {
        slug: "bmi-dan-risiko-metabolik",
        category: L("Berat badan", "Weight"),
        readMinutes: 3,
        publishedAt: "2026-11-10",
        title: L("BMI dan risiko metabolik: lebih daripada nombor", "BMI and metabolic risk: more than a number"),
        excerpt: L(
          "BMI ialah titik permulaan yang berguna, tetapi lilitan pinggang dan ujian darah memberi gambaran lebih lengkap.",
          "BMI is a useful starting point, but waist size and blood tests give a fuller picture.",
        ),
        body: L(
          `Indeks Jisim Tubuh (BMI) dikira daripada berat dan ketinggian. Ia mudah dan berguna, tetapi tidak menceritakan segalanya.

## Kenapa lilitan pinggang penting

Lemak di sekitar perut berkait rapat dengan risiko kencing manis jenis 2, darah tinggi dan penyakit jantung — walaupun BMI anda kelihatan normal.

## Ujian yang mungkin dicadangkan

- Gula dalam darah
- Profil kolesterol
- Tekanan darah

## Langkah kecil yang bermakna

Penurunan berat badan yang sederhana pun boleh memperbaiki tekanan darah dan paras gula. Mulakan dengan perubahan yang boleh dikekalkan: tidur yang cukup, lebih banyak bergerak, dan pinggan yang seimbang.

Berbincanglah dengan doktor untuk pelan yang sesuai dengan kesihatan anda.`,
          `Body Mass Index (BMI) is calculated from weight and height. It is simple and useful, but it doesn't tell the whole story.

## Why waist size matters

Fat around the abdomen is closely linked with type 2 diabetes, high blood pressure and heart disease — even when BMI looks normal.

## Tests your doctor may suggest

- Blood sugar
- Cholesterol profile
- Blood pressure

## Small steps that matter

Even modest weight loss can improve blood pressure and blood sugar. Start with changes you can keep: enough sleep, more movement, and a balanced plate.

Talk to a doctor about a plan that suits your health.`,
        ),
      },
    },
  ],

  faqs: [
    faqItem("faq-1", 1,
      L("Adakah berjumpa doktor tentang kesihatan mental akan direkodkan secara umum?", "Will seeing a doctor about mental health be recorded publicly?"),
      L("Tidak. Rekod perubatan anda adalah sulit dan dilindungi di bawah kerahsiaan perubatan serta undang-undang perlindungan data.", "No. Your medical records are confidential and protected by medical confidentiality and data protection law.")),
    faqItem("faq-2", 2,
      L("Adakah saya perlu dirujuk untuk konsultasi kesihatan mental?", "Do I need a referral for a mental health consultation?"),
      L("Tidak. Anda boleh membuat temujanji terus dengan klinik.", "No. You can book directly with the clinic.")),
    faqItem("faq-3", 3,
      L("Bagaimana jika saya tidak pasti masalah saya serius?", "What if I'm not sure my problem is serious?"),
      L("Itu perkara biasa. Saringan percuma boleh menjadi titik permulaan, dan doktor boleh membantu anda memahami keadaan anda.", "That's very common. The free screening can be a starting point, and a doctor can help you make sense of things.")),
    faqItem("faq-4", 4,
      L("Bolehkah ahli keluarga menemani saya?", "Can a family member come with me?"),
      L("Boleh, jika anda selesa. Anda juga boleh meminta masa bercakap dengan doktor secara bersendirian.", "Yes, if you're comfortable. You can also ask for time with the doctor on your own.")),
    faqItem("faq-5", 5,
      L("Apa yang perlu saya lakukan dalam kecemasan?", "What should I do in an emergency?"),
      L("Hubungi 999 atau pergi ke Jabatan Kecemasan hospital terdekat. Klinik ini bukan perkhidmatan kecemasan.", "Call 999 or go to the nearest hospital Emergency Department. The clinic is not an emergency service.")),
  ],

  videos: [],

  events: [
    {
      slug: "mind-matters-kul-2026",
      status: "draft", // partner name use requires partner approval before publishing
      sort: 1,
      data: {
        slug: "mind-matters-kul-2026",
        title: L("Mind Matters @ KUL — saringan kesihatan mental", "Mind Matters @ KUL — mental health screening"),
        date: "2026-10-15",
        location: L("KLIA, Sepang", "KLIA, Sepang"),
        description: L(
          "Program saringan kesihatan mental PHQ-9 & GAD-7 bersama komuniti. #SpreadPositivity",
          "A community PHQ-9 & GAD-7 mental health screening programme. #SpreadPositivity",
        ),
      },
    },
  ],

  jobs: [
    {
      slug: "pembantu-klinik",
      status: "draft", // publish from Staff Portal → Content when the vacancy is open
      sort: 1,
      data: {
        slug: "pembantu-klinik",
        title: L("Pembantu Klinik", "Clinic Assistant"),
        type: L("Sepenuh masa · Syif", "Full-time · Shifts"),
        summary: L(
          "Menjadi wajah pertama yang pesakit temui — mesra, teratur dan teliti.",
          "Be the first friendly face patients meet — welcoming, organised and careful.",
        ),
        responsibilities: [
          L("Pendaftaran pesakit dan urusan panel", "Patient registration and panel processing"),
          L("Membantu doktor semasa prosedur ringkas", "Assisting the doctor with minor procedures"),
          L("Pengurusan stok dan kebersihan klinik", "Stock management and clinic cleanliness"),
        ],
        requirements: [
          L("Minimum SPM", "Minimum SPM"),
          L("Boleh bekerja mengikut syif", "Able to work shifts"),
          L("Pengalaman klinik adalah kelebihan", "Clinic experience is an advantage"),
        ],
      },
    },
  ],

  values: [
    value("compassion", 1, "heart", L("Belas ihsan", "Compassion"),
      L("Setiap pesakit didengar dengan sabar dan tanpa menghakimi.", "Every patient is heard patiently and without judgement.")),
    value("privacy", 2, "shield", L("Kerahsiaan", "Privacy"),
      L("Maklumat kesihatan anda dilindungi dengan teliti.", "Your health information is protected with care.")),
    value("clarity", 3, "sparkle", L("Penjelasan yang jelas", "Clarity"),
      L("Kami menerangkan pilihan rawatan dalam bahasa yang mudah.", "We explain treatment options in plain language.")),
    value("whole-person", 4, "circle-dot", L("Penjagaan menyeluruh", "Whole-person care"),
      L("Badan dan minda dijaga bersama, bukan berasingan.", "Body and mind cared for together, not apart.")),
  ],
};

// ── helpers ─────────────────────────────────────────────
function faq(q: { ms: string; en: string }, a: { ms: string; en: string }) {
  return { q, a };
}
function faqItem(slug: string, sort: number, q: { ms: string; en: string }, a: { ms: string; en: string }) {
  return { slug, status: "published" as const, sort, data: { slug, q, a } };
}
function value(slug: string, sort: number, icon: string, title: { ms: string; en: string }, body: { ms: string; en: string }) {
  return { slug, status: "published" as const, sort, data: { slug, icon, title, body } };
}
function svc(
  slug: string,
  group: "gp" | "mental" | "weight" | "other",
  sort: number,
  icon: string,
  featured: boolean,
  title: { ms: string; en: string },
  summary: { ms: string; en: string },
  explanation: { ms: string; en: string },
  whoBenefits: { ms: string; en: string }[],
  expect: { ms: string; en: string }[],
  faqs: { q: { ms: string; en: string }; a: { ms: string; en: string } }[],
  whatsappTopic: "mental" | "gp" | "weight" | "screening" | "general",
) {
  return {
    slug,
    status: "published" as const,
    sort,
    data: { slug, group, icon, featured, title, summary, explanation, whoBenefits, expect, faqs, whatsappTopic },
  };
}
