import { PageHero } from "@/components/site/page-hero";
import { getSettings } from "@/lib/content/repo";
import { pageMeta, resolveLang } from "@/lib/page";

/**
 * DRAFT privacy notice & medical disclaimer prepared for Malaysian PDPA 2010
 * (as amended 2024). Must be reviewed by the clinic's legal adviser / DPO
 * before publication — see docs/CONTENT-VERIFICATION.md.
 */
const UPDATED = "2026-11-16";

type Section = { id: string; title: string; body: string[] };

const COPY: Record<"ms" | "en", { title: string; intro: string; sections: Section[] }> = {
  ms: {
    title: "Dasar Privasi & Penafian Perubatan",
    intro: "Notis ini menerangkan bagaimana Klinik Nissa mengumpul, menggunakan dan melindungi data peribadi anda di bawah Akta Perlindungan Data Peribadi 2010.",
    sections: [
      { id: "controller", title: "1. Siapa kami", body: ["Klinik Nissa (juga dikenali sebagai Klinik Dr Azren) ialah pengguna data bagi maklumat yang dikumpul melalui laman web ini. Butiran hubungan dinyatakan di bahagian akhir notis ini."] },
      { id: "collect", title: "2. Data yang kami kumpul", body: [
        "Saringan kesihatan mental: jawapan PHQ-9/GAD-7, skor, bahasa, masa penghantaran dan versi persetujuan. Butiran hubungan (nama, telefon, e-mel, umur) hanya jika anda meminta susulan.",
        "Permohonan kerja: nama, e-mel, telefon, mesej dan CV yang anda hantar.",
        "Kami tidak menggunakan analitik, piksel pengiklanan atau penjejak pihak ketiga pada halaman saringan. Portal staf menggunakan satu kuki sesi yang penting untuk keselamatan sahaja.",
      ] },
      { id: "screening", title: "3. Saringan kesihatan mental", body: [
        "Data kesihatan ialah data peribadi sensitif. Kami memprosesnya hanya dengan persetujuan nyata anda, bagi tujuan saringan, semakan klinikal dan susulan yang anda minta.",
        "Jawapan disulitkan semasa penghantaran dan semasa disimpan. Hanya kakitangan klinikal yang diberi kuasa boleh melihat rekod yang boleh dikenal pasti, dan setiap akses direkodkan.",
        "Jawapan saringan tidak sekali-kali dihantar melalui WhatsApp. Laman web ini tidak dipantau 24 jam — dalam kecemasan hubungi 999.",
        "Saringan bukan diagnosis dan tidak menggantikan konsultasi dengan doktor.",
      ] },
      { id: "use", title: "4. Cara kami menggunakan dan mendedahkan data", body: [
        "Untuk menyediakan penjagaan, susulan klinikal, pentadbiran klinik dan mematuhi undang-undang. Kami tidak menjual data anda.",
        "Pembekal perkhidmatan yang terikat dengan kontrak kerahsiaan (contohnya penyedia pangkalan data awan, Google Workspace dan e-mel) memproses data bagi pihak kami. Sebahagian infrastruktur awan mungkin terletak di luar Malaysia; kami memastikan perlindungan yang setara.",
      ] },
      { id: "retention", title: "5. Tempoh penyimpanan", body: [
        "Rekod saringan disimpan mengikut polisi rekod perubatan klinik (lalai 7 tahun) dan dipadam secara selamat selepas itu.",
        "Permohonan kerja disimpan sehingga 6 bulan melainkan anda diambil bekerja.",
      ] },
      { id: "careers", title: "6. Permohonan kerja", body: ["Data permohonan digunakan hanya untuk proses pengambilan pekerja dan dihantar kepada pasukan pengurusan klinik."] },
      { id: "rights", title: "7. Hak anda", body: ["Anda berhak meminta akses dan pembetulan data anda, serta menarik balik persetujuan untuk pemprosesan pada masa hadapan. Hubungi kami menggunakan butiran di bawah."] },
      { id: "disclaimer", title: "8. Penafian perubatan", body: [
        "Kandungan laman web ini adalah untuk pendidikan umum sahaja dan bukan nasihat perubatan. Sentiasa dapatkan nasihat doktor untuk keadaan kesihatan anda. Hasil rawatan berbeza bagi setiap individu.",
      ] },
    ],
  },
  en: {
    title: "Privacy Policy & Medical Disclaimer",
    intro: "This notice explains how Klinik Nissa collects, uses and protects your personal data under the Personal Data Protection Act 2010.",
    sections: [
      { id: "controller", title: "1. Who we are", body: ["Klinik Nissa (also known as Klinik Dr Azren) is the data user for information collected through this website. Contact details are at the end of this notice."] },
      { id: "collect", title: "2. Data we collect", body: [
        "Mental health screening: PHQ-9/GAD-7 answers, scores, language, submission time and consent version. Contact details (name, phone, email, age) only if you request follow-up.",
        "Job applications: the name, email, phone, message and CV you send.",
        "We do not use analytics, advertising pixels or third-party trackers on the screening page. The staff portal uses one strictly necessary security session cookie.",
      ] },
      { id: "screening", title: "3. Mental health screening", body: [
        "Health data is sensitive personal data. We process it only with your explicit consent, for screening, clinical review and any follow-up you request.",
        "Answers are encrypted in transit and at rest. Only authorised clinical staff can view identifiable records, and every access is logged.",
        "Screening answers are never sent over WhatsApp. This website is not monitored 24/7 — in an emergency call 999.",
        "Screening is not a diagnosis and does not replace a consultation with a doctor.",
      ] },
      { id: "use", title: "4. How we use and disclose data", body: [
        "To provide care, clinical follow-up, clinic administration and to meet legal obligations. We do not sell your data.",
        "Service providers bound by confidentiality (e.g. cloud database hosting, Google Workspace and email) process data on our behalf. Some cloud infrastructure may be located outside Malaysia; we ensure comparable protection.",
      ] },
      { id: "retention", title: "5. Retention", body: [
        "Screening records are kept in line with the clinic's medical records policy (default 7 years) and securely deleted afterwards.",
        "Job applications are kept for up to 6 months unless you are hired.",
      ] },
      { id: "careers", title: "6. Job applications", body: ["Application data is used only for recruitment and is sent to the clinic's management team."] },
      { id: "rights", title: "7. Your rights", body: ["You may request access to and correction of your data, and withdraw consent for future processing. Contact us using the details below."] },
      { id: "disclaimer", title: "8. Medical disclaimer", body: [
        "Content on this website is for general education only and is not medical advice. Always seek a doctor's advice about your health. Individual results vary.",
      ] },
    ],
  },
};

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await resolveLang(params);
  return pageMeta(lang, "/privacy", COPY[lang].title, COPY[lang].intro);
}

export default async function Privacy({ params }: PageProps<"/[lang]/privacy">) {
  const { lang, dict } = await resolveLang(params);
  const c = COPY[lang];
  const s = await getSettings();
  return (
    <>
      <PageHero eyebrow={dict.footer.legal} title={c.title} intro={c.intro} tone="paper" />
      <section className="pb-24">
        <div className="container-page grid gap-10 lg:grid-cols-12">
          <nav className="hidden lg:col-span-3 lg:block">
            <ul className="sticky top-28 space-y-2 text-sm">
              {c.sections.map((x) => <li key={x.id}><a href={`#${x.id}`} className="text-ink-muted hover:text-navy-900">{x.title}</a></li>)}
            </ul>
          </nav>
          <div className="prose-clinic lg:col-span-8">
            <p className="text-sm">{dict.common.lastUpdated}: {UPDATED}</p>
            {c.sections.map((x) => (
              <section key={x.id} id={x.id} className="scroll-mt-28">
                <h2>{x.title}</h2>
                {x.body.map((b) => <p key={b}>{b}</p>)}
              </section>
            ))}
            <h2>{lang === "ms" ? "Hubungi kami" : "Contact us"}</h2>
            <p>{s.clinicName}<br />{s.addressLines.join(", ")}<br />{s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}</p>
          </div>
        </div>
      </section>
    </>
  );
}
