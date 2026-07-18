import { resolveAppBaseUrl } from "../src/lib/app-url";
import { runtimeEnvironment } from "../src/lib/delivery-policy";

process.loadEnvFile?.(".env");

const errors: string[] = [];
const warnings: string[] = [];
const runtime = runtimeEnvironment(process.env);
const appUrl = resolveAppBaseUrl(process.env);

function required(name: string) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required.`);
}

required("DATABASE_URL");
required("DIRECT_URL");
required("NEXT_PUBLIC_SUPABASE_URL");
required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

if (process.env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) errors.push("DATABASE_URL must be a Postgres URL.");
if (process.env.DIRECT_URL && !/^postgres(ql)?:\/\//.test(process.env.DIRECT_URL)) errors.push("DIRECT_URL must be a Postgres URL.");
if (runtime === "production" && (!process.env.APP_BASE_URL?.trim() || !appUrl?.startsWith("https://"))) errors.push("Production requires an explicit canonical HTTPS APP_BASE_URL.");
if (runtime === "production" && process.env.ALLOW_DESTRUCTIVE_SEED === "true") errors.push("ALLOW_DESTRUCTIVE_SEED must never be enabled in production.");
if (runtime !== "production" && process.env.ALLOW_NON_PRODUCTION_DELIVERY === "true") warnings.push("Real outbound delivery is enabled outside production. Use controlled recipients only.");

const smtpConfiguredValues = [process.env.SMTP_HOST, process.env.SMTP_USER, process.env.SMTP_PASSWORD, process.env.INVOICE_FROM_EMAIL || process.env.SMTP_FROM_EMAIL];
const smtpConfiguredCount = smtpConfiguredValues.filter((value) => value?.trim()).length;
if (smtpConfiguredCount > 0 && smtpConfiguredCount < 4) errors.push("SMTP delivery is partially configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and INVOICE_FROM_EMAIL together.");
if (!process.env.INVOICE_FROM_EMAIL?.trim() && process.env.SMTP_FROM_EMAIL?.trim()) warnings.push("SMTP_FROM_EMAIL is a supported legacy fallback; migrate it to INVOICE_FROM_EMAIL.");

if (!process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()) warnings.push("NEXT_PUBLIC_SUPPORT_EMAIL is not configured; the public support page will show controlled-beta guidance.");
if (runtime === "production" && appUrl?.includes(".vercel.app")) warnings.push("Production still uses a Vercel hostname; configure the dedicated product domain before general rollout.");

console.log(JSON.stringify({ ok: errors.length === 0, runtime, appUrl, errors, warnings }, null, 2));
if (errors.length) process.exitCode = 1;
