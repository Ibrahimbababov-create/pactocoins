import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("users")
    .select("name, birthday")
    .not("birthday", "is", null)
    .order("birthday");

  const sorted = (users ?? []).sort((a, b) => {
    const [, am, ad] = a.birthday.split("-").map(Number);
    const [, bm, bd] = b.birthday.split("-").map(Number);
    return am - bm || ad - bd;
  });

  return NextResponse.json({ birthdays: sorted });
}
