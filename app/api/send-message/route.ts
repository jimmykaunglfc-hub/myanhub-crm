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

    // 1. Fetch the saved token
    const { data: integration, error: integrationErr } = await supabaseAdmin
      .from('workspace_integrations')
      .select('token')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .single();

    if (integrationErr || !integration?.token) {
      return NextResponse.json({ 
        error: `Telegram integration lookup failed. Verify your row matches user_id: ${userId}` 
      }, { status: 404 });
    }

    const botToken = integration.token;

    // 2. Fetch customer connection coordinate
    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('social_profile_link')
      .eq('id', customerId)
      .single();

    if (custErr || !customer?.social_profile_link) {
      return NextResponse.json({ error: 'Target connection coordinate missing' }, { status: 404 });
    }

    // 🚀 FIX: Fallback parsing to support both standard string formats and URI objects
    let chatId: string | null = null;
    const rawLink = customer.social_profile_link.trim();

    if (rawLink.includes('id=')) {
      const urlParams = new URLSearchParams(rawLink.replace(/^tg:\/\/user\?/, ''));
      chatId = urlParams.get('id');
    } else {
      // If it's a pure numeric string (e.g., "74839201") or clean string handle, use it directly
      chatId = rawLink.replace('tg://user?', '');
    }
    
    if (!chatId) {
      return NextResponse.json({ error: `Could not derive a valid Telegram Chat ID from string: "${rawLink}"` }, { status: 400 });
    }

    let telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let payload: any = { chat_id: chatId };

    if (mediaUrl) {
      telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      payload.photo = mediaUrl;
      payload.caption = text || "";
    } else {
      payload.text = text;
    }

    // 3. Fire message to Telegram
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!telegramResponse.ok) {
      const errDetails = await telegramResponse.text();
      return NextResponse.json({ error: `Telegram gateway rejected push: ${errDetails}` }, { status: 502 });
    }

    // 4. Update message state
    await supabaseAdmin
      .from('messages')
      .update({ status: 'read' })
      .eq('customer_id', customerId);

    // 5. Append message log
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