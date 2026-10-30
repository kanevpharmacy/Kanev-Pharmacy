import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return respond({ success: false, error: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) {
    return respond({ success: false, error: "Server configuration missing" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return respond({ success: false, error: "Sign in required" }, 401);

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (authError || !auth.user) {
    return respond({ success: false, error: "Your session is invalid. Please sign in again." }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return respond({ success: false, error: "Invalid checkout request." }, 400);
  }

  const customerName = cleanText(body.customer_name, 120);
  const phone = cleanText(body.customer_phone, 40);
  const address = body.delivery_address == null ? null : cleanText(body.delivery_address, 500);
  const deliveryNotes = body.delivery_notes == null ? null : cleanText(body.delivery_notes, 1000);
  const fulfilment = cleanText(body.fulfilment, 20).toLowerCase();

  if (!customerName || !phone || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 40) {
    return respond({ success: false, error: "Enter your name and phone number and add between 1 and 40 products." }, 400);
  }
  if (!["delivery", "collection"].includes(fulfilment)) {
    return respond({ success: false, error: "Choose delivery or collection." }, 400);
  }
  if (fulfilment === "delivery" && !address) {
    return respond({ success: false, error: "Enter the delivery address." }, 400);
  }

  const quantities = new Map<string, number>();
  for (const item of body.items) {
    const id = String(item?.product_id ?? "");
    const quantity = Number(item?.quantity);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return respond({ success: false, error: "One of the products or quantities is invalid." }, 400);
    }
    const combined = (quantities.get(id) || 0) + quantity;
    if (combined > 50) return respond({ success: false, error: "A product quantity cannot exceed 50." }, 400);
    quantities.set(id, combined);
  }

  const latitude = body.delivery_latitude == null ? null : Number(body.delivery_latitude);
  const longitude = body.delivery_longitude == null ? null : Number(body.delivery_longitude);
  const validLatitude = latitude !== null && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const validLongitude = longitude !== null && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The database function locks product rows, validates current prices/stock, creates
  // the order and line items, and deducts/reserves stock in one transaction.
  const { data, error } = await db.rpc("kanev_create_order_atomic", {
    p_customer_id: auth.user.id,
    p_customer_name: customerName,
    p_customer_phone: phone,
    p_delivery_address: fulfilment === "delivery" ? address : null,
    p_delivery_notes: fulfilment === "delivery" ? deliveryNotes : null,
    p_delivery_latitude: fulfilment === "delivery" && validLatitude ? latitude : null,
    p_delivery_longitude: fulfilment === "delivery" && validLongitude ? longitude : null,
    p_fulfilment: fulfilment,
    p_items: [...quantities.entries()].map(([product_id, quantity]) => ({ product_id, quantity })),
  });

  if (error) {
    // Keep database internals out of the customer-facing message; log enough for server diagnostics.
    console.error("kanev_create_order_atomic failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const knownMessage = String(error.message || "");
    const safeErrors = [
      "One or more products are unavailable",
      "is unavailable",
      "Insufficient stock for",
      "A product quantity cannot exceed 50",
      "Invalid fulfilment method",
      "Delivery address is required",
    ];
    const safeMessage = safeErrors.some((phrase) => knownMessage.includes(phrase))
      ? knownMessage
      : "We could not submit your order request. Please refresh the catalogue and try again.";
    return respond({ success: false, error: safeMessage }, 400);
  }

  if (!data?.success || !data?.order_id || !data?.order_number) {
    console.error("kanev_create_order_atomic returned an unexpected result", data);
    return respond({ success: false, error: "We could not confirm your order request. Please contact the pharmacy before trying again." }, 500);
  }

  return respond({
    success: true,
    order_number: data.order_number,
    order_id: data.order_id,
    status: data.status,
    subtotal_zmw: data.subtotal_zmw,
    delivery_fee_zmw: data.delivery_fee_zmw,
    total_zmw: data.total_zmw,
    prescription_review_status: data.prescription_review_status,
    stock_reserved: true,
  }, 201);
});
