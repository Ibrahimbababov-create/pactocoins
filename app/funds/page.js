import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

// Копилки переехали внутрь ролевых разделов (/mop/funds, /observer/funds),
// чтобы у экрана была обычная навигация, а не голая ссылка «На главную».
export default async function FundsRedirect() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(profile?.role === "observer" ? "/observer/funds" : "/mop/funds");
}
