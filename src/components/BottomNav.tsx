"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderKanban, LayoutDashboard, MoreHorizontal, UsersRound } from "lucide-react";
import { isNavigationItemActive, shouldHideAppNavigation } from "@/lib/navigation";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/more", label: "More", icon: MoreHorizontal }
];

export function BottomNav() {
  const pathname = usePathname();
  if (shouldHideAppNavigation(pathname)) return null;

  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(37,40,35,0.07)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5 gap-1.5 md:gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavigationItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[0.68rem] font-bold transition ${
                active ? "bg-mint/10 text-mint" : "text-moss hover:bg-paper hover:text-ink"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={2.3} aria-hidden="true" />
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
