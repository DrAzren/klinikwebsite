import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[80vh] items-center bg-gradient-to-b from-mint to-paper pt-28">
      <div className="container-page text-center">
        <p className="font-display text-[8rem] italic leading-none text-teal-500/70">404</p>
        <h1 className="mt-4 text-3xl font-semibold text-navy-900">Halaman tidak dijumpai · Page not found</h1>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" prefetch={false} className="inline-flex h-12 items-center rounded-full bg-navy-900 px-6 font-semibold text-white">Laman utama</Link>
          <Link href="/en" prefetch={false} className="inline-flex h-12 items-center rounded-full px-6 font-semibold text-navy-900 ring-1 ring-line">Home (English)</Link>
        </div>
      </div>
    </section>
  );
}
