-- Add invoice document snapshot fields used by polished print/PDF invoices.
-- Nullable fields preserve existing invoices and allow current-profile fallback.

ALTER TABLE "Invoice"
  ADD COLUMN "businessContactNameSnapshot" TEXT,
  ADD COLUMN "businessWebsiteSnapshot" TEXT,
  ADD COLUMN "businessDefaultInvoiceNotesSnapshot" TEXT,
  ADD COLUMN "businessDefaultInvoiceEmailMessageSnapshot" TEXT,
  ADD COLUMN "businessSignatureFooterSnapshot" TEXT;
