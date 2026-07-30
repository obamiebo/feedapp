"use client";

import { useRef, useState } from "react";
import { KeyRound, Plus, UserPlus, X } from "lucide-react";
import { KeyFields } from "@/components/ui/key-fields";
import { PasswordInput } from "@/components/ui/password-input";
import type { AdminProductGroup, AdminUser } from "@/services/admin";

type ProductSourceDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  productGroups: AdminProductGroup[];
  productManagers: AdminUser[];
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function ProductSourceDialog({ action, productGroups, productManagers }: ProductSourceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hasProductManagers = productManagers.length > 0;
  const [managerMode, setManagerMode] = useState<"existing" | "create">(hasProductManagers ? "existing" : "create");

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Plus size={15} aria-hidden="true" />
        Add product source
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),560px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Add product source</h2>
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
        <form action={action} className="flex flex-col gap-3 p-5">
          <KeyFields inputClass={inputClass} nameId="product-source-name" keyId="product-source-key" />
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-source-type">
            Type
            <select id="product-source-type" name="type" defaultValue="api" className={inputClass}>
              <option value="api">API</option>
              <option value="webhook">Webhook</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-source-group">
            Product group
            <select id="product-source-group" name="groupId" defaultValue="" className={inputClass}>
              <option value="">Ungrouped</option>
              {productGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input name="enabled" type="checkbox" defaultChecked className="size-4 rounded border-line accent-brand" />
            Enabled
          </label>
          <fieldset className="flex flex-col gap-3 rounded-md border border-line p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Initial Product Manager</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-muted transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:text-ink">
                <input
                  className="size-4 border-line accent-brand"
                  disabled={!hasProductManagers}
                  name="initialProductManagerMode"
                  type="radio"
                  value="existing"
                  checked={managerMode === "existing"}
                  onChange={() => setManagerMode("existing")}
                />
                Use existing
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-muted transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:text-ink">
                <input
                  className="size-4 border-line accent-brand"
                  name="initialProductManagerMode"
                  type="radio"
                  value="create"
                  checked={managerMode === "create"}
                  onChange={() => setManagerMode("create")}
                />
                <UserPlus size={14} aria-hidden="true" />
                Create new
              </label>
            </div>
            {managerMode === "existing" ? (
              <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="initial-product-manager">
                Product Manager
                <select
                  id="initial-product-manager"
                  name="initialProductManagerId"
                  required={managerMode === "existing"}
                  className={inputClass}
                >
                  <option value="">Select a Product Manager</option>
                  {productManagers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="new-product-manager-name">
                  Name
                  <input
                    id="new-product-manager-name"
                    name="newProductManagerName"
                    minLength={2}
                    required={managerMode === "create"}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="new-product-manager-email">
                  Email
                  <input
                    id="new-product-manager-email"
                    name="newProductManagerEmail"
                    type="email"
                    required={managerMode === "create"}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="new-product-manager-password">
                  Temporary password
                  <PasswordInput
                    id="new-product-manager-password"
                    name="newProductManagerTemporaryPassword"
                    minLength={10}
                    required={managerMode === "create"}
                    className={inputClass}
                  />
                </label>
                <p className="text-xs text-muted">The Product Manager is provisioned and must replace this password on first sign-in.</p>
              </div>
            )}
          </fieldset>
          {!hasProductManagers && managerMode === "existing" ? (
            <p className="text-sm text-critical">Create a Product Manager to onboard this product source.</p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-muted"
              disabled={managerMode === "existing" && !hasProductManagers}
              type="submit"
            >
              Create source
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
