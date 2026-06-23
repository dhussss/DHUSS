import Link from "next/link";
import {
  BadgeInfo,
  Building2,
  CheckCircle2,
  FileText,
  FolderKanban,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Search,
  StickyNote,
  UsersRound
} from "lucide-react";
import { deleteClientAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";
import { getClientsPageData } from "@/lib/app-data";
import { formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

function detail(value: string | null) {
  return value?.trim() ? value : "Not recorded";
}

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
        <div className="flex items-center gap-2 text-moss">
          <UsersRound size={20} aria-hidden="true" />
          <p className="section-title">Clients</p>
        </div>
        <h1 className="page-title">Client register</h1>
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
              <article key={client.id} className="card">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-normal">{client.businessName}</h2>
                    <p className="mt-1 text-sm font-bold text-moss">Added {formatDateAU(client.createdAt)}</p>
                  </div>
                  <div className="grid gap-2 md:min-w-52">
                    <Link href={`/clients/${client.id}/edit`} className="tap-secondary w-full">
                      <PencilLine size={18} aria-hidden="true" />
                      Edit Client
                    </Link>
                    <form action={deleteClientAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <ConfirmSubmitButton
                        className="tap-danger w-full"
                        message={`Remove ${client.businessName}? This only works when the client has no invoices or billed history. Projects with real history should be archived instead.`}
                        pendingLabel="Checking..."
                      >
                        Remove Client
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                <dl className="mt-5 grid gap-x-5 md:grid-cols-2">
                  <div className="border-t border-line py-3">
                    <dt className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <Building2 size={16} aria-hidden="true" />
                      Contact
                    </dt>
                    <dd className="mt-2 text-sm font-bold">{detail(client.contactName)}</dd>
                  </div>
                  <div className="border-t border-line py-3">
                    <dt className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <Mail size={16} aria-hidden="true" />
                      Email
                    </dt>
                    <dd className="mt-2 break-words text-sm font-bold">{detail(client.email)}</dd>
                  </div>
                  <div className="border-t border-line py-3">
                    <dt className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <Phone size={16} aria-hidden="true" />
                      Phone
                    </dt>
                    <dd className="mt-2 text-sm font-bold">{detail(client.phone)}</dd>
                  </div>
                  <div className="border-t border-line py-3">
                    <dt className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <BadgeInfo size={16} aria-hidden="true" />
                      ABN
                    </dt>
                    <dd className="mt-2 text-sm font-bold">{detail(client.abn)}</dd>
                  </div>
                  <div className="border-t border-line py-3 md:col-span-2">
                    <dt className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <MapPin size={16} aria-hidden="true" />
                      Address
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap text-sm font-bold">{detail(client.address)}</dd>
                  </div>
                  <div className="border-t border-line py-3 md:col-span-2">
                    <dt className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <StickyNote size={16} aria-hidden="true" />
                      Notes
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap text-sm font-bold">{detail(client.notes)}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid gap-4 border-y border-line py-4 md:grid-cols-3">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <FolderKanban size={16} aria-hidden="true" />
                      Projects
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {client.activeProjectCount} active, {client.archivedProjectCount} archived
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-moss">
                      <FileText size={16} aria-hidden="true" />
                      Invoices
                    </p>
                    <p className="mt-2 text-xl font-black">{client.invoiceCount}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-moss">Invoice value</p>
                    <p className="mt-2 text-xl font-black">{formatMoney(client.invoiceValueCents)}</p>
                  </div>
                </div>

                {client.projectNames ? (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase text-moss">Linked projects</p>
                    <p className="mt-2 text-sm font-bold text-ink">{client.projectNames}</p>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <article className="card text-sm font-bold text-moss">No clients found.</article>
        )}
      </section>

      <Link className="tap-primary mt-5" href="/projects/new">
        <FolderKanban size={20} aria-hidden="true" />
        Add Project or Client
      </Link>
    </main>
  );
}
