-- ============================================================================
-- Funnel registry — dados de referência
-- Aplicar após 20261029093600_funnel_registry_ddl.sql.
-- Fonte do benchmark: analise-setorial-social-media-brasil_.md, seção
-- "Benchmark de conversão por segmento" (10/10/2026). São PROXIES (visitante→
-- pedido/lead), não a etapa "engajamento→conversão". Tudo entra como L2 até
-- ser calibrado com dados reais da base. monetizacao_nativa_plataforma não tem
-- valor: a tela mostra "sem referência de mercado".
-- ============================================================================
begin;

-- Etapas: espelham src/lib/funnel/registry.ts
insert into orbit.funnel_stage_registry
  (funnel_type, stage_key, stage_order, label, source, default_confidence, parent_key, absence_what, absence_why) values
  ('link','alcance',        1,'Alcance',                'instagram_export','L0',null,null,null),
  ('link','visitas_perfil', 2,'Visitas ao perfil',      'instagram_export','L0','alcance',null,null),
  ('link','cliques_link',   3,'Cliques no link da bio', 'instagram_export','L0','visitas_perfil',null,null),
  ('link','vendas_externas',4,'Vendas informadas',      'external_reported','L0','cliques_link',
     'Vendas do período','a venda acontece em página fora do Instagram e só entra quando você ou o cliente informa'),
  ('dm','alcance',              1,'Alcance',                     'instagram_export','L0',null,null,null),
  ('dm','visitas_perfil',       2,'Visitas ao perfil',           'instagram_export','L0','alcance',null,null),
  ('dm','conversas_comerciais', 3,'Conversas comerciais',        'dm_scan','L1','visitas_perfil',null,null),
  ('dm','pediu_preco',          4,'Pediram preço',               'dm_scan','L1','conversas_comerciais',null,null),
  ('dm','intencao_compra',      5,'Disseram que querem comprar', 'dm_scan','L1','pediu_preco',null,null),
  ('dm','fechamento_provavel',  6,'Fechamento provável',         'dm_scan','L1','intencao_compra',null,null),
  ('dm','venda_evidencia_forte',7,'Venda com evidência forte',   'dm_scan','L1','fechamento_provavel',null,null),
  ('dm','venda_confirmada',     8,'Vendas informadas',           'external_reported','L0','conversas_comerciais',
     'Vendas do período','o Instagram só mostra a conversa; Pix, retirada ou combinado por WhatsApp só entram quando você informa')
on conflict (funnel_type, stage_key) do update set
  stage_order=excluded.stage_order, label=excluded.label, source=excluded.source,
  default_confidence=excluded.default_confidence, parent_key=excluded.parent_key,
  absence_what=excluded.absence_what, absence_why=excluded.absence_why;

insert into orbit.funnel_conversion_benchmark
  (segment, value_pct, event_measured, source_grade, confidence_level, is_proxy, source_name, source_url, source_year, caveat) values
  ('comercio_direto_ecommerce_social', 1.650, 'visitante → pedido (média do e-commerce BR, não só tráfego social)',
   'C','L2',true,'Babi Tonhela (atribui à Neotrust)','https://babitonhela.com/blog/o-que-e-taxa-conversao-ecommerce-benchmarks','2024–2026',
   'Fonte secundária com atribuição inconsistente (Neotrust/E-Bit); os relatórios consultados não trazem esta taxa. Corroboração só de ordem de grandeza: 1,08% Instagram (Shopify Brasil, sem fonte) e 1,4–1,8% Shopify (global).'),
  ('infoprodutor_autoridade_personal', 2.970, 'visitante → lead (segmento Educacional, n = 106)',
   'B','L2',true,'Leadster, Panorama 2026','https://leadster.com.br/panorama-geracao-de-leads-2026','2025',
   'Mede lead, não venda. Educacional é aproximação do infoprodutor. Lead → venda de infoproduto: sem fonte encontrada.'),
  ('servico_consultoria_profissional', 3.740, 'visitante → lead/orçamento (Venda de Serviços, n = 444)',
   'A','L2',false,'Leadster, Panorama 2026','https://leadster.com.br/panorama-geracao-de-leads-2026','2025',
   'A (para a etapa lead). Contas desta categoria no ORBIT são quase todas de saúde; Serviços Médicos e Saúde da Leadster = 4,08% (n = 111).'),
  ('patrocinio_publicidade_marca', 3.390, 'visitante → lead, tráfego B2C vindo de Meta Ads (proxy de canal)',
   'C','L2',true,'Leadster, Panorama 2026','https://leadster.com.br/panorama-geracao-de-leads-2026','2025',
   'Proxy por canal; os segmentos de agência medem sites de agência, não campanhas de marcas.'),
  ('monetizacao_nativa_plataforma', null, 'não se aplica (conversão é visualização → receita)',
   'n/a','L2',true,null,null,null,
   'Sem proxy defensável. Exibir "sem referência de mercado".'),
  ('infoprodutor_educador_pago', 2.970, 'visitante → lead (Educacional, n = 106)',
   'B','L2',true,'Leadster, Panorama 2026','https://leadster.com.br/panorama-geracao-de-leads-2026','2025',
   'Proxy por atividade (mesmo valor do infoprodutor). polemic_score diverge entre as duas categorias.'),
  ('autoridade_personal_branding_b2b', 2.530, 'visitante → lead (B2B, mediana geral, n = 1.111)',
   'C','L2',true,'Leadster, Panorama 2026','https://leadster.com.br/panorama-geracao-de-leads-2026','2025',
   'Proxy por modelo de negócio (B2B). Engajamento parecido com serviços não implica conversão parecida.')
on conflict (segment) do update set
  value_pct=excluded.value_pct, event_measured=excluded.event_measured, source_grade=excluded.source_grade,
  confidence_level=excluded.confidence_level, is_proxy=excluded.is_proxy, source_name=excluded.source_name,
  source_url=excluded.source_url, source_year=excluded.source_year, caveat=excluded.caveat, updated_at=now();

-- Conferência (só avisa, não derruba): o valor aqui deve bater com ref_thresholds.conversion_rate_pct.
do $$
declare r record;
begin
  for r in
    select b.segment, b.value_pct
    from orbit.funnel_conversion_benchmark b
    where exists (select 1 from orbit.ref_thresholds t
                  where t.category = b.segment
                    and t.conversion_rate_pct is distinct from b.value_pct)
  loop
    raise warning 'benchmark % diverge de ref_thresholds.conversion_rate_pct (aqui: %)', r.segment, r.value_pct;
  end loop;
end $$;

commit;
