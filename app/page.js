import { redirect } from "next/navigation";

// Весь вход (авто-вход через Telegram, выбор «гость / регистрация»,
// возврат гостя после выхода, e-mail для админа вне Telegram) живёт на
// /login. Корень просто ведёт туда, чтобы не было второго, устаревшего
// экрана логина.
export default function Home() {
  redirect("/login");
}
