import { redirect } from "next/navigation";

/** Merged into the single Sources document. Kept so existing links survive. */
export default async function FollowUpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/prospect/${id}/how-we-know#what-we-found`);
}
