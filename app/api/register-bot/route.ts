import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token, platform, domain } = await req.json();

    if (!token || !platform || !domain) {
      return NextResponse.json({ success: false, error: 'Missing required parameters.' }, { status: 400 });
    }

    if (platform === 'telegram') {
      // 1. Construct your CRM's webhook listener URL
      const webhookUrl = `https://${domain}/api/webhook`;

      // 2. Call the official Telegram API to register the route
      const telegramRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
      const telegramData = await telegramRes.json();

      if (!telegramData.ok) {
        return NextResponse.json({ success: false, error: telegramData.description }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Telegram Webhook successfully bound to ' + domain 
      });
    }

    return NextResponse.json({ success: false, error: 'Platform not yet supported.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}