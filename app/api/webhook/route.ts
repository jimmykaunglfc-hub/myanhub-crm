import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const payload = await req.json();

    if (payload.message && payload.message.text) {
      const telegramUser = payload.message.from;
      const text = payload.message.text;
      const chatId = payload.message.chat.id;
      const socialLink = `tg://user?id=${chatId}`;
      let customerId = '';
      const fallbackName = telegramUser.first_name || 'Telegram Lead';

      // 1. Identify or Create Customer
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('name', fallbackName).eq('platform', 'telegram').eq('user_id', userId).limit(1).single();
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await supabase.from('customers').update({ social_profile_link: socialLink }).eq('id', customerId);
      } else {
        const { data: newCustomer } = await supabase.from('customers').insert({ name: fallbackName, platform: 'telegram', user_id: userId, social_profile_link: socialLink }).select().single();
        if (newCustomer) customerId = newCustomer.id;
      }

      // 2. Save Customer's Message
      if (customerId) {
        await supabase.from('messages').insert({ customer_id: customerId, sender: 'customer', content: text, status: 'unread', user_id: userId });
      }

      // ==========================================
      // 🤖 AI AUTO-PILOT ENGINE
      // ==========================================
      const { data: profile } = await supabase.from('profiles').select('ai_auto_respond, currency_code').eq('id', userId).single();
      
      if (profile?.ai_auto_respond && customerId) {
        // Fetch Live Inventory context for the AI
        const { data: inventory } = await supabase.from('inventory').select('*').eq('user_id', userId);
        const stockContext = inventory?.map(i => `- ${i.name} (Stock: ${i.stock_quantity}, Price: ${i.price} ${profile.currency_code})`).join('\n') || 'No items available.';

        // Prompt Engineering: We teach the AI to output a secret JSON tag if an order is confirmed.
        const systemPrompt = `
          You are a friendly, concise sales assistant for a store. 
          Here is our live inventory right now:
          ${stockContext}
          
          Currency: ${profile.currency_code}.
          
          Rule 1: Answer customer questions quickly. Do not sound like a robot.
          Rule 2: If they want to order, ask them for their Delivery Address and Phone Number.
          Rule 3: IF the customer has confirmed what they want AND provided an address AND a phone number, you MUST append this exact JSON block to the END of your reply, replacing the bracketed info:
          __ORDER__ {"itemName": "[Exact Name from Inventory]", "qty": [Number], "address": "[Address]", "phone": "[Phone]"}
        `;

        // Call Google Gemini API directly
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nCustomer said: "${text}"\nYour Reply:` }] }] })
        });
        
        if (geminiRes.ok) {
          const aiData = await geminiRes.json();
          const rawAiReply = aiData.candidates[0].content.parts[0].text;
          
          // Check if AI decided to create an order!
          if (rawAiReply.includes('__ORDER__')) {
            const splitReply = rawAiReply.split('__ORDER__');
            const friendlyReply = splitReply[0].trim();
            const orderJsonString = splitReply[1].trim();

            try {
              const orderData = JSON.parse(orderJsonString);
              const targetItem = inventory?.find(i => i.name.toLowerCase() === orderData.itemName.toLowerCase());
              
              if (targetItem && targetItem.stock_quantity >= orderData.qty) {
                // Generate Order ID & Total
                const orderIdStr = `MH-${Math.floor(1000 + Math.random() * 9000)}`;
                const totalAmount = targetItem.price * orderData.qty;
                
                // 1. Insert Order
                await supabase.from('orders').insert({
                  customer_id: customerId, user_id: userId, order_id_string: orderIdStr,
                  total_amount: totalAmount, status: 'pending', contact_phone: orderData.phone,
                  delivery_address: orderData.address, cart_items: [{ product: targetItem, quantity: orderData.qty }]
                });

                // 2. Deduct Stock
                await supabase.from('inventory').update({ stock_quantity: targetItem.stock_quantity - orderData.qty }).eq('id', targetItem.id);

                // Send the receipt text to the customer
                const receiptText = `🎉 AI Order Confirmed!\n\nOrder ID: ${orderIdStr}\nItem: ${orderData.qty}x ${targetItem.name}\nTotal: ${totalAmount} ${profile.currency_code}\n\nOur team will dispatch this shortly!`;
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-message`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ customerId, text: receiptText, userId })
                });

                // Log the AI message in CRM as "Workspace Manager" with a robot emoji
                await supabase.from('messages').insert({ customer_id: customerId, sender: 'Workspace Manager', content: `🤖 [AI Auto-Billed] \n${receiptText}`, status: 'read', user_id: userId });
                
                return NextResponse.json({ success: true });
              }
            } catch (e) { console.error("AI JSON parsing failed"); }
          }

          // If no order, just send the conversational text
          const friendlyReply = rawAiReply.replace(/__ORDER__.*/g, '').trim();
          
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-message`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId, text: friendlyReply, userId })
          });

          await supabase.from('messages').insert({ customer_id: customerId, sender: 'Workspace Manager', content: `🤖 ${friendlyReply}`, status: 'read', user_id: userId });
        }
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}