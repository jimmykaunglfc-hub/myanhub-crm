import { NextResponse, after } from 'next/server';
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

  const VERIFY_TOKEN = "myanhub_secure_webhook";

  // If Facebook sends the correct password, we echo back the challenge number
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ FACEBOOK WEBHOOK VERIFIED!');
    return new NextResponse(challenge, { status: 200 });
  }

  // If someone else tries to ping it, we reject them
  return new NextResponse('Forbidden', { status: 403 });
}

// ==========================================
// 2. POST METHOD: INCOMING MESSAGES
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;

    // 🚀 CRITICAL: Read payload stream immediately before returning the response
    const payload = await req.json();

    // 🔥 THE X-RAY LOGGER
    console.log("🔥 INCOMING PAYLOAD RECEIVED:", JSON.stringify(payload, null, 2));

    // 🚀 OFFLOAD HEAVY LIFTING TO BACKGROUND TASK
    // Everything in this block executes AFTER the 200 OK response has been dispatched
    after(async () => {
      try {
        let userId = url.searchParams.get('userId'); // Might be null for Facebook
        let text = '';
        let platform = '';
        let fallbackName = '';
        let socialLink = '';
        let externalId = '';

        // --- FACEBOOK PAYLOAD PARSER ---
        if (payload.object === 'page' && payload.entry) {
          const entry = payload.entry[0];
          const pageId = entry.id;
          
          // SMART ROUTING: Map the Facebook Page ID to the MyanHub Workspace User
          if (!userId && pageId) {
            const { data: activeIntegration } = await supabase
              .from('workspace_integrations')
              .select('user_id')
              .eq('channel', 'facebook')
              .eq('external_account_id', pageId)
              .limit(1)
              .single();
              
            if (activeIntegration) {
              userId = activeIntegration.user_id;
            } else {
              // Fallback just in case external_account_id is missing
              const { data: fallbackIntegration } = await supabase
                .from('workspace_integrations')
                .select('user_id')
                .eq('channel', 'facebook')
                .limit(1)
                .single();
              if (fallbackIntegration) userId = fallbackIntegration.user_id;
            }
          }

          if (!entry.messaging || entry.messaging.length === 0) return;
          const event = entry.messaging[0];
          
          // Ignore messages sent by the page itself (echoes)
          if (event.message?.is_echo) return;
          if (!event.message || !event.message.text) return;
          
          platform = 'facebook';
          text = event.message.text;
          externalId = event.sender.id;
          
          // WORKAROUND: Create a unique dynamic name using their unique ID
          fallbackName = `FB User #${externalId.slice(-5)}`;
          socialLink = `https://facebook.com/${externalId}`;

          // Try to fetch real name if we successfully mapped the userId
          if (userId) {
            try {
              const { data: integration } = await supabase
                .from('workspace_integrations')
                .select('token')
                .eq('user_id', userId)
                .eq('channel', 'facebook')
                .single();

              if (integration?.token) {
                const fbProfileRes = await fetch(`https://graph.facebook.com/v20.0/${externalId}?fields=first_name,last_name&access_token=${integration.token}`);
                
                if (fbProfileRes.ok) {
                  const fbProfile = await fbProfileRes.json();
                  if (fbProfile.first_name) {
                    fallbackName = `${fbProfile.first_name} ${fbProfile.last_name || ''}`.trim();
                    console.log("🔥 SUCCESS: Extracted Facebook Name:", fallbackName);
                  }
                } else {
                  const errText = await fbProfileRes.text();
                  console.error("🔥 META GRAPH API REJECTION:", errText);
                }
              }
            } catch (e) {
              console.error("🔥 Network error trying to reach Meta:", e);
            }
          }
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
          return;
        }

        // SECURITY CHECK: Now we reject if we STILL don't have a userId after smart routing
        if (!userId) {
          console.log("❌ REJECTED: Could not map incoming payload to any MyanHub userId.");
          return;
        }

        let customerId = '';

        // 1. Identify or Create Customer
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id, name')
          .eq('platform', platform)
          .eq('social_profile_link', socialLink)
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          
          // Upgrade them if they are currently stuck as a generic "Facebook Lead"
          if (existingCustomer.name === 'Facebook Lead' || (existingCustomer.name.startsWith('FB User #') && !fallbackName.startsWith('FB User #'))) {
            await supabase.from('customers').update({ name: fallbackName, social_profile_link: socialLink }).eq('id', customerId);
          } else {
            await supabase.from('customers').update({ social_profile_link: socialLink }).eq('id', customerId);
          }
        } else {
          const { data: newCustomer } = await supabase.from('customers').insert({ name: fallbackName, platform: platform, user_id: userId, social_profile_link: socialLink }).select().single();
          if (newCustomer) customerId = newCustomer.id;
        }

        // 2. Save Customer's Message & Auto-Reopen Chat
        if (customerId) {
          // A. Save the actual message to the database
          await supabase.from('messages').insert({ 
            customer_id: customerId, 
            sender: 'customer', 
            content: text, 
            status: 'unread', 
            user_id: userId 
          });

          // B. THE AUTO-REOPEN FIX: 
          // Update the customer's profile using the correct 'chat_status' column
          await supabase.from('customers')
            .update({ chat_status: 'active' }) // Now matches your DB schema exactly!
            .eq('id', customerId);
        }

        // ==========================================
        // 🤖 AI AUTO-PILOT ENGINE
        // ==========================================
        const { data: profile } = await supabase.from('profiles').select('ai_auto_respond, currency_code').eq('id', userId).single();
        
        if (profile?.ai_auto_respond && customerId) {
          if (!process.env.GEMINI_API_KEY) return;

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
              
              let orderJsonString = splitReply[1].trim();
              orderJsonString = orderJsonString.replace(/```json/gi, '').replace(/```/g, '').trim();

              try {
                const orderData = JSON.parse(orderJsonString);
                const targetItem = inventory?.find(i => i.name.toLowerCase() === orderData.itemName.toLowerCase());
                
                if (targetItem && targetItem.stock_quantity >= orderData.qty) {
                  const orderIdStr = `MH-${Math.floor(1000 + Math.random() * 9000)}`;
                  const totalAmount = targetItem.price * orderData.qty;
                  
                  const { error: orderError } = await supabase.from('orders').insert({
                    customer_id: customerId, user_id: userId, order_id_string: orderIdStr,
                    total_amount: totalAmount, status: 'pending', delivery_state: 'unassigned', payment_status: 'Pending',
                    contact_phone: orderData.phone, delivery_address: orderData.address, 
                    cart_items: [{ product: targetItem, quantity: orderData.qty }]
                  });

                  if (!orderError) {
                    await supabase.from('inventory').update({ stock_quantity: targetItem.stock_quantity - orderData.qty }).eq('id', targetItem.id);
                  }

                  const receiptText = `🤖 [AI Auto-Billed]\n🎉 AI Order Confirmed!\n\nOrder ID: ${orderIdStr}\nItem: ${orderData.qty}x ${targetItem.name}\nTotal: ${totalAmount} ${profile.currency_code}\n\nOur team will dispatch this shortly!`;
                  try { await fetch(`${baseUrl}/api/send-message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId, text: receiptText, userId }) }); } catch (e) {}
                  return;
                }
              } catch (e) { console.error("AI JSON parsing failed", e); }
            }

            const friendlyReply = rawAiReply.replace(/__ORDER__[\s\S]*/g, '').trim();
            try { await fetch(`${baseUrl}/api/send-message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId, text: `🤖 ${friendlyReply}`, userId }) }); } catch (e) {}
          }
        }
      } catch (bgError: any) {
        console.error("Background Operational Error:", bgError.message);
      }
    });

    // 🚀 INSTANT RESPONSE SENT HERE (Locks 200 OK immediately)
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Webhook Entry Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}