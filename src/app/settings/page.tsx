import { Activity, ArrowRight, Boxes, ClipboardList, KeyRound, MessageSquare, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { canEnterApplication, canManageAdmin } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { settingsCardDescriptionForUser, visibleSettingsHrefs, type SettingsHref } from "@/lib/settings-access";

export const dynamic = "force-dynamic";

const OVERVIEW_CARDS: Array<{ href: SettingsHref; icon: typeof UsersRound; title: string; description: string }> = [
  {
    href: "/settings/team",
    icon: UsersRound,
    title: "Team & access",
    description: "Create reps, assign roles, and manage product and product-group access."
  },
  {
    href: "/settings/products",
    icon: Boxes,
    title: "Products",
    description: "Manage product sources, product groups, and rotate integration secrets."
  },
  {
    href: "/settings/messaging",
    icon: MessageSquare,
    title: "Messaging",
    description: "Configure when cases prompt staff for customer follow-ups by status and priority."
  },
  {
    href: "/settings/operations",
    icon: Activity,
    title: "Operations",
    description: "Review failed customer message deliveries and retry outbound communication."
  },
  {
    href: "/settings/audit",
    icon: ClipboardList,
    title: "Audit",
    description: "Review security-sensitive user, product, case, and messaging events."
  }
];

function visibleOverviewCards(currentUser: Parameters<typeof visibleSettingsHrefs>[0]) {
  const visibleHrefs = new Set(visibleSettingsHrefs(currentUser, OVERVIEW_CARDS.map((card) => card.href)));
  return OVERVIEW_CARDS.filter((card) => visibleHrefs.has(card.href)).map((card) => ({
    ...card,
    description: settingsCardDescriptionForUser(currentUser, card.href, card.description)
  }));
}

export default async function SettingsOverviewPage() {
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!canEnterApplication(currentUser)) {
    return (
      <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
        <EmptyState icon={ShieldCheck} message="This user is not provisioned for application access." />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <KeyRound size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Profile</h2>
        </div>
        <dl className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Name</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{currentUser.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{currentUser.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Roles</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{currentUser.roles.join(", ") || "No role assigned"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Password</dt>
            <dd className="mt-1">
              <Link
                className="inline-flex items-center rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
                href="/change-password"
              >
                Change password
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Available settings">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          {canManageAdmin(currentUser) ? "Platform configuration" : "Available settings"}
        </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleOverviewCards(currentUser).map(({ href, icon: Icon, title, description }) => (
              <Link
                key={href}
                href={href as Route}
                className="group flex flex-col gap-3 rounded-lg border border-line bg-panel p-5 shadow-sm transition-colors hover:border-accent"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-brand/10 text-brand">
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    {title}
                    <ArrowRight
                      size={14}
                      className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted">{description}</p>
                </div>
              </Link>
            ))}
          </div>
      </section>
    </div>
  );
}
