import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(method: string, table: string, body?: object, params?: string) {
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

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table") || "listings";
  const data = await query("GET", table, undefined, "?order=created_at.desc&limit=100");
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { table, record } = await req.json();
  const data = await query("POST", table, { ...record, created_at: new Date().toISOString() });
  return NextResponse.json({ data });
}
