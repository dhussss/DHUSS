import assert from "node:assert/strict";
import test from "node:test";
import { invoiceBusinessDetails, invoiceClientDetails } from "../src/lib/invoice-data";
import { publicFormError, redirectFormResult, UserInputError } from "../src/lib/form-feedback";

test("issued invoices retain deliberately empty contact snapshots", () => {
  const invoice = {
    status: "SENT",
    businessNameSnapshot: "Original business",
    businessEmailSnapshot: null,
    businessGstRegisteredSnapshot: false,
    businessGstRateSnapshot: 0,
    clientBusinessNameSnapshot: "Original client",
    clientEmailSnapshot: null,
    clientPhoneSnapshot: null,
    client: { businessName: "Updated client", email: "updated@example.com", phone: "0400000000" }
  } as Parameters<typeof invoiceBusinessDetails>[0];
  const profile = {
    tradingName: "Updated business", email: "new@example.com", gstRegistered: true, gstRate: 10
  } as NonNullable<Parameters<typeof invoiceBusinessDetails>[1]>;
  const business = invoiceBusinessDetails(invoice, profile);
  const client = invoiceClientDetails(invoice);
  assert.equal(business.name, "Original business");
  assert.equal(business.email, null);
  assert.equal(business.gstRegistered, false);
  assert.equal(client.businessName, "Original client");
  assert.equal(client.email, null);
  assert.equal(client.phone, null);
  assert.equal(invoiceClientDetails({ ...invoice, status: "DRAFT" }).email, "updated@example.com");
  assert.equal(invoiceBusinessDetails({ ...invoice, status: "DRAFT" }, profile).email, "new@example.com");
});

test("form validation stays useful without exposing unexpected server errors", () => {
  assert.equal(publicFormError(new UserInputError("Choose an active project.")), "Choose an active project.");
  const result = publicFormError(new Error("Database failure containing private connection details"));
  assert.match(result, /Your details are still here/);
  assert.doesNotMatch(result, /private connection/);
});

test("redirect form results accept only internal Next redirects", () => {
  const internal = Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;push;/team/member?paid=1;303;" });
  const external = Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;replace;https://example.com;307;" });
  const protocolRelative = Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;push;//example.com;303;" });

  assert.deepEqual(redirectFormResult(internal), {
    success: true,
    redirectTo: "/team/member?paid=1",
    redirectType: "push"
  });
  assert.equal(redirectFormResult(external), null);
  assert.equal(redirectFormResult(protocolRelative), null);
  assert.equal(redirectFormResult(new Error("ordinary failure")), null);
});
