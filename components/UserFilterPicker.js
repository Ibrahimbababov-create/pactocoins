"use client";

import { useState } from "react";
import EmployeePicker from "@/components/EmployeePicker";

// Фильтр «один сотрудник» внутри обычной формы с GET: выбранный id уходит
// в адрес через скрытое поле с нужным именем параметра.
export default function UserFilterPicker({ employees, name = "user", initial = "" }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="min-w-0 sm:w-72">
      <input type="hidden" name={name} value={value} />
      <EmployeePicker
        employees={employees}
        value={value}
        onChange={setValue}
        clearLabel="Все сотрудники"
        onClear={() => setValue("")}
        placeholder="Выбрать сотрудника: напиши имя"
      />
    </div>
  );
}
