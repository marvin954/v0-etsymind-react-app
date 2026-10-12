import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.ETSY_API_KEY!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/etsy/callback`;

  const codeVerifier = "b_weHkn29GS8JVgHaKxCvEBFXO4zh73MFdoyBGEaHSk";
  const codeChallenge = "DSWlX90ZZNM_ZeKJ_e4HxYJLiMT-TtMa1_CAoVHjINg";

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "listings_w listings_r shops_r transactions_r",
    client_id: clientId,
    state: "etsymind_auth",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(
    `https://www.etsy.com/oauth/connect?${params.toString()}`
  );
}
