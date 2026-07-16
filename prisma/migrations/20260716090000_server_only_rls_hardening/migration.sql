-- The application reads and writes business data through authenticated Next.js
-- server code using the Prisma runtime role. Supabase browser clients are used
-- for Auth and Storage only, so direct PostgREST access to these tables is denied.

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkExpense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WagePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DayOffLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessProfile" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE
      "Client", "Project", "RateHistory", "TimeEntry", "TeamInvitation",
      "TeamMember", "ProjectAssignment", "ExpenseItem", "WorkExpense",
      "WagePayment", "DayOffLog", "Invoice", "InvoiceLineItem", "BusinessProfile"
    FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE
      "Client", "Project", "RateHistory", "TimeEntry", "TeamInvitation",
      "TeamMember", "ProjectAssignment", "ExpenseItem", "WorkExpense",
      "WagePayment", "DayOffLog", "Invoice", "InvoiceLineItem", "BusinessProfile"
    FROM authenticated;
  END IF;
END $$;
