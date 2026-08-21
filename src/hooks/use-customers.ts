"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Customer, CustomerCommunication } from "@/types/project";

export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Kunde inte ladda kunder");
      return res.json();
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customer: Omit<Customer, "id" | "createdAt">) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      if (!res.ok) throw new Error("Kunde inte skapa kund");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Customer> & { id: string }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte uppdatera kund");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte ta bort kund");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useCustomerCommunications(customerId: string | null) {
  return useQuery<CustomerCommunication[]>({
    queryKey: ["communications", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const res = await fetch(`/api/customers/${customerId}/communications`);
      if (!res.ok) throw new Error("Kunde inte ladda kommunikation");
      return res.json();
    },
    enabled: !!customerId,
  });
}

export function useCreateCommunication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      ...data
    }: Omit<CustomerCommunication, "id" | "createdAt">) => {
      const res = await fetch(`/api/customers/${customerId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kunde inte logga kommunikation");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["communications", variables.customerId],
      });
    },
  });
}
