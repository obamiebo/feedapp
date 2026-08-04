"use client";

import { useRef, useState } from "react";
import { Boxes, Settings2, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { KeyFields } from "@/components/ui/key-fields";
import { Tabs } from "@/components/ui/tabs";
import type { AdminProductGroup, AdminProductSource } from "@/services/admin";

type ProductGroupDialogProps = {
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  productGroups: AdminProductGroup[];
  productSources: AdminProductSource[];
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark";

export function ProductGroupDialog({ createAction, updateAction, productGroups, productSources }: ProductGroupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState("add");
  const [selectedGroupId, setSelectedGroupId] = useState(productGroups[0]?.id ?? "");
  const selectedGroup = productGroups.find((group) => group.id === selectedGroupId) ?? productGroups[0] ?? null;

  return (
    <>
      <button
        className={secondaryButtonClass}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Settings2 size={15} aria-hidden="true" />
        Manage product groups
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),680px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Manage product groups</h2>
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
        <div className="max-h-[min(760px,calc(100vh-8rem))] overflow-y-auto p-5">
          <Tabs
            active={activeTab}
            onChange={setActiveTab}
            items={[
              { key: "add", label: "Add group" },
              { key: "manage", label: "Manage existing" }
            ]}
          >
            {(tab) => (
              <>
                {tab === "add" ? (
                  <form action={createAction} className="flex flex-col gap-3">
                    <KeyFields inputClass={inputClass} nameId="product-group-name" keyId="product-group-key" />
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-group-description">
                      Description
                      <input id="product-group-description" name="description" className={inputClass} />
                    </label>
                    <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                      >
                        Cancel
                      </button>
                      <ConfirmSubmitButton
                        className={primaryButtonClass}
                        confirmMessage="Create this product group?"
                        pendingChildren="Creating..."
                      >
                        Create group
                      </ConfirmSubmitButton>
                    </div>
                  </form>
                ) : null}

                {tab === "manage" ? (
                  <div className="flex flex-col gap-4">
                    {selectedGroup ? (
                      <>
                        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-product-group-select">
                          Product group
                          <select
                            id="manage-product-group-select"
                            value={selectedGroup.id}
                            className={inputClass}
                            onChange={(event) => setSelectedGroupId(event.target.value)}
                          >
                            {productGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <form key={selectedGroup.id} action={updateAction} className="flex flex-col gap-3">
                          <input name="groupId" type="hidden" value={selectedGroup.id} />
                          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-product-group-name">
                            Name
                            <input
                              id="manage-product-group-name"
                              name="name"
                              minLength={2}
                              required
                              defaultValue={selectedGroup.name}
                              className={inputClass}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-product-group-key">
                            Key
                            <input
                              id="manage-product-group-key"
                              value={selectedGroup.key}
                              readOnly
                              className={`${inputClass} text-muted`}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-product-group-description">
                            Description
                            <input
                              id="manage-product-group-description"
                              name="description"
                              defaultValue={selectedGroup.description ?? ""}
                              className={inputClass}
                            />
                          </label>
                          <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3">
                            <legend className="px-1 text-sm font-medium text-muted">Products in this group</legend>
                            {productSources.length > 0 ? (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {productSources.map((source) => (
                                  <label key={source.id} className="flex items-start gap-2 rounded-md border border-line px-3 py-2 text-sm text-muted">
                                    <input
                                      name="productSourceIds"
                                      type="checkbox"
                                      value={source.id}
                                      defaultChecked={source.groupId === selectedGroup.id}
                                      className="mt-0.5 size-4 rounded border-line accent-brand"
                                    />
                                    <span>
                                      <span className="block font-medium text-ink">{source.name}</span>
                                      <span className="text-xs text-muted">{source.groupId && source.groupId !== selectedGroup.id ? "Currently in another group" : source.key}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted">No product sources are available yet.</p>
                            )}
                          </fieldset>
                          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
                            <button
                              className={secondaryButtonClass}
                              type="button"
                              onClick={() => dialogRef.current?.close()}
                            >
                              Cancel
                            </button>
                            <ConfirmSubmitButton
                              className={primaryButtonClass}
                              confirmMessage="Save changes to this product group?"
                              pendingChildren="Saving..."
                            >
                              Save group
                            </ConfirmSubmitButton>
                          </div>
                        </form>
                      </>
                    ) : (
                      <p className="rounded-md border border-line bg-panel-subtle px-3 py-2 text-sm text-muted">
                        Create a product group before managing group details or product membership.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </Tabs>
        </div>
      </dialog>
    </>
  );
}
