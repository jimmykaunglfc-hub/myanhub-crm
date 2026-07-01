import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize a server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    // If there is no User ID attached to the URL, reject it
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId in webhook pipeline' }, { status: 400 });
    }

    const payload = await req.json();

    // Verify it is a standard Telegram message payload
    if (payload.message && payload.message.text) {
      const telegramUser = payload.message.from;
      const text = payload.message.text;

      let customerId = '';

      // 1. Check if this customer already exists in May's directory
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('name', telegramUser.first_name)
        .eq('platform', 'telegram')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // 2. If new, create a new customer profile for May
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            name: telegramUser.first_name || 'Telegram Lead',
            platform: 'telegram',
            user_id: userId
          })
          .select()
          .single();
          
        if (newCustomer) customerId = newCustomer.id;
      }

      // 3. Drop the actual message into May's inbox
      if (customerId) {
        await supabase.from('messages').insert({
          customer_id: customerId,
          sender: 'customer',
          content: text,
          status: 'unread',
          user_id: userId
        });
      }
    }

    // Always tell Telegram "200 OK" so it doesn't keep retrying
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}