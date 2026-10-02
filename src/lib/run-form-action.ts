import { unstable_rethrow } from "next/navigation";
import { publicFormError, redirectFormResult, UserInputError, type FormActionResult } from "@/lib/form-feedback";
import { collectRevalidation } from "@/lib/deferred-revalidation";

export async function runFormAction(action: () => Promise<unknown>): Promise<FormActionResult> {
  const execution = await collectRevalidation(action);
  if (!("error" in execution)) return { success: true, revalidation: execution.revalidation };

  const error = execution.error;
  const redirect = redirectFormResult(error);
  if (redirect) return { ...redirect, revalidation: execution.revalidation };
  unstable_rethrow(error);
  if (!(error instanceof UserInputError)) console.error("Form action failed", error);
  return { error: publicFormError(error) };
}
