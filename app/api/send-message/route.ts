import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { customerId, text, mediaUrl } = await request.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch target user's data coordinates
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

    const botToken = process.env.TELEGRAM_BOT_TOKEN; 
    let telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let payload: any = { chat_id: chatId };

    // 2. Adjust payload dynamically based on text vs image attachments
    if (mediaUrl) {
      telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      payload.photo = mediaUrl;
      payload.caption = text || "";
    } else {
      payload.text = text;
    }

    // 3. Fire real outbound request out to Telegram servers
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!telegramResponse.ok) {
      const errDetails = await telegramResponse.text();
      return NextResponse.json({ error: `Telegram gateway rejected push: ${errDetails}` }, { status: 502 });
    }

    // 4. Update message state to clear unread counts on current conversation
    await supabaseAdmin
      .from('messages')
      .update({ status: 'read' })
      .eq('customer_id', customerId);

    // 5. Append agent reply record to database log stream for transparent display
    const { data: loggedMsg } = await supabaseAdmin
      .from('messages')
      .insert({
        customer_id: customerId,
        sender: 'Workspace Manager',
        content: mediaUrl ? `[Sent Image Attachment] ${text || ""}` : text,
        status: 'read'
      })
      .select()
      .single();

    return NextResponse.json({ success: true, message: loggedMsg });
  } catch (err) {
    return NextResponse.json({ error: 'Internal pipeline failure' }, { status: 500 });
  }
}