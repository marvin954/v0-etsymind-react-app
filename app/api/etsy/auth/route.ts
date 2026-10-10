import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";

export async function GET() {
  const clientId = process.env.ETSY_API_KEY!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/etsy/callback`;

  // Fresh PKCE verifier and state per login. A fixed verifier lets anyone
  // who intercepts the code redeem it.
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "listings_w listings_r shops_r transactions_r",
    client_id: clientId,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const res = NextResponse.redirect(`https://www.etsy.com/oauth/connect?${params.toString()}`);
  res.cookies.set("etsy_oauth", `${state}.${codeVerifier}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/etsy/callback",
    maxAge: 600,
  });
  return res;
}
