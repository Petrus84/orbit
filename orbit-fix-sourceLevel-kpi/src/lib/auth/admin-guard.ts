import { createSupabaseServerClient } from '@/lib/supabase/server';

// UIDs autorizados a usar rotas de admin (service_role).
// Vem de env var — nunca hardcode no código versionado.
// Exemplo de .env.local:
// ADMIN_USER_IDS=c8454173-e13f-4c0b-a2cd-d1d89798d7e8,403e7908-460c-48b5-8547-59937a4d7bf4
function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Confirma que existe um usuário logado (sessão válida) E que o UID dele
 * está na allowlist de admins. Lança erro se não estiver — o caller decide
 * o status HTTP de resposta.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('UNAUTHENTICATED');
  }

  const adminIds = getAdminUserIds();

  if (!adminIds.includes(user.id)) {
    throw new Error('FORBIDDEN');
  }

  return user;
}
