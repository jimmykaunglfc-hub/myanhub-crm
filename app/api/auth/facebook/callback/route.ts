import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🔥 THIS FORCES NEXT.JS TO RUN THIS CODE LIVE INSTEAD OF USING CACHED DATA
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state'); // Tracks which MyanHub client is logging in

  if (!code || !userId) {
    return NextResponse.json({ error: 'Authorization canceled' }, { status: 400 });
  }

  try {
    // Ensure no trailing slash breaks the exact match validation
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/facebook/callback`;
    
    // 1. Swap the temporary social login code for a token
    const res = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.FB_CLIENT_ID}&redirect_uri=${redirectUri}&client_secret=${process.env.FB_CLIENT_SECRET}&code=${code}`
    );
    const data = await res.json();
    
    // X-RAY LAYER 1: If token swap failed, show exactly why
    if (data.error) {
      return NextResponse.json({ error: 'Token Exchange Failed', details: data.error });
    }

    const userAccessToken = data.access_token;

    // 2. Automatically grab their page profile details
    const accountsRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${userAccessToken}`);
    const accountsData = await accountsRes.json();
    
    // X-RAY LAYER 2: If account fetch failed, show exactly why
    if (accountsData.error) {
      return NextResponse.json({ error: 'Page Fetch Failed', details: accountsData.error });
    }

    const authorizedPage = accountsData.data?.[0]; 

    if (authorizedPage) {
      // 3. Save the page access token securely into your Supabase integrations table
      await supabase.from('workspace_integrations').upsert({
        user_id: userId,
        channel: 'facebook',
        token: authorizedPage.access_token,
        external_account_id: authorizedPage.id
      });

      // 4. Force the popup to close itself and instantly reload your CRM dashboard
      return new NextResponse(`
        <script>
          window.opener.location.reload();
          window.close();
        </script>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // X-RAY LAYER 3: Show exactly what Facebook sent back if the page list is empty
    return NextResponse.json({ 
      error: 'No associated pages authorized', 
      meta_response: accountsData 
    });

  } catch (e: any) {
    return NextResponse.json({ 
      error: 'Handshake connection failed', 
      message: e.message 
    }, { status: 500 });
  }
}