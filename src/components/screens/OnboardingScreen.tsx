import React, { useState } from 'react'
import SectionHead from '@/components/common/SectionHead'
import type {
  ClientOnboarding,
  BioLink,
  CTAType,
  FunnelMaturity,
  SetorBenchmark,
  ProofMechanism,
  PankseppSystem,
} from '@/types/orbit'

interface OnboardingScreenProps {
  clientId: string
  initialData: ClientOnboarding | null
  onSave: (data: ClientOnboarding) => Promise<boolean>
  isSaving: boolean
}

export default function OnboardingScreen({
  clientId,
  initialData,
  onSave,
  isSaving,
}: OnboardingScreenProps): React.ReactElement {
  const [formData, setFormData] = useState<Partial<ClientOnboarding>>(
    initialData || {
      client_id: clientId,
      total_followers: 0,
      total_followers_source: 'manual_print_confirmado',
      bio_links: [],
      cta_type: null,
      funnel_maturity: null,
      q1_engagement_period_notes: null,
      q2_content_proxy_notes: null,
      q3_misalignment_notes: null,
      audience_nucleo_fiel_pct: null,
      audience_consumo_passivo_pct: null,
      audience_curiosidade_externa_pct: null,
      audience_alta_rotatividade_pct: null,
      observed_content_clusters: null,
      setor_benchmark: null,
      nicho: null,
      proof_mechanism: null,
      expected_panksepp_system: null,
      real_panksepp_system: null,
      expected_schwartz: null,
      real_schwartz: null,
      values_affect_source: 'manual',
      values_affect_confidence: 'L1',
      updated_by: 'pet',
      updated_at: new Date().toISOString(),
    }
  )

  // ============================================================================
  // VALIDAÇÃO E SALVAMENTO
  // ============================================================================
  const handleSave = async () => {
    // 1. Validar a constraint física de soma do split de audiência (audience_split_sum)
    const n = formData.audience_nucleo_fiel_pct ?? 0
    const p = formData.audience_consumo_passivo_pct ?? 0
    const e = formData.audience_curiosidade_externa_pct ?? 0
    const r = formData.audience_alta_rotatividade_pct ?? 0
    const totalSoma = n + p + e + r

    if (totalSoma > 0 && Math.abs(totalSoma - 100) > 0.1) {
      alert(`❌ ERRO DE CONSTRAINT: A soma das fatias de audiência deve ser exatamente 100%. Soma atual: ${totalSoma}%`)
      return
    }

    // 2. Normalizar o timestamp para ser aceito por timestamp without time zone (sem o Z da string ISO)
    const dateClean = new Date().toISOString().replace('Z', '')

    const payloadSaneado = {
      ...formData,
      updated_at: dateClean
    } as ClientOnboarding

    const success = await onSave(payloadSaneado)
    if (success) {
      alert('✅ Onboarding salvo com sucesso!')
    } else {
      alert('❌ Erro ao salvar onboarding')
    }
  }

  // ============================================================================
  // GERENCIAMENTO DE BIO LINKS
  // ============================================================================
  const addBioLink = () => {
    const newLink: BioLink = { url: '', label: '' }
    setFormData({
      ...formData,
      bio_links: [...(formData.bio_links || []), newLink],
    })
  }

  const updateBioLink = (index: number, field: 'url' | 'label', value: string) => {
    const updated = [...(formData.bio_links || [])]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, bio_links: updated })
  }

  const removeBioLink = (index: number) => {
    setFormData({
      ...formData,
      bio_links: (formData.bio_links || []).filter((_, i) => i !== index),
    })
  }

  // ============================================================================
  // TYPE GUARDS — Substituem `as any` por null seguro
  // ============================================================================

  /**
   * Type guard para CTAType
   * Retorna true se o valor é um CTAType válido, false caso contrário
   */
  const isCTAType = (value: string | null | undefined): value is CTAType => {
    if (!value) return false
    return ['link_direto', 'linktree_multilink', 'dm_comentario', 'nenhum'].includes(value)
  }

  /**
   * Type guard para FunnelMaturity
   */
  const isFunnelMaturity = (value: string | null | undefined): value is FunnelMaturity => {
    if (!value) return false
    return ['nao_implementado', 'implementado_fragmentado', 'implementado_unificado'].includes(
      value
    )
  }

  /**
   * Type guard para SetorBenchmark
   */
  const isSetorBenchmark = (value: string | null | undefined): value is SetorBenchmark => {
    if (!value) return false
    return [
      'comercio_direto_ecommerce_social',
      'comissionamento_afiliados',
      'infoprodutor_educador_pago',
      'servico_consultoria_profissional',
      'patrocinio_publicidade_marca',
      'membership_assinatura_comunidade',
      'monetizacao_nativa_plataforma',
      'autoridade_personal_branding_b2b',
      'pre_monetizacao_a_validar',
    ].includes(value)
  }

  /**
   * Type guard para ProofMechanism
   */
  const isProofMechanism = (value: string | null | undefined): value is ProofMechanism => {
    if (!value) return false
    return [
      'prova_social',
      'autoridade',
      'escassez_urgencia',
      'associacao_marca',
      'resultado_documentado',
      'nenhum_observavel',
    ].includes(value)
  }

  /**
   * Type guard para PankseppSystem
   */
  const isPankseppSystem = (value: string | null | undefined): value is PankseppSystem => {
    if (!value) return false
    return ['SEEKING', 'CARE', 'PLAY', 'LUST', 'FEAR', 'RAGE', 'PANIC_GRIEF'].includes(value)
  }

  // ============================================================================
  // HELPER: Atualiza campo enum com type guard seguro
  // ============================================================================
  const updateEnumField = <T extends string>(
    field: keyof ClientOnboarding,
    value: string,
    typeGuard: (val: string | null | undefined) => val is T
  ) => {
    const safeValue = value === '' ? null : typeGuard(value) ? value : null
    setFormData({ ...formData, [field]: safeValue })
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      <SectionHead title="Onboarding do Cliente" subtitle="Configure os dados estratégicos" />

      <div className="flex flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        {/* ====================================================================
            SEGUIDORES
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Total de Seguidores</label>
          <input
            type="number"
            value={formData.total_followers || 0}
            onChange={(e) =>
              setFormData({ ...formData, total_followers: parseInt(e.target.value) || 0 })
            }
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
          />
        </div>

        {/* ====================================================================
            FONTE DE SEGUIDORES
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Fonte de Seguidores</label>
          <select
            value={formData.total_followers_source || 'manual_print_confirmado'}
            onChange={(e) => {
              const value = e.target.value
              const validSources = ['manual_print_confirmado', 'instagram_api', 'estimate'] as const
              const safeValue = validSources.includes(value as typeof validSources[number])
                ? (value as typeof validSources[number])
                : 'manual_print_confirmado'
              setFormData({ ...formData, total_followers_source: safeValue })
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
          >
            <option value="manual_print_confirmado">Manual (Print Confirmado)</option>
            <option value="instagram_api">Instagram API</option>
            <option value="estimate">Estimativa</option>
          </select>
        </div>

        {/* ====================================================================
            BIO LINKS
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Links na Bio</label>
          {(formData.bio_links || []).map((link, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                placeholder="URL"
                value={link.url}
                onChange={(e) => updateBioLink(idx, 'url', e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
              />
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={(e) => updateBioLink(idx, 'label', e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
              />
              <button
                onClick={() => removeBioLink(idx)}
                className="rounded-lg bg-red-900/30 px-3 py-2 text-red-400 hover:bg-red-900/50"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addBioLink}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-zinc-300 hover:bg-zinc-700"
          >
            + Adicionar Link
          </button>
        </div>

        {/* ====================================================================
            CTA TYPE — ✅ Type guard ao invés de `as any`
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Tipo de CTA</label>
          <select
            value={formData.cta_type || ''}
            onChange={(e) => updateEnumField('cta_type', e.target.value, isCTAType)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
          >
            <option value="">Selecione...</option>
            <option value="link_direto">Link Direto</option>
            <option value="linktree_multilink">Linktree / Multilink</option>
            <option value="dm_comentario">DM / Comentário</option>
            <option value="nenhum">Nenhum</option>
          </select>
        </div>

        {/* ====================================================================
            FUNNEL MATURITY — ✅ Type guard ao invés de `as any`
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Maturidade do Funil</label>
          <select
            value={formData.funnel_maturity || ''}
            onChange={(e) => updateEnumField('funnel_maturity', e.target.value, isFunnelMaturity)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
          >
            <option value="">Selecione...</option>
            <option value="nao_implementado">Não Implementado</option>
            <option value="implementado_fragmentado">Implementado (Fragmentado)</option>
            <option value="implementado_unificado">Implementado (Unificado)</option>
          </select>
        </div>

        {/* ====================================================================
            PERGUNTAS DE ENGAJAMENTO
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">
            Q1: Período de Engajamento
          </label>
          <textarea
            value={formData.q1_engagement_period_notes || ''}
            onChange={(e) =>
              setFormData({ ...formData, q1_engagement_period_notes: e.target.value || null })
            }
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Q2: Proxy de Conteúdo</label>
          <textarea
            value={formData.q2_content_proxy_notes || ''}
            onChange={(e) =>
              setFormData({ ...formData, q2_content_proxy_notes: e.target.value || null })
            }
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Q3: Desalinhamento</label>
          <textarea
            value={formData.q3_misalignment_notes || ''}
            onChange={(e) =>
              setFormData({ ...formData, q3_misalignment_notes: e.target.value || null })
            }
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            rows={3}
          />
        </div>

        {/* ====================================================================
            SPLIT DE AUDIÊNCIA
            ==================================================================== */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-300">Núcleo Fiel (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.audience_nucleo_fiel_pct || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setFormData({
                  ...formData,
                  audience_nucleo_fiel_pct: isNaN(val) ? null : val,
                })
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-300">Consumo Passivo (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.audience_consumo_passivo_pct || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setFormData({
                  ...formData,
                  audience_consumo_passivo_pct: isNaN(val) ? null : val,
                })
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-300">Curiosidade Externa (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.audience_curiosidade_externa_pct || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setFormData({
                  ...formData,
                  audience_curiosidade_externa_pct: isNaN(val) ? null : val,
                })
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-300">Alta Rotatividade (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.audience_alta_rotatividade_pct || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setFormData({
                  ...formData,
                  audience_alta_rotatividade_pct: isNaN(val) ? null : val,
                })
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            />
          </div>
        </div>

        {/* ====================================================================
            SETOR BENCHMARK — ✅ Type guard ao invés de `as any`
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Setor / Benchmark</label>
          <select
            value={formData.setor_benchmark || ''}
            onChange={(e) => updateEnumField('setor_benchmark', e.target.value, isSetorBenchmark)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
          >
            <option value="">Selecione...</option>
            <option value="comercio_direto_ecommerce_social">
              Comércio Direto / E-commerce Social
            </option>
            <option value="comissionamento_afiliados">Comissionamento / Afiliados</option>
            <option value="infoprodutor_educador_pago">Infoproduto / Educador Pago</option>
            <option value="servico_consultoria_profissional">
              Serviço / Consultoria Profissional
            </option>
            <option value="patrocinio_publicidade_marca">Patrocínio / Publicidade de Marca</option>
            <option value="membership_assinatura_comunidade">
              Membership / Assinatura / Comunidade
            </option>
            <option value="monetizacao_nativa_plataforma">Monetização Nativa da Plataforma</option>
            <option value="autoridade_personal_branding_b2b">
              Autoridade / Personal Branding B2B
            </option>
            <option value="pre_monetizacao_a_validar">Pré-Monetização / A Validar</option>
          </select>
        </div>

        {/* ====================================================================
            NICHO
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Nicho</label>
          <input
            type="text"
            value={formData.nicho || ''}
            onChange={(e) => setFormData({ ...formData, nicho: e.target.value || null })}
            placeholder="Ex: Fitness, E-commerce, Educação"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
          />
        </div>

        {/* ====================================================================
            PROOF MECHANISM — ✅ Type guard ao invés de `as any`
            ==================================================================== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">Mecanismo de Prova</label>
          <select
            value={formData.proof_mechanism || ''}
            onChange={(e) => updateEnumField('proof_mechanism', e.target.value, isProofMechanism)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
          >
            <option value="">Selecione...</option>
            <option value="prova_social">Prova Social</option>
            <option value="autoridade">Autoridade</option>
            <option value="escassez_urgencia">Escassez / Urgência</option>
            <option value="associacao_marca">Associação de Marca</option>
            <option value="resultado_documentado">Resultado Documentado</option>
            <option value="nenhum_observavel">Nenhum Observável</option>
          </select>
        </div>

        {/* ====================================================================
            PANKSEPP SYSTEMS — ✅ Type guard ao invés de `as any`
            ==================================================================== */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-300">Panksepp Esperado</label>
            <select
              value={formData.expected_panksepp_system || ''}
              onChange={(e) =>
                updateEnumField('expected_panksepp_system', e.target.value, isPankseppSystem)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            >
              <option value="">Selecione...</option>
              <option value="SEEKING">SEEKING</option>
              <option value="CARE">CARE</option>
              <option value="PLAY">PLAY</option>
              <option value="LUST">LUST</option>
              <option value="FEAR">FEAR</option>
              <option value="RAGE">RAGE</option>
              <option value="PANIC_GRIEF">PANIC_GRIEF</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-300">Panksepp Real</label>
            <select
              value={formData.real_panksepp_system || ''}
              onChange={(e) =>
                updateEnumField('real_panksepp_system', e.target.value, isPankseppSystem)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
            >
              <option value="">Selecione...</option>
              <option value="SEEKING">SEEKING</option>
              <option value="CARE">CARE</option>
              <option value="PLAY">PLAY</option>
              <option value="LUST">LUST</option>
              <option value="FEAR">FEAR</option>
              <option value="RAGE">RAGE</option>
              <option value="PANIC_GRIEF">PANIC_GRIEF</option>
            </select>
          </div>
        </div>

        {/* ====================================================================
            SAVE BUTTON
            ==================================================================== */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          {isSaving ? '💾 Salvando...' : '💾 Salvar Onboarding'}
        </button>
      </div>
    </main>
  )
}
