'use client'

import React, { useState, useCallback } from 'react'
import { ChevronRight, AlertCircle, HelpCircle, Loader, Lightbulb } from 'lucide-react'
import { useOnboarding } from '@/hooks/useOnboarding'
import { validateAudienceSum, validatePercentage } from '@/lib/onboarding/enums'
import {
  ENUM_TOTAL_FOLLOWERS_SOURCE,
  ENUM_CTA_TYPE,
  ENUM_FUNNEL_MATURITY,
  ENUM_SETOR_BENCHMARK,
  ENUM_PROOF_MECHANISM,
  ENUM_VALUES_AFFECT_SOURCE,
  ENUM_CONFIDENCE,
  ENUM_GENDER_CATEGORY,
  CURIOSIDADES_POR_SETOR,
} from '@/lib/onboarding/enums'
import type { ClientOnboarding, SetorBenchmark } from '@/types/orbit'
import styles from './OnboardingScreen.module.css'

// ============================================================================
// TIPOS
// ============================================================================

interface CampoConfig {
  id: keyof FormAnswers
  label: string
  tipo: 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'radio' | 'url'
  placeholder?: string
  tooltip?: string
  insight?: string // Dado setorial contextual
  step?: string
  opcoes?: { valor: string; label: string }[]
  validacao?: (valor: unknown) => { ok: boolean; erro?: string }
  alerta?: boolean
  obrigatorio?: boolean
}

interface Fase {
  id: string
  titulo: string
  descricao: string
  campos: CampoConfig[]

}


// ============================================================================
// FASES DO ONBOARDING COM INSIGHTS
// ============================================================================

const FASES: Fase[] = [
  {
    id: 'info_basica',
    titulo: 'Informações Básicas',
    descricao: 'Vamos começar com o essencial sobre sua conta',
    campos: [
      {
        id: 'total_followers',
        label: 'Total de seguidores',
        tipo: 'number',
        placeholder: '15000',
        obrigatorio: true,
        insight: 'O Brasil tem 150M usuários ativos em redes (70% da população). Seu tamanho ajuda a calibrar benchmarks.',
        validacao: (v) => {
          if (!v) return { ok: false, erro: 'Campo obrigatório' }
          const num = Number(v)
          if (!Number.isInteger(num) || num <= 0) {
            return { ok: false, erro: 'Deve ser um número inteiro maior que 0' }
          }
          return { ok: true }
        },
      },
      {
        id: 'total_followers_source',
        label: 'Fonte da informação',
        tipo: 'select',
        obrigatorio: true,
        opcoes: ENUM_TOTAL_FOLLOWERS_SOURCE.map(([v, l]) => ({ valor: v, label: l })),
        insight: 'Dados confirmados (print/scrape) são mais confiáveis que estimativas para benchmarking.',
        validacao: (v) => ({
          ok: !!v,
          erro: v ? undefined : 'Selecione uma fonte',
        }),
      },
    ],
  },
  {
    id: 'negocio',
    titulo: 'Seu Negócio',
    descricao: 'Categoria e modelo de monetização',
    campos: [
      {
        id: 'setor_benchmark',
        label: 'Setor / Benchmark',
        tipo: 'select',
        obrigatorio: true,
        opcoes: ENUM_SETOR_BENCHMARK.map(([v, l]) => ({ valor: v, label: l })),
        insight: 'Cada setor monetiza diferente. Comércio direto mede conversão; infoproduto mede lançamento; serviços medem lead.',
        validacao: (v) => ({
          ok: !!v,
          erro: v ? undefined : 'Selecione um setor',
        }),
      },
      {
        id: 'nicho',
        label: 'Nicho específico',
        tipo: 'text',
        placeholder: 'Ex: Marketing digital, gestão de tráfego...',
        tooltip: 'Nichos específicos convertem melhor que genéricos',
        insight: 'Nichos específicos (ex: "gestão de tráfego para clínicas") tendem a funcionar melhor que temas genéricos.',
      },
      {
        id: 'cta_type',
        label: 'Call-to-action principal',
        tipo: 'select',
        opcoes: ENUM_CTA_TYPE.map(([v, l]) => ({ valor: v, label: l })),
        insight: 'Link direto e WhatsApp são os CTAs mais comuns no Brasil para comércio direto.',
      },
    ],
  },
  {
    id: 'audiencia',
    titulo: 'Sua Audiência',
    descricao: 'Segmentação em % (soma deve ser ~100%)',
    campos: [
      {
        id: 'audience_nucleo_fiel_pct',
        label: 'Núcleo fiel (compra regularmente) %',
        tipo: 'number',
        placeholder: '30',
        step: '0.1',
        tooltip: 'Seu core de clientes leais',
        insight: 'Núcleo fiel é o segmento mais valioso — gera receita recorrente e recomendações.',
        validacao: validatePercentage,
      },
      {
        id: 'audience_consumo_passivo_pct',
        label: 'Consumo passivo (vê, não compra) %',
        tipo: 'number',
        placeholder: '40',
        step: '0.1',
        tooltip: 'Inspiração, curiosidade',
        insight: 'Consumo passivo é seu funil de topo — alimenta o núcleo fiel com conteúdo educativo.',
        validacao: validatePercentage,
      },
      {
        id: 'audience_curiosidade_externa_pct',
        label: 'Curiosidade externa (descobriu recentemente) %',
        tipo: 'number',
        placeholder: '20',
        step: '0.1',
        tooltip: 'Potencial novo cliente',
        insight: 'Curiosidade externa é tráfego novo — importante para crescimento, mas com conversão menor.',
        validacao: validatePercentage,
      },
      {
        id: 'audience_alta_rotatividade_pct',
        label: 'Alta rotatividade (segue/deixa) %',
        tipo: 'number',
        placeholder: '10',
        step: '0.1',
        tooltip: 'Viral, sem lealdade',
        insight: 'Alta rotatividade é comum em conteúdo viral — útil para alcance, mas sem valor de cliente.',
        validacao: validatePercentage,
      },
    ],
  },
  {
    id: 'avatar',
    titulo: 'Avatar do Cliente',
    descricao: 'Descreva seu cliente ideal',
    campos: [
      {
        id: 'expected_age_range',
        label: 'Faixa etária esperada',
        tipo: 'text',
        placeholder: '18-45',
        insight: 'Formato: idade_mínima-idade_máxima (ex: 18-45)',
        validacao: (v) => {
          if (!v) return { ok: true }
          const match = String(v).match(/^(\d+)-(\d+)$/)
          if (!match) {
            return { ok: false, erro: 'Formato: 18-45' }
          }
          const min = Number(match[1])
          const max = Number(match[2])
          if (min < 13 || max > 120 || min >= max) {
            return { ok: false, erro: 'Idade entre 13-120, mín < máx' }
          }
          return { ok: true }
        },
      },
      {
        id: 'avatar_expected_gender',
        label: 'Gênero predominante',
        tipo: 'select',
        opcoes: ENUM_GENDER_CATEGORY.map(([v, l]) => ({ valor: v, label: l })),
        insight: 'Gênero é uma dimensão importante para validar alinhamento de audiência.',
      },
    ],
  },
  {
    id: 'funil',
    titulo: 'Seu Funil',
    descricao: 'Estrutura de conversão',
    campos: [
      {
        id: 'funnel_maturity',
        label: 'Maturidade do funil',
        tipo: 'select',
        opcoes: ENUM_FUNNEL_MATURITY.map(([v, l]) => ({ valor: v, label: l })),
        insight: 'Funil maduro (automação + sequência) escala sem atendimento manual. Sem funil, limite é ~50 vendas/mês.',
      },
      {
        id: 'bio_links',
        label: 'Links na bio (separados por vírgula)',
        tipo: 'textarea',
        placeholder: 'https://link1.com, https://link2.com',
        tooltip: 'URLs que você coloca na bio do Instagram',
        insight: '64% dos consumidores checam preço antes de comprar. Links claros na bio aumentam conversão.',
        validacao: (v) => {
          if (!v) return { ok: true }
          const links = String(v).split(',').map(l => l.trim()).filter(Boolean)
          const invalid = links.filter((link) => {
            try {
              const url = new URL(link)
              return url.protocol !== 'http:' && url.protocol !== 'https:'
            } catch {
              return true
            }
          })
          if (invalid.length > 0) {
            return { ok: false, erro: `URLs inválidas: ${invalid.join(', ')}` }
          }
          return { ok: true }
        },
      },
    ],
  },
  {
    id: 'prova_social',
    titulo: 'Confiança & Prova Social',
    descricao: 'Como você prova que funciona',
    campos: [
      {
        id: 'proof_mechanism',
        label: 'Mecanismo de prova social',
        tipo: 'select',
        opcoes: ENUM_PROOF_MECHANISM.map(([v, l]) => ({ valor: v, label: l })),
        tooltip: 'Selecione todos que se aplicam',
        insight: '39% dos consumidores leem comentários antes de comprar. Prova social reduz devoluções em 60%.',
      },
      {
        id: 'values_affect_source',
        label: 'Origem dos dados de confiança',
        tipo: 'select',
        opcoes: ENUM_VALUES_AFFECT_SOURCE.map(([v, l]) => ({ valor: v, label: l })),
        insight: 'Dados confirmados (manual/feedback) são mais confiáveis que inferências para decisões.',
      },
      {
        id: 'confidence_diagnostico',
        label: 'Confiança do diagnóstico',
        tipo: 'select',
        opcoes: ENUM_CONFIDENCE.map(([v, l]) => ({ valor: v, label: l })),
        insight: 'L0 = confirmado; L1 = fundamentado; L2 = depende de dado ausente. Afeta recomendações.',
      },
    ],
  },
]

// ============================================================================
// COMPONENTE DE CAMPO
// ============================================================================

interface CampoProps {
  campo: CampoConfig
  valor: unknown
  erro?: string
  onChange: (valor: unknown) => void
}

const toInputValue = (valor: unknown): string => {
  if (typeof valor === 'string' || typeof valor === 'number') {
    return String(valor)
  }

  return ''
}

const CampoInput: React.FC<CampoProps> = ({ campo, valor, erro, onChange }) => {
  switch (campo.tipo) {
    case 'text':
    case 'number':
    case 'url':
      return (
        <div>
          <input
            type={campo.tipo === 'url' ? 'url' : campo.tipo}
            placeholder={campo.placeholder}
            value={toInputValue(valor)}
            onChange={(e) => onChange(e.target.value)}
            step={campo.step}
            className={`${styles.input} ${erro ? styles.inputError : ''}`}
          />
          {erro && <p className={styles.errorText}>{erro}</p>}
        </div>
      )

    case 'textarea':
      return (
        <div>
          <textarea
            placeholder={campo.placeholder}
            value={toInputValue(valor)}
            onChange={(e) => onChange(e.target.value)}
            className={`${styles.textarea} ${erro ? styles.inputError : ''}`}
            rows={3}
          />
          {erro && <p className={styles.errorText}>{erro}</p>}
        </div>
      )

    case 'select':
      return (
        <div>
          <select
            value={toInputValue(valor)}
            onChange={(e) => onChange(e.target.value)}
            className={`${styles.input} ${erro ? styles.inputError : ''}`}
          >
            <option value="">Selecione uma opção</option>
            {campo.opcoes?.map((opt) => (
              <option key={opt.valor} value={opt.valor}>
                {opt.label}
              </option>
            ))}
          </select>
          {erro && <p className={styles.errorText}>{erro}</p>}
        </div>
      )

    case 'radio':
      return (
        <div className={styles.radioGroup}>
          {campo.opcoes?.map((opt) => (
            <label key={opt.valor} className={styles.radioLabel}>
              <input
                type="radio"
                name={String(campo.id)}
                value={opt.valor}
                checked={valor === opt.valor}
                onChange={(e) => onChange(e.target.value)}
                className={styles.radioInput}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          {erro && <p className={styles.errorText}>{erro}</p>}
        </div>
      )

    case 'checkbox':
      return (
        <div className={styles.checkboxGroup}>
          {campo.opcoes?.map((opt) => (
            <label key={opt.valor} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                value={opt.valor}
                checked={Array.isArray(valor) && valor.includes(opt.valor)}
                onChange={(e) => {
                  const arr = Array.isArray(valor) ? valor : []
                  if (e.target.checked) {
                    onChange([...arr, opt.valor])
                  } else {
                    onChange(arr.filter((v) => v !== opt.valor))
                  }
                }}
                className={styles.checkboxInput}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          {erro && <p className={styles.errorText}>{erro}</p>}
        </div>
      )

    default:
      return null
  }
}

// ============================================================================
// COMPONENTE DE INSIGHT SETORIAL
// ============================================================================

interface InsightCardProps {
  setor?: SetorBenchmark
}

const InsightCard: React.FC<InsightCardProps> = ({ setor }) => {
  if (!setor || typeof setor !== 'string' || !(setor in CURIOSIDADES_POR_SETOR)) return null

  const curiosidade = CURIOSIDADES_POR_SETOR[setor as keyof typeof CURIOSIDADES_POR_SETOR]

  return (
    <div className={styles.insightCard}>
      <div className={styles.insightHeader}>
        <Lightbulb className={styles.insightIcon} />
        <h3 className={styles.insightTitle}>{curiosidade.titulo}</h3>
      </div>
      <p className={styles.insightText}>{curiosidade.texto}</p>
      <p className={styles.insightSource}>Fonte: {curiosidade.fonte}</p>
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

interface OnboardingScreenProps {
  clientId: string
  initialData?: ClientOnboarding | null
}

const toFormAnswers = (onboarding: ClientOnboarding | null): FormAnswers => {
  if (!onboarding) return {}

  const { bio_links: bioLinks, avatar_expected_age_min: ageMin, avatar_expected_age_max: ageMax, ...rest } = onboarding

  return {
    ...rest,
    bio_links: bioLinks.map((link) => link.url).join(', '),
    expected_age_range: ageMin !== null && ageMax !== null ? `${ageMin}-${ageMax}` : '',
  }
}

const toNullableNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error('Há um valor numérico inválido no formulário')
  return number
}

export default function OnboardingScreen({ clientId, initialData = null }: OnboardingScreenProps): React.ReactElement {
  const { data, status, error, save } = useOnboarding(clientId)
  const [faseAtual, setFaseAtual] = useState(0)
  const incomingData = data ?? (status === 'idle' || status === 'loading' ? initialData : null)
  const [formState, setFormState] = useState<OnboardingFormState>(() => ({
    clientId,
    source: incomingData,
    answers: toFormAnswers(incomingData),
  }))

  if (formState.clientId !== clientId || formState.source !== incomingData) {
    setFormState({ clientId, source: incomingData, answers: toFormAnswers(incomingData) })
  }

  const respostas = formState.answers
  const [erros, setErros] = useState<Record<string, string>>({})
  const [savingError, setSavingError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const fase = FASES[faseAtual] ?? FASES[0]
  const totalFases = FASES.length
  const progresso = totalFases > 0 ? ((faseAtual + 1) / totalFases) * 100 : 0

  // Insight setorial contextual
  const setorSelecionado = respostas.setor_benchmark as SetorBenchmark | undefined

  const handleResposta = useCallback((campoId: keyof FormAnswers, valor: unknown) => {
    setFormState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [campoId]: valor } as FormAnswers,
    }))
    setErros((prev) => {
      const newErros = { ...prev }
      delete newErros[String(campoId)]
      return newErros
    })
  }, [])

  const validarFase = useCallback((): boolean => {
    if (!fase) return false

    const novosErros: Record<string, string> = {}

    for (const campo of fase.campos) {
      const campoKey = String(campo.id)
      const valor = respostas[campo.id as keyof FormAnswers]

      if (campo.obrigatorio && !valor) {
        novosErros[campoKey] = `${campo.label} é obrigatório`
        continue
      }

      if (campo.validacao && valor !== undefined && valor !== null && valor !== '') {
        const resultado = campo.validacao(valor)
        if (!resultado.ok && resultado.erro) {
          novosErros[campoKey] = resultado.erro
        }
      }
    }

    if (fase.id === 'audiencia') {
      const audienceValidation = validateAudienceSum(respostas)
      if (!audienceValidation.ok) {
        const somaAtual = Number.isFinite(audienceValidation.sum) ? audienceValidation.sum : 0
        novosErros.audience_sum = `A soma dos percentuais deve ficar próxima de 100% (atual: ${somaAtual.toFixed(1)}%)`
      }
    }

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }, [fase, respostas])

  const handleSalvar = useCallback(async () => {
    try {
      setIsSaving(true)
      setSavingError(null)

      if (!clientId) {
        throw new Error('ID do cliente não fornecido')
      }

      const totalFollowers = toNullableNumber(respostas.total_followers)
      const followersSource = respostas.total_followers_source
      if (totalFollowers === null || totalFollowers <= 0 || !followersSource) {
        throw new Error('Preencha total de seguidores e sua fonte antes de salvar')
      }

      const ageRange = respostas.expected_age_range?.trim()
      const ageMatch = ageRange ? ageRange.match(/^(\d+)-(\d+)$/) : null
      if (ageRange && !ageMatch) throw new Error('Faixa etária inválida; use o formato 18-45')
      const payload = {
        client_id: clientId,
        total_followers: totalFollowers,
        total_followers_source: followersSource,
        audience_nucleo_fiel_pct: toNullableNumber(respostas.audience_nucleo_fiel_pct),
        audience_consumo_passivo_pct: toNullableNumber(respostas.audience_consumo_passivo_pct),
        audience_curiosidade_externa_pct: toNullableNumber(respostas.audience_curiosidade_externa_pct),
        audience_alta_rotatividade_pct: toNullableNumber(respostas.audience_alta_rotatividade_pct),
        cta_type: respostas.cta_type,
        funnel_maturity: respostas.funnel_maturity,
        q1_engagement_period_notes: respostas.q1_engagement_period_notes,
        q2_content_proxy_notes: respostas.q2_content_proxy_notes,
        q3_misalignment_notes: respostas.q3_misalignment_notes,
        observed_content_clusters: respostas.observed_content_clusters,
        nicho: respostas.nicho,
        setor_benchmark: respostas.setor_benchmark,
        proof_mechanism: respostas.proof_mechanism,
        values_affect_source: respostas.values_affect_source,
        values_affect_confidence: respostas.values_affect_confidence,
        confidence_seguidores: respostas.confidence_seguidores,
        confidence_bio_funil: respostas.confidence_bio_funil,
        confidence_diagnostico: respostas.confidence_diagnostico,
        confidence_audiencia: respostas.confidence_audiencia,
        avatar_expected_age_min: ageMatch ? Number(ageMatch[1]) : null,
        avatar_expected_age_max: ageMatch ? Number(ageMatch[2]) : null,
        avatar_expected_gender: respostas.avatar_expected_gender,
        avatar_expected_gender_pct: respostas.avatar_expected_gender_pct,
        bio_links: typeof respostas.bio_links === 'string'
          ? respostas.bio_links.split(',').map((link) => link.trim()).filter(Boolean).map((url) => ({ url, label: url }))
          : respostas.bio_links ?? [],
      }

      if (!(await save(payload))) throw new Error('Falha ao salvar os dados do onboarding')

      setSavingError(null)
      setTimeout(() => {
        setFaseAtual(0)
        setFormState((prev) => ({ ...prev, answers: {} }))
        setErros({})
      }, 2000)
    } catch (err) {
      setSavingError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }, [clientId, respostas, save])

  const handleVoltar = useCallback(() => {
    if (faseAtual > 0) {
      setFaseAtual(faseAtual - 1)
    }
  }, [faseAtual])

  if (!fase) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <p>Carregando onboarding...</p>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Loader className={styles.loaderIcon} />
          <p>Carregando dados...</p>
        </div>
      </div>
    )
  }

  if (status === 'error' && error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle className={styles.errorIcon} />
          <p>Erro ao carregar: {error}</p>
        </div>
      </div>
    )
  }

  function handleProximo(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault()

    if (isSaving || !validarFase()) return

    if (faseAtual === totalFases - 1) {
      void handleSalvar()
      return
    }

    setFaseAtual((atual) => Math.min(atual + 1, totalFases - 1))
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {status === 'not_found' && (
          <div className={`${styles.message} ${styles.messageWarning}`}>
            Nenhum onboarding cadastrado para este cliente.
          </div>
        )}
        {savingError && (
          <div className={`${styles.message} ${styles.messageError}`}>
            <AlertCircle className={styles.messageIcon} />
            {savingError}
          </div>
        )}

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🎯 ORBIT Onboarding</h1>
            <p className={styles.subtitle}>
              {faseAtual + 1} de {totalFases}
            </p>
          </div>
          <div className={styles.progress}>
            <div className={styles.progressValue}>{Math.round(progresso)}%</div>
          </div>
        </div>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progresso}%` }}
          />
        </div>

        {/* Insight setorial contextual */}
        {setorSelecionado && faseAtual === 1 && (
          <InsightCard setor={setorSelecionado} />
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{fase.titulo}</h2>
          <p className={styles.cardDescription}>{fase.descricao}</p>

          {erros.audience_sum && (
            <div className={`${styles.message} ${styles.messageWarning}`}>
              {erros.audience_sum}
            </div>
          )}

          <div className={styles.fieldsContainer}>
            {fase.campos.map((campo) => (
              <div key={String(campo.id)} className={styles.fieldWrapper}>
                <div className={styles.labelContainer}>
                  <label className={styles.label}>
                    {campo.label}
                    {campo.obrigatorio && <span className={styles.required}>*</span>}
                  </label>
                  {campo.alerta && <AlertCircle className={styles.alertIcon} />}
                  {campo.tooltip && (
                    <div className={styles.tooltipWrapper}>
                      <HelpCircle className={styles.helpIcon} />
                      <div className={styles.tooltip}>{campo.tooltip}</div>
                    </div>
                  )}
                </div>

                <CampoInput
                  campo={campo}
                  valor={respostas[campo.id as keyof FormAnswers]}
                  erro={erros[String(campo.id)]}
                  onChange={(valor) => handleResposta(campo.id as keyof FormAnswers, valor)}
                />

                {/* Insight contextual do campo */}
                {campo.insight && (
                  <div className={styles.fieldInsight}>
                    <Lightbulb className={styles.fieldInsightIcon} />
                    <span>{campo.insight}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={handleVoltar}
            disabled={isSaving || faseAtual === 0}
            className={styles.buttonSecondary}
          >
            ← Voltar
          </button>
          <button
            onClick={handleProximo}
            disabled={isSaving}
            className={styles.buttonPrimary}
          >
            {isSaving ? (
              <>
                <Loader className={styles.loaderIcon} />
                Salvando...
              </>
            ) : (
              <>
                {faseAtual === totalFases - 1 ? 'Finalizar' : 'Próximo'}
                {faseAtual < totalFases - 1 && <ChevronRight className={styles.chevronIcon} />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

type FormAnswers = Partial<Omit<ClientOnboarding, 'bio_links'>> & {
  bio_links?: string | ClientOnboarding['bio_links'] | null
  expected_age_range?: string
}

interface OnboardingFormState {
  clientId: string
  source: ClientOnboarding | null
  answers: FormAnswers
}