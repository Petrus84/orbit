import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { supabaseAdmin } from '@/lib/repositories/supabaseAdmin';

export async function GET() {
  // 1) Confirma sessão válida + UID na allowlist de admin.
  //    Se falhar, nem chega perto da service_role.
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  // 2) Só agora usamos a service_role já existente no projeto
  //    (src/lib/repositories/supabaseAdmin.ts) — RLS é ignorado, retorna os clients.
  const { data, error } = await supabaseAdmin
    .schema('orbit')
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data });
}

