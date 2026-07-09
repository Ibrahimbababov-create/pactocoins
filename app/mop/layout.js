import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";

export default async function MopLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex justify-end mb-2">
          <LogoutButton />
        </div>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
