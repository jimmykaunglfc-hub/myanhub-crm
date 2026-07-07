import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// 1. GET METHOD: FACEBOOK SECURITY VERIFICATION
// ==========================================
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  // This is the secret password Facebook will ask for.
  const VERIFY_TOKEN = "myanhub_secure_webhook";

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

// ==========================================
// 2. POST METHOD: INCOMING MESSAGES
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const payload = await req.json();

    // Unified Variables
    let text = '';
    let platform = '';
    let fallbackName = '';
    let socialLink = '';
    let externalId = '';

    // --- FACEBOOK PAYLOAD PARSER ---
    if (payload.object === 'page' && payload.entry) {
      const event = payload.entry[0].messaging[0];
      if (!event.message || !event.message.text) return NextResponse.json({ success: true });
      
      platform = 'facebook';
      text = event.message.text;
      externalId = event.sender.id;
      fallbackName = 'Facebook Lead';
      socialLink = `https://facebook.com/${externalId}`;
    } 
    // --- TELEGRAM PAYLOAD PARSER ---
    else if (payload.message && payload.message.text) {
      platform = 'telegram';
      text = payload.message.text;
      externalId = payload.message.chat.id.toString();
      fallbackName = payload.message.from.first_name || 'Telegram Lead';
      socialLink = `tg://user?id=${externalId}`;
    } 
    // --- IGNORE UNKNOWN FORMATS ---
    else {
      return NextResponse.json({ success: true });
    }

    let customerId = '';

    // 1. Identify or Create Customer
    const { data: existingCustomer } = await supabase.from('customers').select('id').eq('name', fallbackName).eq('platform', platform).eq('user_id', userId).limit(1).single();
    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabase.from('customers').update({ social_profile_link: socialLink }).eq('id', customerId);
    } else {
      const { data: newCustomer } = await supabase.from('customers').insert({ name: fallbackName, platform: platform, user_id: userId, social_profile_link: socialLink }).select().single();
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
      
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ success: true });
      }

      const { data: inventory } = await supabase.from('inventory').select('*').eq('user_id', userId);
      const stockContext = inventory?.map(i => `- ${i.name} (Stock: ${i.stock_quantity}, Price: ${i.price} ${profile.currency_code})`).join('\n') || 'No items available.';

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

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nCustomer said: "${text}"\nYour Reply:` }] }] })
      });
      
      if (geminiRes.ok) {
        const aiData = await geminiRes.json();
        const rawAiReply = aiData.candidates[0].content.parts[0].text;
        
        if (rawAiReply.includes('__ORDER__')) {
          const splitReply = rawAiReply.split('__ORDER__');
          const friendlyReply = splitReply[0].trim();
          
          let orderJsonString = splitReply[1].trim();
          orderJsonString = orderJsonString.replace(/```json/gi, '').replace(/```/g, '').trim();

          try {
            const orderData = JSON.parse(orderJsonString);
            const targetItem = inventory?.find(i => i.name.toLowerCase() === orderData.itemName.toLowerCase());
            
            if (targetItem && targetItem.stock_quantity >= orderData.qty) {
              const orderIdStr = `MH-${Math.floor(1000 + Math.random() * 9000)}`;
              const totalAmount = targetItem.price * orderData.qty;
              
              const { error: orderError } = await supabase.from('orders').insert({
                customer_id: customerId, 
                user_id: userId, 
                order_id_string: orderIdStr,
                total_amount: totalAmount, 
                status: 'pending', 
                delivery_state: 'unassigned',
                payment_status: 'Pending',
                contact_phone: orderData.phone,
                delivery_address: orderData.address, 
                cart_items: [{ product: targetItem, quantity: orderData.qty }]
              });

              if (!orderError) {
                await supabase.from('inventory').update({ stock_quantity: targetItem.stock_quantity - orderData.qty }).eq('id', targetItem.id);
              }

              const receiptText = `🤖 [AI Auto-Billed]\n🎉 AI Order Confirmed!\n\nOrder ID: ${orderIdStr}\nItem: ${orderData.qty}x ${targetItem.name}\nTotal: ${totalAmount} ${profile.currency_code}\n\nOur team will dispatch this shortly!`;
              
              try {
                await fetch(`${baseUrl}/api/send-message`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ customerId, text: receiptText, userId })
                });
              } catch (e) {}
              
              return NextResponse.json({ success: true });
            }
          } catch (e) { console.error("AI JSON parsing failed", e); }
        }

        const friendlyReply = rawAiReply.replace(/__ORDER__[\s\S]*/g, '').trim();
        
        try {
          await fetch(`${baseUrl}/api/send-message`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId, text: `🤖 ${friendlyReply}`, userId })
          });
        } catch (e) {}

      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}