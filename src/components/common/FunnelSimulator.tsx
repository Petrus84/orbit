'use client'

import React, { useState } from 'react';
import Slider from './Slider';
import type { SetorBenchmark } from '@/types/orbit';
import styles from './FunnelSimulator.module.css';

interface SaturationOutput {
  razaoEscala: number;
  isSaturated: boolean;
  engajamentoEfetivo: number;
  ctrEfetivo: number;
  convEfetivo: number;
}

export interface SimulatorState {
  ctrBio: number;
  taxaConv: number;
  alcance: number;
  /**
   * Ticket médio (R$) — premissa única aplicada ao cenário real e ao
   * simulado (ver nota em FunnelResult.tsx). Editável aqui porque não há,
   * ainda, receita real vinda do banco.
   */
  ticketMedio: number;
}

interface FunnelSimulatorProps {
  state: SimulatorState;
  onChange: (next: SimulatorState) => void;
  /**
   * Calculado por src/lib/funnelMath.ts (fonte única) e passado pronto —
   * este componente só exibe. Antes, FunnelSimulator recalculava a mesma
   * coisa localmente só para o texto de aviso, e esse cálculo paralelo
   * nunca alimentava o resultado real (era puro teatro visual). Ver
   * FunnelScreen.tsx.
   */
  saturation: SaturationOutput;
  erRealNativo: number | null;
  setor: SetorBenchmark | null;
}

// Rótulo de exibição para o enum bruto vindo de client_onboarding.setor_benchmark
// (10 valores confirmados via pg_constraint em 11/09/2026 — ver types/orbit.ts).
// Fica aqui, e não em types/orbit.ts, porque é texto de UI, não contrato de dado.
const SETOR_LABELS: Record<SetorBenchmark, string> = {
  comercio_direto_ecommerce_social: 'Comércio direto / e-commerce social',
  comissionamento_afiliados: 'Afiliados / comissionamento',
  infoprodutor_educador_pago: 'Infoprodutor / educador pago',
  servico_consultoria_profissional: 'Serviço / consultoria profissional',
  patrocinio_publicidade_marca: 'Patrocínio / publicidade de marca',
  membership_assinatura_comunidade: 'Membership / assinatura / comunidade',
  monetizacao_nativa_plataforma: 'Monetização nativa da plataforma',
  autoridade_personal_branding_b2b: 'Autoridade / personal branding B2B',
  pre_monetizacao_a_validar: 'Pré-monetização (a validar)',
  saas_ferramenta: 'SaaS / ferramenta',
};

// ✅ MOVIDO (09/09/2026): `result`/`baseVendas`/`baseCliques`/`onSaveGoal`
// saíram daqui — este componente parou de renderizar <FunnelResult> (era a
// "continuação" do card do simulador que misturava premissas com
// resultado/receita). FunnelResult agora é um terceiro card próprio,
// renderizado direto por FunnelScreen.tsx, que já tem tudo que ele precisa.
export default function FunnelSimulator({
  state,
  onChange,
  saturation,
  erRealNativo,
  setor,
}: FunnelSimulatorProps): React.ReactElement {
  const { razaoEscala, isSaturated, engajamentoEfetivo, ctrEfetivo, convEfetivo } = saturation;
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof SimulatorState>(key: K, value: SimulatorState[K]) =>
    onChange({ ...state, [key]: value });

  // Antes: botão "Exportar Cenário" sem onClick — puro elemento decorativo.
  // Aqui: exporta as premissas + os valores já degradados pela saturação
  // (os mesmos números que o card já mostra, nunca recalculados de novo)
  // como texto simples, via clipboard nativo. Sem dependência nova, sem
  // arquivo novo — se um export "de verdade" (PDF/CSV) for definido depois,
  // este handler é o lugar certo para trocar de implementação.
  const handleExport = async () => {
    const linhas = [
      'Orbit — Cenário simulado do funil',
      setor ? `Setor: ${SETOR_LABELS[setor]}` : null,
      `Alcance simulado: ${state.alcance.toLocaleString('pt-BR')}`,
      `CTR alvo da bio: ${state.ctrBio.toFixed(1)}%${
        razaoEscala > 1 ? ` (aplicado na simulação: ${ctrEfetivo.toFixed(2)}%)` : ''
      }`,
      `Taxa de conversão: ${state.taxaConv.toFixed(1)}%${
        razaoEscala > 1 ? ` (aplicado na simulação: ${convEfetivo.toFixed(2)}%)` : ''
      }`,
      `Ticket médio: R$ ${state.ticketMedio.toFixed(0)}`,
      `Engajamento efetivo usado (${erRealNativo !== null ? 'banco' : 'benchmark'}): ${engajamentoEfetivo}%`,
      isSaturated
        ? `⚠ Saturação: escala ${razaoEscala.toFixed(1)}x acima da bolha histórica — CTR e conversão acima já vêm degradados.`
        : null,
    ].filter((linha): linha is string => linha !== null);

    try {
      await navigator.clipboard.writeText(linhas.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível (ex.: contexto não seguro/permissão negada).
      // Falha silenciosa é aceitável aqui — não é um dado de negócio, é
      // conveniência de UI; não vale abrir alerta por isso.
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.diagnosticBox}>
        SSOT · Métrica de engajamento ({erRealNativo !== null ? 'Banco' : 'Benchmark'}):{' '}
        <strong className={styles.diagnosticStrong}>{engajamentoEfetivo}%</strong>
        {setor && (
          <>
            {' · '}
            Setor: <strong className={styles.diagnosticStrong}>{SETOR_LABELS[setor]}</strong>
          </>
        )}
      </div>

      {/* ✅ REORDENADO (09/09/2026): premissas agora seguem a MESMA ordem
          do funil real (FunnelChart.tsx / dados de useFunnel): Alcance →
          Visita/Clique → Venda. Antes a ordem era CTR bio → Conversão →
          Alcance → Ticket, o que colocava o resultado do topo do funil
          (Alcance) depois de duas taxas que dependem dele — invertido em
          relação ao card "Funil Real" ao lado. Ticket médio continua por
          último por ser uma premissa financeira (R$/venda), não uma etapa
          do funil. */}
      <div className={styles.slidersBlock}>
        <div className={styles.sliderGroup}>
          <Slider
            label="Alcance simulado"
            helpText="Quantas pessoas a publicação ou campanha deve alcançar."
            min={1000}
            max={500000}
            step={1000}
            value={state.alcance}
            onChange={(v) => set('alcance', v)}
            unit=""
          />
        </div>

        <div className={styles.sliderGroup}>
          {/* ⚠️ Rótulo corrigido: este slider nunca controlou "clique no
              link" — em funnelMath.ts ele é aplicado direto sobre o
              alcance para gerar VISITAS ao perfil (visitas = alcance ×
              este valor). Quem gera clique é um CTR de link separado,
              calculado do histórico real da conta em FunnelScreen.tsx e
              nunca exposto nesta tela. Renomeado para bater com o que o
              número de fato faz — sem isso, "cliques no link: 8" no card
              de resultado não bate com a mental model de quem mexeu só
              num "CTR de clique". Se quiser reintroduzir controle direto
              sobre clique-no-link, o lugar certo é expor `ctrLink` aqui
              como um novo slider — decisão de produto, não deste patch. */}
          <Slider
            label="Taxa de visita ao perfil"
            helpText="De cada 100 pessoas alcançadas, quantas visitam seu perfil. (O clique no link da bio vem depois, calculado a partir do seu histórico real — por isso o resultado final pode parecer menor do que só este número sugere.)"
            min={0}
            max={20}
            step={0.1}
            value={state.ctrBio}
            onChange={(v) => set('ctrBio', v)}
            unit="%"
          />
          {razaoEscala > 1 && (
            <div className={styles.degradedHint}>
              ↳ Aplicado na simulação: {ctrEfetivo.toFixed(2)}% — nesta escala, parte do público
              alcançado é frio (nunca te seguiu), e público frio visita/clica menos.
            </div>
          )}
        </div>

        <div className={styles.sliderGroup}>
          <Slider
            label="Taxa de conversão"
            helpText="A porcentagem de cliques que pode virar uma venda."
            min={0}
            max={10}
            step={0.1}
            value={state.taxaConv}
            onChange={(v) => set('taxaConv', v)}
            unit="%"
          />
          {razaoEscala > 1 && (
            <div className={styles.degradedHint}>
              ↳ Aplicado na simulação: {convEfetivo.toFixed(2)}% — mesmo motivo: quem chega frio
              demora mais pra confiar e comprar.
            </div>
          )}
        </div>

        <div className={styles.sliderGroup}>
          <Slider
            label="Ticket médio (R$)"
            helpText="O valor médio estimado de cada venda."
            min={10}
            max={1000}
            step={5}
            value={state.ticketMedio}
            onChange={(v) => set('ticketMedio', v)}
            formatDisplay={(v) => `R$ ${v.toFixed(0)}`}
          />
        </div>
      </div>

      {isSaturated && (
        <div className={styles.saturationAlert}>
          <strong>Alcance {razaoEscala.toFixed(1)}x acima do que sua conta já entregou.</strong>{' '}
          Nessa faixa, o público extra é majoritariamente frio — por isso o CTR e a conversão já
          aparecem reduzidos logo acima, e as vendas estimadas abaixo já refletem essa redução.
          Não é um limite fixo do simulador: é o comportamento esperado quando se escala tráfego
          além do que a conta comprovou organicamente.
        </div>
      )}

      <div className={styles.footerActions}>
        <button type="button" className={styles.exportBtn} onClick={handleExport}>
          {copied ? 'Copiado ✓' : 'Exportar Cenário'}
        </button>
      </div>
    </div>
  );
}