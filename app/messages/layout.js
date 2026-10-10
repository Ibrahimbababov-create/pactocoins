import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import MopLayout from "@/app/mop/layout";

// Сообщения живут вне /mop, поэтому раньше открывались без отступов,
// шапки и нижнего меню. Сотрудникам даём ту же обёртку, что и в кабинете;
// у админа и наблюдателя своё меню, им — просто аккуратный контейнер.
export default async function MessagesLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin" || profile?.role === "observer") {
    return (
      <div className="min-h-screen bg-dark-900">
        <div className="max-w-lg mx-auto px-4 py-6">{children}</div>
      </div>
    );
  }

  return <MopLayout>{children}</MopLayout>;
}
