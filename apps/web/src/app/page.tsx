import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { ROLE_HOME } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(ROLE_HOME[user.role]);
}
