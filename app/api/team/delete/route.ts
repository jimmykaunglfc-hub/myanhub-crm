import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { targetUserId } = await req.json();

    // 🚀 CRITICAL: We must use the SERVICE_ROLE_KEY to delete Auth accounts
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

    // This deletes the user's login credentials. 
    // Supabase will automatically cascade and delete their row in the 'profiles' table too!
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}