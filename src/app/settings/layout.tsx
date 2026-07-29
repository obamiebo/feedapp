import type { Route } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Activity, Boxes, ClipboardList, LayoutGrid, MessageSquare, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { EmptyState } from "@/components/empty-state";
import { canEnterApplication } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { visibleSettingsHrefs, type SettingsHref } from "@/lib/settings-access";

export const dynamic = "force-dynamic";

const SETTINGS_NAV_ITEMS: Array<{ href: SettingsHref; label: string; icon: ReactNode }> = [
  { href: "/settings", label: "Overview", icon: <LayoutGrid size={15} aria-hidden="true" /> },
  { href: "/settings/team", label: "Team & access", icon: <UsersRound size={15} aria-hidden="true" /> },
  { href: "/settings/products", label: "Products", icon: <Boxes size={15} aria-hidden="true" /> },
  { href: "/settings/messaging", label: "Messaging", icon: <MessageSquare size={15} aria-hidden="true" /> },
  { href: "/settings/operations", label: "Operations", icon: <Activity size={15} aria-hidden="true" /> },
  { href: "/settings/audit", label: "Audit", icon: <ClipboardList size={15} aria-hidden="true" /> }
];

function visibleSettingsNavItems(currentUser: Parameters<typeof visibleSettingsHrefs>[0]) {
  const visibleHrefs = new Set(visibleSettingsHrefs(currentUser, SETTINGS_NAV_ITEMS.map((item) => item.href)));
  return SETTINGS_NAV_ITEMS.filter((item) => visibleHrefs.has(item.href));
}

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.passwordMustChange) {
    redirect("/change-password");
  }

  if (!canEnterApplication(currentUser)) {
    return (
      <AppShell active="settings" currentUser={currentUser}>
        <PageHeader
          breadcrumbHref={"/" as Route}
          breadcrumbLabel="Back to cases"
          eyebrow="Account and platform settings"
          title="Settings"
        />
        <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
          <EmptyState icon={UsersRound} message="This user is not provisioned for application access." />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell active="settings" currentUser={currentUser}>
      <PageHeader
        breadcrumbHref={"/" as Route}
        breadcrumbLabel="Back to cases"
        eyebrow="Account and platform settings"
        title="Settings"
      />
      <div className="mb-6">
        <SegmentedNav items={visibleSettingsNavItems(currentUser)} />
      </div>
      {children}
    </AppShell>
  );
}
