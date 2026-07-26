import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/session";

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; returnTo?: string }>;
}) {
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo ?? query.next);
  redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
}
