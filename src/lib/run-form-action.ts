import { unstable_rethrow } from "next/navigation";
import { publicFormError, UserInputError, type FormActionResult } from "@/lib/form-feedback";

export async function runFormAction(action: () => Promise<unknown>): Promise<FormActionResult> {
  try {
    await action();
    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof UserInputError)) console.error("Form action failed", error);
    return { error: publicFormError(error) };
  }
}
