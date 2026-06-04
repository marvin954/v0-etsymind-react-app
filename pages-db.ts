import type { NextApiRequest, NextApiResponse } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseQuery(method: string, table: string, body?: object, params?: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params || ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.status(500).json({ error: "Supabase not configured" });

  if (req.method === "GET") {
    const table = (req.query.table as string) || "listings";
    const data = await supabaseQuery("GET", table, undefined, "?order=created_at.desc&limit=100");
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const { table, record } = req.body;
    const data = await supabaseQuery("POST", table, { ...record, created_at: new Date().toISOString() });
    return res.status(200).json({ data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
