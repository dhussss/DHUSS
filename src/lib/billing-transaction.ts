import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserInputError } from "@/lib/form-feedback";

// Retry the entire read/write operation, not just its final write.
export async function billingTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000
      });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (
        error.code === "P2034" ||
        (error.code === "P2002" && Array.isArray(error.meta?.target) && error.meta.target.includes("invoiceNumber"))
      );
      if (!retryable) throw error;
      if (attempt === 3) throw new UserInputError("This work was updated at the same time. Refresh and try again.");
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  throw new UserInputError("Unable to save this billing update. Please try again.");
}
