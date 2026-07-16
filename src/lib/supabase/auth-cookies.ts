type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
};

export function isSupabaseAuthCookie(name: string) {
  return /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name);
}

export function isStaleRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as AuthErrorLike;
  const normalisedCode = typeof code === "string" ? code.toLowerCase() : "";
  const normalisedMessage = typeof message === "string" ? message.toLowerCase() : "";

  return (
    normalisedCode === "refresh_token_not_found" ||
    normalisedCode === "refresh_token_already_used" ||
    normalisedMessage.includes("refresh token not found") ||
    normalisedMessage.includes("invalid refresh token")
  );
}
