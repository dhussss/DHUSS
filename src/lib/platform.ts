const DEFAULT_PRODUCT_NAME = "Trade Invoice Tracker";
const DEFAULT_SHORT_NAME = "Trade Tracker";
const DEFAULT_DESCRIPTION = "Work, expense, team and invoice tracking for Australian trade businesses.";

function publicValue(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function optionalPublicValue(value: string | undefined) {
  return value?.trim() || null;
}

export const platform = Object.freeze({
  name: publicValue(process.env.NEXT_PUBLIC_PRODUCT_NAME, DEFAULT_PRODUCT_NAME),
  shortName: publicValue(process.env.NEXT_PUBLIC_PRODUCT_SHORT_NAME, DEFAULT_SHORT_NAME),
  description: publicValue(process.env.NEXT_PUBLIC_PRODUCT_DESCRIPTION, DEFAULT_DESCRIPTION),
  supportEmail: optionalPublicValue(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  defaultLocale: "en-AU",
  defaultCurrency: "AUD"
});

export function invoiceSenderDisplayName(businessName: string) {
  return `${businessName} via ${platform.name}`;
}

