# 1. Cria a estrutura nova
$dirs = @(
  '01_dropship_fornecedores\src',
  '01_dropship_fornecedores\docs',
  '01_dropship_fornecedores\outputs',
  '01_dropship_fornecedores\legado',
  '02_orbit_monetizacao_ig\src',
  '02_orbit_monetizacao_ig\outputs',
  '02_orbit_monetizacao_ig\legado',
  '99_nao_classificado'
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

# 2. Projeto A — código Python
Move-Item alibaba_loader.py, buscar_fornecedores_apify.py, import_requests.py, `
  import_setup_cp.py, import_setup_cp_v2original.py, mineradoramplo.py, `
  pipeline_dropship_apify_v2.py, PROCESSADOR_FORNECEDORES_CORRIGIDO_V2.py, `
  scoring_engine.py, requirements.txt `
  -Destination '01_dropship_fornecedores\src\'

# 3. Projeto A — docs
Move-Item Business_Plan.txt, CPIMPORTSTORE_BusinessPlan_v5.0_Otimizado.xlsx `
  -Destination '01_dropship_fornecedores\docs\'
Move-Item 'legado\outros\seletordeprodutos.html' -Destination '01_dropship_fornecedores\docs\'

# 4. Projeto A — cache inteiro
Move-Item cache_apify -Destination '01_dropship_fornecedores\'

# 5. Projeto A — outputs (só o que é dele; o resto do outputs/ fica pra depois)
Move-Item 'outputs\01_fornecedores_completos_bruto_*.csv', `
  'outputs\02_fornecedores_vencedores_menor_custo_*.csv', `
  'outputs\03_relatorio_alternativas_*.csv', `
  'outputs\apify_errors.log', `
  'outputs\historico_scores.json', `
  'outputs\resumo_alibaba.json', `
  'outputs\dados_minerados_completos.json', `
  'outputs\dados_minerados_completos.csv', `
  'outputs\stats_mineracao.json', `
  'outputs\debug_meta_raw_sample.json', `
  output_bruto.json, output_resumo.csv `
  -Destination '01_dropship_fornecedores\outputs\'

# 6. Projeto A — legado
Move-Item 'legado\delta.py', 'legado\teste_pipeline_dropship_apify.py', `
  'legado\outros\Business_Plan.py' `
  -Destination '01_dropship_fornecedores\legado\'

# 7. Projeto B — código TypeScript
Move-Item ingest.ts, ingest-benchmark-pilot.ts, ingest-benchmark-pilot_v2.ts, `
  compute.ts, compute-real-correlations.ts, tiers.ts, tsconfig.json `
  -Destination '02_orbit_monetizacao_ig\src\'

# 8. Projeto B — dados e outputs
Move-Item data -Destination '02_orbit_monetizacao_ig\'
Move-Item 'outputs\orbit_L1_filtrado_*.json' -Destination '02_orbit_monetizacao_ig\outputs\'

# 9. Projeto B — legado
Move-Item 'legado\ingest-benchmark-pilot_conhecidos.ts', 'legado\outros\ORBIT.TS' `
  -Destination '02_orbit_monetizacao_ig\legado\'

# 10. Sobras
Move-Item 'legado\outros\dogativo.json' -Destination '99_nao_classificado\'

# 11. Limpeza: pastas agora vazias + build artifacts
Remove-Item __pycache__ -Recurse -Force
Remove-Item outputs, legado -Recurse -Force -ErrorAction SilentlyContinue