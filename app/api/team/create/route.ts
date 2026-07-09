import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { email, password, fullName, role, workspaceId } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

    // 1. Create the user in the secure Auth vault
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, 
    });

    if (authError) throw authError;

    // 2. FORCE INSERT/UPDATE: Guarantee the profile row is created with all data
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: fullName,
        email: email, // Explicitly save the email
        role: role,
        workspace_id: workspaceId
      });

    if (profileError) {
      // If profile fails, rollback and delete the auth user so we don't get phantom accounts!
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true, userId: authData.user.id });
    
  } catch (error: any) {
    console.error("Provisioning Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}