import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente NORMAL, com a ANON key + cookies da sessão do usuário.
// Respeita RLS. Usado só para descobrir QUEM está logado (auth.uid()).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de um Server Component sem permissão de escrita — ok ignorar
          }
        },
      },
    }
  );
}
