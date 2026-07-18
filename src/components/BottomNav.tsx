"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderKanban, LayoutDashboard, MoreHorizontal, UsersRound } from "lucide-react";
import { isNavigationItemActive, shouldHideAppNavigation } from "@/lib/navigation";

const items = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/more", label: "More", icon: MoreHorizontal }
];

export function BottomNav() {
  const pathname = usePathname();
  if (shouldHideAppNavigation(pathname)) return null;

  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pt-1.5 shadow-[0_-8px_28px_rgba(21,24,29,0.06)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5 gap-1 md:gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavigationItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-semibold transition ${
                active ? "text-mint" : "text-moss hover:bg-paper hover:text-ink"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {active ? <span className="absolute inset-x-5 -top-1.5 h-0.5 bg-mint" aria-hidden="true" /> : null}
              <Icon size={20} strokeWidth={2.3} aria-hidden="true" className="relative" />
              <span className="relative leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
