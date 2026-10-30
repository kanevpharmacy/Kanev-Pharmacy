// Kanev Pharmacy phone + password sign-in
// Deploy: npx supabase functions deploy kanev-phone-login
// Required Edge Function secrets: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. Never put the service-role key in the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("260")) return `+${digits}`;
  if (digits.startsWith("0")) return `+260${digits.slice(1)}`;
  if (digits.length === 9) return `+260${digits}`;
  return `+260${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { phone: rawPhone, password } = await req.json();
    const phone = normalizePhone(rawPhone);
    if (!phone || typeof password !== "string" || password.length < 6 || password.length > 256) {
      return json({ error: "Invalid sign-in details" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) {
      console.error("Phone login function is missing required server secrets.");
      return json({ error: "Sign-in is temporarily unavailable" }, 500);
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // The app's admin portal uses customer_profiles(user_id, phone).
    // Lookup is performed only on the server; the phone-to-email mapping
    // is never returned to the client.
    const { data: profile, error: profileError } = await adminClient
      .from("customer_profiles")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError) {
      console.error("Phone profile lookup failed:", profileError.message);
      return json({ error: "Sign-in is temporarily unavailable" }, 500);
    }
    if (!profile?.user_id) {
      return json({ error: "Invalid sign-in details" }, 401);
    }

    // Phone login is for customers only. Staff must use their staff email
    // so the existing admin role verification path remains in force.
    const { data: staff, error: staffError } = await adminClient
      .from("admin_members")
      .select("user_id")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    if (staffError) {
      console.error("Phone login role check failed:", staffError.message);
      return json({ error: "Sign-in is temporarily unavailable" }, 500);
    }
    if (staff) return json({ error: "Invalid sign-in details" }, 401);

    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(profile.user_id);
    const email = userData?.user?.email;
    if (userError || !email) {
      if (userError) console.error("Phone login account lookup failed:", userError.message);
      return json({ error: "Invalid sign-in details" }, 401);
    }

    // Verify the password using Supabase Auth's password flow. Return only
    // the resulting session tokens, never the account email or profile row.
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signedIn.session) {
      return json({ error: "Invalid sign-in details" }, 401);
    }

    return json({
      access_token: signedIn.session.access_token,
      refresh_token: signedIn.session.refresh_token,
    });
  } catch (error) {
    console.error("Phone login request failed:", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Sign-in is temporarily unavailable" }, 500);
  }
});
