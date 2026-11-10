"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
      className={buttonClasses({ variant: "ghost", size: "sm", className: "px-3 font-semibold" })}
    >
      {loading ? "Chiqilmoqda…" : "Chiqish"}
    </button>
  );
}
