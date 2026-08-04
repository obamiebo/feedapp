import { LockKeyhole } from "lucide-react";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PasswordInput } from "@/components/ui/password-input";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { resolveCurrentUser } from "@/lib/current-user";
import { clearEntryContext, getSessionToken, setSessionCookie } from "@/lib/session-cookie";
import { createAuthService } from "@/services/auth";

export const dynamic = "force-dynamic";

async function changePasswordAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const nextPassword = String(formData.get("nextPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentUser) {
    redirect("/login");
  }

  if (nextPassword !== confirmPassword) {
    redirect("/change-password?error=mismatch");
  }

  const authService = createAuthService();

  try {
    await authService.changePassword(currentUser.id, currentPassword, nextPassword);
  } catch {
    redirect("/change-password?error=invalid");
  }

  const currentToken = await getSessionToken();

  if (currentToken) {
    await authService.revokeSession(currentToken);
  }

  const nextSession = await authService.createSession(currentUser.id);
  await setSessionCookie(nextSession.token, nextSession.expiresAt);
  await clearEntryContext();
  revalidatePath("/", "layout");
  revalidatePath("/change-password");

  redirect("/");
}

export default async function ChangePasswordPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await resolveCurrentUser();
  const resolvedSearchParams = await searchParams;
  const error = Array.isArray(resolvedSearchParams.error) ? resolvedSearchParams.error[0] : resolvedSearchParams.error;
  const isTemporaryPassword = currentUser?.passwordMustChange ?? false;

  if (!currentUser) {
    redirect("/login");
  }

  const inputClass =
    "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <section className="flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-line bg-panel p-6 shadow-lg">
        <Image src="/feedapp-icon.png" alt="FeedApp" width={44} height={44} priority className="h-11 w-11" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            {isTemporaryPassword ? "First sign-in" : "Account security"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {isTemporaryPassword ? "Create your password" : "Change password"}
          </h1>
        </div>
        {isTemporaryPassword ? (
          <div className="rounded-md border border-info/20 bg-info-bg px-3 py-3 text-sm font-medium leading-snug text-info">
            Your temporary password can only be used to activate your account. Choose a new password before continuing.
          </div>
        ) : null}
        {error ? (
          <EmptyState
            icon={LockKeyhole}
            message={
              error === "mismatch"
                ? "The new passwords do not match."
                : "Check your current password and choose a new password of at least 10 characters."
            }
          />
        ) : null}
        <form action={changePasswordAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="currentPassword">
            Current password
            <PasswordInput
              autoComplete="current-password"
              id="currentPassword"
              name="currentPassword"
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="nextPassword">
            New password
            <PasswordInput
              autoComplete="new-password"
              id="nextPassword"
              minLength={10}
              name="nextPassword"
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="confirmPassword">
            Confirm new password
            <PasswordInput
              autoComplete="new-password"
              id="confirmPassword"
              minLength={10}
              name="confirmPassword"
              required
              className={inputClass}
            />
          </label>
          <PendingSubmitButton
            className="mt-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-80"
            pendingChildren={isTemporaryPassword ? "Activating..." : "Saving..."}
          >
            {isTemporaryPassword ? "Activate account" : "Save password"}
          </PendingSubmitButton>
        </form>
        <div className="flex items-center justify-center gap-1.5 border-t border-line pt-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Powered by</span>
          <Image src="/itc-logo.png" alt="IT Consortium" width={78} height={21} className="h-auto w-[78px]" />
        </div>
      </section>
    </main>
  );
}
