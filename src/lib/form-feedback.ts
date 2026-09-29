export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}

export type FormActionResult = { error?: string; success?: boolean };

export function publicFormError(error: unknown): string {
  if (error instanceof UserInputError) return error.message;
  return "We couldn't complete that request. Your details are still here. Please try again.";
}
