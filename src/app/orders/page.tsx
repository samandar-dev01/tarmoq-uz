import { redirect } from "next/navigation";
import { requirePageRole, ROLE_HOME } from "@/lib/auth";

export default async function OrdersIndex() {
  const user = await requirePageRole("CLIENT", "PROVIDER", "ADMIN");
  redirect(user.role === "ADMIN" ? "/admin/orders" : ROLE_HOME[user.role]);
}
