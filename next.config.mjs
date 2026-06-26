/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/invoices/[id]/pdf": ["./node_modules/pdfkit/js/data/**/*"]
  }
};

export default nextConfig;
