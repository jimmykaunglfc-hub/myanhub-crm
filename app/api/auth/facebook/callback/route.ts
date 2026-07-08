import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state');

  if (!code || !userId) {
    return NextResponse.json({ error: 'Authorization canceled' }, { status: 400 });
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    const redirectUri = `${siteUrl}/api/auth/facebook/callback`;
    
    // 1. Swap the code for an access token
    const res = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.FB_CLIENT_ID}&redirect_uri=${redirectUri}&client_secret=${process.env.FB_CLIENT_SECRET}&code=${code}`
    );
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: 'Token Exchange Failed', details: data.error });

    const userAccessToken = data.access_token;

    // 2. Grab the authorized pages
    const accountsRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${userAccessToken}`);
    const accountsData = await accountsRes.json();
    if (accountsData.error) return NextResponse.json({ error: 'Page Fetch Failed', details: accountsData.error });

    const authorizedPage = accountsData.data?.[0]; 

    if (authorizedPage) {
      const pageToken = authorizedPage.access_token;
      const pageId = authorizedPage.id;
      
      // 🔥 NEW: Tell Meta to route messages for this specific page to your App
      try {
        await fetch(`https://graph.facebook.com/v20.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageToken}`, {
          method: 'POST'
        });
      } catch (err) {
        console.error("Failed to subscribe webhook to page:", err);
      }
      
      // 3. TRIGGER YOUR WEBHOOK REGISTRATION (Replaces your frontend fetch)
      // ... (keep the rest of your existing code below this)
      
      // 3. TRIGGER YOUR WEBHOOK REGISTRATION (Replaces your frontend fetch)
      try {
        const domainUrl = new URL(siteUrl).host; // e.g., co.myanhub.com
        await fetch(`${siteUrl}/api/register-bot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: pageToken, platform: 'facebook', domain: domainUrl, userId: userId })
        });
      } catch (err) {
        console.error("Register bot failed silently:", err);
      }

      // 4. SAVE TO SUPABASE (Strictly matching your schema)
      // Check if it already exists first
      const { data: existingRow } = await supabase
        .from('workspace_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('channel', 'facebook')
        .single();

      let dbError;
      if (existingRow) {
        const updateRes = await supabase.from('workspace_integrations')
          .update({ token: pageToken, status: 'active' })
          .eq('id', existingRow.id);
        dbError = updateRes.error;
      } else {
        const insertRes = await supabase.from('workspace_integrations')
          .insert({ user_id: userId, channel: 'facebook', token: pageToken, status: 'active' });
        dbError = insertRes.error;
      }

      // X-RAY LAYER: Check if Supabase rejected the save
      if (dbError) {
        return NextResponse.json({ error: 'Supabase Save Failed', details: dbError });
      }

      // 5. Success! Reload the CRM window
      return new NextResponse(`
        <script>
          window.opener.location.reload();
          window.close();
        </script>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    return NextResponse.json({ error: 'No associated pages authorized', meta_response: accountsData });

  } catch (e: any) {
    return NextResponse.json({ error: 'Handshake connection failed', message: e.message }, { status: 500 });
  }
}