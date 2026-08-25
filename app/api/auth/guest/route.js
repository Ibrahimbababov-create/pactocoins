import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getOrCreateGuestAccount, GUEST_EMAIL, GUEST_PASSWORD } from "@/lib/guestAccount";

export async function POST() {
  try {
    await getOrCreateGuestAccount();
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const cookieStore = cookies();
  const cookiesToSet = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookiesToSet.push({ name, value, options }),
        remove: (name, options) => cookiesToSet.push({ name, value: "", options }),
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: GUEST_EMAIL,
    password: GUEST_PASSWORD,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ redirect: "/mop" });
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set({ name, value, ...options });
  });

  return response;
}
