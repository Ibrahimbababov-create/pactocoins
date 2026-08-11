"use client";

import { useRouter, usePathname } from "next/navigation";

export default function MonthPicker({ months, selected }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`${pathname}?month=${e.target.value}`)}
      className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-acid-400"
    >
      {months.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
