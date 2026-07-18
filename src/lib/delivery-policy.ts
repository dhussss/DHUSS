type DeliveryEnvironment = {
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  ALLOW_NON_PRODUCTION_DELIVERY?: string;
};

export function runtimeEnvironment(environment: DeliveryEnvironment = process.env) {
  if (environment.VERCEL_ENV) return environment.VERCEL_ENV;
  return environment.NODE_ENV === "production" ? "production" : "development";
}

export function outboundDeliveryAllowed(environment: DeliveryEnvironment = process.env) {
  return runtimeEnvironment(environment) === "production" || environment.ALLOW_NON_PRODUCTION_DELIVERY === "true";
}

export function assertOutboundDeliveryAllowed(environment: DeliveryEnvironment = process.env) {
  if (!outboundDeliveryAllowed(environment)) {
    throw new Error("Real invoice delivery is disabled outside production. Set ALLOW_NON_PRODUCTION_DELIVERY=true only for controlled provider testing.");
  }
}

