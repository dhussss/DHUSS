export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <header>
        <p className="section-title">Privacy</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Your business data</h1>
        <p className="mt-2 max-w-2xl text-sm font-bold text-moss">
          Trade Invoice Tracker is designed so each user works inside their own account.
        </p>
      </header>

      <section className="mt-6 grid gap-4">
        <article className="card">
          <h2 className="text-xl font-black tracking-normal">Account access</h2>
          <p className="mt-2 text-sm font-bold text-moss">
            Users must log in before viewing dashboard, client, project, invoice, hours, backup, diagnostics, and audit data.
          </p>
        </article>

        <article className="card">
          <h2 className="text-xl font-black tracking-normal">Data separation</h2>
          <p className="mt-2 text-sm font-bold text-moss">
            Clients, projects, invoices, time entries, expenses, business profiles, and backups are scoped to the logged-in user account.
          </p>
        </article>

        <article className="card">
          <h2 className="text-xl font-black tracking-normal">Business and bank details</h2>
          <p className="mt-2 text-sm font-bold text-moss">
            Bank details are stored so they can appear on that user’s invoices. They are not shown in diagnostics or audit metadata.
          </p>
        </article>

        <article className="card">
          <h2 className="text-xl font-black tracking-normal">Backups</h2>
          <p className="mt-2 text-sm font-bold text-moss">
            Backup exports require login and the private backup token. A backup exports only the logged-in user’s records.
          </p>
        </article>

        <article className="card">
          <h2 className="text-xl font-black tracking-normal">Invoice email and client links</h2>
          <p className="mt-2 text-sm font-bold text-moss">
            The app prepares invoice emails and opens the user’s own email app. Public invoice links use long random tokens and can be revoked or regenerated from the invoice page.
          </p>
        </article>

        <article className="card">
          <h2 className="text-xl font-black tracking-normal">Responsibility</h2>
          <p className="mt-2 text-sm font-bold text-moss">
            Users should verify invoice details before sending. This app is not accounting, legal, or tax advice.
          </p>
        </article>
      </section>
    </main>
  );
}
