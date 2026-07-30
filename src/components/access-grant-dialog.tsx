"use client";

import { useRef } from "react";
import { ShieldCheck, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import type { AdminDepartment, AdminProductGroup, AdminProductSource, AdminRole, AdminUser } from "@/services/admin";

type AccessGrantDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  user: AdminUser;
  departments: AdminDepartment[];
  roles: AdminRole[];
  productGroups: AdminProductGroup[];
  productSources: AdminProductSource[];
};

export function AccessGrantDialog({ action, user, departments, roles, productGroups, productSources }: AccessGrantDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const userDepartmentIds = new Set(user.departments.map((department) => department.id));
  const userRoleIds = new Set(user.roles.map((role) => role.id));
  const userProductGroupIds = new Set(user.productGroups.map((group) => group.id));
  const userProductSourceIds = new Set(user.productSources.map((source) => source.id));
  const fieldId = (name: string) => `${name}-${user.id}`;

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel-muted"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <ShieldCheck size={14} aria-hidden="true" />
        Edit grants
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),560px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-muted" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Edit access grants</h2>
            </div>
            <p className="mt-1 text-xs text-muted">{user.name} - {user.email}</p>
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
          <input name="targetUserId" type="hidden" value={user.id} />
          <label className="flex items-center gap-1.5 text-sm text-muted" htmlFor={fieldId("provisioned")}>
            <input
              id={fieldId("provisioned")}
              name="provisioned"
              type="checkbox"
              defaultChecked={user.provisioned}
              className="size-4 rounded border-line accent-brand"
            />
            Provisioned
          </label>
          <fieldset className="flex flex-col gap-1.5 rounded-md border border-line p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Departments</legend>
            {departments.map((department) => (
              <label className="flex items-center gap-1.5 text-sm text-muted" key={department.id}>
                <input
                  name="departmentIds"
                  type="checkbox"
                  value={department.id}
                  defaultChecked={userDepartmentIds.has(department.id)}
                  className="size-4 rounded border-line accent-brand"
                />
                {department.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-1.5 rounded-md border border-line p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Roles</legend>
            {roles.map((role) => (
              <label className="flex items-center gap-1.5 text-sm text-muted" key={role.id}>
                <input
                  name="roleIds"
                  type="checkbox"
                  value={role.id}
                  defaultChecked={userRoleIds.has(role.id)}
                  className="size-4 rounded border-line accent-brand"
                />
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
                  defaultChecked={userProductGroupIds.has(group.id)}
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
                  defaultChecked={userProductSourceIds.has(source.id)}
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
            <ConfirmSubmitButton
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              confirmMessage={`Save access changes for ${user.name}?`}
              pendingChildren="Saving..."
            >
              Save grants
            </ConfirmSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
