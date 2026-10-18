import BatchWriter from "@/components/BatchWriter";
import ScorerPlayground from "@/components/ScorerPlayground";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Bulk SEO Writer</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Tempel daftar keyword → generate artikel secara batch → tiap artikel
          dapat <strong>kartu skor SEO deterministik</strong> (keyword density,
          keterbacaan, struktur heading, meta description, panjang) →
          ekspor Markdown atau unduh semua sebagai .zip.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Skor SELALU dihitung oleh scorer deterministik dari teks — LLM hanya
          menulis artikel, tidak pernah mengarang skor.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          1 · Batch generator
        </h2>
        <BatchWriter />
      </section>

      <section className="mb-12">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-800">
            2 · SEO scorer live (coba teks apa pun)
          </h2>
          <p className="text-sm text-slate-500">
            Bagian ini 100% jalan tanpa API key — tempel teks Anda, skor berubah
            real-time. Inilah inti demo zero-env.
          </p>
        </div>
        <ScorerPlayground />
      </section>

      <footer className="border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p>
          Stateless by design — tidak ada DB/auth, tidak ada file yang dikirim ke
          server (export .zip dibuat di browser). Set{" "}
          <code className="rounded bg-slate-100 px-1">OPENAI_API_KEY</code> untuk
          mode LLM penuh; tanpa key, demo memakai artikel contoh dan scorer tetap
          live.
        </p>
        <p className="mt-2 text-slate-400">
          Pro (bukan bagian demo): publish WordPress, image generation, internal
          linking/clustering, riwayat tersimpan + billing.
        </p>
      </footer>
    </main>
  );
}
