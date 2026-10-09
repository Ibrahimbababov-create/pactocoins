import { setViewAs, clearViewAs } from "@/app/admin/viewAsActions";
import { roleTitle } from "@/lib/roles";

// Кнопки «посмотреть кабинет глазами роли». Список ролей приходит из базы:
// появится новая роль у живого человека — появится и кнопка, руками сюда
// дописывать ничего не нужно.
export default function ViewAsSwitch({ roles, current = null }) {
  return (
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
  );
}
