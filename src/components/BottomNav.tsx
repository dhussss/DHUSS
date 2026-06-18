"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, FileText, FolderKanban, LayoutDashboard, UsersRound } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/hours-export", label: "Hours", icon: Clock3 }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pt-2 shadow-[0_-12px_30px_rgba(23,33,28,0.08)] backdrop-blur md:left-1/2 md:max-w-2xl md:-translate-x-1/2 md:rounded-t-lg md:border-x">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-bold transition ${
                active ? "bg-mint text-white" : "text-moss hover:bg-paper hover:text-ink"
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
