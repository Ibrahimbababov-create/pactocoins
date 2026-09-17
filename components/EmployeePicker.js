"use client";

import { useMemo, useState } from "react";
import { normalizeForSearch } from "@/lib/translit";

const ROLE_LABEL = { admin: "админ", observer: "наблюдатель", rop: "РОП" };

function groupEmployees(employees) {
  const rops = employees.filter((e) => e.role === "rop");
  const admins = employees.filter((e) => e.role === "admin");
  const observers = employees.filter((e) => e.role === "observer");

  const byRop = new Map(rops.map((r) => [r.id, []]));
  const noTeam = [];

  for (const e of employees) {
    if (e.role === "rop" || e.role === "admin" || e.role === "observer") continue;
    if (e.rop_id && byRop.has(e.rop_id)) byRop.get(e.rop_id).push(e);
    else noTeam.push(e);
  }

  const byName = (a, b) => a.name.localeCompare(b.name);

  return {
    // РОП — первой строкой в своей же команде, чтобы его можно было
    // выбрать так же, как любого мопа, без отдельной зоны клика на шапке.
    teams: rops
      .map((rop) => ({
        rop,
        members: [rop, ...(byRop.get(rop.id) || []).sort(byName)],
      }))
      .sort((a, b) => byName(a.rop, b.rop)),
    admins: admins.sort(byName),
    observers: observers.sort(byName),
    noTeam: noTeam.sort(byName),
  };
}

// Поиск + сотрудники сгруппированы по РОПам (сворачиваемые), плюс отдельные
// группы «Админы», «Наблюдатели», «Без команды» — вместо одного длинного
// плоского списка. Ищет с учётом транслита (Сула → Sula).
export default function EmployeePicker({
  employees,
  multiple = false,
  value,
  values,
  onChange,
  onToggle,
  placeholder = "Найти сотрудника…",
  describe,
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const selectedSet = multiple ? new Set(values || []) : null;
  const selectedOne = !multiple ? employees.find((e) => e.id === value) : null;

  const grouped = useMemo(() => groupEmployees(employees), [employees]);

  const normalizedQuery = normalizeForSearch(query);
  const flatMatches = useMemo(() => {
    if (!normalizedQuery) return null;
    return employees
      .filter((e) => normalizeForSearch(e.name).includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, normalizedQuery]);

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function pick(id) {
    if (multiple) {
      onToggle(id);
    } else {
      onChange(id);
      setQuery("");
      setFocused(false);
    }
  }

  function subLabelFor(emp) {
    if (emp.role === "admin" || emp.role === "observer") return ROLE_LABEL[emp.role];
    if (emp.role === "rop") return "РОП";
    const team = grouped.teams.find((t) => t.rop.id === emp.rop_id);
    return team ? team.rop.name : "без команды";
  }

  function Row({ emp, subLabel }) {
    const checked = multiple && selectedSet.has(emp.id);
    const active = !multiple && value === emp.id;
    const line2 = describe ? describe(emp) : subLabel;
    return (
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          pick(emp.id);
        }}
        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-dark-700 ${
          active ? "bg-acid-400/10 text-acid-400" : ""
        }`}
      >
        {multiple && (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="pointer-events-none w-4 h-4 shrink-0"
          />
        )}
        <span className="truncate">
          {emp.name}
          {line2 && <span className="text-gray-500"> · {line2}</span>}
        </span>
      </div>
    );
  }

  // Вся строка — это ТОЛЬКО разворот/сворот команды, без второго смысла.
  // Выбрать самого РОПа можно строкой внутри списка (он там первым).
  function GroupHeader({ groupKey, label, count }) {
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggleGroup(groupKey)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400 hover:bg-dark-700"
      >
        <span className="truncate">{label}</span>
        <span className="text-gray-500 shrink-0 pl-2">
          {count} {openGroups[groupKey] ? "▾" : "▸"}
        </span>
      </button>
    );
  }

  const showDropdown = multiple || focused || query;

  return (
    <div>
      {!multiple && (
        <p className="mb-1 text-xs text-gray-500 truncate">
          {selectedOne
            ? `Выбран: ${selectedOne.name}${
                describe ? ` — ${describe(selectedOne)}` : ""
              }`
            : "Никто не выбран"}
        </p>
      )}
      {multiple && (
        <p className="mb-1 text-xs text-gray-500">Выбрано: {selectedSet.size}</p>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
      />
      {showDropdown && (
        <div className="mt-1 max-h-56 overflow-y-auto bg-dark-800 border border-dark-600 rounded-lg divide-y divide-dark-700">
          {flatMatches ? (
            flatMatches.length ? (
              flatMatches.map((e) => (
                <Row key={e.id} emp={e} subLabel={subLabelFor(e)} />
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-gray-500">Никого не нашлось</p>
            )
          ) : (
            <>
              {grouped.teams.map(({ rop, members }) => (
                <div key={rop.id}>
                  <GroupHeader
                    groupKey={rop.id}
                    label={rop.name}
                    count={members.length}
                  />
                  {openGroups[rop.id] &&
                    members.map((e) => (
                      <Row
                        key={e.id}
                        emp={e}
                        subLabel={e.role === "rop" ? "РОП" : undefined}
                      />
                    ))}
                </div>
              ))}
              {grouped.noTeam.length > 0 && (
                <div>
                  <GroupHeader
                    groupKey="noTeam"
                    label="Без команды"
                    count={grouped.noTeam.length}
                  />
                  {openGroups.noTeam &&
                    grouped.noTeam.map((e) => <Row key={e.id} emp={e} />)}
                </div>
              )}
              {grouped.admins.length > 0 && (
                <div>
                  <GroupHeader
                    groupKey="admins"
                    label="Админы"
                    count={grouped.admins.length}
                  />
                  {openGroups.admins &&
                    grouped.admins.map((e) => <Row key={e.id} emp={e} />)}
                </div>
              )}
              {grouped.observers.length > 0 && (
                <div>
                  <GroupHeader
                    groupKey="observers"
                    label="Наблюдатели"
                    count={grouped.observers.length}
                  />
                  {openGroups.observers &&
                    grouped.observers.map((e) => <Row key={e.id} emp={e} />)}
                </div>
              )}
              {!grouped.teams.length &&
                !grouped.noTeam.length &&
                !grouped.admins.length &&
                !grouped.observers.length && (
                  <p className="px-3 py-2 text-xs text-gray-500">Список пуст</p>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
