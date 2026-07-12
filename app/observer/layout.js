import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ObserverNav from "@/components/ObserverNav";
import LogoutButton from "@/components/LogoutButton";

export default async function ObserverLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="border-b border-dark-600 bg-dark-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-black text-lg">
            Pacto<span className="text-acid-400">Coins</span>{" "}
            <span className="text-gray-500 font-normal text-sm">
              наблюдатель
            </span>
          </h1>
          <LogoutButton />
        </div>
        <ObserverNav />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
