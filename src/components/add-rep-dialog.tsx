"use client";

import { useRef } from "react";
import { UserPlus, X } from "lucide-react";
import type { AdminProductGroup, AdminProductSource, AdminRole } from "@/services/admin";

type AddRepDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  roles: AdminRole[];
  productGroups: AdminProductGroup[];
  productSources: AdminProductSource[];
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function AddRepDialog({ action, roles, productGroups, productSources }: AddRepDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <UserPlus size={15} aria-hidden="true" />
        Add rep
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),560px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Add rep</h2>
          </div>
          <button
            className="inline-flex size-8 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-panel-muted hover:text-ink"
            type="button"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <form action={action} className="flex max-h-[min(760px,calc(100vh-8rem))] flex-col gap-3 overflow-y-auto p-5">
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="user-name">
            Name
            <input id="user-name" name="name" minLength={2} required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="user-email">
            Email
            <input id="user-email" name="email" type="email" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="temporary-password">
            Temporary password
            <input
              id="temporary-password"
              minLength={10}
              name="temporaryPassword"
              type="password"
              required
              className={inputClass}
            />
          </label>
          <p className="text-xs text-muted">The rep must replace this password on first sign-in.</p>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input name="provisioned" type="checkbox" defaultChecked className="size-4 rounded border-line accent-brand" />
            Provisioned
          </label>
          <fieldset className="flex flex-col gap-1.5 rounded-md border border-line p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Roles</legend>
            {roles.map((role) => (
              <label className="flex items-center gap-1.5 text-sm text-muted" key={role.id}>
                <input name="roleIds" type="checkbox" value={role.id} className="size-4 rounded border-line accent-brand" />
                {role.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-1.5 rounded-md border border-line p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Product groups</legend>
            {productGroups.map((group) => (
              <label className="flex items-center gap-1.5 text-sm text-muted" key={group.id}>
                <input
                  name="productGroupIds"
                  type="checkbox"
                  value={group.id}
                  className="size-4 rounded border-line accent-brand"
                />
                {group.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-1.5 rounded-md border border-line p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Products</legend>
            {productSources.map((source) => (
              <label className="flex items-center gap-1.5 text-sm text-muted" key={source.id}>
                <input
                  name="productSourceIds"
                  type="checkbox"
                  value={source.id}
                  className="size-4 rounded border-line accent-brand"
                />
                {source.name}
              </label>
            ))}
          </fieldset>
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <button
              className="inline-flex items-center justify-center rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              type="submit"
            >
              Create rep
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
