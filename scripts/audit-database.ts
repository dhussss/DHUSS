import { PrismaClient } from "@prisma/client";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();

async function main() {
  const [runtimeRole, tableSecurity, integrity, storageSecurity] = await Promise.all([
    prisma.$queryRaw<Array<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT current_user, role.rolsuper, role.rolbypassrls
      FROM pg_roles role
      WHERE role.rolname = current_user
    `,
    prisma.$queryRaw<Array<{ table_name: string; rls_enabled: boolean; exposed_to_api_roles: boolean }>>`
      SELECT
        tables.relname AS table_name,
        tables.relrowsecurity AS rls_enabled,
        COALESCE(
          BOOL_OR(
            grants.grantee IN ('anon', 'authenticated')
            AND grants.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
          ),
          false
        ) AS exposed_to_api_roles
      FROM pg_class tables
      JOIN pg_namespace namespaces ON namespaces.oid = tables.relnamespace
      LEFT JOIN information_schema.role_table_grants grants
        ON grants.table_schema = namespaces.nspname
        AND grants.table_name = tables.relname
      WHERE namespaces.nspname = 'public'
        AND tables.relkind = 'r'
        AND tables.relname <> '_prisma_migrations'
      GROUP BY tables.relname, tables.relrowsecurity
      ORDER BY tables.relname
    `,
    prisma.$queryRaw<Array<Record<string, number>>>`
      SELECT
        (SELECT COUNT(*)::int FROM "Client" WHERE "ownerId" IS NULL) AS clients_without_owner,
        (SELECT COUNT(*)::int FROM "Project" WHERE "ownerId" IS NULL) AS projects_without_owner,
        (SELECT COUNT(*)::int FROM "TimeEntry" WHERE "ownerId" IS NULL) AS entries_without_owner,
        (SELECT COUNT(*)::int FROM "ExpenseItem" WHERE "ownerId" IS NULL) AS items_without_owner,
        (SELECT COUNT(*)::int FROM "Invoice" WHERE "ownerId" IS NULL) AS invoices_without_owner,
        (SELECT COUNT(*)::int FROM "InvoiceLineItem" WHERE "ownerId" IS NULL) AS lines_without_owner,
        (SELECT COUNT(*)::int FROM "RateHistory" WHERE "ownerId" IS NULL) AS rates_without_owner,
        (
          SELECT COUNT(*)::int
          FROM "Project" project
          JOIN "Client" client ON client.id = project."clientId"
          WHERE project."ownerId" IS DISTINCT FROM client."ownerId"
        ) AS project_client_owner_mismatches,
        (
          SELECT COUNT(*)::int
          FROM "TimeEntry" entry
          JOIN "Project" project ON project.id = entry."projectId"
          WHERE entry."ownerId" IS DISTINCT FROM project."ownerId"
        ) AS entry_project_owner_mismatches,
        (
          SELECT COUNT(*)::int
          FROM "Invoice" invoice
          JOIN "Project" project ON project.id = invoice."projectId"
          JOIN "Client" client ON client.id = invoice."clientId"
          WHERE invoice."ownerId" IS DISTINCT FROM project."ownerId"
             OR invoice."ownerId" IS DISTINCT FROM client."ownerId"
        ) AS invoice_owner_mismatches,
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT line."timeEntryId"
            FROM "InvoiceLineItem" line
            JOIN "Invoice" invoice ON invoice.id = line."invoiceId"
            WHERE invoice.status = 'DRAFT' AND line."timeEntryId" IS NOT NULL
            GROUP BY line."timeEntryId"
            HAVING COUNT(*) > 1
          ) duplicated_draft_entries
        ) AS entries_reserved_by_multiple_drafts,
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT line."expenseItemId"
            FROM "InvoiceLineItem" line
            JOIN "Invoice" invoice ON invoice.id = line."invoiceId"
            WHERE invoice.status = 'DRAFT' AND line."expenseItemId" IS NOT NULL
            GROUP BY line."expenseItemId"
            HAVING COUNT(*) > 1
          ) duplicated_draft_expenses
        ) AS expenses_reserved_by_multiple_drafts,
        (
          SELECT COUNT(*)::int
          FROM "ExpenseItem" item
          JOIN "Project" project ON project.id = item."projectId"
          WHERE item."ownerId" IS DISTINCT FROM project."ownerId"
        ) AS expense_project_owner_mismatches,
        (
          SELECT COUNT(*)::int
          FROM "InvoiceLineItem" line
          JOIN "Invoice" invoice ON invoice.id = line."invoiceId"
          WHERE line."ownerId" IS DISTINCT FROM invoice."ownerId"
        ) AS invoice_line_owner_mismatches,
        (
          SELECT COUNT(*)::int
          FROM "ProjectAssignment" assignment
          JOIN "Project" project ON project.id = assignment."projectId"
          JOIN "TeamMember" member ON member.id = assignment."teamMemberId"
          WHERE assignment."ownerId" IS DISTINCT FROM project."ownerId"
             OR assignment."ownerId" IS DISTINCT FROM member."ownerId"
        ) AS assignment_owner_mismatches,
        (
          SELECT COUNT(*)::int
          FROM "WagePayment" payment
          JOIN "Project" project ON project.id = payment."projectId"
          JOIN "TeamMember" member ON member.id = payment."teamMemberId"
          WHERE payment."ownerId" IS DISTINCT FROM project."ownerId"
             OR payment."ownerId" IS DISTINCT FROM member."ownerId"
        ) AS wage_payment_owner_mismatches,
        (
          SELECT COUNT(*)::int
          FROM "TimeEntry"
          WHERE "durationMinutes" <= 0
             OR "hourlyRateCentsSnapshot" < 0
             OR COALESCE("payRateCentsSnapshot", 0) < 0
        ) AS invalid_time_values,
        (
          SELECT COUNT(*)::int
          FROM "ExpenseItem"
          WHERE "quantity" <= 0 OR "unitCostCents" < 0 OR "totalCostCents" < 0
        ) AS invalid_expense_values,
        (
          SELECT COUNT(*)::int
          FROM "Invoice"
          WHERE "dateRangeStart" > "dateRangeEnd"
             OR "subtotalCents" < 0
             OR "gstCents" < 0
             OR "grandTotalCents" < 0
        ) AS invalid_invoice_values,
        (
          SELECT
            (SELECT COUNT(*) FROM "Project" WHERE "currentHourlyRateCents" < 0)
            + (SELECT COUNT(*) FROM "RateHistory" WHERE "rateCents" < 0)
            + (SELECT COUNT(*) FROM "WorkExpense" WHERE "amountCents" <= 0 OR "gstAmountCents" < 0 OR "gstAmountCents" > "amountCents")
            + (SELECT COUNT(*) FROM "WagePayment" WHERE "minutes" <= 0 OR "amountCents" < 0)
            + (SELECT COUNT(*) FROM "ProjectAssignment" WHERE "payRateCents" < 0 OR "chargeRateCents" < 0)
            + (SELECT COUNT(*) FROM "TeamMember" WHERE "defaultPayRateCents" < 0 OR "defaultChargeRateCents" < 0)
            + (SELECT COUNT(*) FROM "InvoiceLineItem" WHERE "unitAmountCents" < 0 OR "totalAmountCents" < 0 OR COALESCE("hoursMinutes", 1) <= 0)
        )::int AS invalid_operational_values,
        (
          SELECT COUNT(*)::int
          FROM "Invoice" invoice
          WHERE invoice.status IN ('SENT', 'PAID')
            AND EXISTS (
              SELECT 1
              FROM "InvoiceLineItem" line
              LEFT JOIN "TimeEntry" entry ON entry.id = line."timeEntryId"
              LEFT JOIN "ExpenseItem" item ON item.id = line."expenseItemId"
              WHERE line."invoiceId" = invoice.id
                AND (
                  (line."timeEntryId" IS NOT NULL AND (entry."billingStatus" <> 'BILLED' OR entry."invoiceId" IS DISTINCT FROM invoice.id))
                  OR
                  (line."expenseItemId" IS NOT NULL AND (item."billingStatus" <> 'BILLED' OR item."invoiceId" IS DISTINCT FROM invoice.id))
                )
            )
        ) AS finalised_invoice_source_mismatches,
        (
          SELECT COUNT(*)::int
          FROM "Invoice" invoice
          WHERE invoice."subtotalCents" <> invoice."labourTotalCents" + invoice."itemTotalCents"
             OR invoice."grandTotalCents" <> invoice."subtotalCents" + invoice."gstCents"
        ) AS invoice_total_mismatches
    `
    ,
    prisma.$queryRaw<Array<{ bucket_exists: boolean; owner_scoped_policy_count: number }>>`
      SELECT
        EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'business-logos') AS bucket_exists,
        (
          SELECT COUNT(*)::int
          FROM pg_policies
          WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND (
              COALESCE(qual, '') LIKE '%business-logos%'
              OR COALESCE(with_check, '') LIKE '%business-logos%'
            )
            AND (
              COALESCE(qual, '') LIKE '%auth.uid()%'
              OR COALESCE(with_check, '') LIKE '%auth.uid()%'
            )
        ) AS owner_scoped_policy_count
    `
  ]);

  const exposedTables = tableSecurity.filter((table) => table.exposed_to_api_roles && !table.rls_enabled);
  const tablesWithoutRls = tableSecurity.filter((table) => !table.rls_enabled).map((table) => table.table_name);

  console.log(
    JSON.stringify(
      { runtimeRole, exposedTables, tablesWithoutRls, storageSecurity: storageSecurity[0], integrity: integrity[0] },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Database audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
