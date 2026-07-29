import { Boxes, Power, RefreshCw, ShieldCheck, UserPlus, UsersRound, XCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ProductSourceDialog } from "@/components/product-source-dialog";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { DataTable } from "@/components/ui/data-table";
import type { AdminProductGroup, AdminProductSource, ProductRosterMember } from "@/services/admin";
import { canManageAdmin, canManageAnyProductRoster } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { createAdminService } from "@/services/admin";

export const dynamic = "force-dynamic";

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

async function createProductGroupAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (name.length < 2) {
    throw new Error("Product group name is required");
  }

  await createAdminService().createProductGroup({ key, name, description }, currentUser.id);
  revalidatePath("/settings/products");
  redirect("/settings/products");
}

async function createProductSourceAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const type = String(formData.get("type") ?? "api").trim();
  const groupId = String(formData.get("groupId") ?? "");
  const initialProductManagerMode = String(formData.get("initialProductManagerMode") ?? "existing");
  const initialProductManagerId = String(formData.get("initialProductManagerId") ?? "");
  const newProductManagerName = String(formData.get("newProductManagerName") ?? "").trim();
  const newProductManagerEmail = String(formData.get("newProductManagerEmail") ?? "").trim();
  const newProductManagerTemporaryPassword = String(formData.get("newProductManagerTemporaryPassword") ?? "");

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (name.length < 2) {
    throw new Error("Product source name is required");
  }

  const initialProductManager =
    initialProductManagerMode === "create"
      ? {
          mode: "create" as const,
          name: newProductManagerName,
          email: newProductManagerEmail,
          temporaryPassword: newProductManagerTemporaryPassword
        }
      : {
          mode: "existing" as const,
          userId: initialProductManagerId
        };

  const result = await createAdminService().createProductSource(
    { key, name, type, groupId, enabled: checkboxValue(formData, "enabled"), initialProductManager },
    currentUser.id
  );
  revalidatePath("/settings/products");
  redirect(
    `/settings/products?newProductKey=${encodeURIComponent(result.key)}&newProductSecret=${encodeURIComponent(result.secret)}`
  );
}

async function updateProductSourceAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const sourceId = String(formData.get("sourceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "api").trim();
  const groupId = String(formData.get("groupId") ?? "");

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!sourceId || name.length < 2) {
    throw new Error("Product source and name are required");
  }

  await createAdminService().updateProductSource(
    { sourceId, name, type, groupId, enabled: checkboxValue(formData, "enabled") },
    currentUser.id
  );
  revalidatePath("/settings/products");
  redirect("/settings/products");
}

async function rotateProductSourceSecretAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const sourceId = String(formData.get("sourceId") ?? "");

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!sourceId) {
    throw new Error("Product source is required");
  }

  const result = await createAdminService().rotateProductSourceSecret(sourceId, currentUser.id);
  revalidatePath("/settings/products");
  redirect(
    `/settings/products?newProductKey=${encodeURIComponent(result.key)}&newProductSecret=${encodeURIComponent(result.secret)}`
  );
}

async function updateProductSourceCallbackAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const sourceId = String(formData.get("sourceId") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "").trim();
  const callbackSecret = String(formData.get("callbackSecret") ?? "").trim();

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!sourceId) {
    throw new Error("Product source is required");
  }

  await createAdminService().updateProductSourceCallback({ sourceId, callbackUrl, callbackSecret }, currentUser.id);
  revalidatePath("/settings/products");
  redirect("/settings/products");
}

async function addProductRosterUserAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const sourceId = String(formData.get("sourceId") ?? "");
  const email = String(formData.get("email") ?? "").trim();

  if (!currentUser || !canManageAnyProductRoster(currentUser)) {
    throw new Error("Current user cannot manage product rosters");
  }

  if (!sourceId || !email.includes("@")) {
    redirect(`/settings/products?sourceId=${encodeURIComponent(sourceId)}&rosterError=invalid-email`);
  }

  try {
    await createAdminService().addProductRosterUser(sourceId, email, currentUser);
  } catch (error) {
    const rosterError =
      error instanceof Error && error.message === "Rep must be an existing provisioned user"
        ? "rep-not-found"
        : "add-failed";
    redirect(`/settings/products?sourceId=${encodeURIComponent(sourceId)}&rosterError=${rosterError}`);
  }
  revalidatePath("/settings/products");
  redirect(`/settings/products?sourceId=${encodeURIComponent(sourceId)}`);
}

async function removeProductRosterUserAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const sourceId = String(formData.get("sourceId") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (!currentUser || !canManageAnyProductRoster(currentUser)) {
    throw new Error("Current user cannot manage product rosters");
  }

  if (!sourceId || !userId) {
    throw new Error("Product and rep are required");
  }

  await createAdminService().removeProductRosterUser(sourceId, userId, currentUser);
  revalidatePath("/settings/products");
  redirect(`/settings/products?sourceId=${encodeURIComponent(sourceId)}`);
}

export default async function SettingsProductsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const canManagePlatform = canManageAdmin(currentUser);
  const canManageRosters = canManageAnyProductRoster(currentUser);

  if (!canManagePlatform && !canManageRosters) {
    return (
      <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
        <EmptyState icon={ShieldCheck} message="Product settings are only available to platform admins and product managers." />
      </section>
    );
  }

  const resolvedSearchParams = await searchParams;
  const newProductKey = Array.isArray(resolvedSearchParams.newProductKey)
    ? resolvedSearchParams.newProductKey[0]
    : resolvedSearchParams.newProductKey;
  const newProductSecret = Array.isArray(resolvedSearchParams.newProductSecret)
    ? resolvedSearchParams.newProductSecret[0]
    : resolvedSearchParams.newProductSecret;
  const selectedSourceId = Array.isArray(resolvedSearchParams.sourceId)
    ? resolvedSearchParams.sourceId[0]
    : resolvedSearchParams.sourceId;
  const rosterError = Array.isArray(resolvedSearchParams.rosterError)
    ? resolvedSearchParams.rosterError[0]
    : resolvedSearchParams.rosterError;

  const adminService = createAdminService();
  const [directory, rosterDirectory] = await Promise.all([
    canManagePlatform
      ? adminService.getProductsDirectory()
      : Promise.resolve({ productGroups: [], productSources: [] }),
    adminService.getProductRosterDirectory(currentUser, selectedSourceId)
  ]);
  const teamDirectory = canManagePlatform ? await adminService.getTeamDirectory() : null;
  const productManagerOptions =
    teamDirectory?.users.filter(
      (user) => user.provisioned && user.roles.some((role) => role.name === "Product Manager")
    ) ?? [];

  const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
  const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark";
  const rosterErrorMessage =
    rosterError === "invalid-email"
      ? "Enter a valid rep email address."
      : rosterError === "rep-not-found"
        ? "That email does not belong to an existing provisioned rep."
        : rosterError === "add-failed"
          ? "The rep could not be added to this product."
          : null;

  const rosterSection = (
    <section className="rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <UsersRound size={18} className="text-muted" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Product reps</h2>
      </div>
      {rosterDirectory.selectedSource ? (
        <div className="flex flex-col gap-4 p-5">
          {rosterErrorMessage ? (
            <div className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
              {rosterErrorMessage}
            </div>
          ) : null}
          <form className="max-w-sm" method="get">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="roster-source">
              Product
              <AutoSubmitSelect
                id="roster-source"
                name="sourceId"
                defaultValue={rosterDirectory.selectedSource.id}
                className={inputClass}
                options={rosterDirectory.productSources
                  .filter((source) => source.canManageRoster)
                  .map((source) => ({ value: source.id, label: source.name }))}
              />
            </label>
          </form>

          <div className="rounded-md border border-line">
            <DataTable<ProductRosterMember>
              columns={[
                {
                  key: "user",
                  header: "Rep",
                  render: (member) => (
                    <div>
                      <div className="font-medium text-ink">{member.name}</div>
                      <div className="text-xs text-muted">{member.email}</div>
                    </div>
                  )
                },
                {
                  key: "roles",
                  header: "Roles",
                  render: (member) => member.roles.map((role) => role.name).join(", ") || "None"
                },
                {
                  key: "access",
                  header: "Access",
                  render: (member) =>
                    member.direct ? (
                      <span className="rounded-full bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok">
                        Direct product access
                      </span>
                    ) : member.groupDerived ? (
                      <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-medium text-info">
                        Via product group
                      </span>
                    ) : (
                      "None"
                    )
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (member) =>
                    member.direct ? (
                      <form action={removeProductRosterUserAction}>
                        <input name="sourceId" type="hidden" value={rosterDirectory.selectedSource?.id} />
                        <input name="userId" type="hidden" value={member.id} />
                        <button className="inline-flex items-center gap-1 text-sm font-medium text-critical" type="submit">
                          <XCircle size={14} /> Remove
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted">Managed by group</span>
                    )
                }
              ]}
              rows={rosterDirectory.members}
              getRowKey={(member) => member.id}
              emptyIcon={UsersRound}
              emptyMessage="No reps have access to this product yet."
            />
          </div>

          <form action={addProductRosterUserAction} className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input name="sourceId" type="hidden" value={rosterDirectory.selectedSource.id} />
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="rep-email">
              Add existing rep by email
              <input id="rep-email" name="email" type="email" required className={inputClass} />
            </label>
            <button className={`${primaryButtonClass} self-end`} type="submit">
              <UserPlus size={15} /> Add rep
            </button>
          </form>
        </div>
      ) : (
        <div className="p-6">
          <EmptyState icon={UsersRound} message="No directly managed products are available for this user." />
        </div>
      )}
    </section>
  );

  return canManagePlatform ? (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-6">
        {rosterSection}

        <section className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Boxes size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Product sources</h2>
          </div>
          {newProductKey && newProductSecret ? (
            <div className="mx-5 mt-4 flex flex-col gap-1 rounded-md border border-warning-bg bg-warning-bg p-4 text-sm">
              <strong className="text-warning">Secret generated for {newProductKey}</strong>
              <span className="text-muted">Store this now. It will not be shown again.</span>
              <code className="mt-1 break-all rounded bg-panel px-2 py-1 text-xs text-ink">{newProductSecret}</code>
            </div>
          ) : null}
          <div className="p-2">
            <DataTable<AdminProductSource>
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (source) => <span className="font-medium text-ink">{source.name}</span>
                },
                { key: "key", header: "Key", render: (source) => source.key },
                {
                  key: "group",
                  header: "Group",
                  render: (source) =>
                    directory.productGroups.find((group) => group.id === source.groupId)?.name ?? "Ungrouped"
                },
                { key: "status", header: "Status", render: (source) => (source.enabled ? "Enabled" : "Disabled") },
                { key: "events", header: "Events", render: (source) => source.eventCount },
                { key: "secret", header: "Secret", render: (source) => (source.hasSecret ? "Set" : "Missing") },
                {
                  key: "callback",
                  header: "Callback",
                  render: (source) => (source.callbackConfigured ? "Configured" : "Missing")
                }
              ]}
              rows={directory.productSources}
              getRowKey={(source) => source.id}
              emptyIcon={Boxes}
              emptyMessage="No product sources yet."
            />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Boxes size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Product groups</h2>
          </div>
          <div className="p-2">
            <DataTable<AdminProductGroup>
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (group) => (
                    <div>
                      <div className="font-medium text-ink">{group.name}</div>
                      {group.description ? <div className="text-xs text-muted">{group.description}</div> : null}
                    </div>
                  )
                },
                { key: "key", header: "Key", render: (group) => group.key },
                { key: "products", header: "Products", render: (group) => group.productCount }
              ]}
              rows={directory.productGroups}
              getRowKey={(group) => group.id}
              emptyIcon={Boxes}
              emptyMessage="No product groups yet."
            />
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <ProductSourceDialog
            action={createProductSourceAction}
            productGroups={directory.productGroups}
            productManagers={productManagerOptions}
          />
        </div>

        <section className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Boxes size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Add product group</h2>
          </div>
          <form action={createProductGroupAction} className="flex flex-col gap-3 p-5">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-group-name">
              Name
              <input
                id="product-group-name"
                name="name"
                minLength={2}
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-group-key">
              Key
              <input
                id="product-group-key"
                name="key"
                placeholder="Optional, generated from name"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-group-description">
              Description
              <input
                id="product-group-description"
                name="description"
                className={inputClass}
              />
            </label>
            <button
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              type="submit"
            >
              Create group
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Power size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Manage source</h2>
          </div>
          <form action={updateProductSourceAction} className="flex flex-col gap-3 p-5">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source">
              Source
              <select
                id="manage-source"
                name="sourceId"
                required
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {directory.productSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source-name">
              Name
              <input
                id="manage-source-name"
                name="name"
                minLength={2}
                required
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source-type">
              Type
              <select
                id="manage-source-type"
                name="type"
                defaultValue="api"
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="api">API</option>
                <option value="webhook">Webhook</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source-group">
              Product group
              <select
                id="manage-source-group"
                name="groupId"
                defaultValue=""
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Ungrouped</option>
                {directory.productGroups.map((group) => (
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
            <button
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              type="submit"
            >
              Save source
            </button>
          </form>
          <form action={rotateProductSourceSecretAction} className="flex flex-col gap-3 border-t border-line p-5">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="rotate-source">
              Rotate secret
              <select
                id="rotate-source"
                name="sourceId"
                required
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {directory.productSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
              type="submit"
            >
              <RefreshCw size={15} /> Rotate secret
            </button>
          </form>
          <form action={updateProductSourceCallbackAction} className="flex flex-col gap-3 border-t border-line p-5">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="callback-source">
              Status callback source
              <select
                id="callback-source"
                name="sourceId"
                required
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {directory.productSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="callback-url">
              Callback URL
              <input
                id="callback-url"
                name="callbackUrl"
                placeholder="https://product.example.com/feedapp/callback"
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="callback-secret">
              Signing secret
              <input
                id="callback-secret"
                name="callbackSecret"
                type="password"
                placeholder="Shared callback signing secret"
                className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <p className="text-xs text-muted">Leave URL and secret blank to disable callbacks for the selected source.</p>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
              type="submit"
            >
              Save callback
            </button>
          </form>
        </section>
      </div>
    </div>
  ) : (
    <div className="max-w-4xl">{rosterSection}</div>
  );
}
