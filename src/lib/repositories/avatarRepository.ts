/* ==========================================================================
   ORBIT · Avatar Alignment Repository (v1.0.0 — SEM ANY)
   
   ✅ Exporta fetchAvatarAlignment()
   ✅ Usa supabase + supabaseLegacy (fallback)
   ✅ 100% Typesafe (sem 'any')
   ✅ Conforme P0_TASK (C-05: Avatar Alignment Score)
   ========================================================================== */

import { supabase, supabaseLegacy } from '../supabase'
import type { AvatarAlignment, AlignmentStatus } from '../../types/avatar'

// ✅ FUNÇÃO EXPORTADA (necessária para useAvatar.ts)
export async function fetchAvatarAlignment(clientId: string): Promise<AvatarAlignment> {
  try {
    // Primary: orbit.v_avatar_alignment
    const { data: orbitData, error: orbitError } = await supabase
      .from('v_avatar_alignment')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle()

    if (!orbitError && orbitData) {
      const status: AlignmentStatus = (orbitData.alignment_status ?? 'healthy') as AlignmentStatus
      
      return {
        id: orbitData.id,
        clientId: orbitData.client_id,
        expected: {
          gender: {
            male: orbitData.expected_gender_male ?? 50,
            female: 100 - (orbitData.expected_gender_male ?? 50),
          },
          ageRange: orbitData.expected_age_range ?? 'N/A',
          interest: orbitData.expected_interest ?? 'N/A',
          geo: orbitData.expected_geo ?? 'N/A',
        },
        real: {
          gender: {
            male: orbitData.real_gender_male ?? 0,
            female: orbitData.real_gender_female ?? 0,
          },
          ageRange: orbitData.real_age_range ?? 'N/A',
          interest: 'N/A',
          geo: orbitData.real_geo ?? 'N/A',
        },
        score: orbitData.alignment_score ?? 0,
        status: status,
        bars: [
          {
            label: 'Gênero',
            expected: orbitData.expected_gender_male ?? 50,
            real: orbitData.real_gender_male ?? 0,
            variance: Math.abs((orbitData.real_gender_male ?? 0) - (orbitData.expected_gender_male ?? 50)),
            status: status,
          },
          {
            label: 'Localização',
            expected: 50,
            real: orbitData.real_geo_pct ?? 0,
            variance: Math.abs((orbitData.real_geo_pct ?? 0) - 50),
            status: status,
          },
        ],
        recommendation: generateRecommendation(orbitData.alignment_score ?? 0),
      }
    }

    console.warn('[avatarRepository] orbit.v_avatar_alignment indisponível. Fallback legacy...')

    // Fallback: public.avatar_alignment
    const { data: legacyData, error: legacyError } = await supabaseLegacy
      .from('avatar_alignment')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle()

    if (legacyError) {
      console.error('[avatarRepository] fetchAvatarAlignment:', legacyError.message)
      throw new Error(legacyError.message)
    }

    if (!legacyData) {
      return {
        id: clientId,
        clientId: clientId,
        expected: { gender: { male: 50, female: 50 }, ageRange: 'N/A', interest: 'N/A', geo: 'N/A' },
        real: { gender: { male: 0, female: 0 }, ageRange: 'N/A', interest: 'N/A', geo: 'N/A' },
        score: 0,
        status: 'healthy' as AlignmentStatus,
        bars: [],
        recommendation: 'Dados de audiência não disponíveis',
      }
    }

    const legacyStatus: AlignmentStatus = (legacyData.alignment_status ?? 'healthy') as AlignmentStatus

    return {
      id: legacyData.id,
      clientId: legacyData.client_id,
      expected: {
        gender: { male: legacyData.expected_gender_male ?? 50, female: 100 - (legacyData.expected_gender_male ?? 50) },
        ageRange: legacyData.expected_age_range ?? 'N/A',
        interest: legacyData.expected_interest ?? 'N/A',
        geo: legacyData.expected_geo ?? 'N/A',
      },
      real: {
        gender: { male: legacyData.real_gender_male ?? 0, female: legacyData.real_gender_female ?? 0 },
        ageRange: legacyData.real_age_range ?? 'N/A',
        interest: 'N/A',
        geo: legacyData.real_geo ?? 'N/A',
      },
      score: legacyData.alignment_score ?? 0,
      status: legacyStatus,
      bars: [],
      recommendation: generateRecommendation(legacyData.alignment_score ?? 0),
    }
  } catch (error) {
    console.error('[avatarRepository] fetchAvatarAlignment fatal:', error)
    throw error
  }
}

// ── Helper Function ────────────────────────────────────────────────────────

function generateRecommendation(score: number): string {
  if (score >= 85) return 'Avatar alinhado com audiência — manter estratégia atual'
  if (score >= 70) return 'Avatar parcialmente alinhado — ajustar narrativa para melhor conexão'
  if (score >= 50) return 'Avatar desalinhado — revisar briefing criativo e público-alvo'
  return 'Avatar crítico — necessário reposicionamento estratégico'
}
