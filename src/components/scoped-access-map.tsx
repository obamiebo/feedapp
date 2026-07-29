"use client";

import { useMemo, useState } from "react";
import { Boxes, ShieldCheck, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/ui/data-table";
import type { AdminRole, ScopedTeamDirectory, ScopedTeamProduct } from "@/services/admin";

function roleRank(roleName: string) {
  switch (roleName) {
    case "Admin":
      return 0;
    case "Product Manager":
      return 1;
    case "Customer Service":
      return 2;
    case "Product User":
      return 3;
    default:
      return 4;
  }
}

function formatRoles(roles: AdminRole[]) {
  return [...roles].sort((left, right) => roleRank(left.name) - roleRank(right.name)).map((role) => role.name);
}

function ScopedProductTeam({ product }: { product: ScopedTeamProduct }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-semibold text-ink">{product.name}</h3>
          <p className="mt-1 text-xs text-muted">{product.key}</p>
        </div>
        <StatusBadge label={`${product.access} access`} tone={product.access === "Direct" ? "info" : "neutral"} />
        {product.canManageRoster ? <StatusBadge label="Roster admin" tone="warning" /> : null}
      </div>
      <DataTable
        columns={[
          {
            key: "user",
            header: "User",
            render: (member) => (
              <div>
                <div className="font-medium text-ink">{member.name}</div>
                <div className="text-xs text-muted">{member.email}</div>
              </div>
            )
          },
          {
            key: "roles",
            header: "Role level",
            render: (member) => formatRoles(member.roles).join(", ") || "No role assigned"
          },
          {
            key: "access",
            header: "Access level",
            render: (member) => (
              <div className="flex flex-wrap gap-2">
                {member.direct ? <StatusBadge label="Direct" tone="info" /> : null}
                {member.groupDerived ? <StatusBadge label="Group" tone="neutral" /> : null}
                {member.rosterAdmin ? <StatusBadge label="Roster admin" tone="warning" /> : null}
              </div>
            )
          }
        ]}
        rows={product.members}
        getRowKey={(member) => member.id}
        emptyIcon={UsersRound}
        emptyMessage="No teammates are assigned to this product."
      />
    </div>
  );
}

export function ScopedAccessMap({ directory }: { directory: ScopedTeamDirectory }) {
  const [selectedProductId, setSelectedProductId] = useState(directory.products[0]?.id ?? "");
  const visibleProductCount = directory.products.length;
  const sharedMemberCount = useMemo(
    () => new Set(directory.products.flatMap((product) => product.members.map((member) => member.id))).size,
    [directory.products]
  );
  const selectedProduct = directory.products.find((product) => product.id === selectedProductId) ?? directory.products[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <ShieldCheck size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Your access</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Role level</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {formatRoles(directory.actor?.roles ?? []).map((role) => (
                <StatusBadge key={role} label={role} tone={role === "Product Manager" ? "warning" : "info"} />
              ))}
              {(directory.actor?.roles.length ?? 0) === 0 ? <span className="text-sm text-muted">No role assigned</span> : null}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Visible products</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{visibleProductCount}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Shared teammates</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{sharedMemberCount}</div>
          </div>
        </div>
      </section>

      {directory.productGroups.length > 0 ? (
        <section className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Boxes size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Product groups</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
            {directory.productGroups.map((group) => (
              <div key={group.id} className="rounded-md border border-line p-3">
                <div className="text-sm font-semibold text-ink">{group.name}</div>
                <div className="mt-1 text-xs text-muted">{group.productCount} products</div>
                {group.description ? <p className="mt-2 text-sm text-muted">{group.description}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <UsersRound size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Product teams</h2>
          </div>
          {directory.products.length > 0 ? (
            <label className="flex w-full flex-col gap-1 sm:w-80" htmlFor="scoped-product">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Product</span>
              <select
                id="scoped-product"
                value={selectedProduct?.id ?? ""}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {directory.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div>
          {selectedProduct ? (
            <ScopedProductTeam product={selectedProduct} />
          ) : (
            <EmptyState icon={UsersRound} message="No product access is assigned to this account." />
          )}
        </div>
      </section>
    </div>
  );
}
