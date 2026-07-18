import packageJson from "../../package.json";

function buildChannel() {
  const explicitChannel = process.env.NEXT_PUBLIC_BUILD_CHANNEL?.trim();
  if (explicitChannel) return explicitChannel;

  const isVercelDevelopment = Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production");
  const isLocalDevelopment = !process.env.VERCEL_ENV && process.env.NODE_ENV !== "production";

  if (isVercelDevelopment || isLocalDevelopment) {
    return "Development Build";
  }

  return "Approved Build";
}

function buildVersion() {
  return process.env.NEXT_PUBLIC_APP_VERSION?.trim() || packageJson.version;
}

export function BuildIndicator() {
  const channel = buildChannel();
  const version = buildVersion();

  return (
    <div className="pointer-events-none fixed bottom-2 right-3 z-30 hidden rounded-full border border-line/80 bg-white/90 px-2.5 py-1 text-[0.64rem] font-semibold text-moss shadow-sm backdrop-blur sm:block">
      {channel} v{version}
    </div>
  );
}
