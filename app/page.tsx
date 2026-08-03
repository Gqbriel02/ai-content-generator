import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSessionFromCookie();
  if (session) {
    redirect("/chat");
  }
  redirect("/login");
}
