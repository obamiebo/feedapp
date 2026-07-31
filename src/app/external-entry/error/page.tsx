import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

const reasonLabels: Record<string, string> = {
  "not-configured": "External entry is not configured for this environment.",
  "missing-token": "The external entry link is missing its access token.",
  "invalid-token": "The external entry link is invalid.",
  "expired-token": "The external entry link has expired.",
  "issuer-mismatch": "The external entry issuer is not trusted.",
  "source-not-allowed": "This external entry link is not allowed for the requested product.",
  "user-not-found": "This user has not been provisioned in FeedApp.",
  "user-not-provisioned": "This user is not currently provisioned for FeedApp.",
  "password-change-required": "This FeedApp user must activate their account before external entry can be used.",
  "user-source-denied": "This FeedApp user does not have access to the requested product."
};

export default async function ExternalEntryErrorPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const reason = Array.isArray(resolvedSearchParams.reason) ? resolvedSearchParams.reason[0] : resolvedSearchParams.reason;
  const message = reasonLabels[reason ?? ""] ?? "The external entry link could not be used.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <section className="flex w-full max-w-[440px] flex-col gap-4 rounded-lg border border-line bg-panel p-6 shadow-lg">
        <EmptyState icon={ShieldAlert} message={message} />
        <Link
          href="/login"
          className="rounded-md border border-line bg-panel px-3 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
        >
          Go to FeedApp login
        </Link>
      </section>
    </main>
  );
}
