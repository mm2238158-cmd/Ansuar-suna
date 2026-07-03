/** Normalize Ethiopian-style input to E.164 (+251...). */
export const normalizePhone = (phone: string): string => {
  const trimmed = phone.trim().replace(/\s/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("0")) return `+251${trimmed.slice(1)}`;
  return `+251${trimmed}`;
};

/** Basic E.164 validation (8–15 digits after country code). */
export const isValidE164 = (phone: string): boolean =>
  /^\+[1-9]\d{7,14}$/.test(phone);

export const RECAPTCHA_CONTAINER_ID = "recaptcha-container";
