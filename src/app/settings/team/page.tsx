import { Building2, ShieldCheck, UsersRound } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AccessGrantDialog } from "@/components/access-grant-dialog";
import { AddRepDialog } from "@/components/add-rep-dialog";
import { DepartmentDialog } from "@/components/department-dialog";
import { EmptyState } from "@/components/empty-state";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DataTable } from "@/components/ui/data-table";
import { ScopedAccessMap } from "@/components/scoped-access-map";
import type { AdminDepartment, AdminUser } from "@/services/admin";
import { canManageAdmin } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { createAdminService } from "@/services/admin";

export const dynamic = "force-dynamic";

function values(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

async function createUserAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const temporaryPassword = String(formData.get("temporaryPassword") ?? "");

  if (name.length < 2 || !email.includes("@") || temporaryPassword.length < 10) {
    throw new Error("Name, email, and a temporary password of at least 10 characters are required");
  }

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  await createAdminService().createUser(
    {
      name,
      email,
      temporaryPassword,
      provisioned: checkboxValue(formData, "provisioned"),
      roleIds: values(formData, "roleIds"),
      departmentIds: values(formData, "departmentIds"),
      productSourceIds: values(formData, "productSourceIds"),
      productGroupIds: values(formData, "productGroupIds")
    },
    currentUser.id
  );
  revalidatePath("/settings/team");
  redirect("/settings/team");
}

async function createDepartmentAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (name.length < 2) {
    throw new Error("Department name is required");
  }

  await createAdminService().createDepartment({ key, name }, currentUser.id);
  revalidatePath("/settings/team");
  revalidatePath("/settings/operations");
  redirect("/settings/team");
}

async function deleteDepartmentAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const departmentId = String(formData.get("departmentId") ?? "");

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!departmentId) {
    throw new Error("Department is required");
  }

  try {
    await createAdminService().deleteDepartment(departmentId, currentUser.id);
  } catch {
    redirect("/settings/team?departmentError=delete-blocked");
  }

  revalidatePath("/settings/team");
  revalidatePath("/settings/operations");
  redirect("/settings/team");
}

async function updateUserAccessAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const targetUserId = String(formData.get("targetUserId") ?? "");

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!targetUserId) {
    throw new Error("User is required");
  }

  await createAdminService().updateUserAccess(
    {
      userId: targetUserId,
      provisioned: checkboxValue(formData, "provisioned"),
      roleIds: values(formData, "roleIds"),
      departmentIds: values(formData, "departmentIds"),
      productSourceIds: values(formData, "productSourceIds"),
      productGroupIds: values(formData, "productGroupIds")
    },
    currentUser.id
  );
  revalidatePath("/settings/team");
  redirect("/settings/team");
}

export default async function SettingsTeamPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const adminService = createAdminService();
  if (!canManageAdmin(currentUser)) {
    const scopedDirectory = await adminService.getScopedTeamDirectory(currentUser);
    return <ScopedAccessMap directory={scopedDirectory} />;
  }

  const resolvedSearchParams = await searchParams;
  const departmentError = Array.isArray(resolvedSearchParams.departmentError)
    ? resolvedSearchParams.departmentError[0]
    : resolvedSearchParams.departmentError;
  const directory = await adminService.getTeamDirectory();
  const provisionedCount = directory.users.filter((user) => user.provisioned).length;
  const directGrantCount = directory.users.reduce((total, user) => total + user.productSources.length, 0);
  const groupGrantCount = directory.users.reduce((total, user) => total + user.productGroups.length, 0);
  const roleGrantCount = directory.users.reduce((total, user) => total + user.roles.length, 0);
  const departmentErrorMessage =
    departmentError === "delete-blocked" ? "Only departments with no members and no cases can be deleted." : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <UsersRound size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Reps and access</h2>
          </div>
          <AddRepDialog
            action={createUserAction}
            departments={directory.departments}
            roles={directory.roles}
            productGroups={directory.productGroups}
            productSources={directory.productSources}
          />
        </div>
        <div className="p-2">
          <DataTable<AdminUser>
            columns={[
              {
                key: "user",
                header: "User",
                render: (user) => (
                  <div>
                    <div className="font-medium text-ink">{user.name}</div>
                    <div className="text-xs text-muted">{user.email}</div>
                  </div>
                )
              },
              {
                key: "provisioned",
                header: "Status",
                render: (user) => (
                  <span
                    className={
                      user.provisioned
                        ? "rounded-full bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok"
                        : "rounded-full bg-panel-muted px-2 py-0.5 text-xs font-medium text-muted"
                    }
                  >
                    {user.provisioned ? "Provisioned" : "Suspended"}
                  </span>
                )
              },
              {
                key: "roles",
                header: "Roles",
                render: (user) =>
                  user.roles.length > 0 ? (
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-medium text-info" key={role.id}>
                          {role.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">None</span>
                  )
              },
              {
                key: "departments",
                header: "Departments",
                render: (user) =>
                  user.departments.length > 0 ? (
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {user.departments.map((department) => (
                        <span className="rounded-full bg-panel-muted px-2 py-0.5 text-xs font-medium text-ink" key={department.id}>
                          {department.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">None</span>
                  )
              },
              {
                key: "access",
                header: "Product access",
                render: (user) => {
                  const grants = [
                    ...user.productGroups.map((group) => ({ id: `group-${group.id}`, name: group.name, label: "Group" })),
                    ...user.productSources.map((source) => ({ id: `source-${source.id}`, name: source.name, label: "Direct" }))
                  ];

                  return grants.length > 0 ? (
                    <div className="flex max-w-sm flex-wrap gap-1">
                      {grants.map((grant) => (
                        <span className="rounded-full bg-panel-muted px-2 py-0.5 text-xs font-medium text-ink" key={grant.id}>
                          {grant.label}: {grant.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">None</span>
                  );
                }
              },
              {
                key: "actions",
                header: "Actions",
                render: (user) => (
                  <AccessGrantDialog
                    action={updateUserAccessAction}
                    user={user}
                    departments={directory.departments}
                    roles={directory.roles}
                    productGroups={directory.productGroups}
                    productSources={directory.productSources}
                  />
                )
              }
            ]}
            rows={directory.users}
            getRowKey={(user) => user.id}
            emptyIcon={UsersRound}
            emptyMessage="No reps yet."
          />
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <ShieldCheck size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Grant coverage</h2>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-lg bg-line text-sm">
            <div className="bg-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Users</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{directory.users.length}</dd>
            </div>
            <div className="bg-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Provisioned</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{provisionedCount}</dd>
            </div>
            <div className="bg-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Role grants</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{roleGrantCount}</dd>
            </div>
            <div className="bg-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Direct grants</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{directGrantCount}</dd>
            </div>
            <div className="bg-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Group grants</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{groupGrantCount}</dd>
            </div>
            <div className="bg-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Products</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{directory.productSources.length}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-muted" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Departments</h2>
            </div>
            <DepartmentDialog action={createDepartmentAction} />
          </div>
          {departmentErrorMessage ? (
            <div className="mx-5 mt-4 rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
              {departmentErrorMessage}
            </div>
          ) : null}
          <div className="p-2">
            <DataTable<AdminDepartment>
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (department) => <span className="font-medium text-ink">{department.name}</span>
                },
                { key: "key", header: "Key", render: (department) => department.key },
                { key: "members", header: "Members", render: (department) => department.memberCount },
                { key: "cases", header: "Cases", render: (department) => department.caseCount },
                {
                  key: "actions",
                  header: "Actions",
                  render: (department) => (
                    <form action={deleteDepartmentAction}>
                      <input name="departmentId" type="hidden" value={department.id} />
                        <ConfirmSubmitButton
                          className="text-sm font-medium text-critical disabled:cursor-not-allowed disabled:text-muted"
                          confirmMessage={`Delete ${department.name}? This cannot be undone.`}
                          disabled={department.memberCount > 0 || department.caseCount > 0}
                          pendingChildren="Deleting..."
                        >
                          Delete
                        </ConfirmSubmitButton>
                    </form>
                  )
                }
              ]}
              rows={directory.departments}
              getRowKey={(department) => department.id}
              emptyIcon={Building2}
              emptyMessage="No departments are available."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
