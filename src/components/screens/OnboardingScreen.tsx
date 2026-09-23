'use client'

/* ==========================================================================
   ORBIT · Screen — OnboardingScreen (v2.0 — UX view/edit + dossiê)
   Versão: 2.0.0  |  Data: 2026-09-12

   ✅ INTEGRAÇÃO (12/09/2026) — adaptado do rascunho de UX recebido. Diferenças
   em relação ao rascunho original, decididas com o time antes de integrar:

   1) syncState/localStorage como FALLBACK DE DADO removido por decisão
      explícita ("sempre salva direto no Supabase como hoje") — não existe
      em nenhum outro repositório do Orbit, era uma feature nova não pedida.
      `save()` do hook real devolve só `boolean`; a tela trata sucesso/erro,
      sem estado "salvo localmente"/"sincronizado".
   2) `useSession` de '@supabase/auth-helpers-react' removido — o pacote não
      está instalado no projeto. Autor do log de mudanças agora vem de
      `supabase.auth.getUser()` (mesmo padrão já usado em
      src/lib/auth/admin-guard.ts), buscado no momento do save.
   3) Hook real (`useOnboarding.ts`) já busca sozinho no mount e expõe
      `{ data, status, error, save, refetch }` — não `{ record, syncState,
      loading, fetchRecord, saveRecord }` do rascunho. Esta tela agora chama
      o hook diretamente (self-contained) em vez de receber
      initialData/onSave/isSaving como props controladas — ver page.tsx.
   4) O log de histórico (`orbit_onboarding_log_{clientId}` no localStorage)
      foi mantido — é só um audit trail de leitura local, não fallback de
      dado, então não conflita com a decisão do item 1.
   5) Bug do rascunho corrigido: a linha de edição Schwartz tem 4 campos
      (chave, valor, prioridade, remover) mas a classe CSS `.repRow.schwartz`
      (grid de 4 colunas) nunca era aplicada no JSX — só `.repRow` (3
      colunas) — layout quebrava. Corrigido abaixo.
   6) `priority` do Schwartz tipado como `SchwatzValue['priority']`
      ('high'|'medium'|'low'), não `string` solto — evita erro de tsc ao
      gravar de volta no objeto.
   ========================================================================== */

import React, { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './OnboardingScreen.module.css'
import { useOnboarding } from '@/hooks/useOnboarding'
import {
  completeness,
  validateAudienceSum,
  summarizeChanges,
  fmtDate,
  VOCAB,
  HELP,
  isFilled,
} from '@/lib/onboarding/helpers'
import {
  ENUM_TOTAL_FOLLOWERS_SOURCE,
  ENUM_CTA,
  ENUM_FUNNEL,
  ENUM_SETOR,
  ENUM_PROOF,
  ENUM_AFFECT_SOURCE,
  ENUM_CONFIDENCE,
  labelFor,
} from '@/lib/onboarding/enums'
import type {
  ClientOnboarding,
  BioLink,
  CTAType,
  FunnelMaturity,
  TotalFollowersSource,
  SetorBenchmark,
  ProofMechanism,
  ValuesAffectSource,
  ConfidenceLevel,
} from '@/types/orbit'

interface OnboardingScreenProps {
  clientId: string
  initialData?: ClientOnboarding | null
}

type Mode = 'view' | 'edit' | 'loading'

// ── Rótulo de campo com (?) de ajuda e (!) de "sem valor" ───────────────
// (?) abre um popover com o texto de VOCAB no hover/foco/clique — evita a
// poluição de um parágrafo de ajuda sempre visível embaixo de cada campo.
// (!) marca campo vazio de forma explícita, sem depender de cor (vermelho/
// verde já carregam outro significado nesta tela — ver .sumCheck) — mais
// fácil de notar rápido do que ficar comparando cores.
function FieldLabel({
  children,
  help,
  missing,
}: {
  children: React.ReactNode
  help?: string
  missing?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <label className={styles.fieldLabel}>
      <span>{children}</span>
      {missing && (
        <span className={styles.missingFlag} title="Ainda sem valor" aria-label="Campo sem valor">
          !
        </span>
      )}
      {help && (
        <span className={styles.fieldHelp}>
          <button
            type="button"
            className={styles.fieldHelpTrigger}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onFocus={() => setShow(true)}
            onBlur={() => setShow(false)}
            onClick={() => setShow((s) => !s)}
            aria-label="Mais informações sobre este campo"
          >
            ?
          </button>
          {show && <span className={styles.fieldHelpPopover}>{help}</span>}
        </span>
      )}
    </label>
  )
}

interface LogEntry {
  ts: string
  who: string
  changes: string[]
}

const AUD_COLORS = ['var(--neon-cyan)', 'var(--amber)', 'var(--acc2)', 'var(--red)']

export default function OnboardingScreen({
  clientId,
  initialData,
}: OnboardingScreenProps): React.ReactElement {
  const { data: record, status, error: hookError, save, refetch } = useOnboarding(clientId)
  const loading = status === 'loading' || status === 'idle'

  const [mode, setMode] = useState<Mode>('loading')
  const [draft, setDraft] = useState<Partial<ClientOnboarding> | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>(() => {
    if (typeof window === 'undefined') return []

    try {
      const stored = localStorage.getItem(`orbit_onboarding_log_${clientId}`)
      return stored ? (JSON.parse(stored) as LogEntry[]) : []
    } catch {
      return []
    }
  })

  const effectiveRecord = record ?? initialData ?? null

  // ============================================================================
  // LOG (audit trail local — não é fallback de dado, ver nota 4 no cabeçalho)
  // ============================================================================
  const pushLog = useCallback(
    (entry: LogEntry) => {
      setLog((current) => {
        const updated = [entry, ...current].slice(0, 30)
        try {
          localStorage.setItem(`orbit_onboarding_log_${clientId}`, JSON.stringify(updated))
        } catch {
          // localStorage indisponível (modo privado, quota) — log só some da
          // sessão atual, não bloqueia o save real (que já foi ao Supabase).
        }
        return updated
      })
    },
    [clientId]
  )

  const displayMode: Mode = loading
    ? 'loading'
    : mode === 'loading'
      ? effectiveRecord
        ? 'view'
        : 'edit'
      : mode

  // ============================================================================
  // EDIT / CANCEL / SAVE
  // ============================================================================
  const handleEdit = (): void => {
    setDraft(effectiveRecord ? JSON.parse(JSON.stringify(effectiveRecord)) : {})
    setMode('edit')
  }

  const handleCancel = (): void => {
    setMode('view')
    setDraft(null)
  }

  const handleSave = async (): Promise<void> => {
    if (!draft) return

    const check = validateAudienceSum(draft)
    if (!check.ok) {
      setError(
        `❌ Soma dos quadrantes de audiência deve ser ~100%. Está em ${check.sum.toFixed(1)}%.`
      )
      setTimeout(() => setError(null), 5000)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload: ClientOnboarding = {
        ...(effectiveRecord ?? undefined),
        ...draft,
        client_id: clientId,
        updated_by: user?.email ?? 'desconhecido',
        updated_at: new Date().toISOString(),
      } as ClientOnboarding

      const ok = await save(payload)
      if (!ok) {
        throw new Error('Falha ao salvar onboarding (ver console/RLS)')
      }

      pushLog({
        ts: new Date().toISOString(),
        who: user?.email ?? 'desconhecido',
        changes: summarizeChanges(effectiveRecord, draft),
      })

      setSuccess('✅ Onboarding salvo com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
      setMode('view')
      setDraft(null)
      refetch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      setError(`❌ ${msg}`)
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  // ============================================================================
  // BIO LINKS
  // ============================================================================
  const addBioLink = (): void => {
    if (!draft) return
    const newLink: BioLink = { url: '', label: '' }
    setDraft({
      ...draft,
      bio_links: [...(draft.bio_links || []), newLink],
    })
  }

  const updateBioLink = (index: number, field: 'url' | 'label', value: string): void => {
    if (!draft) return
    const updated = [...(draft.bio_links || [])]
    const current = updated[index]
    if (!current) return
    updated[index] = { ...current, [field]: value }
    setDraft({ ...draft, bio_links: updated })
  }

  const removeBioLink = (index: number): void => {
    if (!draft) return
    setDraft({
      ...draft,
      bio_links: (draft.bio_links || []).filter((_, i) => i !== index),
    })
  }

  // ============================================================================
  // RENDER: VIEW MODE
  // ============================================================================
  const renderView = (): React.ReactElement => {
    if (!effectiveRecord) return <div className={styles.empty}>Nenhum registro encontrado</div>

    const audVals = [
      effectiveRecord.audience_nucleo_fiel_pct,
      effectiveRecord.audience_consumo_passivo_pct,
      effectiveRecord.audience_curiosidade_externa_pct,
      effectiveRecord.audience_alta_rotatividade_pct,
    ]
    const audSum = audVals.reduce((a: number, v) => a + (parseFloat(String(v)) || 0), 0)
    const audAny = audVals.some((v) => v !== null && v !== undefined)

    return (
      <div className={styles.sections}>
        {/* 01. Seguidores */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>01</span> Seguidores
          </h2>
          <div className={styles.grid2}>
            <div>
              <dt>Total de seguidores</dt>
              <dd>{effectiveRecord.total_followers || '—'}</dd>
            </div>
            <div>
              <dt>Fonte</dt>
              <dd>
                {labelFor(ENUM_TOTAL_FOLLOWERS_SOURCE, effectiveRecord.total_followers_source) ||
                  '—'}
              </dd>
            </div>
          </div>
        </section>

        {/* 02. Bio, CTA e Funil */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>02</span> Bio, CTA e Funil
          </h2>
          <div className={styles.spaceY}>
            <div>
              <dt>Links da bio</dt>
              {effectiveRecord.bio_links && effectiveRecord.bio_links.length > 0 ? (
                <div className={styles.pillList}>
                  {effectiveRecord.bio_links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.pill}
                    >
                      {link.label || link.url}
                    </a>
                  ))}
                </div>
              ) : (
                <dd className={styles.empty}>nenhum link cadastrado</dd>
              )}
            </div>
            <div className={styles.grid2}>
              <div>
                <dt>Tipo de CTA</dt>
                <dd>{labelFor(ENUM_CTA, effectiveRecord.cta_type) || '—'}</dd>
              </div>
              <div>
                <dt>Maturidade do funil</dt>
                <dd>{labelFor(ENUM_FUNNEL, effectiveRecord.funnel_maturity) || '—'}</dd>
              </div>
            </div>
          </div>
        </section>

        {/* 03. Diagnóstico */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>03</span> Notas de Diagnóstico
          </h2>
          <div className={styles.spaceY}>
            {(
              [
                ['Q1 — Período de engajamento', effectiveRecord.q1_engagement_period_notes],
                ['Q2 — Proxy de conteúdo', effectiveRecord.q2_content_proxy_notes],
                ['Q3 — Desalinhamento', effectiveRecord.q3_misalignment_notes],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </div>
        </section>

        {/* 04. Audiência */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>04</span> Segmentação de Audiência
          </h2>
          <div className={styles.grid2}>
            {(
              [
                ['Núcleo fiel (%)', effectiveRecord.audience_nucleo_fiel_pct],
                ['Consumo passivo (%)', effectiveRecord.audience_consumo_passivo_pct],
                ['Curiosidade externa (%)', effectiveRecord.audience_curiosidade_externa_pct],
                ['Alta rotatividade (%)', effectiveRecord.audience_alta_rotatividade_pct],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? '—'}</dd>
              </div>
            ))}
          </div>
          {audAny && (
            <div className={styles.audMeterWrap}>
              <div className={styles.audMeter}>
                {audVals.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${Math.max(0, parseFloat(String(v)) || 0)}%`,
                      backgroundColor: AUD_COLORS[i],
                    }}
                  />
                ))}
              </div>
              <p className={styles.audLabel}>
                Soma: {audSum.toFixed(1)}% {Math.abs(audSum - 100) < 0.15 ? '✓' : '⚠'}
              </p>
            </div>
          )}
        </section>

        {/* 05. Contexto de Negócio */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>05</span> Contexto de Negócio
          </h2>
          <div className={styles.spaceY}>
            {(
              [
                ['Clusters de conteúdo', effectiveRecord.observed_content_clusters],
                ['Setor / benchmark', labelFor(ENUM_SETOR, effectiveRecord.setor_benchmark)],
                ['Nicho', effectiveRecord.nicho],
                ['Mecanismo de prova', labelFor(ENUM_PROOF, effectiveRecord.proof_mechanism)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </div>
        </section>

        {/* 06. Metadados */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>06</span> Metadados
          </h2>
          <div className={styles.grid2}>
            {(
              [
                [
                  'Fonte (values/affect)',
                  labelFor(ENUM_AFFECT_SOURCE, effectiveRecord.values_affect_source),
                ],
                [
                  'Confiança (registro inteiro — legado)',
                  labelFor(ENUM_CONFIDENCE, effectiveRecord.values_affect_confidence),
                ],
                ['Atualizado por', effectiveRecord.updated_by],
                ['Atualizado em', fmtDate(effectiveRecord.updated_at)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </div>
          <p className={styles.help}>
            O campo Confiança — registro inteiro é herdado e não reflete que partes diferentes
            do formulário têm origem diferente (ex.: seguidores costuma ser medido, Q3 é quase
            sempre hipótese). Use a confiança por seção abaixo, preenchida em cada bloco.
          </p>
          <div className={styles.grid2}>
            {(
              [
                ['Confiança — Seguidores', labelFor(ENUM_CONFIDENCE, effectiveRecord.confidence_seguidores)],
                ['Confiança — Bio/CTA/Funil', labelFor(ENUM_CONFIDENCE, effectiveRecord.confidence_bio_funil)],
                ['Confiança — Diagnóstico', labelFor(ENUM_CONFIDENCE, effectiveRecord.confidence_diagnostico)],
                ['Confiança — Audiência', labelFor(ENUM_CONFIDENCE, effectiveRecord.confidence_audiencia)],
                ['Confiança — Negócio', labelFor(ENUM_CONFIDENCE, effectiveRecord.confidence_negocio)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '— não classificado —'}</dd>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  // ============================================================================
  // RENDER: EDIT MODE
  // ============================================================================
  const renderEdit = (): React.ReactElement | null => {
    if (!draft) return null

    const audVals = [
      draft.audience_nucleo_fiel_pct,
      draft.audience_consumo_passivo_pct,
      draft.audience_curiosidade_externa_pct,
      draft.audience_alta_rotatividade_pct,
    ]
    const audSum = audVals.reduce((a: number, v) => a + (parseFloat(String(v)) || 0), 0)
    const audAny = audVals.some((v) => v !== null && v !== undefined && (v as unknown) !== '')
    const audOk = Math.abs(audSum - 100) < 0.15

    const audienceFields = [
      ['audience_nucleo_fiel_pct', 'Núcleo fiel (%)'],
      ['audience_consumo_passivo_pct', 'Consumo passivo (%)'],
      ['audience_curiosidade_externa_pct', 'Curiosidade externa (%)'],
      ['audience_alta_rotatividade_pct', 'Alta rotatividade (%)'],
    ] as const

    return (
      <div className={styles.sections}>
        {/* 01. Cliente e Seguidores */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>01</span> Cliente e Seguidores
          </h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label>client_id</label>
              <input type="text" value={clientId} disabled className={styles.disabled} />
            </div>
            <div className={styles.field}>
              <FieldLabel help={VOCAB.total_followers} missing={!isFilled('total_followers', draft)}>
                Total de seguidores
              </FieldLabel>
              <input
                type="number"
                value={draft.total_followers || 0}
                onChange={(e) =>
                  setDraft({ ...draft, total_followers: parseInt(e.target.value, 10) || 0 })
                }
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <FieldLabel
                help={VOCAB.total_followers_source}
                missing={!isFilled('total_followers_source', draft)}
              >
                Fonte
              </FieldLabel>
              <select
                value={draft.total_followers_source || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    total_followers_source: e.target.value as TotalFollowersSource,
                  })
                }
                className={styles.select}
              >
                <option value="">— selecione —</option>
                {ENUM_TOTAL_FOLLOWERS_SOURCE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <FieldLabel
                help={VOCAB.confidence_section}
                missing={!isFilled('confidence_seguidores', draft)}
              >
                Confiança desta seção
              </FieldLabel>
              <select
                value={draft.confidence_seguidores || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    confidence_seguidores: (e.target.value || null) as ConfidenceLevel | null,
                  })
                }
                className={styles.select}
              >
                <option value="">— não classificado —</option>
                {ENUM_CONFIDENCE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 02. Bio, CTA e Funil */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>02</span> Bio, CTA e Funil
          </h2>
          <div className={styles.spaceY}>
            <div>
              <FieldLabel help={VOCAB.bio_links} missing={!isFilled('bio_links', draft)}>
                Links da bio
              </FieldLabel>
              <div className={styles.repRows}>
                {(draft.bio_links || []).map((link, idx) => (
                  <div key={idx} className={styles.repRow}>
                    <input
                      type="text"
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) => updateBioLink(idx, 'url', e.target.value)}
                      className={styles.input}
                    />
                    <input
                      type="text"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => updateBioLink(idx, 'label', e.target.value)}
                      className={styles.input}
                    />
                    <button
                      onClick={() => removeBioLink(idx)}
                      className={styles.btnRemove}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addBioLink} className={styles.btnAdd} type="button">
                + Adicionar link
              </button>
            </div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <FieldLabel help={VOCAB.cta_type} missing={!isFilled('cta_type', draft)}>
                  Tipo de CTA
                </FieldLabel>
                <select
                  value={draft.cta_type || ''}
                  onChange={(e) => setDraft({ ...draft, cta_type: e.target.value as CTAType })}
                  className={styles.select}
                >
                  <option value="">— selecione —</option>
                  {ENUM_CTA.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <FieldLabel
                  help={VOCAB.funnel_maturity}
                  missing={!isFilled('funnel_maturity', draft)}
                >
                  Maturidade do funil
                </FieldLabel>
                <select
                  value={draft.funnel_maturity || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, funnel_maturity: e.target.value as FunnelMaturity })
                  }
                  className={styles.select}
                >
                  <option value="">— selecione —</option>
                  {ENUM_FUNNEL.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <FieldLabel
                help={VOCAB.confidence_section}
                missing={!isFilled('confidence_bio_funil', draft)}
              >
                Confiança desta seção
              </FieldLabel>
              <select
                value={draft.confidence_bio_funil || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    confidence_bio_funil: (e.target.value || null) as ConfidenceLevel | null,
                  })
                }
                className={styles.select}
              >
                <option value="">— não classificado —</option>
                {ENUM_CONFIDENCE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 03. Diagnóstico */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>03</span> Notas de Diagnóstico
          </h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <FieldLabel help={VOCAB.q1} missing={!isFilled('q1_engagement_period_notes', draft)}>
                Q1 — Período de engajamento
              </FieldLabel>
              <textarea
                value={draft.q1_engagement_period_notes || ''}
                onChange={(e) =>
                  setDraft({ ...draft, q1_engagement_period_notes: e.target.value || null })
                }
                rows={3}
                className={styles.textarea}
              />
            </div>
            <div className={styles.field}>
              <FieldLabel help={VOCAB.q2} missing={!isFilled('q2_content_proxy_notes', draft)}>
                Q2 — Proxy de conteúdo
              </FieldLabel>
              <textarea
                value={draft.q2_content_proxy_notes || ''}
                onChange={(e) =>
                  setDraft({ ...draft, q2_content_proxy_notes: e.target.value || null })
                }
                rows={3}
                className={styles.textarea}
              />
            </div>
            <div className={styles.field}>
              <FieldLabel help={VOCAB.q3} missing={!isFilled('q3_misalignment_notes', draft)}>
                Q3 — Desalinhamento
              </FieldLabel>
              <textarea
                value={draft.q3_misalignment_notes || ''}
                onChange={(e) =>
                  setDraft({ ...draft, q3_misalignment_notes: e.target.value || null })
                }
                rows={3}
                className={styles.textarea}
              />
            </div>
            <div className={styles.field}>
              <FieldLabel
                help={VOCAB.confidence_section}
                missing={!isFilled('confidence_diagnostico', draft)}
              >
                Confiança desta seção
              </FieldLabel>
              <select
                value={draft.confidence_diagnostico || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    confidence_diagnostico: (e.target.value || null) as ConfidenceLevel | null,
                  })
                }
                className={styles.select}
              >
                <option value="">— não classificado —</option>
                {ENUM_CONFIDENCE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 04. Audiência */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>04</span> Segmentação de Audiência
          </h2>
          <div className={styles.grid2}>
            {audienceFields.map(([id, label]) => (
              <div key={id} className={styles.field}>
                <FieldLabel help={VOCAB.audience} missing={!isFilled(id, draft)}>
                  {label}
                </FieldLabel>
                <input
                  type="number"
                  step="0.1"
                  value={draft[id] ?? 0}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [id]: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  className={styles.input}
                />
              </div>
            ))}
          </div>
          <p className={styles.help}>{HELP.audience}</p>
          <div
            className={`${styles.sumCheck} ${!audAny ? styles.empty : audOk ? styles.ok : styles.bad}`}
          >
            {!audAny
              ? 'sem valores ainda'
              : audOk
                ? `soma = ${audSum.toFixed(1)}% — ok ✓`
                : `soma = ${audSum.toFixed(1)}% — fora do CHECK ⚠`}
            <div className={styles.audMeter}>
              {audVals.map((v, i) => (
                <div
                  key={i}
                  style={{
                    width: `${Math.max(0, parseFloat(String(v)) || 0)}%`,
                    backgroundColor: AUD_COLORS[i],
                  }}
                />
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label>Confiança desta seção</label>
            <select
              value={draft.confidence_audiencia || ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  confidence_audiencia: (e.target.value || null) as ConfidenceLevel | null,
                })
              }
              className={styles.select}
            >
              <option value="">— não classificado —</option>
              {ENUM_CONFIDENCE.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* 05. Contexto de Negócio */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>05</span> Contexto de Negócio
          </h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label>Clusters de conteúdo observados</label>
              <textarea
                value={draft.observed_content_clusters || ''}
                onChange={(e) =>
                  setDraft({ ...draft, observed_content_clusters: e.target.value || null })
                }
                rows={2}
                className={styles.textarea}
              />
            </div>
            <div className={styles.field}>
              <label>Setor / benchmark</label>
              <select
                value={draft.setor_benchmark || ''}
                onChange={(e) =>
                  setDraft({ ...draft, setor_benchmark: e.target.value as SetorBenchmark })
                }
                className={styles.select}
              >
                <option value="">— selecione —</option>
                {ENUM_SETOR.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Nicho</label>
              <input
                type="text"
                value={draft.nicho || ''}
                onChange={(e) => setDraft({ ...draft, nicho: e.target.value || null })}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label>Mecanismo de prova</label>
              <select
                value={draft.proof_mechanism || ''}
                onChange={(e) =>
                  setDraft({ ...draft, proof_mechanism: e.target.value as ProofMechanism })
                }
                className={styles.select}
              >
                <option value="">— selecione —</option>
                {ENUM_PROOF.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Confiança desta seção</label>
              <select
                value={draft.confidence_negocio || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    confidence_negocio: (e.target.value || null) as ConfidenceLevel | null,
                  })
                }
                className={styles.select}
              >
                <option value="">— não classificado —</option>
                {ENUM_CONFIDENCE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 06. Metadados */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.idx}>06</span> Metadados
          </h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label>Fonte (values/affect)</label>
              <select
                value={draft.values_affect_source || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    values_affect_source: e.target.value as ValuesAffectSource,
                  })
                }
                className={styles.select}
              >
                <option value="">— selecione —</option>
                {ENUM_AFFECT_SOURCE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Confiança</label>
              <select
                value={draft.values_affect_confidence || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    values_affect_confidence: e.target.value as ConfidenceLevel,
                  })
                }
                className={styles.select}
              >
                <option value="">— selecione —</option>
                {ENUM_CONFIDENCE.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Atualizado por</label>
              <input
                type="text"
                value={draft.updated_by || ''}
                disabled
                className={styles.disabled}
              />
              <p className={styles.help}>Preenchido automaticamente com o usuário logado ao salvar.</p>
            </div>
          </div>
        </section>

      </div>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  const pct = completeness(effectiveRecord || draft)

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dossiê de Onboarding</h1>
          <p className={styles.subtitle}>
            {effectiveRecord ? `Atualizado em ${fmtDate(effectiveRecord.updated_at) || '—'}` : 'Ainda sem registro'}
          </p>
        </div>
        <div className={styles.completeness}>
          <div className={styles.pct}>{pct}%</div>
          <p className={styles.pctLabel}>preenchido</p>
        </div>
      </div>

      {/* Banners */}
      {hookError && <div className={styles.bannerError}>❌ {hookError}</div>}
      {error && <div className={styles.bannerError}>{error}</div>}
      {success && <div className={styles.bannerSuccess}>{success}</div>}

      {/* Content */}
      {loading ? (
        <div className={styles.loading}>Carregando registro…</div>
      ) : displayMode === 'view' ? (
        <>
          {renderView()}
          <div className={styles.actions}>
            <button onClick={handleEdit} className={styles.btnPrimary} type="button">
              ✏️ Editar dados
            </button>
          </div>
        </>
      ) : (
        <>
          {renderEdit()}
          <div className={styles.actions}>
            <button onClick={handleCancel} className={styles.btnGhost} type="button">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={styles.btnPrimary}
              type="button"
            >
              {isSaving ? '💾 Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </>
      )}

      {/* Log */}
      <details className={styles.logPanel}>
        <summary className={styles.logSummary}>📋 Histórico ({log.length})</summary>
        <div className={styles.logContent}>
          {log.length === 0 ? (
            <p className={styles.logEmpty}>Nenhuma atualização registrada</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} className={styles.logEntry}>
                <time>{fmtDate(entry.ts)}</time>
                <span>{entry.who}</span>
                <div>{entry.changes.join(', ')}</div>
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  )
}