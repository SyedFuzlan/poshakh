"use client";
import { useEffect } from "react";
import { useStore } from "@/store";

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const setCustomer = useStore((s) => s.setCustomer);
  const setSessionReady = useStore((s) => s.setSessionReady);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.customer) {
          setCustomer({
            id: data.customer.id,
            email: data.customer.email,
            phone: data.customer.phone ?? "",
            firstName: data.customer.firstName ?? "",
            lastName: data.customer.lastName ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setSessionReady());
  }, [setCustomer, setSessionReady]);

  return <>{children}</>;
}
