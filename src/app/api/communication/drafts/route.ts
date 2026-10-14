import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { EmailDraft, Customer } from '@/types/database';

export async function GET() {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('email_drafts')
      .select('*, customers(id, first_name, last_name, email, email_opt_out)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ success: true, drafts: [] });
    }

    return NextResponse.json({
      success: true,
      drafts: (data as (EmailDraft & { customers?: Customer })[]) || [],
    });
  } catch {
    return NextResponse.json({ success: true, drafts: [] });
  }
}
