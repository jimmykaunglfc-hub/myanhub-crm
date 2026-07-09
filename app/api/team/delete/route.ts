import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'No user ID provided.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Failsafe check
    if (!supabaseAdminKey) {
      return NextResponse.json({ error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

    // 1. CLEANUP PRE-CHECK: Prevent Foreign Key errors by unassigning the driver from all active orders
    await supabaseAdmin
      .from('orders')
      .update({ assigned_driver_id: null, delivery_state: 'unassigned' })
      .eq('assigned_driver_id', targetUserId);

    // 2. DELETE THE USER: Now that they are detached, Postgres will allow the destruction
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (error) {
      // Fallback stringifier so it never returns an empty {} again
      const errorMessage = error.message || JSON.stringify(error);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Deletion API Crash:", error);
    return NextResponse.json({ error: error.message || "An unexpected server error occurred." }, { status: 500 });
  }
}