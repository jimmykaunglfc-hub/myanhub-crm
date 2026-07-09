import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// We use the service key here so the server has permission to read the profiles table
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Verify this is an UPDATE event coming from the orders table
    if (payload.type === 'UPDATE' && payload.table === 'orders') {
      const oldRecord = payload.old_record;
      const newRecord = payload.record;

      // 🚀 THE TRIGGER: Only fire if the status JUST changed to 'delivered'
      // Replace 'delivered' with whatever exact string you use in your database!
      if (newRecord.delivery_state === 'delivered' && oldRecord?.delivery_state !== 'delivered') {
         
         const customerId = newRecord.customer_id;
         const userId = newRecord.user_id; 
         const orderId = newRecord.order_id_string;
         const amount = newRecord.total_amount;
         
         // Fetch the workspace currency code
         const { data: profile } = await supabase
            .from('profiles')
            .select('currency_code')
            .eq('id', userId)
            .single();
            
         const currency = profile?.currency_code || 'MMK';

         // Format the beautiful automated receipt
         const receiptText = `📦 [Delivery Complete]\n\nGreat news! Your order ${orderId} has been successfully delivered to your address.\n\nTotal Paid: ${amount} ${currency}\n\nThank you for shopping with us! Let us know if you need anything else.`;

         // Send it to the customer using your existing send-message route!
         const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://co.myanhub.com';
         await fetch(`${baseUrl}/api/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId, text: receiptText, userId })
         });
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Auto-Invoice Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}