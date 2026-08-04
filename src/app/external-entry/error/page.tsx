import { ArrowRight, RefreshCw, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const reasonContent: Record<string, { title: string; message: string; detail: string; action: string }> = {
  "not-configured": {
    title: "External access is not configured",
    message: "This FeedApp environment is not ready to accept trusted dashboard links.",
    detail: "Ask a platform administrator to configure external entry before trying again.",
    action: "Go to FeedApp login"
  },
  "missing-token": {
    title: "Access link is incomplete",
    message: "The dashboard link did not include the secure token FeedApp needs.",
    detail: "Open FeedApp again from the product dashboard so it can generate a fresh link.",
    action: "Go to FeedApp login"
  },
  "invalid-token": {
    title: "Access link could not be verified",
    message: "FeedApp could not verify the trusted dashboard link.",
    detail: "Open FeedApp again from the product dashboard or sign in directly if you have FeedApp credentials.",
    action: "Go to FeedApp login"
  },
  "expired-token": {
    title: "This secure link has expired",
    message: "Trusted dashboard links are short-lived to protect customer feedback data.",
    detail: "Return to your product dashboard and open the Feedback tab again to get a fresh session.",
    action: "Continue to FeedApp login"
  },
  "issuer-mismatch": {
    title: "Dashboard source is not trusted",
    message: "The system that created this link is not an approved FeedApp entry source.",
    detail: "Use an approved product dashboard or contact a platform administrator.",
    action: "Go to FeedApp login"
  },
  "source-not-allowed": {
    title: "Product scope is not allowed",
    message: "This trusted link requested a product scope FeedApp does not allow.",
    detail: "Open FeedApp from the correct product dashboard or contact a platform administrator.",
    action: "Go to FeedApp login"
  },
  "user-not-found": {
    title: "FeedApp account not found",
    message: "Your product dashboard identity does not match a FeedApp user.",
    detail: "Ask a FeedApp administrator to provision your account and product access.",
    action: "Go to FeedApp login"
  },
  "user-not-provisioned": {
    title: "FeedApp access is not active",
    message: "Your account exists, but it is not currently provisioned for FeedApp.",
    detail: "Ask a FeedApp administrator to activate your access.",
    action: "Go to FeedApp login"
  },
  "password-change-required": {
    title: "Account activation required",
    message: "You need to activate your FeedApp account before using trusted dashboard entry.",
    detail: "Sign in directly and create your password, then return to the product dashboard.",
    action: "Activate account"
  },
  "user-source-denied": {
    title: "Product access unavailable",
    message: "Your FeedApp account is not scoped to the product requested by this link.",
    detail: "Ask a FeedApp administrator or product manager to review your product access.",
    action: "Go to FeedApp login"
  }
};

export default async function ExternalEntryErrorPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const reason = Array.isArray(resolvedSearchParams.reason) ? resolvedSearchParams.reason[0] : resolvedSearchParams.reason;
  const content = reasonContent[reason ?? ""] ?? {
    title: "Trusted entry was blocked",
    message: "The external entry link could not be used.",
    detail: "Open FeedApp again from the product dashboard or sign in directly if you have FeedApp credentials.",
    action: "Go to FeedApp login"
  };
  const isExpired = reason === "expired-token";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <section className="w-full max-w-[520px] overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
        <div className="flex items-center justify-between border-b border-line bg-panel-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Image src="/feedapp-icon.png" alt="" width={32} height={32} aria-hidden="true" className="h-8 w-8" />
            <div>
              <div className="text-sm font-semibold text-ink">FeedApp</div>
              <div className="text-xs text-muted">Trusted dashboard entry</div>
            </div>
          </div>
          <div className="flex size-10 items-center justify-center rounded-md bg-warning-bg text-warning">
            {isExpired ? <RefreshCw size={18} aria-hidden="true" /> : <ShieldAlert size={18} aria-hidden="true" />}
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">Access check</div>
            <h1 className="mt-2 text-2xl font-semibold text-ink">{content.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{content.message}</p>
          </div>

          <div className="rounded-md border border-line bg-panel-subtle px-4 py-3 text-sm leading-6 text-muted">
            {content.detail}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              {content.action}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/external-entry/error"
              className="inline-flex items-center justify-center rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
            >
              View access help
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
