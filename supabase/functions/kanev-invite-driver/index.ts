import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: adminRow, error: adminError } = await admin
    .from("admin_members").select("role").eq("user_id", user.id).maybeSingle();
  if (adminError || !adminRow) return json({ error: "Administrator access required" }, 403);

  let body: { email?: string; full_name?: string; phone?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "A valid email address is required" }, 400);
  if (!fullName || fullName.length > 120) return json({ error: "Driver name is required (maximum 120 characters)" }, 400);
  if (!phone || phone.length > 40) return json({ error: "Driver phone number is required" }, 400);

  const redirectTo = Deno.env.get("DRIVER_INVITE_REDIRECT_URL") || "https://kanev-pharmacy.vercel.app/";
  // Reuse an existing Auth identity when an earlier invitation was accepted
  // by Auth but its one-time link expired before the driver finished setup.
  let existingUser: { id: string; email?: string } | null = null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return json({ error: "Could not check existing account: " + error.message }, 500);
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (match) { existingUser = { id: match.id, email: match.email }; break; }
    if (data.users.length < 1000) break;
  }

  let driverUserId: string;
  let deliveryMethod: "invitation" | "password_reset";
  if (existingUser) {
    driverUserId = existingUser.id;
    const { error: profileError } = await admin.from("delivery_drivers").upsert({
      user_id: driverUserId, full_name: fullName, phone, status: "active", created_by: user.id,
    }, { onConflict: "user_id" });
    if (profileError) return json({ error: "Existing account found, but driver access could not be updated: " + profileError.message }, 500);

    const recoveryClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: recoveryError } = await recoveryClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (recoveryError) return json({ error: "Driver access was prepared, but the password setup email could not be sent: " + recoveryError.message }, 400);
    deliveryMethod = "password_reset";
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: fullName, kanev_account_type: "delivery_driver" },
    });
    if (inviteError || !invited.user) {
      return json({ error: inviteError?.message || "Could not send the driver invitation" }, 400);
    }
    driverUserId = invited.user.id;
    const { error: profileError } = await admin.from("delivery_drivers").upsert({
      user_id: driverUserId, full_name: fullName, phone, status: "active", created_by: user.id,
    }, { onConflict: "user_id" });
    if (profileError) {
      await admin.auth.admin.deleteUser(driverUserId);
      return json({ error: "Invitation could not be registered: " + profileError.message }, 500);
    }
    deliveryMethod = "invitation";
  }

  return json({
    success: true,
    delivery_method: deliveryMethod,
    message: deliveryMethod === "password_reset"
      ? "This email already has a Kanev account. A fresh password setup link has been sent."
      : "Driver invitation sent.",
    driver: { user_id: driverUserId, email, full_name: fullName, phone, status: "active" },
  });
});
