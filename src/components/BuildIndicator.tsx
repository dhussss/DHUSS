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
    <div className="pointer-events-none fixed right-2 top-[4.45rem] z-30 rounded-full border border-line/80 bg-white/90 px-2.5 py-1 text-[0.64rem] font-bold text-moss shadow-sm backdrop-blur md:bottom-2 md:right-3 md:top-auto">
      {channel} v{version}
    </div>
  );
}
