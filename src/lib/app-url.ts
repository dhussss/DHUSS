type AppUrlEnvironment = {
  APP_BASE_URL?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

function validOrigin(value: string | undefined) {
  const candidate = value?.trim().replace(/\/$/, "");
  if (!candidate) return null;

  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveAppBaseUrl(environment: AppUrlEnvironment = process.env) {
  const configured = validOrigin(environment.APP_BASE_URL);
  if (configured) return configured;

  const vercelHost = environment.VERCEL_URL || environment.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelOrigin = validOrigin(vercelHost);
  if (vercelOrigin) return vercelOrigin;

  if (environment.NODE_ENV !== "production") return "http://localhost:3000";
  return null;
}

export function absoluteAppUrl(path: string, environment: AppUrlEnvironment = process.env) {
  const baseUrl = resolveAppBaseUrl(environment);
  if (!baseUrl) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl}/`).toString();
}

export function requirePublicAppUrl(path: string, environment: AppUrlEnvironment = process.env) {
  const url = absoluteAppUrl(path, environment);
  if (!url.startsWith("https://")) {
    throw new Error("A canonical HTTPS APP_BASE_URL is required for public invoice delivery.");
  }
  return url;
}
