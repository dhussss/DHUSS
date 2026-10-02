export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}

export type FormActionResult = {
  error?: string;
  success?: boolean;
  redirectTo?: string;
  redirectType?: "push" | "replace";
  revalidation?: {
    paths: Array<{ path: string; type?: "layout" | "page" }>;
    tags: string[];
  };
};

export function redirectFormResult(error: unknown): FormActionResult | null {
  if (!(error instanceof Error) || !("digest" in error) || typeof error.digest !== "string") return null;

  const match = /^NEXT_REDIRECT;(push|replace);([^;]+);30[378];$/.exec(error.digest);
  if (!match) return null;

  const [, redirectType, redirectTo] = match;
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) return null;
  return { success: true, redirectTo, redirectType: redirectType as "push" | "replace" };
}

export function publicFormError(error: unknown): string {
  if (error instanceof UserInputError) return error.message;
  return "We couldn't complete that request. Your details are still here. Please try again.";
}
