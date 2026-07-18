import Link from "next/link";
import { CheckCircle2, Eye, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { deleteClientAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { getClientsPageData } from "@/lib/app-data";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LearnHowLink } from "@/components/LearnHowLink";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ownerId = await requireUserId();
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const saved = params?.saved === "client-updated";

  const clients = await getClientsPageData(ownerId, q);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-moss">
              <UsersRound size={20} aria-hidden="true" />
              <p className="section-title">Clients</p>
            </div>
            <h1 className="page-title">Client register</h1>
          </div>
          <Link href="/clients/new" className="tap-primary">
            <Plus size={18} aria-hidden="true" />
            Add Client
          </Link>
        </div>
        <LearnHowLink tutorialKey="creating-clients">Learn how clients work</LearnHowLink>
      </header>

      <form className="search-panel mt-5 flex items-center gap-2">
        <Search size={20} className="ml-2 text-moss" aria-hidden="true" />
        <input
          className="min-h-10 border-0 bg-transparent p-2 shadow-none focus:shadow-none"
          name="q"
          defaultValue={q}
          placeholder="Search client details"
        />
      </form>

      {saved ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">
          <CheckCircle2 size={18} aria-hidden="true" />
          Client updated.
        </div>
      ) : null}

      <section className="collection-panel mt-5">
        {clients.length ? (
          clients.map((client) => {
            return (
              <article key={client.id} className="collection-row client-collection-row">
                  <div className="min-w-0"><h2 className="collection-title">{client.businessName}</h2><p className="collection-subtitle">{client.contactName || "No contact name"}</p></div>
                  <dl className="collection-meta"><dt>Email</dt><dd>{client.email || "Not recorded"}</dd></dl>
                  <dl className="collection-meta"><dt>Phone</dt><dd>{client.phone || "Not recorded"}</dd></dl>
                  <div className="collection-actions">
                    <Link href={`/clients/${client.id}`} className="tap-secondary w-full">
                      <Eye size={18} aria-hidden="true" />
                      View
                    </Link>
                    <form action={deleteClientAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <ConfirmSubmitButton
                        className="tap-danger w-full"
                        message={`Remove ${client.businessName}? This only works when the client has no invoices or billed history. Projects with real history should be archived instead.`}
                        pendingLabel="Checking..."
                        showDefaultIcon={false}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                        Remove
                      </ConfirmSubmitButton>
                    </form>
                  </div>
              </article>
            );
          })
        ) : (
          q ? <div className="empty-collection"><UsersRound size={18} aria-hidden="true" />No clients match “{q}”.</div> : <div className="grid justify-items-start gap-3 p-5 sm:p-6">
            <span className="icon-tile"><UsersRound size={19} aria-hidden="true" /></span>
            <div><h2 className="text-lg font-semibold text-ink">Clients are the businesses you work for</h2><p className="mt-1 max-w-xl text-sm font-medium leading-6 text-moss">Add a client before creating their projects or invoices. Their contact and billing details can be reused on every job.</p></div>
            <div className="flex flex-wrap gap-2"><Link href="/clients/new" className="tap-primary"><Plus size={17} aria-hidden="true" />Add your first client</Link><LearnHowLink tutorialKey="creating-clients">Learn more</LearnHowLink></div>
          </div>
        )}
      </section>
    </main>
  );
}
