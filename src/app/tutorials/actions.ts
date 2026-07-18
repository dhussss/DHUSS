"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tutorialByKey } from "@/lib/tutorials";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function tutorialInput(formData: FormData) {
  const tutorialKey = text(formData, "tutorialKey");
  const tutorial = tutorialByKey(tutorialKey);
  if (!tutorial) throw new Error("That tutorial is no longer available.");

  const requestedStep = Number(text(formData, "currentStep") || "0");
  const currentStep = Number.isInteger(requestedStep)
    ? Math.max(0, Math.min(requestedStep, tutorial.steps.length - 1))
    : 0;

  return { tutorialKey, currentStep };
}

export async function saveTutorialProgressAction(formData: FormData) {
  const ownerId = await requireUserId();
  const { tutorialKey, currentStep } = tutorialInput(formData);

  await prisma.tutorialProgress.upsert({
    where: { ownerId_tutorialKey: { ownerId, tutorialKey } },
    create: { ownerId, tutorialKey, currentStep, status: "IN_PROGRESS" },
    update: { currentStep, status: "IN_PROGRESS", completedAt: null }
  });

  revalidatePath("/tutorials");
}

export async function completeTutorialAction(formData: FormData) {
  const ownerId = await requireUserId();
  const { tutorialKey, currentStep } = tutorialInput(formData);

  await prisma.tutorialProgress.upsert({
    where: { ownerId_tutorialKey: { ownerId, tutorialKey } },
    create: { ownerId, tutorialKey, currentStep, status: "COMPLETED", completedAt: new Date() },
    update: { currentStep, status: "COMPLETED", completedAt: new Date() }
  });

  revalidatePath("/tutorials");
}

export async function restartTutorialAction(formData: FormData) {
  const ownerId = await requireUserId();
  const { tutorialKey } = tutorialInput(formData);

  await prisma.tutorialProgress.upsert({
    where: { ownerId_tutorialKey: { ownerId, tutorialKey } },
    create: { ownerId, tutorialKey, currentStep: 0, status: "IN_PROGRESS" },
    update: { currentStep: 0, status: "IN_PROGRESS", completedAt: null, startedAt: new Date() }
  });

  revalidatePath("/tutorials");
}
