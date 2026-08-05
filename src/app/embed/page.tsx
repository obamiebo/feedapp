import { redirect } from "next/navigation";
import { getEntryContext } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

export default async function EmbedLandingPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const sourceSystemParam = resolvedSearchParams.sourceSystem;
  const sourceSystem = Array.isArray(sourceSystemParam) ? sourceSystemParam[0] : sourceSystemParam;
  const entryContext = await getEntryContext();
  const scopedSource = sourceSystem || entryContext.sourceSystem;
  const params = new URLSearchParams({ entryMode: "embed" });

  if (scopedSource) {
    params.set("sourceSystem", scopedSource);
  }

  redirect(`/?${params.toString()}`);
}
