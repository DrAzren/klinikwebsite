/** Instant skeleton while a portal page loads its per-user data. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-8 w-72 rounded-xl bg-navy-100" />
      <div className="mt-3 h-4 w-96 max-w-full rounded-lg bg-navy-100/70" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-3xl bg-white ring-1 ring-line" />)}
      </div>
      <div className="mt-6 h-80 rounded-3xl bg-white ring-1 ring-line" />
    </div>
  );
}
