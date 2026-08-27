"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    // Гостя после выхода ведём сразу на экран выбора (гость / регистрация),
    // а не в авто-вход телеграма — иначе после гостевой сессии обратно
    // зайти бывает нельзя.
    let isGuest = false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("is_guest")
          .eq("id", user.id)
          .single();
        isGuest = !!data?.is_guest;
      }
    } catch {
      // не критично — просто уйдём на обычный /login
    }

    await supabase.auth.signOut();
    router.push(isGuest ? "/login?welcome=1" : "/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-500 hover:text-red-400 transition"
    >
      Выйти
    </button>
  );
}
