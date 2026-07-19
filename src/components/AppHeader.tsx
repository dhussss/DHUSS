"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  HardHat,
  Clock3,
  LayoutDashboard,
  MoreHorizontal,
  ReceiptText,
  Search,
  UsersRound,
} from "lucide-react";
import { isNavigationItemActive, shouldHideAppNavigation } from "@/lib/navigation";
import { platform } from "@/lib/platform";

const items = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/search", label: "Find", icon: Search },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/hours-export", label: "Hours", icon: Clock3 },
  { href: "/team", label: "Team", icon: HardHat, separated: true },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/more", label: "More", icon: MoreHorizontal }
];

export function AppHeader() {
  const pathname = usePathname();
  if (shouldHideAppNavigation(pathname)) return null;

  return (
    <header className="app-header no-print">
      <div className="app-header-inner">
        <Link href="/" className="app-brand">
          <span className="app-brand-mark">
            <BriefcaseBusiness size={18} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="app-brand-name">{platform.name}</span>
        </Link>

        <Link href="/search" className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-moss lg:hidden" aria-label="Find clients, projects, or invoices">
          <Search size={19} aria-hidden="true" />
        </Link>

        <nav className="app-nav" aria-label="Main navigation">
          {items.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`app-nav-item ${item.separated ? "app-nav-separator" : ""} ${active ? "is-active" : ""}`}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="app-rail-footer">
          <span className="app-avatar" aria-hidden="true">{platform.shortName.charAt(0).toUpperCase()}</span>
          <span><strong>Business workspace</strong><small>Private account</small></span>
        </div>
      </div>
    </header>
  );
}
