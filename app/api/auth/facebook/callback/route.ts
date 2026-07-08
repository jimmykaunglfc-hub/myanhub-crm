import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state'); // Tracks which MyanHub client is logging in

  if (!code || !userId) return NextResponse.json({ error: 'Authorization canceled' }, { status: 400 });

  try {
    // 1. Automatically trade the 1-click login security code for an access token
    const res = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.FB_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/facebook/callback&client_secret=${process.env.FB_CLIENT_SECRET}&code=${code}`
    );
    const data = await res.json();
    const userAccessToken = data.access_token;

    // 2. Query Meta to see which Page the user picked (e.g., Cohort Explorers)
    const accountsRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${userAccessToken}`);
    const accountsData = await accountsRes.json();
    const authorizedPage = accountsData.data?.[0]; 

    if (authorizedPage) {
      // 3. Save the page access token securely into your Supabase integrations table
      await supabase.from('workspace_integrations').upsert({
        user_id: userId,
        channel: 'facebook',
        token: authorizedPage.access_token,
        external_account_id: authorizedPage.id
      });

      // 4. Close Meta's popup automatically and refresh your client's CRM window smoothly
      return new NextResponse(`
        <script>
          window.opener.location.reload();
          window.close();
        </script>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    return NextResponse.json({ error: 'No associated pages authorized' });
  } catch (e) {
    return NextResponse.json({ error: 'Handshake connection failed' }, { status: 500 });
  }
}