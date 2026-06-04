import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error } = req.query;

  if (error || !code) return res.status(400).json({ error: error || "No code received" });

  const keystring = process.env.ETSY_KEYSTRING!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/etsy/callback`;

  try {
    const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: keystring,
        redirect_uri: redirectUri,
        code: code as string,
        code_verifier: "b_weHkn29GS8JVgHaKxCvEBFXO4zh73MFdoyBGEaHSk",
      }),
    });

    const data = await tokenRes.json();
    if (data.error) return res.status(400).json({ error: data.error_description || data.error });

    // Show tokens so you can copy them to Vercel
    return res.status(200).json({
      success: true,
      message: "✅ Copy these to Vercel Environment Variables",
      ETSY_ACCESS_TOKEN: data.access_token,
      ETSY_REFRESH_TOKEN: data.refresh_token,
      expires_in_seconds: data.expires_in,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
