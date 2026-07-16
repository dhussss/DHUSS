import Link from "next/link";
import { BarChart3, BookOpenCheck, Building2, Clock3, LogOut, ReceiptText, Settings2, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const links = [
  {
    href: "/tutorials",
    label: "Tutorials",
    body: "Open short guides for clients, jobs, work logs, invoices, expenses, and team workflows.",
    icon: BookOpenCheck
  },
  {
    href: "/team",
    label: "Team",
    body: "Invite subcontractors, assign projects, review hours, and track payments.",
    icon: UsersRound
  },
  {
    href: "/settings",
    label: "Settings",
    body: "Theme, tax planning, super estimates, and app preferences.",
    icon: Settings2
  },
  {
    href: "/insights",
    label: "Insights",
    body: "Analytics for workload, revenue, trends, and financial-year progress.",
    icon: BarChart3
  },
  {
    href: "/expenses",
    label: "Expenses",
    body: "Work-related expense register for tax planning and project allocation.",
    icon: ReceiptText
  },
  {
    href: "/hours-export",
    label: "Hours Export",
    body: "Review and export weekly or custom-date time logs.",
    icon: Clock3
  },
  {
    href: "/business-profile",
    label: "Business Profile",
    body: "Business details, invoice identity, payment details, logo, and email wording.",
    icon: Building2
  }
];

export default async function MorePage() {
  await requireUserId();

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-title">More</p>
        <h1 className="page-title">Tools and settings</h1>
        <p className="page-subtitle">Less crowding in the bottom bar, with the deeper tools still close by.</p>
      </header>

      <section className="mt-4 grid gap-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-mint/50 hover:bg-white sm:p-5">
              <span className="icon-tile">
                <Icon size={21} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xl font-black text-ink">{item.label}</span>
                <span className="mt-1 block text-sm font-medium leading-6 text-moss">{item.body}</span>
              </span>
            </Link>
          );
        })}
      </section>

      <form action={logoutAction} className="mt-3">
        <button className="tap-secondary w-full justify-start" type="submit">
          <LogOut size={20} aria-hidden="true" />
          Logout
        </button>
      </form>
    </main>
  );
}
