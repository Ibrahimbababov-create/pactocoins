import {
  setViewAs,
  setViewAsUser,
  clearViewAs,
} from "@/app/admin/viewAsActions";
import { roleTitle } from "@/lib/roles";

// Порядок групп в списке людей: сначала те, у кого есть команда.
const GROUPS = [
  { role: "rop", title: "РОПы" },
  { role: "mentor", title: "Наставники" },
  { role: "mop", title: "Менеджеры" },
];

// Кнопки «посмотреть кабинет глазами роли». Список ролей приходит из базы:
// появится новая роль у живого человека — появится и кнопка, руками сюда
// дописывать ничего не нужно.
export default function ViewAsSwitch({
  roles,
  current = null,
  people = [],
  currentUserId = null,
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
      {roles.map((role) => {
        const on = current === role;
        return (
          <form key={role} action={setViewAs.bind(null, role)}>
            <button
              type="submit"
              className={`text-xs font-semibold rounded-lg px-3 py-2 border transition ${
                on
                  ? "bg-acid-400/10 border-acid-400 text-acid-400"
                  : "bg-dark-700 border-dark-600 text-gray-300 active:scale-95"
              }`}
            >
              {roleTitle(role)}
            </button>
          </form>
        );
      })}

        {current && (
          <form action={clearViewAs}>
            <button
              type="submit"
              className="text-xs rounded-lg px-3 py-2 text-gray-500 underline underline-offset-2"
            >
              Выйти из просмотра
            </button>
          </form>
        )}
      </div>

      {people.length > 0 && (
        <form
          action={setViewAsUser}
          className="flex flex-wrap items-center gap-2 pt-1"
        >
          <span className="text-[11px] text-gray-600">или глазами:</span>
          <select
            name="userId"
            defaultValue={currentUserId ?? ""}
            className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-white max-w-[220px]"
          >
            <option value="">выбрать человека</option>
            {GROUPS.map(({ role, title }) => {
              const group = people.filter((p) => p.role === role);
              if (group.length === 0) return null;
              return (
                <optgroup key={role} label={title}>
                  {group.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <button
            type="submit"
            className="text-xs rounded-lg px-3 py-2 border border-dark-600 text-gray-300 active:scale-95"
          >
            Открыть
          </button>
        </form>
      )}

    </div>
  );
}
