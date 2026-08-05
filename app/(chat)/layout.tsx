import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth/session";

export default async function ProtectedApplicationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionFromCookie();
  if (!session) {
    redirect("/login");
  }

  return children;
}
