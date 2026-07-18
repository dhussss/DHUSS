import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, Building2, Clock3, FileDown, HelpCircle, LogOut, ReceiptText, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const links = [
  {
    href: "/tutorials",
    label: "Tutorials",
    body: "Open short guides for clients, jobs, work logs, invoices, expenses, and team workflows.",
    icon: BookOpenCheck,
    group: "Help"
  },
  {
    href: "/support",
    label: "Support and product help",
    body: "Get help, review service guidance, and understand how your data is handled.",
    icon: HelpCircle,
    group: "Help"
  },
  {
    href: "/legal/privacy",
    label: "Privacy and terms",
    body: "Read the current privacy summary and terms requiring final legal review.",
    icon: ShieldCheck,
    group: "Help"
  },
  {
    href: "/team",
    label: "Team",
    body: "Invite subcontractors, assign projects, review hours, and track payments.",
    icon: UsersRound,
    group: "Work"
  },
  {
    href: "/settings",
    label: "Settings",
    body: "Theme, tax planning, super estimates, and app preferences.",
    icon: Settings2,
    group: "Business"
  },
  {
    href: "/insights",
    label: "Insights",
    body: "Analytics for workload, revenue, trends, and financial-year progress.",
    icon: BarChart3,
    group: "Work"
  },
  {
    href: "/expenses",
    label: "Expenses",
    body: "Work-related expense register for tax planning and project allocation.",
    icon: ReceiptText,
    group: "Work"
  },
  {
    href: "/hours-export",
    label: "Hours Export",
    body: "Review and export weekly or custom-date time logs.",
    icon: Clock3,
    group: "Work"
  },
  {
    href: "/business-profile",
    label: "Business Profile",
    body: "Business details, invoice identity, payment details, logo, and email wording.",
    icon: Building2,
    group: "Business"
  },
  {
    href: "/account",
    label: "Account and data",
    body: "Download your business data and review account lifecycle options.",
    icon: FileDown,
    group: "Business"
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

      <section className="more-groups">
        {["Work", "Business", "Help"].map((group) => (
          <div className="more-group" key={group}>
            <h2>{group}</h2>
            <div className="collection-panel">
              {links.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="more-row">
                    <span className="icon-tile"><Icon size={18} aria-hidden="true" /></span>
                    <span><strong>{item.label}</strong><small>{item.body}</small></span>
                    <ArrowRight size={16} className="text-moss" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
