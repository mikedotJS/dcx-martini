import { createClient } from "@weirdscience/based-client";

export const based = createClient({
  url: import.meta.env.VITE_BASED_URL,
  anonKey: import.meta.env.VITE_BASED_ANON_KEY,
});

// Auto-auth against a single shared service account. No UI, no login screen —
// creds live in .env.local (and ship in the bundle). Trade-off accepted so
// writes (which Based requires a JWT for) work out of the box.
export async function ensureServiceSession() {
  await based.ready();
  if (based.getState().user) return;
  const email = import.meta.env.VITE_BASED_SERVICE_EMAIL;
  const password = import.meta.env.VITE_BASED_SERVICE_PASSWORD;
  try {
    await based.auth.signIn(email, password);
  } catch {
    await based.auth.signUp(email, password);
  }
}
