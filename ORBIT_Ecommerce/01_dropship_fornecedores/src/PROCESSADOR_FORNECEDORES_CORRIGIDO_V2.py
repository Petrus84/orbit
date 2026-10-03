import json
import os
import numpy as np
import pandas as pd
from datetime import datetime

# =====================================================================
# CONFIGURAÇÕES DE AMBIENTE (CAMINHO ABSOLUTO BLINDADO)
# =====================================================================
PASTA_RAIZ = r"C:\Users\DELL\Downloads\ORBIT_Ecommerce"
arquivo_input = os.path.join(PASTA_RAIZ, "output_bruto.json")

# CRITÉRIOS DE NEGÓCIO SEGUROS (SUAS REGRAS EXPLÍCITAS)
COTACAO_DOLAR = 5.60          
NOTA_MINIMA_LOJA = 4.5         # Critério rígido: Só fábricas excelentes
VENDAS_MINIMAS_PROVA = 0        # ✅ CORRIGIDO: Aceita novos SEM exigência de vendas

def carregar_json_validado(caminho_json: str) -> dict:
    """Carrega e valida o arquivo JSON gigante"""
    print(f"[*] Abrindo arquivo absoluto: '{caminho_json}'...")
    
    try:
        if not os.path.exists(caminho_json):
            print(f"[-] Erro Crítico: O arquivo '{caminho_json}' não existe!")
            return {}
            
        with open(caminho_json, "r", encoding="utf-8") as f:
            dados_brutos = json.load(f)
        print(f"[✓] JSON carregado com sucesso")
        return dados_brutos
        
    except json.JSONDecodeError as e:
        print(f"[-] Erro ao parsear JSON: {e}")
        print(f"[-] Verifique se o arquivo está corrompido")
        return {}
    except Exception as e:
        print(f"[-] Erro inesperado: {e}")
        return {}


def validar_item_fornecedor(item: dict) -> tuple:
    """
    Valida cada fornecedor aplicando REGRAS DE NEGÓCIO IMPLACÁVEIS
    
    ✅ REGRA 1 (CORRIGIDA): Aprova APENAS se:
       - Nota >= 4.5 (estabelecida e confiável)
       - OU Nota == 0 (novo, sem histórico, mas com preço competitivo)
    
    ❌ REJEITA: Qualquer nota entre 0.1 e 4.4 (loja ruim/golpista)
    
    ✅ REGRA 2 (CORRIGIDA): Novos (nota=0) NÃO exigem vendas mínimas
       - Fábricas de atacado novas podem ter 0 vendas
       - O preço competitivo é o critério, não o histórico
    """
    
    try:
        # Extrai dados com segurança
        preco_usd = float(item.get("priceCurrentMin") or 0)
        vendas = int(item.get("soldCount") or 0)
        nota = float(item.get("ratingValue") or 0)
        product_id = str(item.get("productId", ""))
        url_link = item.get("productUrl", "")
        titulo_forn = item.get("title", "Produto sem titulo")
        
    except (ValueError, TypeError):
        return False, {}
    
    # ✅ REGRA 1 (CORRIGIDA): Aprova APENAS nota >= 4.5 OU nota == 0
    # ❌ REJEITA: Qualquer valor entre 0.1 e 4.4 (loja ruim)
    if nota > 0 and nota < NOTA_MINIMA_LOJA:
        # Loja com histórico ruim - REJEITA
        return False, {}
    
    # ✅ REGRA 2 (CORRIGIDA): Remove exigência de vendas mínimas para novos
    # Novos (nota=0) são aceitos independente de vendas
    # Estabelecidos (nota>=4.5) também não têm exigência de vendas
    
    # REGRA 3: Preço deve ser válido
    if preco_usd <= 0:
        return False, {}
    
    # REGRA 4: Product ID deve existir
    if not product_id or product_id == "":
        return False, {}
    
    # ✅ PASSOU EM TODAS AS REGRAS
    preco_brl = round(preco_usd * COTACAO_DOLAR, 2)
    
    return True, {
        "Produto Sistema": "",  # Será preenchido depois
        "Fornecedor ID": product_id,
        "Título Fornecedor": (titulo_forn[:62] + "...") if len(titulo_forn) > 65 else titulo_forn,
        "Preço USD": preco_usd,
        "Custo Estimado BRL": preco_brl,
        "Nota Loja": nota,
        "Status Loja": "Estabelecida" if nota > 0 else "Nova",
        "Qtd Vendida": vendas,
        "URL Link": url_link
    }


def processar_json_gigante(caminho_json: str) -> pd.DataFrame:
    """Processa JSON completo com validação e remoção de duplicatas"""
    
    dados_brutos = carregar_json_validado(caminho_json)
    if not dados_brutos:
        return pd.DataFrame()
    
    fornecedores_qualificados = []
    total_processados = 0
    total_rejeitados = 0
    
    for produto_nome, lista_fornecedores in dados_brutos.items():
        
        # Pula estruturas de erro
        if isinstance(lista_fornecedores, dict) and "erro" in lista_fornecedores:
            print(f" [!] Pulando '{produto_nome[:30]}...': Contém log de erro antigo.")
            continue
        
        # Valida se é lista
        if not isinstance(lista_fornecedores, list):
            continue
        
        print(f" [sourcing] Analisando alternativas para: '{produto_nome[:50]}...'")
        
        for item in lista_fornecedores:
            total_processados += 1
            
            # ✅ VALIDA COM REGRAS IMPLACÁVEIS
            valido, dados_item = validar_item_fornecedor(item)
            
            if not valido:
                total_rejeitados += 1
                continue
            
            # Adiciona nome do produto
            dados_item["Produto Sistema"] = produto_nome
            fornecedores_qualificados.append(dados_item)
    
    # Cria DataFrame
    if not fornecedores_qualificados:
        print(f"\n[-] Nenhum fornecedor atendeu aos requisitos mínimos.")
        return pd.DataFrame()
    
    df = pd.DataFrame(fornecedores_qualificados)
    
    # ✅ Remove duplicatas por Fornecedor ID
    df_original_count = len(df)
    df = df.drop_duplicates(subset=["Fornecedor ID"], keep="first")
    duplicatas_removidas = df_original_count - len(df)
    
    print(f"\n[📊] ESTATÍSTICAS DE PROCESSAMENTO:")
    print(f"    → Total de itens processados: {total_processados}")
    print(f"    → Total rejeitado (regras negócio): {total_rejeitados}")
    print(f"    → Fornecedores qualificados: {df_original_count}")
    print(f"    → Duplicatas removidas: {duplicatas_removidas}")
    print(f"    → Fornecedores únicos finais: {len(df)}")
    
    return df


def remover_outliers_estatisticos(df: pd.DataFrame) -> pd.DataFrame:
    """Remove outliers usando método 2-sigma por produto"""
    
    if df.empty:
        return df
    
    df_limpo = []
    
    for produto, grupo in df.groupby("Produto Sistema"):
        if len(grupo) > 2:
            me = grupo["Custo Estimado BRL"].mean()
            std = grupo["Custo Estimado BRL"].std()
            
            if std > 0:
                # ✅ Remove outliers com 2-sigma
                grupo = grupo[np.abs(grupo["Custo Estimado BRL"] - me) <= (2 * std)]
            else:
                # Se todos preços iguais, mantém apenas primeiro
                grupo = grupo.head(1)
        
        df_limpo.append(grupo)
    
    return pd.concat(df_limpo, ignore_index=True) if df_limpo else pd.DataFrame()


def selecionar_fornecedores_campeoes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Seleciona 1 fornecedor campeão por produto
    Critérios (em ordem de prioridade):
    1. Menor preço em BRL
    2. Melhor nota de loja
    3. Maior quantidade vendida
    """
    
    if df.empty:
        return df
    
    # Ordena por: produto, preço (asc), nota (desc), vendas (desc)
    df_ordenado = df.sort_values(
        by=["Produto Sistema", "Custo Estimado BRL", "Nota Loja", "Qtd Vendida"],
        ascending=[True, True, False, False]
    )
    
    # Pega primeiro de cada produto (menor custo)
    df_campeoes = df_ordenado.groupby("Produto Sistema").first().reset_index()
    
    return df_campeoes


def gerar_relatorio_alternativas(df: pd.DataFrame) -> pd.DataFrame:
    """Gera relatório com estatísticas de preços e alternativas por produto"""
    
    if df.empty:
        return pd.DataFrame()
    
    relatorio = []
    
    for produto, grupo in df.groupby("Produto Sistema"):
        preco_min = grupo["Custo Estimado BRL"].min()
        preco_max = grupo["Custo Estimado BRL"].max()
        preco_medio = grupo["Custo Estimado BRL"].mean()
        margem_preco = preco_max - preco_min
        
        nota_media = grupo["Nota Loja"].mean()
        total_vendas = grupo["Qtd Vendida"].sum()
        qtd_fornecedores = len(grupo)
        
        relatorio.append({
            "Produto Sistema": produto,
            "Qtd Fornecedores": qtd_fornecedores,
            "Menor Custo BRL": round(preco_min, 2),
            "Custo Médio BRL": round(preco_medio, 2),
            "Maior Custo BRL": round(preco_max, 2),
            "Margem de Preço BRL": round(margem_preco, 2),
            "Nota Média Loja": round(nota_media, 2),
            "Total Vendas": total_vendas
        })
    
    return pd.DataFrame(relatorio)


def salvar_resultados(df_bruto: pd.DataFrame, df_campeoes: pd.DataFrame, df_relatorio: pd.DataFrame):
    """Salva resultados em 3 arquivos CSV com timestamp"""
    
    pasta_output = os.path.join(PASTA_RAIZ, "outputs")
    os.makedirs(pasta_output, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Arquivo 1: Todos os fornecedores
    arquivo1 = os.path.join(pasta_output, f"01_fornecedores_completos_bruto_{timestamp}.csv")
    df_bruto.to_csv(arquivo1, index=False, encoding="utf-8")
    print(f"[✓] Salvo: {arquivo1}")
    
    # Arquivo 2: Fornecedores campeões
    arquivo2 = os.path.join(pasta_output, f"02_fornecedores_vencedores_menor_custo_{timestamp}.csv")
    df_campeoes.to_csv(arquivo2, index=False, encoding="utf-8")
    print(f"[✓] Salvo: {arquivo2}")
    
    # Arquivo 3: Relatório de alternativas
    arquivo3 = os.path.join(pasta_output, f"03_relatorio_alternativas_{timestamp}.csv")
    df_relatorio.to_csv(arquivo3, index=False, encoding="utf-8")
    print(f"[✓] Salvo: {arquivo3}")


def exibir_resumo_executivo(df_bruto: pd.DataFrame, df_campeoes: pd.DataFrame, df_relatorio: pd.DataFrame):
    """Exibe tabelas formatadas com resultados"""
    
    print("\n" + "=" * 80)
    print("[✅] SUCESSO! SELEÇÃO DE FORNECEDORES FINALIZADA")
    print("=" * 80)
    
    if not df_bruto.empty:
        print(f"\n📊 ESTATÍSTICAS GERAIS:")
        print(f"    → Total de ofertas qualificadas: {len(df_bruto)}")
        print(f"    → Produtos com fornecedores: {df_bruto['Produto Sistema'].nunique()}")
        print(f"    → Fornecedores campeões selecionados: {len(df_campeoes)}")
    
    if not df_campeoes.empty:
        print(f"\n🏆 FORNECEDORES VENCEDORES (MENOR CUSTO):\n")
        print(df_campeoes[["Produto Sistema", "Custo Estimado BRL", "Nota Loja", "Status Loja", "Qtd Vendida"]].to_string(index=False))
    
    if not df_relatorio.empty:
        print(f"\n📈 RELATÓRIO DE ALTERNATIVAS E MARGENS:\n")
        print(df_relatorio.to_string(index=False))
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    print("=" * 80)
    print("[+] MÓDULO PYTHON: SELETOR DE FORNECEDORES DE ALTA PERFORMANCE")
    print("[+] VERSÃO: 2.0 - CORRIGIDA (SEM OS 2 ERROS GRAVES)")
    print("=" * 80)
    
    # ETAPA 1: Processa JSON
    df_bruto = processar_json_gigante(arquivo_input)
    
    if df_bruto.empty:
        print("\n[-] Nenhum fornecedor atendeu aos requisitos mínimos.")
        exit(0)
    
    # ETAPA 2: Remove outliers
    df_filtrado = remover_outliers_estatisticos(df_bruto)
    
    if df_filtrado.empty:
        print("\n[-] Nenhum fornecedor passou no filtro de outliers.")
        exit(0)
    
    # ETAPA 3: Seleciona campeões
    df_campeoes = selecionar_fornecedores_campeoes(df_filtrado)
    
    # ETAPA 4: Gera relatório
    df_relatorio = gerar_relatorio_alternativas(df_filtrado)
    
    # ETAPA 5: Salva resultados
    salvar_resultados(df_bruto, df_campeoes, df_relatorio)
    
    # ETAPA 6: Exibe resumo
    exibir_resumo_executivo(df_bruto, df_campeoes, df_relatorio)
