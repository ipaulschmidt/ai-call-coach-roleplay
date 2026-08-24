// Remembers the rep's name + email across sessions so they don't have to retype
// them every time they start a roleplay.
const EMAIL_KEY = "rep.email";
const NAME_KEY = "rep.name";

export function getSavedRepEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getSavedRepName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRep(email: string, name: string) {
  if (typeof window === "undefined") return;
  try {
    const e = email.trim();
    const n = name.trim();
    if (e) window.localStorage.setItem(EMAIL_KEY, e);
    if (n) window.localStorage.setItem(NAME_KEY, n);
    else window.localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}
