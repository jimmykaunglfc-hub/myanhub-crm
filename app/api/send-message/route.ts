import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { customerId, text, mediaUrl, userId } = await request.json();

    if (!userId || !customerId) {
      return NextResponse.json({ error: 'Missing required workspace user or customer ID' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch customer details (We need their platform and coordinate)
    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('platform, social_profile_link')
      .eq('id', customerId)
      .single();

    if (custErr || !customer?.social_profile_link || !customer?.platform) {
      return NextResponse.json({ error: 'Target connection coordinate or platform missing' }, { status: 404 });
    }

    const platform = customer.platform;

    // 2. Fetch the saved token dynamically based on the customer's platform
    // 🚀 FIXED: Replaced .single() with .limit(1) to prevent crashes when multiple accounts exist for the same channel
    const { data: integrations, error: integrationErr } = await supabaseAdmin
      .from('workspace_integrations')
      .select('token')
      .eq('user_id', userId)
      .eq('channel', platform)
      .order('created_at', { ascending: false })
      .limit(1);

    if (integrationErr || !integrations || integrations.length === 0) {
      return NextResponse.json({ 
        error: `${platform.toUpperCase()} integration lookup failed. Verify your row matches user_id: ${userId}` 
      }, { status: 404 });
    }

    const botToken = integrations[0].token;
    const rawLink = customer.social_profile_link.trim();

    // ==========================================
    // 3. PLATFORM-SPECIFIC ROUTING
    // ==========================================
    
    // --- TELEGRAM OUTBOUND ROUTER ---
    if (platform === 'telegram') {
      let chatId: string | null = null;
      
      if (rawLink.includes('id=')) {
        const urlParams = new URLSearchParams(rawLink.replace(/^tg:\/\/user\?/, ''));
        chatId = urlParams.get('id');
      } else {
        chatId = rawLink.replace('tg://user?', '');
      }
      
      if (!chatId) return NextResponse.json({ error: `Invalid Telegram Chat ID` }, { status: 400 });

      let telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      let payload: any = { chat_id: chatId };

      if (mediaUrl) {
        telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
        payload.photo = mediaUrl;
        payload.caption = text || "";
      } else {
        payload.text = text;
      }

      const telegramResponse = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!telegramResponse.ok) {
        const errDetails = await telegramResponse.text();
        return NextResponse.json({ error: `Telegram gateway rejected push: ${errDetails}` }, { status: 502 });
      }
    } 
    
    // --- FACEBOOK OUTBOUND ROUTER ---
    else if (platform === 'facebook') {
      // Extract the PSID (Facebook User ID) that we saved in the webhook
      const psid = rawLink.replace('https://facebook.com/', '').trim();
      
      if (!psid) return NextResponse.json({ error: 'Could not derive a valid Facebook PSID' }, { status: 400 });

      const fbApiUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${botToken}`;
      let payload: any = {
        recipient: { id: psid },
        message: {}
      };

      if (mediaUrl) {
        payload.message.attachment = {
          type: "image",
          payload: { url: mediaUrl, is_reusable: true }
        };
      } else {
        payload.message.text = text;
      }

      const fbResponse = await fetch(fbApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!fbResponse.ok) {
        const errDetails = await fbResponse.text();
        return NextResponse.json({ error: `Facebook gateway rejected push: ${errDetails}` }, { status: 502 });
      }
    } 
    
    // --- UNKNOWN PLATFORMS ---
    else {
      return NextResponse.json({ error: `Outbound routing for platform ${platform} not yet supported` }, { status: 400 });
    }

    // ==========================================
    // 4. DATABASE SYNCING
    // ==========================================
    
    // Mark previous messages as read
    await supabaseAdmin
      .from('messages')
      .update({ status: 'read' })
      .eq('customer_id', customerId);

    // Append outbound message log to CRM UI
    const { data: loggedMsg } = await supabaseAdmin
      .from('messages')
      .insert({
        customer_id: customerId,
        sender: 'Workspace Manager',
        content: mediaUrl ? `[Sent Image Attachment] ${text || ""}` : text,
        status: 'read',
        user_id: userId 
      })
      .select()
      .single();

    return NextResponse.json({ success: true, message: loggedMsg });
  } catch (err: any) {
    console.error("Outbound Error:", err);
    return NextResponse.json({ error: err.message || 'Internal pipeline failure' }, { status: 500 });
  }
}