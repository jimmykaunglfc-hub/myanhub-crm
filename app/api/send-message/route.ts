import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. Extract the payload, including the new userId sent from the frontend
    const { customerId, text, mediaUrl, userId } = await request.json();

    if (!userId || !customerId) {
      return NextResponse.json({ error: 'Missing required tenant or customer ID' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. DYNAMIC TOKEN LOOKUP: Fetch the specific client's Telegram token from their saved integrations
    const { data: integration, error: integrationErr } = await supabaseAdmin
      .from('workspace_integrations')
      .select('token')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .single();

    if (integrationErr || !integration?.token) {
      return NextResponse.json({ error: 'Telegram integration not found for this workspace' }, { status: 404 });
    }

    const botToken = integration.token;

    // 3. Fetch target user's data coordinates
    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('social_profile_link')
      .eq('id', customerId)
      .single();

    if (custErr || !customer?.social_profile_link) {
      return NextResponse.json({ error: 'Target connection coordinate missing' }, { status: 404 });
    }

    // Extract Telegram Chat ID integer out of standard proxy string
    const urlParams = new URLSearchParams(customer.social_profile_link.replace('tg://user?', ''));
    const chatId = urlParams.get('id');
    
    if (!chatId) return NextResponse.json({ error: 'Malformed profile channel metadata' }, { status: 400 });

    let telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let payload: any = { chat_id: chatId };

    // 4. Adjust payload dynamically based on text vs image attachments
    if (mediaUrl) {
      telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      payload.photo = mediaUrl;
      payload.caption = text || "";
    } else {
      payload.text = text;
    }

    // 5. Fire real outbound request out to Telegram servers using the Client's specific token
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!telegramResponse.ok) {
      const errDetails = await telegramResponse.text();
      return NextResponse.json({ error: `Telegram gateway rejected push: ${errDetails}` }, { status: 502 });
    }

    // 6. Update message state to clear unread counts on current conversation
    await supabaseAdmin
      .from('messages')
      .update({ status: 'read' })
      .eq('customer_id', customerId);

    // 7. Append agent reply record securely to database log stream
    const { data: loggedMsg } = await supabaseAdmin
      .from('messages')
      .insert({
        customer_id: customerId,
        sender: 'Workspace Manager',
        content: mediaUrl ? `[Sent Image Attachment] ${text || ""}` : text,
        status: 'read',
        user_id: userId // CRITICAL: This ensures the message passes Row Level Security
      })
      .select()
      .single();

    return NextResponse.json({ success: true, message: loggedMsg });
  } catch (err) {
    console.error("Outbound Error:", err);
    return NextResponse.json({ error: 'Internal pipeline failure' }, { status: 500 });
  }
}