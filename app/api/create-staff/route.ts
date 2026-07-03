import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We MUST use the Service Role Key to bypass the restriction on creating users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, password, name, role, workspaceId } = await req.json();

    if (!email || !password || !name || !role || !workspaceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create the user in the Supabase Auth system (auto-confirmed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // 2. Inject their profile data into the database to link them to the Owner
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      role: role,
      workspace_id: workspaceId,
      full_name: name,
    });

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, message: 'Account created successfully!' });

  } catch (error: any) {
    console.error("Staff Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}