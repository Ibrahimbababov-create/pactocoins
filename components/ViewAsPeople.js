"use client";

import { useTransition } from "react";
import EmployeePicker from "@/components/EmployeePicker";
import { setViewAsUser } from "@/app/admin/viewAsActions";

// Выбор человека, чьими глазами смотреть: с поиском по имени и командами
// РОПов — список на три десятка имён листать невозможно.
export default function ViewAsPeople({ people, currentUserId }) {
  const [isPending, startTransition] = useTransition();

  if (!people.length) return null;

  return (
    <div className="max-w-xs">
      <p className="text-[11px] text-gray-600 mb-1">или глазами человека:</p>
      <EmployeePicker
        employees={people}
        value={currentUserId ?? ""}
        onChange={(id) => {
          if (!id || isPending) return;
          const form = new FormData();
          form.set("userId", id);
          startTransition(() => setViewAsUser(form));
        }}
        placeholder="Начни писать имя…"
      />
    </div>
  );
}
