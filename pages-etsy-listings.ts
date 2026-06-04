import type { NextApiRequest, NextApiResponse } from "next";

const ETSY_BASE = "https://openapi.etsy.com/v3";

async function etsyFetch(path: string, method = "GET", body?: object) {
  const keystring = process.env.ETSY_KEYSTRING!;
  const token = process.env.ETSY_ACCESS_TOKEN!;

  const res = await fetch(`${ETSY_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": keystring,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const shopId = process.env.ETSY_SHOP_ID;
  if (!shopId) return res.status(500).json({ error: "ETSY_SHOP_ID not set" });

  // GET — fetch active listings
  if (req.method === "GET") {
    try {
      const data = await etsyFetch(`/application/shops/${shopId}/listings?state=active&limit=25`);
      return res.status(200).json({ listings: data.results, count: data.count });
    } catch (e: unknown) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown" });
    }
  }

  // POST — create a new listing
  if (req.method === "POST") {
    if (!process.env.ETSY_ACCESS_TOKEN)
      return res.status(401).json({ error: "ETSY_ACCESS_TOKEN not set. Visit /api/etsy/auth to connect." });

    try {
      const { title, description, price, tags } = req.body;
      const listing = await etsyFetch(`/application/shops/${shopId}/listings`, "POST", {
        quantity: 999,
        title: title.slice(0, 140),
        description,
        price: parseFloat(price?.replace("$", "") || "5.99"),
        who_made: "i_did",
        when_made: "made_to_order",
        taxonomy_id: 2078,
        tags: tags?.slice(0, 13) || [],
        is_digital: true,
        should_auto_renew: true,
        is_taxable: false,
        type: "download",
      });
      return res.status(200).json({ success: true, listing_id: listing.listing_id, listing });
    } catch (e: unknown) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
