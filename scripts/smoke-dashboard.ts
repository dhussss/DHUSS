import { prisma } from "../src/lib/prisma";
import { loadDashboardData } from "../src/lib/app-data";

async function main() {
  const owner = await prisma.project.findFirst({
    where: { ownerId: { not: null } },
    select: { ownerId: true },
    orderBy: { createdAt: "asc" }
  });

  if (!owner?.ownerId) {
    console.log("Dashboard smoke test skipped: no project owner exists in this database.");
    return;
  }

  const dashboard = await loadDashboardData(owner.ownerId);
  console.log(
    `Dashboard smoke test passed: ${dashboard.projects.length} active projects, ${dashboard.currentWeekEntryCount} current-week entries.`
  );
}

main()
  .catch((error) => {
    console.error("Dashboard smoke test failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
