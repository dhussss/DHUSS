import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { acceptTeamInvitationAction } from "@/app/team/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function JoinTeamPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const code = typeof params?.code === "string" ? params.code : "";
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/team/join?code=${code}`)}`);
  return (
    <main className="page-shell max-w-xl">
      <Link href="/team" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-mint"><ArrowLeft size={18} aria-hidden="true" />Team</Link>
      <section className="card">
        <span className="icon-tile"><Link2 size={21} aria-hidden="true" /></span>
        <h1 className="mt-4 text-3xl font-black">Join a contractor team</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-moss">This links only projects assigned to you. Your private clients, invoices, expenses, and dashboard remain separate.</p>
        <form action={acceptTeamInvitationAction} className="mt-5 grid gap-4">
          <label>Invitation code<input name="code" defaultValue={code} autoCapitalize="characters" required /></label>
          <SubmitButton className="tap-primary" pendingLabel="Joining team..."><Link2 size={19} aria-hidden="true" />Accept invitation</SubmitButton>
        </form>
      </section>
    </main>
  );
}
