import type { InvoiceStatus, ProjectStatus } from "@prisma/client";

const invoiceStyles: Record<InvoiceStatus, string> = {
  DRAFT: "border-line bg-paper text-moss",
  SENT: "border-yolk/45 bg-yolk/10 text-yolk",
  PAID: "border-mint/40 bg-mint/10 text-mint",
  VOID: "border-gum/40 bg-gum/10 text-gum"
};

const projectStyles: Record<ProjectStatus, string> = {
  ACTIVE: "border-mint/40 bg-mint/10 text-mint",
  ARCHIVED: "border-line bg-paper text-moss"
};

export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return <span className={`status-pill ${invoiceStyles[status]}`}>{status.toLowerCase()}</span>;
}

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return <span className={`status-pill ${projectStyles[status]}`}>{status.toLowerCase()}</span>;
}
