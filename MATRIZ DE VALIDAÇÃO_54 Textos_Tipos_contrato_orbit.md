MATRIZ DE VALIDAÇÃO: 54 Textos × Tipos em orbit.ts
# Texto da Base Tipo em orbit.ts Shape Esperado Shape Real
✅/❌ Observação
1 "AlertSeverity: info/warning/critical" AlertSeverity (L33) 'info' | 'warning' |
'critical' 'info' | 'warning' | 'critical' ✅ Canônico, correto
2 "Alert com clientId, severity, title, description" Alert (L50-62) { id,
clientId, severity, title, description, metricName, metricValue, thresholdValue,
isResolved, createdAt, action } { id, clientId, clientName, clientHandle, type,
severity, title, description, metricName, metricValue, thresholdValue, isResolved,
createdAt, action } ⚠️ DIVERGÊNCIA: Texto não menciona clientName,
clientHandle, type
3 "FetchStatus: idle/loading/success/error"FetchStatus (L65) 'idle' | 'loading' |
'success' | 'error' 'idle' | 'loading' | 'success' | 'error' ✅ Correto
4 "AsyncState<T> com data, status, error" AsyncState<T> (L67-71) { data: T |
null, status, error } { data: T | null, status: FetchStatus, error: string | null }✅
Correto
5 "IGAccountOverviewData com followers, engagement_rate, posts_count,
stories_count, avg_likes, avg_comments, last_updated"
IGAccountOverviewData (L73-81) 7 campos conforme texto 7 campos
conforme tipo ✅ Correto
6 "DashboardHeaderMeta com clientHandle, periodLabel, dateRange"
DashboardHeaderMeta (L83-89) { clientHandle, periodLabel, dateRange: { start:
Date, end: Date } } { clientHandle: string, periodLabel: string, dateRange: { start:
Date, end: Date } } ✅ Correto
7 "KPICardData com label, value, unit, delta, deltaLabel, semaphore, glowColor,
subtitle" KPICardData (L91-108) 8 campos base + sourceLevel, playRate 8
campos base + sourceLevel?, playRate? ✅ Correto (campos opcionais
adicionados)
8 "QualityScoreItem com label, value, unit, statusText, statusVariant, glowColor"
QualityScoreItem (L110-117) 6 campos conforme texto 6 campos
conforme tipo ✅ Correto
9 "FormatPerformanceRow com format, posts, shares, trendLabel, trendColor"
FormatPerformanceRow (L119-125) 5 campos conforme texto 5 campos
conforme tipo ✅ Correto
10 "InsightData com text" InsightData (L127-130) { id, text } { id:
string, text: string } ✅ Correto
11 "CriticalAlertData com title, body, severity, description, actionUrl"
CriticalAlertData (L132-139) 5 campos conforme texto 5 campos conforme
tipo ✅ Correto
12 "IGOverviewData com meta, kpis, qualityScores, formatPerformance, insights,
criticalAlerts" IGOverviewData (L141-148) 6 campos conforme texto 6 campos
conforme tipo ✅ Correto
13 "FunnelMetrics (PT-BR): alcance, visitas, cliques, vendas, ctrBio, taxaConv"
FunnelMetrics (L150-157) 6 campos em PT-BR 6 campos em PT-BR
✅ Correto
14 "FunnelActualMetrics (EN): reach, profileVisits, linkClicks, ctrBio,
conversionRate" FunnelActualMetrics (L159-165) 5 campos em EN 5 campos
em EN ✅ Correto (tipo morto, mantido)
15 "SliderConfig para simulador com key, label, min, max, step, unit"
SliderConfig (L167-174) 6 campos conforme texto 6 campos conforme tipo ✅
Correto
16 "SimulatedFunnelResult com reachSimulated, profileVisitsSimulated,
linkClicksSimulated, conversionsSimulated" SimulatedFunnelResult (L176-181)
4 campos conforme texto 4 campos conforme tipo ✅ Correto
17 "UseFunnelResult estende AsyncState + params, setParams, refetch"
UseFunnelResult (L187-192) AsyncState + 3 campos AsyncState + 3 campos
✅ Correto
18 "FunnelMetricsRow com reach_total, profile_visits, link_clicks, period_start,
period_end" FunnelMetricsRow (L194-200) 5 campos conforme texto 5 campos
conforme tipo ✅ Correto
19 "TabId: overview/metrics/health/alerts/settings/por-post/audiencia" TabId
(L210-217) 7 valores conforme texto 7 valores conforme tipo ✅ Correto
20 "IGOverviewLegacyData (duplicata de IGAccountOverviewData)"
IGOverviewLegacyData (L219-227) 7 campos idênticos 7 campos idênticos ⚠️
OBSERVAÇÃO 6 CONFIRMADA: Duplicata semântica
21 "ClientHealthStatus: healthy/warning/critical/unknown"ClientHealthStatus
(L229)4 valores conforme texto 4 valores conforme tipo ✅ Correto
22 "ClientMetrics com engagement_real, ctr_link, follower_balance,
polemic_score_pct, follower_churn_pct, segment" ClientMetrics (L231-243) 6
campos + segment aninhado 6 campos + segment aninhado ✅ Correto
23 "Client com id, handle, name, avatar, status, metrics, lastUpdated" Client
(L245-252) 7 campos conforme texto 7 campos conforme tipo ✅ Correto
24 "OrbitClientHealthRow com client_id, handle, avatar_name, metric_count,
avg_quality_score, health_status, last_updated, days_since_update,
max_confidence_level" OrbitClientHealthRow (L257-265) 9 campos conforme
texto 9 campos conforme tipo ✅ Correto
25 "validateOrbitClientHealthRow: type guard com todos os campos"
validateOrbitClientHealthRow (L267-282) Valida 9 campos Valida 9 campos
✅ Correto
26 "hasVolumeData: metric_count > 0" hasVolumeData (L284-287)
Retorna boolean Retorna boolean ✅ Correto
27 "isReallyCritical: health_status === 'critical' && metric_count > 0"
isReallyCritical (L289-295) Retorna boolean Retorna boolean ✅ Correto
28 "OrbitAlertRow com id, client_id, alert_type, severity, title, description,
metric_name, metric_value, threshold_value, action_url, is_resolved, created_at,
clients (join)" OrbitAlertRow (L305-319) 13 campos conforme texto 13 campos
conforme tipo ✅ Correto
29 "validateOrbitAlertRow: type guard completo" validateOrbitAlertRow
(L321-339) Valida 13 campos Valida 13 campos ✅ Correto
30 "LegacyAlertRow com id, client_id, title, description, severity, created_at,
clients (join)" LegacyAlertRow (L341-348) 7 campos conforme texto 7 campos
conforme tipo ✅ Correto
31 "validateLegacyAlertRow: type guard" validateLegacyAlertRow (L350-363)
Valida 7 campos Valida 7 campos ✅ Correto
32 "AvatarAlignmentRow com expected/real gender, age, interest, geo +
alignment_score, alignment_status" AvatarAlignmentRow (L365-383) 16
campos conforme texto 16 campos conforme tipo ✅ Correto
33 "validateAvatarAlignmentRow: type guard" validateAvatarAlignmentRow
(L385-411) Valida 16 campos Valida 16 campos ✅ Correto
34 "AvatarValidationRow com client_id, validation_date, observed_interest,
observed_geo_primary, source, confidence_level, notes" AvatarValidationRow
(L413-421) 7 campos conforme texto 7 campos conforme tipo ✅ Correto
35 "validateAvatarValidationRow: type guard com enums"
validateAvatarValidationRow (L423-441) Valida 7 campos + enums Valida 7 campos
+ enums ✅ Correto
36 "IgAccountSnapshotEnrichmentRow com client_id, period_start, period_end,
link_ctr_pct, followers_net"IgAccountSnapshotEnrichmentRow (L443-448)5 campos
conforme texto 5 campos conforme tipo ✅ Correto
37 "validateIgAccountSnapshotEnrichmentRow: type guard"
validateIgAccountSnapshotEnrichmentRow (L450-462) Valida 5 campos
Valida 5 campos ✅ Correto
38 "TopCityEntry com name, pct" TopCityEntry (L464-467) 2 campos
conforme texto 2 campos conforme tipo ✅ Correto
39 "IgAudienceSnapshotRow com client_id, period, gender %, age %, top_cities"
IgAudienceSnapshotRow (L469-483) 12 campos conforme texto 12
campos conforme tipo ✅ Correto
40 "validateIgAudienceSnapshotRow: type guard"
validateIgAudienceSnapshotRow (L485-502) Valida 12 campos Valida 12
campos ✅ Correto
41 "SimulatedFunnelParams com alcance, ctrBio, taxaConv (PT-BR)"
SimulatedFunnelParams (L504-508) 3 campos em PT-BR 3 campos em
PT-BR✅ Correto
42 "SnapshotSelect com reach_total, profile_visits, link_clicks" SnapshotSelect
(L510-515) 3 campos conforme texto 3 campos conforme tipo ✅ Correto
43 "validateSnapshotSelect: type guard" validateSnapshotSelect (L517-527)
Valida 3 campos Valida 3 campos ✅ Correto
44 "RawRow: Record<string, unknown>" RawRow (L529) Tipo genérico
Tipo genérico ✅ Correto
45 "FetchOverviewParams com clientId, periodStart, periodEnd"
FetchOverviewParams (L531-535) 3 campos conforme texto 3 campos
conforme texto ✅ Correto
46 "RawKPIRow com id, metric, value, semaphore, delta_pct, period_start,
period_end" RawKPIRow (L537-544) 7 campos conforme texto 7 campos
conforme tipo ✅ Correto
47 "validateRawKPIRow: type guard" validateRawKPIRow (L546-558)
Valida 7 campos Valida 7 campos ✅ Correto
48 "RawQualityRow com id, score_key, score_value, status_text, status_variant"
RawQualityRow (L560-566) 5 campos conforme texto 5 campos
conforme tipo ✅ Correto
49 "validateRawQualityRow: type guard" validateRawQualityRow (L568-578)
Valida 5 campos Valida 5 campos ✅ Correto
50 "RawFormatRow com id, format_name, post_count, share_count, trend_label,
trend_color" RawFormatRow (L580-587) 6 campos conforme texto 6 campos
conforme tipo ✅ Correto
51 "validateRawFormatRow: type guard" validateRawFormatRow (L589-601)
Valida 6 campos Valida 6 campos ✅ Correto
52 "RawAudienceRow com id, client_id, age_range, gender_split, top_city,
recorded_at" RawAudienceRow (L603-609) 6 campos conforme texto 6 campos
conforme tipo ✅ Correto
53 "validateRawAudienceRow: type guard" validateRawAudienceRow
(L611-621) Valida 6 campos Valida 6 campos ✅ Correto
54 "DateBounds com earliest, latest" DateBounds (L623-626) 2 campos
conforme texto 2 campos conforme tipo ✅ Correto
com essa: ┌──────────────────┐ ┌──────────────────┐
┌──────────────────┐ ┌──────────────────┐
┌──────────────────┐
│ Dados Brutos │────▶│ GENERATED │────▶│ TRIGGERS
│────▶│ VIEWS │────▶│ ÍNDICES │
│ (Snapshots) │ │ COLUMNS │ │ (Alertas) │ │ (Agregação)
│ │ (Performance) │
└──────────────────┘ └──────────────────┘
└──────────────────┘ └──────────────────┘
└──────────────────┘
 ↓ ↓ ↓ ↓ ↓
 ig_posts polemic_score trg_check_churn v_client_metrics
idx_ig_snap_
 ads_meta_ fatigue_score trg_eval_boost
v_meta_ads_metrics client_period
 snapshots utility_score trg_updated_at v_quality_scores
idx_meta_snap_
 followers_net v_avatar_alignment
client_date
 roas v_boost_candidates
idx_ig_posts_
 boost