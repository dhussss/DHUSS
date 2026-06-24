import Link from "next/link";
import { BarChart3, Building2, Clock3, ShieldCheck } from "lucide-react";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const links = [
  {
    href: "/insights",
    label: "Insights",
    body: "Analytics for workload, revenue, trends, and financial-year progress.",
    icon: BarChart3
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
    body: "Invoice settings, payment details, branding, and email defaults.",
    icon: Building2
  },
  {
    href: "/privacy",
    label: "Privacy",
    body: "How your private business data is handled in this app.",
    icon: ShieldCheck
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
            <Link key={item.href} href={item.href} className="group flex items-start gap-4 rounded-lg border border-line bg-white p-4 shadow-soft transition hover:border-mint">
              <span className="icon-tile">
                <Icon size={21} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xl font-black tracking-normal text-ink">{item.label}</span>
                <span className="mt-1 block text-sm font-bold leading-6 text-moss">{item.body}</span>
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
