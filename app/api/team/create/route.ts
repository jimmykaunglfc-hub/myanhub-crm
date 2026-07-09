import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { email, password, fullName, role, workspaceId } = await req.json();

    // 🚀 CRITICAL: We must use the SERVICE_ROLE_KEY to bypass security and create an Auth user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

    // 1. Create the user in the secure Auth vault
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm so they can log in immediately
    });

    if (authError) throw authError;

    // 2. Update their public profile with their Role, Name, and Workspace ID
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        role: role,
        workspace_id: workspaceId
      })
      .eq('id', authData.user.id);

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, userId: authData.user.id });
    
  } catch (error: any) {
    console.error("Provisioning Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}