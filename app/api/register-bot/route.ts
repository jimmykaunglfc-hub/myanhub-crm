import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token, platform, domain, userId } = await req.json();

    if (!token || !platform || !domain || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required parameters.' }, { status: 400 });
    }

    // ==========================================
    // 1. TELEGRAM INTEGRATION
    // ==========================================
    if (platform === 'telegram') {
      const webhookUrl = `https://${domain}/api/webhook?userId=${userId}`;
      const telegramRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
      const telegramData = await telegramRes.json();

      if (!telegramData.ok) {
        return NextResponse.json({ success: false, error: telegramData.description }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Telegram Webhook successfully bound' });
    }

    // ==========================================
    // 2. FACEBOOK MESSENGER INTEGRATION
    // ==========================================
    if (platform === 'facebook') {
      // Ping the Meta Graph API to verify the Access Token is valid
      const fbRes = await fetch(`https://graph.facebook.com/me?access_token=${token}`);
      const fbData = await fbRes.json();

      // If Meta rejects the token, return their exact error message
      if (fbData.error) {
        return NextResponse.json({ success: false, error: fbData.error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Facebook token verified and bound' });
    }

    // ==========================================
    // 3. OTHER OMNI-CHANNEL PLATFORMS
    // ==========================================
    const upcomingPlatforms = ['whatsapp', 'viber', 'tiktok', 'line'];
    if (upcomingPlatforms.includes(platform)) {
      // For now, we bypass strict API validation so the frontend can safely store the keys in the DB
      return NextResponse.json({ success: true, message: `${platform.toUpperCase()} key securely stored.` });
    }

    // Fallback for unknown platforms
    return NextResponse.json({ success: false, error: 'Platform not yet supported.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}