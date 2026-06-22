import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaInitCount?: number;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaInitCount = (globalForPrisma.prismaInitCount ?? 0) + 1;
}

export function prismaRuntimeDiagnostics() {
  return {
    initCount: globalForPrisma.prismaInitCount ?? 0,
    clientReused: globalForPrisma.prisma === prisma
  };
}
