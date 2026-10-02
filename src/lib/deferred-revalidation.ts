import { AsyncLocalStorage } from "node:async_hooks";
import { revalidatePath as immediateRevalidatePath, revalidateTag as immediateRevalidateTag } from "next/cache";

export type RevalidationRequest = {
  paths: Array<{ path: string; type?: "layout" | "page" }>;
  tags: string[];
};

type RevalidationExecution<T> = {
  value?: T;
  error?: unknown;
  revalidation: RevalidationRequest;
};

const collectors = new AsyncLocalStorage<RevalidationRequest>();

export async function collectRevalidation<T>(work: () => Promise<T>): Promise<RevalidationExecution<T>> {
  const revalidation: RevalidationRequest = { paths: [], tags: [] };
  try {
    const value = await collectors.run(revalidation, work);
    return { value, revalidation };
  } catch (error) {
    return { error, revalidation };
  }
}

export function revalidatePath(path: string, type?: "layout" | "page") {
  const collector = collectors.getStore();
  if (!collector) return immediateRevalidatePath(path, type);
  if (!collector.paths.some((entry) => entry.path === path && entry.type === type)) collector.paths.push({ path, type });
}

export function revalidateTag(tag: string) {
  const collector = collectors.getStore();
  if (!collector) return immediateRevalidateTag(tag);
  if (!collector.tags.includes(tag)) collector.tags.push(tag);
}
