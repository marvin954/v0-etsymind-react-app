import { NextRequest, NextResponse } from "next/server";

const ETSY_BASE = "https://openapi.etsy.com/v3";

async function etsyRequest(path: string, method = "GET", body?: object) {
  const token = process.env.ETSY_ACCESS_TOKEN;
  const apiKey = process.env.ETSY_API_KEY;

  const res = await fetch(`${ETSY_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey!,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json();
}

// GET — fetch all listings from your Etsy shop
export async function GET(req: NextRequest) {
  const shopId = process.env.ETSY_SHOP_ID;
  if (!shopId) return NextResponse.json({ error: "ETSY_SHOP_ID not set" }, { status: 500 });

  try {
    const data = await etsyRequest(
      `/application/shops/${shopId}/listings?state=active&limit=25`
    );
    return NextResponse.json({ listings: data.results, count: data.count });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

// POST — create a new listing on Etsy
export async function POST(req: NextRequest) {
  const shopId = process.env.ETSY_SHOP_ID;
  if (!shopId) return NextResponse.json({ error: "ETSY_SHOP_ID not set" }, { status: 500 });
  if (!process.env.ETSY_ACCESS_TOKEN)
    return NextResponse.json({ error: "ETSY_ACCESS_TOKEN not set. Visit /api/etsy/auth to connect." }, { status: 401 });

  try {
    const { title, description, price, tags, quantity = 999, who_made = "i_did", when_made = "made_to_order", taxonomy_id = 2078 } = await req.json();

    const listing = await etsyRequest(
      `/application/shops/${shopId}/listings`,
      "POST",
      {
        quantity,
        title: title.slice(0, 140),
        description,
        price: parseFloat(price?.replace("$", "") || "5.99"),
        who_made,
        when_made,
        taxonomy_id,
        tags: tags?.slice(0, 13) || [],
        shipping_profile_id: null,
        is_digital: true,
        should_auto_renew: true,
        is_taxable: false,
        type: "download",
      }
    );

    return NextResponse.json({ success: true, listing_id: listing.listing_id, listing });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
