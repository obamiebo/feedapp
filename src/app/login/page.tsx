import { LockKeyhole } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PasswordInput } from "@/components/ui/password-input";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { resolveCurrentUser } from "@/lib/current-user";
import { clearEntryContext, setSessionCookie } from "@/lib/session-cookie";
import { createAuthService } from "@/services/auth";

export const dynamic = "force-dynamic";

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await createAuthService().authenticate(email, password);

  if (!result.ok) {
    redirect("/login?error=invalid");
  }

  await setSessionCookie(result.token, result.expiresAt);
  await clearEntryContext();

  if (result.user.passwordMustChange) {
    redirect("/change-password");
  }

  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const currentUser = await resolveCurrentUser();
  const resolvedSearchParams = await searchParams;
  const error = Array.isArray(resolvedSearchParams.error) ? resolvedSearchParams.error[0] : resolvedSearchParams.error;

  if (currentUser) {
    redirect(currentUser.passwordMustChange ? "/change-password" : "/");
  }

  const inputClass =
    "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <section className="flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-line bg-panel p-6 shadow-lg">
        <Image src="/feedapp-icon.png" alt="FeedApp" width={44} height={44} priority className="h-11 w-11" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">Staff access</div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Sign in</h1>
        </div>
        {error === "invalid" ? (
          <EmptyState icon={LockKeyhole} message="The email or password is incorrect." />
        ) : null}
        <form action={loginAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="email">
            Email
            <input autoComplete="email" id="email" name="email" type="email" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="password">
            Password
            <PasswordInput
              autoComplete="current-password"
              id="password"
              name="password"
              required
              className={inputClass}
            />
          </label>
          <PendingSubmitButton
            className="mt-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-80"
            pendingChildren="Signing in..."
          >
            Sign in
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
