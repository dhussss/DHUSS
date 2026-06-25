"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderKanban, LayoutDashboard, MoreHorizontal, UsersRound } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/more", label: "More", icon: MoreHorizontal }
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/signup" || pathname.startsWith("/public/")) return null;

  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pt-2 shadow-[0_-12px_30px_rgba(23,33,28,0.08)] backdrop-blur md:bottom-4 md:left-1/2 md:max-w-2xl md:-translate-x-1/2 md:rounded-lg md:border md:p-2">
      <div className="grid grid-cols-5 gap-1 md:gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/more"
                ? pathname.startsWith("/more") ||
                  pathname.startsWith("/settings") ||
                  pathname.startsWith("/insights") ||
                  pathname.startsWith("/expenses") ||
                  pathname.startsWith("/hours-export") ||
                  pathname.startsWith("/business-profile")
                : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-bold transition ${
                active ? "bg-ink text-white shadow-soft" : "text-moss hover:bg-paper hover:text-ink"
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
