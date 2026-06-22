export default function Loading() {
  return (
    <main className="page-shell">
      <div className="grid gap-4">
        <div className="h-5 w-40 animate-pulse rounded bg-line" />
        <div className="h-10 w-72 max-w-full animate-pulse rounded bg-line" />
        <section className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-lg border border-line bg-white" />
          <div className="h-28 animate-pulse rounded-lg border border-line bg-white" />
        </section>
        <div className="h-48 animate-pulse rounded-lg border border-line bg-white" />
      </div>
    </main>
  );
}
