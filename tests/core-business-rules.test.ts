import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { parseInputDate, todayInputValue } from "../src/lib/dates";
import { nextInvoiceNumberFromExisting } from "../src/lib/invoice-numbers";
import { canShareInvoicePublicly } from "../src/lib/invoice-sharing";
import { invoiceTotals } from "../src/lib/invoices";
import { dollarsToCents } from "../src/lib/money";
import { labourTotalCents, parseClockTime } from "../src/lib/time";
import { normaliseRgbValue } from "../src/lib/themes";
import { isStaleRefreshTokenError, isSupabaseAuthCookie } from "../src/lib/supabase/auth-cookies";
import { canSkipSessionLookup } from "../src/lib/supabase/middleware-routes";
import { safeInternalPath } from "../src/lib/navigation";
import { absoluteAppUrl, resolveAppBaseUrl } from "../src/lib/app-url";
import { outboundDeliveryAllowed } from "../src/lib/delivery-policy";
import { invoiceSenderDisplayName } from "../src/lib/platform";
import { tutorialByKey, tutorialCategories, tutorials } from "../src/lib/tutorials";

test("currency input is converted to integer cents without silent truncation", () => {
  assert.equal(dollarsToCents("$1,234.50"), 123450);
  assert.equal(dollarsToCents(".75"), 75);
  assert.equal(dollarsToCents("-12.05"), -1205);
  assert.equal(dollarsToCents("12.345"), 0);
  assert.equal(dollarsToCents("12abc"), 0);
  assert.equal(dollarsToCents("1e3"), 0);
});

test("date input rejects impossible or loosely formatted dates", () => {
  assert.equal(parseInputDate("2028-02-29").toISOString(), "2028-02-29T00:00:00.000Z");
  assert.throws(() => parseInputDate("2026-02-29"), /valid date/i);
  assert.throws(() => parseInputDate("2026-04-31"), /valid date/i);
  assert.throws(() => parseInputDate("16/07/2026"), /valid date/i);
});

test("clock input requires an exact 24-hour time", () => {
  assert.equal(parseClockTime("07:30"), 450);
  assert.equal(parseClockTime("23:45"), 1425);
  assert.equal(parseClockTime("7:30"), null);
  assert.equal(parseClockTime("07:30:00"), null);
  assert.equal(parseClockTime("24:00"), null);
});

test("legacy theme values cannot inject arbitrary CSS", () => {
  assert.equal(normaliseRgbValue("12 34 56", "1 2 3"), "12 34 56");
  assert.equal(normaliseRgbValue("300 34 56", "1 2 3"), "1 2 3");
  assert.equal(normaliseRgbValue("1 2 3;} body{display:none", "4 5 6"), "4 5 6");
});

test("stale Supabase refresh sessions are recognised and scoped cookies are removable", () => {
  assert.equal(isStaleRefreshTokenError({ code: "refresh_token_not_found" }), true);
  assert.equal(isStaleRefreshTokenError(new Error("Invalid Refresh Token: Refresh Token Not Found")), true);
  assert.equal(isStaleRefreshTokenError({ code: "email_not_confirmed" }), false);
  assert.equal(isSupabaseAuthCookie("sb-exampleproject-auth-token"), true);
  assert.equal(isSupabaseAuthCookie("sb-exampleproject-auth-token.1"), true);
  assert.equal(isSupabaseAuthCookie("unrelated-session"), false);
});

test("platform URLs are environment-driven and never fall back to a personal domain", () => {
  assert.equal(resolveAppBaseUrl({ APP_BASE_URL: "https://app.example.com/", NODE_ENV: "production" }), "https://app.example.com");
  assert.equal(resolveAppBaseUrl({ VERCEL_URL: "preview.example.vercel.app", NODE_ENV: "production" }), "https://preview.example.vercel.app");
  assert.equal(resolveAppBaseUrl({ NODE_ENV: "production" }), null);
  assert.equal(resolveAppBaseUrl({ APP_BASE_URL: "https://app.example.com/path", NODE_ENV: "production" }), null);
  assert.equal(absoluteAppUrl("/team/join", { APP_BASE_URL: "https://app.example.com", NODE_ENV: "production" }), "https://app.example.com/team/join");
});

test("invoice sender identity separates the platform address from the tenant business", () => {
  assert.equal(invoiceSenderDisplayName("Example Electrical"), "Example Electrical via Trade Invoice Tracker");
});

test("real outbound delivery is blocked outside production unless deliberately enabled", () => {
  assert.equal(outboundDeliveryAllowed({ VERCEL_ENV: "production" }), true);
  assert.equal(outboundDeliveryAllowed({ VERCEL_ENV: "preview" }), false);
  assert.equal(outboundDeliveryAllowed({ VERCEL_ENV: "preview", ALLOW_NON_PRODUCTION_DELIVERY: "true" }), true);
});

test("public routes skip remote session lookups while protected routes do not", () => {
  assert.equal(canSkipSessionLookup("/public/invoices/example-token"), true);
  assert.equal(canSkipSessionLookup("/public/invoices/example-token/pdf"), true);
  assert.equal(canSkipSessionLookup("/auth/callback"), true);
  assert.equal(canSkipSessionLookup("/forgot-password"), true);
  assert.equal(canSkipSessionLookup("/sw.js"), true);
  assert.equal(canSkipSessionLookup("/login"), false);
  assert.equal(canSkipSessionLookup("/projects"), false);
  assert.equal(canSkipSessionLookup("/reset-password"), false);
});

test("draft invoices can be shared without changing delivery status", () => {
  assert.equal(canShareInvoicePublicly("DRAFT"), true);
  assert.equal(canShareInvoicePublicly("SENT"), true);
  assert.equal(canShareInvoicePublicly("PAID"), true);
  assert.equal(canShareInvoicePublicly("VOID"), false);
});

test("internal return paths cannot redirect to another origin", () => {
  assert.equal(safeInternalPath("/projects/123?tab=hours"), "/projects/123?tab=hours");
  assert.equal(safeInternalPath("//malicious.example/path"), "/");
  assert.equal(safeInternalPath("/\\malicious.example/path"), "/");
  assert.equal(safeInternalPath("https://malicious.example/path"), "/");
  assert.equal(safeInternalPath(null, "/onboarding"), "/onboarding");
});

test("tutorial catalogue has stable unique keys and complete learning content", () => {
  assert.equal(new Set(tutorials.map((tutorial) => tutorial.key)).size, tutorials.length);
  assert.ok(tutorials.length >= 15);
  assert.ok(tutorials.every((tutorial) => tutorialCategories.includes(tutorial.category)));
  assert.ok(tutorials.every((tutorial) => tutorial.steps.length >= 3));
  assert.ok(tutorials.every((tutorial) => tutorial.demoFrames.length >= 3));
  assert.equal(tutorialByKey("workflow-overview")?.category, "Getting Started");
  assert.equal(tutorialByKey("team-setup")?.employersOnly, true);
});

test("today defaults to the Australia/Perth calendar date", () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const expected = ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");

  assert.equal(todayInputValue(), expected);
});

test("invoice numbering advances from the highest sequence and ignores gaps", () => {
  assert.equal(
    nextInvoiceNumberFromExisting(["INV-2026-0001", "INV-2026-0003"], "INV-", 2026),
    "INV-2026-0004"
  );
  assert.equal(
    nextInvoiceNumberFromExisting(["QUOTE-2026-9999", "INV-2025-0010"], "INV-", 2026),
    "INV-2026-0001"
  );
  assert.equal(nextInvoiceNumberFromExisting(["INV-2026-0004"], "INV-", 2026, 1), "INV-2026-0006");
});

test("labour and GST totals stay in integer cents", () => {
  assert.equal(labourTotalCents(75, 9550), 11938);

  const totals = invoiceTotals(
    [
      {
        id: "time-1",
        date: new Date("2026-07-16T00:00:00.000Z"),
        durationMinutes: 75,
        notes: null,
        hourlyRateCentsSnapshot: 9550,
        workerDisplayNameSnapshot: null,
        teamMemberId: null,
        payRateCentsSnapshot: null
      }
    ],
    [
      {
        id: "expense-1",
        datePurchased: new Date("2026-07-16T00:00:00.000Z"),
        description: "Materials",
        quantity: new Prisma.Decimal(1),
        unitCostCents: 1062,
        totalCostCents: 1062,
        notes: null
      }
    ],
    { registered: true, rate: 10 }
  );

  assert.deepEqual(
    {
      labour: totals.labourTotalCents,
      expenses: totals.itemTotalCents,
      subtotal: totals.subtotalCents,
      gst: totals.gstCents,
      total: totals.grandTotalCents
    },
    { labour: 11938, expenses: 1062, subtotal: 13000, gst: 1300, total: 14300 }
  );
});
