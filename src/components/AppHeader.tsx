"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, FileText, FolderKanban, LayoutDashboard, MoreHorizontal, UsersRound } from "lucide-react";
import { isNavigationItemActive, shouldHideAppNavigation } from "@/lib/navigation";

const items = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/more", label: "More", icon: MoreHorizontal }
];

export function AppHeader() {
  const pathname = usePathname();
  if (shouldHideAppNavigation(pathname)) return null;

  return (
    <header className="app-header no-print">
      <div className="mx-auto flex h-16 w-full max-w-[92rem] items-center justify-between gap-6 px-5 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3 text-ink">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-white shadow-[0_1px_1px_rgba(21,24,29,0.2),0_6px_16px_-6px_rgba(21,24,29,0.5)]">
            <BriefcaseBusiness size={18} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="truncate text-[0.95rem] font-black tracking-tight">Trade Invoice Tracker</span>
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-xl border border-line/70 bg-white/60 p-1 md:flex" aria-label="Main navigation">
          {items.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold transition ${
                  active ? "bg-ink text-white shadow-sm" : "text-moss hover:bg-white hover:text-ink"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
