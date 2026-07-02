import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: We use the SERVICE_ROLE_KEY here to safely bypass RLS on the backend
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

      // CRITICAL NEW ADDITION: Grab the unique Chat ID from the incoming payload
      const chatId = payload.message.chat.id;
      const socialLink = `tg://user?id=${chatId}`; // Format it for the outbound route

      let customerId = '';
      const fallbackName = telegramUser.first_name || 'Telegram Lead';

      // 1. Check if this customer already exists in the client's directory
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('name', fallbackName)
        .eq('platform', 'telegram')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        
        // Update the link just in case it was missing previously (fixes older test accounts)
        await supabase
          .from('customers')
          .update({ social_profile_link: socialLink })
          .eq('id', customerId);

      } else {
        // 2. If new, create a new customer profile AND save their chat routing ID
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            name: fallbackName,
            platform: 'telegram',
            user_id: userId,
            social_profile_link: socialLink // The outbound route needs this!
          })
          .select()
          .single();
          
        if (newCustomer) customerId = newCustomer.id;
      }

      // 3. Drop the actual message into the tenant's inbox
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
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}