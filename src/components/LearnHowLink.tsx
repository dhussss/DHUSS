import Link from "next/link";
import { CircleHelp } from "lucide-react";

export function LearnHowLink({ tutorialKey, children, className = "" }: { tutorialKey: string; children: string; className?: string }) {
  return (
    <Link href={`/tutorials?guide=${encodeURIComponent(tutorialKey)}`} className={`inline-flex min-h-10 items-center gap-2 text-sm font-bold text-mint transition hover:text-ink ${className}`}>
      <CircleHelp size={17} aria-hidden="true" />
      {children}
    </Link>
  );
}
