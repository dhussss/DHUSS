import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Seed aborted. This script deletes existing application rows. Set ALLOW_DESTRUCTIVE_SEED=true only against an isolated development database.");
  }

  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Seed aborted. The destructive demo seed cannot run in the production Vercel environment.");
  }

  await prisma.invoiceLineItem.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.rateHistory.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();

  const coastal = await prisma.client.create({
    data: {
      businessName: "Coastal Homes WA",
      contactName: "Mia Thompson",
      email: "mia@coastalhomes.example",
      phone: "0400 111 222",
      abn: "12 345 678 901",
      address: "18 Marine Parade, Fremantle WA",
      notes: "Prefers SMS for site updates."
    }
  });

  const ridge = await prisma.client.create({
    data: {
      businessName: "Ridge Electrical",
      contactName: "Sam Patel",
      email: "sam@ridgeelectrical.example",
      phone: "0400 333 444",
      abn: "98 765 432 109",
      address: "42 Hay Street, Subiaco WA",
      notes: "Invoices go to accounts each Friday."
    }
  });

  const alfresco = await prisma.project.create({
    data: {
      title: "Alfresco Fitout",
      clientId: coastal.id,
      currentHourlyRateCents: 9500,
      notes: "Outdoor kitchen and deck works.",
      rateHistory: {
        create: [{ rateCents: 9500, startsAt: d("2026-04-01"), notes: "Initial agreed rate" }]
      }
    }
  });

  const switchboards = await prisma.project.create({
    data: {
      title: "Switchboard Upgrade",
      clientId: ridge.id,
      currentHourlyRateCents: 11000,
      notes: "Commercial tenancy switchboard replacement.",
      rateHistory: {
        create: [{ rateCents: 11000, startsAt: d("2026-04-15"), notes: "Initial agreed rate" }]
      }
    }
  });

  const bathroom = await prisma.project.create({
    data: {
      title: "Bathroom Renovation",
      clientId: coastal.id,
      currentHourlyRateCents: 9800,
      notes: "Second-stage renovation, owner supplied tiles.",
      rateHistory: {
        create: [{ rateCents: 9800, startsAt: d("2026-05-08"), notes: "Initial agreed rate" }]
      }
    }
  });

  const paidEntryA = await prisma.timeEntry.create({
    data: {
      projectId: alfresco.id,
      date: d("2026-05-04"),
      startTime: "07:00",
      endTime: "15:00",
      durationMinutes: 480,
      notes: "Frame prep and material pickup",
      billingStatus: "BILLED",
      hourlyRateCentsSnapshot: 9500
    }
  });

  const paidEntryB = await prisma.timeEntry.create({
    data: {
      projectId: alfresco.id,
      date: d("2026-05-05"),
      startTime: "07:30",
      endTime: "14:30",
      durationMinutes: 420,
      notes: "Deck boards and setout",
      billingStatus: "BILLED",
      hourlyRateCentsSnapshot: 9500
    }
  });

  const sentEntryA = await prisma.timeEntry.create({
    data: {
      projectId: switchboards.id,
      date: d("2026-06-01"),
      startTime: "06:30",
      endTime: "16:30",
      durationMinutes: 600,
      notes: "Isolation and board strip-out",
      billingStatus: "BILLED",
      hourlyRateCentsSnapshot: 11000
    }
  });

  const sentEntryB = await prisma.timeEntry.create({
    data: {
      projectId: switchboards.id,
      date: d("2026-06-02"),
      durationMinutes: 510,
      notes: "Fit-off and testing",
      billingStatus: "BILLED",
      hourlyRateCentsSnapshot: 11000
    }
  });

  await prisma.timeEntry.createMany({
    data: [
      {
        projectId: bathroom.id,
        date: d("2026-06-10"),
        startTime: "07:00",
        endTime: "15:15",
        durationMinutes: 495,
        notes: "Demo and waterproof prep",
        hourlyRateCentsSnapshot: 9800
      },
      {
        projectId: bathroom.id,
        date: d("2026-06-11"),
        durationMinutes: 435,
        notes: "Wall framing and niche",
        hourlyRateCentsSnapshot: 9800
      },
      {
        projectId: alfresco.id,
        date: d("2026-06-12"),
        durationMinutes: 300,
        notes: "Final trim list",
        hourlyRateCentsSnapshot: 9500
      }
    ]
  });

  const paidExpense = await prisma.expenseItem.create({
    data: {
      projectId: alfresco.id,
      datePurchased: d("2026-05-04"),
      description: "Deck screws",
      quantity: 2,
      unitCostCents: 3200,
      totalCostCents: 6400,
      notes: "Stainless, 10g",
      billingStatus: "BILLED"
    }
  });

  await prisma.expenseItem.create({
    data: {
      projectId: switchboards.id,
      datePurchased: d("2026-06-01"),
      description: "Cable glands",
      quantity: 10,
      unitCostCents: 480,
      totalCostCents: 4800,
      billingStatus: "BILLED"
    }
  });

  await prisma.expenseItem.createMany({
    data: [
      {
        projectId: bathroom.id,
        datePurchased: d("2026-06-10"),
        description: "Waterproofing membrane",
        quantity: 1,
        unitCostCents: 18900,
        totalCostCents: 18900,
        notes: "20L pail"
      },
      {
        projectId: alfresco.id,
        datePurchased: d("2026-06-12"),
        description: "Silicone and fixings",
        quantity: 3,
        unitCostCents: 1450,
        totalCostCents: 4350
      }
    ]
  });

  const paidInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-0001",
      projectId: alfresco.id,
      clientId: coastal.id,
      invoiceDate: d("2026-05-06"),
      dateRangeStart: d("2026-05-04"),
      dateRangeEnd: d("2026-05-05"),
      status: "PAID",
      totalHours: 15,
      labourTotalCents: 142500,
      itemTotalCents: 6400,
      grandTotalCents: 148900,
      paymentDate: d("2026-05-13"),
      summary: "2 labour days and 1 expense item.",
      lineItems: {
        create: [
          {
            timeEntryId: paidEntryA.id,
            type: "LABOUR",
            description: "Labour - Alfresco Fitout",
            date: d("2026-05-04"),
            hoursMinutes: 480,
            unitAmountCents: 9500,
            totalAmountCents: 76000,
            notes: "Frame prep and material pickup",
            sortOrder: 1
          },
          {
            timeEntryId: paidEntryB.id,
            type: "LABOUR",
            description: "Labour - Alfresco Fitout",
            date: d("2026-05-05"),
            hoursMinutes: 420,
            unitAmountCents: 9500,
            totalAmountCents: 66500,
            notes: "Deck boards and setout",
            sortOrder: 2
          },
          {
            expenseItemId: paidExpense.id,
            type: "EXPENSE",
            description: "Deck screws",
            date: d("2026-05-04"),
            quantity: 2,
            unitAmountCents: 3200,
            totalAmountCents: 6400,
            notes: "Stainless, 10g",
            sortOrder: 3
          }
        ]
      }
    }
  });

  await prisma.timeEntry.updateMany({
    where: { id: { in: [paidEntryA.id, paidEntryB.id] } },
    data: { invoiceId: paidInvoice.id }
  });
  await prisma.expenseItem.update({
    where: { id: paidExpense.id },
    data: { invoiceId: paidInvoice.id }
  });

  const sentInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-0002",
      projectId: switchboards.id,
      clientId: ridge.id,
      invoiceDate: d("2026-06-03"),
      dateRangeStart: d("2026-06-01"),
      dateRangeEnd: d("2026-06-02"),
      status: "SENT",
      totalHours: 18.5,
      labourTotalCents: 203500,
      itemTotalCents: 4800,
      grandTotalCents: 208300,
      summary: "2 labour days and 1 expense item.",
      lineItems: {
        create: [
          {
            timeEntryId: sentEntryA.id,
            type: "LABOUR",
            description: "Labour - Switchboard Upgrade",
            date: d("2026-06-01"),
            hoursMinutes: 600,
            unitAmountCents: 11000,
            totalAmountCents: 110000,
            notes: "Isolation and board strip-out",
            sortOrder: 1
          },
          {
            timeEntryId: sentEntryB.id,
            type: "LABOUR",
            description: "Labour - Switchboard Upgrade",
            date: d("2026-06-02"),
            hoursMinutes: 510,
            unitAmountCents: 11000,
            totalAmountCents: 93500,
            notes: "Fit-off and testing",
            sortOrder: 2
          },
          {
            type: "EXPENSE",
            description: "Cable glands",
            date: d("2026-06-01"),
            quantity: 10,
            unitAmountCents: 480,
            totalAmountCents: 4800,
            sortOrder: 3
          }
        ]
      }
    }
  });

  await prisma.timeEntry.updateMany({
    where: { id: { in: [sentEntryA.id, sentEntryB.id] } },
    data: { invoiceId: sentInvoice.id }
  });
  await prisma.expenseItem.updateMany({
    where: { projectId: switchboards.id, billingStatus: "BILLED" },
    data: { invoiceId: sentInvoice.id }
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-0003",
      projectId: bathroom.id,
      clientId: coastal.id,
      invoiceDate: d("2026-06-12"),
      dateRangeStart: d("2026-06-10"),
      dateRangeEnd: d("2026-06-11"),
      status: "DRAFT",
      totalHours: 15.5,
      labourTotalCents: 151900,
      itemTotalCents: 18900,
      grandTotalCents: 170800,
      summary: "Draft only. Source entries remain unbilled until finalised.",
      lineItems: {
        create: [
          {
            type: "LABOUR",
            description: "Labour - Bathroom Renovation",
            date: d("2026-06-10"),
            hoursMinutes: 495,
            unitAmountCents: 9800,
            totalAmountCents: 80850,
            notes: "Demo and waterproof prep",
            sortOrder: 1
          },
          {
            type: "LABOUR",
            description: "Labour - Bathroom Renovation",
            date: d("2026-06-11"),
            hoursMinutes: 435,
            unitAmountCents: 9800,
            totalAmountCents: 71050,
            notes: "Wall framing and niche",
            sortOrder: 2
          },
          {
            type: "EXPENSE",
            description: "Waterproofing membrane",
            date: d("2026-06-10"),
            quantity: 1,
            unitAmountCents: 18900,
            totalAmountCents: 18900,
            notes: "20L pail",
            sortOrder: 3
          }
        ]
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
