import { Boxes, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ManageProductSourceDialog } from "@/components/manage-product-source-dialog";
import { ProductGroupDialog } from "@/components/product-group-dialog";
import { ProductSourceDialog } from "@/components/product-source-dialog";
import { ProductRosterUserDialog } from "@/components/product-roster-user-dialog";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
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

async function updateProductGroupAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const productSourceIds = formData.getAll("productSourceIds").map(String).filter(Boolean);

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!groupId || name.length < 2) {
    throw new Error("Product group and name are required");
  }

  await createAdminService().updateProductGroup({ groupId, name, description, productSourceIds }, currentUser.id);
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

  let result: { key: string; secret: string };

  try {
    result = await createAdminService().createProductSource(
      { key, name, type, groupId, enabled: checkboxValue(formData, "enabled"), initialProductManager },
      currentUser.id
    );
  } catch (error) {
    const productError =
      error instanceof Error && error.message === "A legacy routing department is required before creating product sources"
        ? "missing-department"
        : "create-failed";
    redirect(`/settings/products?productError=${productError}`);
  }

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

async function updateProductExternalEntryAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const sourceId = String(formData.get("sourceId") ?? "");
  const issuer = String(formData.get("issuer") ?? "").trim();
  const tokenTtlSeconds = Number(formData.get("tokenTtlSeconds") ?? 300);
  const allowedOrigins = String(formData.get("allowedOrigins") ?? "")
    .split(/\r?\n|,/)
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedModes = formData
    .getAll("allowedModes")
    .map(String)
    .filter((mode): mode is "portal" | "embed" => mode === "portal" || mode === "embed");

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!sourceId) {
    throw new Error("Product source is required");
  }

  let result: { key: string; entrySecret: string | null };

  try {
    result = await createAdminService().updateProductExternalEntry(
      {
        sourceId,
        enabled: checkboxValue(formData, "enabled"),
        issuer,
        tokenTtlSeconds,
        allowedOrigins,
        allowedModes,
        rotateSecret: checkboxValue(formData, "rotateSecret")
      },
      currentUser.id
    );
  } catch (error) {
    const entryError =
      error instanceof Error && error.message === "External entry issuer is required" ? "missing-issuer" : "save-failed";
    redirect(`/settings/products?entrySourceId=${encodeURIComponent(sourceId)}&entryError=${entryError}`);
  }

  revalidatePath("/settings/products");
  const params = new URLSearchParams({ entrySourceId: sourceId });

  if (result.entrySecret) {
    params.set("newEntryKey", result.key);
    params.set("newEntrySecret", result.entrySecret);
  }

  redirect(`/settings/products?${params.toString()}`);
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
  const productError = Array.isArray(resolvedSearchParams.productError)
    ? resolvedSearchParams.productError[0]
    : resolvedSearchParams.productError;
  const entrySourceId = Array.isArray(resolvedSearchParams.entrySourceId)
    ? resolvedSearchParams.entrySourceId[0]
    : resolvedSearchParams.entrySourceId;
  const entryError = Array.isArray(resolvedSearchParams.entryError)
    ? resolvedSearchParams.entryError[0]
    : resolvedSearchParams.entryError;
  const newEntryKey = Array.isArray(resolvedSearchParams.newEntryKey)
    ? resolvedSearchParams.newEntryKey[0]
    : resolvedSearchParams.newEntryKey;
  const newEntrySecret = Array.isArray(resolvedSearchParams.newEntrySecret)
    ? resolvedSearchParams.newEntrySecret[0]
    : resolvedSearchParams.newEntrySecret;

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
  const rosterErrorMessage =
    rosterError === "invalid-email"
      ? "Enter a valid rep email address."
      : rosterError === "rep-not-found"
        ? "That email does not belong to an existing provisioned rep."
        : rosterError === "add-failed"
          ? "The rep could not be added to this product."
          : null;
  const productErrorMessage =
    productError === "missing-department"
      ? "Create a department before adding products. Production seed now creates Support by default."
      : productError === "create-failed"
        ? "The product could not be created. Check the product details and try again."
        : null;
  const selectedEntrySource =
    directory.productSources.find((source) => source.id === entrySourceId) ?? directory.productSources[0] ?? null;
  const entryErrorMessage =
    entryError === "missing-issuer"
      ? "Issuer is required when embedded access is enabled."
      : entryError === "save-failed"
        ? "Embedded access settings could not be saved."
        : null;

  const rosterSection = (
    <section className="rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-2">
          <UsersRound size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Product reps</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {rosterDirectory.selectedSource ? (
            <form className="min-w-[260px]" method="get">
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
          ) : null}
          <ProductRosterUserDialog
            action={addProductRosterUserAction}
            selectedSource={rosterDirectory.selectedSource}
            users={teamDirectory?.users}
          />
        </div>
      </div>
      {rosterDirectory.selectedSource ? (
        <div className="flex flex-col gap-4 p-5">
          {rosterErrorMessage ? (
            <div className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
              {rosterErrorMessage}
            </div>
          ) : null}

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
                        <ConfirmSubmitButton
                          className="inline-flex items-center gap-1 text-sm font-medium text-critical"
                          confirmMessage={`Remove ${member.name} from this product?`}
                          pendingChildren="Removing..."
                        >
                          <XCircle size={14} /> Remove
                        </ConfirmSubmitButton>
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
        </div>
      ) : (
        <div className="p-6">
          <EmptyState icon={UsersRound} message="No directly managed products are available for this user." />
        </div>
      )}
    </section>
  );

  return canManagePlatform ? (
    <div className="flex flex-col gap-6">
      {rosterSection}

      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Product sources</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProductSourceDialog
              action={createProductSourceAction}
              productGroups={directory.productGroups}
              productManagers={productManagerOptions}
            />
            <ManageProductSourceDialog
              selectedSource={selectedEntrySource}
              productSources={directory.productSources}
              productGroups={directory.productGroups}
              updateSourceAction={updateProductSourceAction}
              rotateSecretAction={rotateProductSourceSecretAction}
              updateCallbackAction={updateProductSourceCallbackAction}
              updateExternalEntryAction={updateProductExternalEntryAction}
              entryErrorMessage={entryErrorMessage}
              newEntryKey={newEntryKey}
              newEntrySecret={newEntrySecret}
            />
          </div>
        </div>
        {productErrorMessage ? (
          <div className="mx-5 mt-4 rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
            {productErrorMessage}
          </div>
        ) : null}
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
              },
              {
                key: "embeddedEntry",
                header: "Embedded entry",
                render: (source) => (source.externalEntryConfigured ? "Enabled" : "Disabled")
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
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Product groups</h2>
          </div>
          <ProductGroupDialog
            createAction={createProductGroupAction}
            updateAction={updateProductGroupAction}
            productGroups={directory.productGroups}
            productSources={directory.productSources}
          />
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
  ) : (
    <div className="max-w-4xl">{rosterSection}</div>
  );
}
