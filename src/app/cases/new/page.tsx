import { Info, MessageSquare, ShieldCheck, Users2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { priorities } from "@/domain/constants";
import { canCreateCase, canEnterApplication } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { createManualCaseSchema } from "@/lib/validation";
import { createPrismaDepartmentRepository } from "@/repositories/departments";
import { createPrismaIntegrationRepository, type ProductSourceSummary } from "@/repositories/integrations";
import { createCaseService } from "@/services/cases";

export const dynamic = "force-dynamic";

function optionalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function defaultDepartmentKey(source: ProductSourceSummary) {
  if (typeof source.config !== "object" || source.config === null || Array.isArray(source.config)) {
    return null;
  }

  return typeof source.config.defaultDepartmentKey === "string" ? source.config.defaultDepartmentKey : null;
}

async function createManualCaseAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const parsed = createManualCaseSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    priority: String(formData.get("priority") ?? ""),
    sourceSystem: String(formData.get("sourceSystem") ?? ""),
    assigneeId: optionalValue(formData.get("assigneeId")),
    customerName: String(formData.get("customerName") ?? "").trim(),
    customerEmail: optionalValue(formData.get("customerEmail")),
    customerPhone: optionalValue(formData.get("customerPhone")),
    customerExternalId: optionalValue(formData.get("customerExternalId"))
  });

  if (!parsed.success) {
    throw new Error("Invalid manual case payload");
  }

  const [productSources, departments] = await Promise.all([
    createPrismaIntegrationRepository().listProductSources(),
    createPrismaDepartmentRepository().listDepartments()
  ]);
  const productSource = productSources.find((source) => source.key === parsed.data.sourceSystem && source.enabled);
  const departmentKey = productSource ? defaultDepartmentKey(productSource) : null;
  const department = departments.find((item) => item.key === departmentKey) ?? departments[0];

  if (!productSource || !department) {
    throw new Error("Selected product source is not available for manual intake");
  }

  const created = await createCaseService().createManualCaseForUser(
    {
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      departmentId: department.id,
      sourceSystem: parsed.data.sourceSystem,
      assigneeId: parsed.data.assigneeId === "unassigned" ? undefined : parsed.data.assigneeId,
      customer: {
        name: parsed.data.customerName,
        email: parsed.data.customerEmail,
        phone: parsed.data.customerPhone,
        externalId: parsed.data.customerExternalId
      }
    },
    currentUser
  );

  revalidatePath("/");
  redirect(`/cases/${created.id}`);
}

export default async function NewCasePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  void (await searchParams);
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.passwordMustChange) {
    redirect("/change-password");
  }

  if (!canEnterApplication(currentUser)) {
    return (
      <AppShell active="cases" currentUser={currentUser}>
        <PageHeader breadcrumbHref="/" breadcrumbLabel="Back to cases" eyebrow="Manual intake" title="New customer case" />
        <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
          <EmptyState icon={ShieldCheck} message="This user is not provisioned for application access." />
        </section>
      </AppShell>
    );
  }

  const productSources = await createPrismaIntegrationRepository().listProductSources();
  const activeProductSources = productSources.filter(
    (source) => source.enabled && canCreateCase(currentUser) && currentUser.productSourceKeys.includes(source.key)
  );

  const inputClass =
    "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

  return (
    <AppShell active="cases" currentUser={currentUser}>
      <PageHeader breadcrumbHref="/" breadcrumbLabel="Back to cases" eyebrow="Manual intake" title="New customer case" />

      {!currentUser || !canCreateCase(currentUser) ? (
        <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
          <EmptyState icon={MessageSquare} message="This user cannot create cases." />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form action={createManualCaseAction} className="rounded-lg border border-line bg-panel shadow-sm">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <MessageSquare size={18} className="text-muted" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Case details</h2>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Case</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-muted sm:col-span-2" htmlFor="title">
                  Title
                  <input id="title" name="title" minLength={3} required className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="priority">
                  Priority
                  <select id="priority" name="priority" defaultValue="Medium" required className={inputClass}>
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="sourceSystem">
                  Product
                  <select id="sourceSystem" name="sourceSystem" required className={inputClass}>
                    {activeProductSources.map((source) => (
                      <option key={source.id} value={source.key}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted sm:col-span-2" htmlFor="description">
                  Description
                  <textarea id="description" name="description" minLength={3} rows={6} required className={inputClass} />
                </label>
              </div>

              <div className="mt-2 border-t border-line pt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                Customer
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="customerName">
                  Customer name
                  <input id="customerName" name="customerName" required className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="customerEmail">
                  Customer email
                  <input id="customerEmail" name="customerEmail" type="email" className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="customerPhone">
                  Customer phone
                  <input id="customerPhone" name="customerPhone" className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="customerExternalId">
                  Customer external ID
                  <input id="customerExternalId" name="customerExternalId" className={inputClass} />
                </label>
              </div>

              <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
                <Link
                  className="inline-flex items-center rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
                  href="/"
                >
                  Cancel
                </Link>
                <button
                  className="inline-flex items-center rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                  type="submit"
                >
                  Create case
                </button>
              </div>
            </div>
          </form>

          <aside className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Intake notes</h2>
            <div className="flex items-start gap-3 rounded-md border border-line bg-panel-subtle p-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <div className="text-sm">
                <strong className="block text-ink">Manual source</strong>
                <span className="text-muted">Cases created here are linked to the product selected in the form.</span>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-line bg-panel-subtle p-3">
              <Users2 size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <div className="text-sm">
                <strong className="block text-ink">Customer matching</strong>
                <span className="text-muted">
                  Existing customers are reused when external ID, email, or phone already exists.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-line bg-panel-subtle p-3">
              <Info size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <div className="text-sm">
                <strong className="block text-ink">SLA deadline</strong>
                <span className="text-muted">
                  The service calculates the SLA deadline from the product routing policy and priority.
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
