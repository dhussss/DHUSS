import Link from "next/link";
import { CheckCircle2, Eye, Mail, Phone, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { deleteClientAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { getClientsPageData } from "@/lib/app-data";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

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

      <section className="mt-5 grid gap-3">
        {clients.length ? (
          clients.map((client) => {
            return (
              <article key={client.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-mint/40 sm:p-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black tracking-tight text-ink">{client.businessName}</h2>
                    {client.contactName ? <p className="mt-1 text-sm font-semibold text-moss">{client.contactName}</p> : null}
                    <div className="mt-3 flex flex-col gap-1 text-sm font-medium text-moss sm:flex-row sm:flex-wrap sm:gap-x-4">
                      {client.email ? (
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Mail size={15} aria-hidden="true" />
                          <span className="break-all">{client.email}</span>
                        </span>
                      ) : null}
                      {client.phone ? (
                        <span className="inline-flex items-center gap-2">
                          <Phone size={15} aria-hidden="true" />
                          {client.phone}
                        </span>
                      ) : null}
                      {!client.email && !client.phone ? <span>No contact details recorded</span> : null}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 md:min-w-48">
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
                </div>
              </article>
            );
          })
        ) : (
          <article className="card text-sm font-bold text-moss">No clients found.</article>
        )}
      </section>
    </main>
  );
}
