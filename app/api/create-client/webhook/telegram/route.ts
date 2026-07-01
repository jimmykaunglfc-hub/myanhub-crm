import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.message) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const incomingText = body.message.text || "[Media Transmission]";
    const userFirstName = body.message.from.first_name || "Anonymous Shopper";

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look for matching chat profile signature mapping
    let { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('social_profile_link', `tg://user?id=${chatId}`)
      .single();

    // Map a dynamic new lead profile card if this sender is unrecognized
    if (!customer) {
      const { data: newCustomer } = await supabaseAdmin
        .from('customers')
        .insert({
          name: userFirstName,
          platform: 'Telegram Chat',
          social_profile_link: `tg://user?id=${chatId}`,
          tags: ['Live Lead', 'Unassigned']
        })
        .select('id')
        .single();
      customer = newCustomer;
    }

    if (customer) {
      // Append the inbound text directly into the primary thread database logs
      await supabaseAdmin.from('messages').insert({
        customer_id: customer.id,
        sender: userFirstName,
        content: incomingText,
        status: 'unread'
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Webhook processing failure' }, { status: 500 });
  }
}