import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize admin client with service role key to manage authentication states
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { action, targetUserId, newRole, workspaceId } = await req.json();

    if (!action || !targetUserId || !workspaceId) {
      return NextResponse.json({ error: 'Missing required validation fields' }, { status: 400 });
    }

    // ACTION 1: DYNAMICALLY UPDATE ROLE
    if (action === 'update_role') {
      if (!newRole) return NextResponse.json({ error: 'Role value required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId)
        .eq('workspace_id', workspaceId); // Guardrail: ensure they belong to your workspace

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Permissions updated successfully.' });
    }

    // ACTION 2: PERMANENTLY REVOKE ACCESS (DELETE ACCOUNT)
    if (action === 'delete') {
      // First verify the profile belongs to the requesting workspace owner
      const { data: verification } = await supabaseAdmin
        .from('profiles')
        .select('workspace_id')
        .eq('id', targetUserId)
        .single();

      if (!verification || verification.workspace_id !== workspaceId) {
        return NextResponse.json({ error: 'Unauthorized workspace boundaries' }, { status: 403 });
      }

      // Delete user entirely from the Supabase core authentication ledger
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (authError) throw authError;

      return NextResponse.json({ success: true, message: 'Account credentials purged.' });
    }

    return NextResponse.json({ error: 'Invalid operation action command.' }, { status: 400 });

  } catch (error: any) {
    console.error("Staff Management System Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}