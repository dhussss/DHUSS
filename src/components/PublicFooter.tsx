import Link from "next/link";
import { platform } from "@/lib/platform";

export function PublicFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`${compact ? "mt-5" : "mt-10"} flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-moss`}>
      <span>{platform.name}</span>
      <Link href="/support" className="hover:text-ink">Support</Link>
      <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
      <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
    </footer>
  );
}
