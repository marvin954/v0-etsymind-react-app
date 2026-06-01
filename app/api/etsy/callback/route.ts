import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.json({ error: error || "No code received" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ETSY_API_KEY!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/etsy/callback`,
        code,
        code_verifier: "b_weHkn29GS8JVgHaKxCvEBFXO4zh73MFdoyBGEaHSk",
      }),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error_description }, { status: 400 });
    }

    // Save tokens to Supabase if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          service: "etsy",
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          created_at: new Date().toISOString(),
        }),
      });
    }

    // Redirect to app with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?etsy=connected`
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
