import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("id");
  if (!listingId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await fetch(
    `https://api.etsy.com/v3/application/listings/${listingId}?includes=images,files`,
    {
      headers: {
        "x-api-key": process.env.ETSY_API_KEY!,
        "Authorization": `Bearer ${process.env.ETSY_ACCESS_TOKEN!}`,
      },
    }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
