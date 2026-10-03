"""
Busca fornecedores alternativos no AliExpress via Apify API (actor devcake/aliexpress-products-scraper).

COMO USAR:
1. pip install requests --break-system-packages
2. Defina a variável de ambiente APIFY_TOKEN (não cole o token direto no arquivo):
   Windows (PowerShell):  $env:APIFY_TOKEN="seu_token_aqui"
   Windows (cmd/Git Bash): export APIFY_TOKEN="seu_token_aqui"
3. Rode: python3 buscar_fornecedores_apify.py
4. Confira o arquivo output_bruto.json gerado.

NOTA DE SEGURANÇA: o token anterior apareceu em texto puro em chat e em log —
trate-o como comprometido. Revogue em apify.com/console/account/integrations
e gere um novo antes de rodar este script.
"""

import os
import sys
import csv
import json
import time
import requests

# --- Token vem de variável de ambiente, nunca hardcoded ---
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "").strip()

# Actor ID no formato username~actor-name, exigido pela API v2 da Apify
ACTOR_ID = "devcake~aliexpress-products-scraper"

# Endpoint correto: subdomínio api. + path /v2/acts/{actorId}/run-sync-get-dataset-items
API_URL = f"https://api.apify.com/v2/acts/{ACTOR_ID}/run-sync-get-dataset-items"

# Termo duro (fábrica), não o título poluído do anúncio
TERMOS_DUROS = {
    "Campainha de Vídeo Inteligente Tuya WiFi com Armazenamento em Nuvem e Detecção Humana": "Tuya Smart Video Doorbell WiFi 720P Cloud Storage Human Detection",
    "Peças de Reposição Premium para BYD Seagull - Carro Elétrico Novo 2023-2025": "BYD Seagull Electric Car Spare Parts 2023 2024 2025",
    "CarlinKit Adaptador CarPlay Sem Fio Mini Ultra4 5GHz WiFi - Plug and Play Android Auto": "CarlinKit Wireless CarPlay Adapter Mini Ultra4 5GHz WiFi Android Auto",
    "K1A Adaptador CarPlay Sem Fio Mini USB - Apple CarPlay e Android Auto Evoluído": "K1A Wireless CarPlay Adapter USB Apple CarPlay Android Auto",
    "Termostato Inteligente WiFi Tuya com Display LED para Aquecimento de Piso - Controle por App": "Tuya Smart WiFi Thermostat LED Display Floor Heating App Control",
    "Interruptor Touch Inteligente 3.5 Polegadas com Sensor Radar e Controle de Cortina - Tuya": "Tuya Smart Touch Switch 3.5 inch Radar Sensor Curtain Control",
    "Painel de Controle Smart Home Tuya 3.5'' com Zigbee para Dispositivos Inteligentes": "Tuya Smart Home Control Panel 3.5 inch Zigbee Smart Devices",
    "Fechadura Inteligente Tuya com WiFi, Digital, Impressão Digital, Cartão RFID e Senha": "Tuya Smart Lock WiFi Digital Fingerprint RFID Card Password",
    "Terminal POS Biométrico Z108P 2025 - Leitura de Veia Palmar com NFC e 4G": "Z108P Biometric POS Terminal Palm Vein Reader NFC 4G",
    "Termostato WiFi Tuya 2026 com Controle de Temperatura e Umidade - Knob LED e Voz": "Tuya WiFi Thermostat 2026 Temperature Humidity Control LED Knob Voice",
    "Host de Música Ambiente Smart Home 7 Polegadas Touch 2025 - Gateway Zigbee Tuya 8 Canais": "Smart Home Music Host 7 inch Touch Screen Gateway Zigbee Tuya 8 Channel",
    "Gateway Smart Home Tuya WiFi Touch 7 Polegadas - Zigbee, Alexa e Música para Hotéis": "Tuya Smart Home Gateway WiFi Touch 7 inch Zigbee Alexa Music Hotel",
    "Máquina de Café Espresso Portátil Mini 2 em 1 USB em Alumínio - Carro e Hotel": "Portable Mini Espresso Coffee Machine USB 2 in 1 Aluminum Travel",
    "Difusor de Óleo Essencial Inteligente Bluetooth WiFi sem Água - Casa e Escritório": "Smart Essential Oil Diffuser Bluetooth WiFi Waterless Home Office",
    "Painel de Controle Touch 7 Polegadas 2026 para Música Ambiente - Gateway Zigbee Tuya 8 Canais": "Smart Home Control Panel 7 inch Touch 2026 Music Gateway Zigbee Tuya",
    "Analisador de Qualidade da Água para Piscina, Banheira e Aquário": "Water Quality Analyzer Tester Pool Spa Aquarium",
    "Sistema de Música Ambiente Smart Home 10 Polegadas com 2 Zonas - Tuya, Zigbee e Google Play": "Smart Home Music System 10 inch 2 Zone Tuya Zigbee Google Play",
    "Rastreador GPS Portátil em Tempo Real para Bike, Pets e Crianças - Anti-Furto": "Portable GPS Tracker Real Time Bike Pet Kids Anti-theft",
    "Interruptor de Parede Inteligente Tuya WiFi US - 1 a 4 Botões com Sensor Touch e Voz": "Tuya Smart WiFi Wall Switch US 1 2 3 4 Button Touch Voice Control",
    "Interruptor e Tomada Inteligente WiFi em Vidro Touch - Tuya, Alexa e Controle Remoto": "Smart WiFi Switch Socket Glass Touch Tuya Alexa Remote Control",
    "ACEBOTT Carrinho Robótico Inteligente DIY ESP32 com Lançador de Água - STEM Arduino": "ACEBOTT Smart Robot Car DIY ESP32 Water Launcher STEM Arduino",
    "R&B Boneca Reborn Realista Corpo Macio - Pintura 3D estilo Bebê de Verdade": "Reborn Doll Realistic Soft Body 3D Painting Baby Lifelike",
    "Daytech Sensor de Porta Sem Fio Tuya com Campainha - Segurança Infantil": "Daytech Wireless Door Sensor Tuya Doorbell Child Safety",
    "Interruptor Touch Inteligente Tuya 10A - 1 a 4 Botões com Alexa e Google Home": "Tuya Smart Touch Switch 10A 1 2 3 4 Button Alexa Google Home",
    "Máquina de Café Espresso Portátil USB para Viagem e Camping - Aquecimento Automático": "Portable Espresso Coffee Machine USB Travel Camping Auto Heating",
    "Hub de Automação Residencial 10.1 Polegadas Touch com WiFi, RJ45, PoE e NFC - Hotelaria": "Smart Home Automation Hub 10.1 inch Touch WiFi RJ45 PoE NFC Hotel",
    "Hub de Automação 10.1 Polegadas WiFi Zigbee 3.0 Bluetooth - Hotelaria com Voz, PoE e 4G": "Home Automation Hub 10.1 inch WiFi Zigbee 3.0 Bluetooth Voice PoE 4G",
    "YG-T10 Rastreador GPS Veicular 4G com Garantia de 1 Ano - Suporte Global": "YG-T10 Vehicle GPS Tracker 4G 1 Year Warranty Global Support",
    "Farol de LED 120W Bicolor 6500K Canbus - Compatível com H7, H11, 9012, H1 e H27": "LED Headlight 120W Bicolor 6500K Canbus H7 H11 H1 H27",
    "TYSH Interruptor Inteligente Sem Fio Matter/Tuya WiFi Touch - 1 a 4 Botões com Alexa": "TYSH Smart Wireless Switch Matter Tuya WiFi Touch 1 2 3 4 Button Alexa",
    "Relógio de Mesa Inteligente com Luz RGB e Carregamento Wireless - Decoração de Quarto": "Smart Desk Clock RGB Light Wireless Charging Bedroom Decor",
}

MAX_ITEMS_POR_TERMO = 15  # folga acima de 3, pra sobrar depois do filtro de qualidade
TIMEOUT_SEGUNDOS = 180
DELAY_ENTRE_CHAMADAS = 2


class ApifyAuthError(RuntimeError):
    """Erro específico de autenticação (401) -- token inválido ou revogado."""
    pass


def rodar_actor(termo: str, max_items: int) -> list:
    params = {"token": APIFY_TOKEN}

    # Payload alinhado com o input schema do actor (productUrls + searchQueries)
    payload = {
        "productUrls": [],
        "searchQueries": [termo],
        "maxItems": max_items,
    }

    resp = requests.post(API_URL, params=params, json=payload, timeout=TIMEOUT_SEGUNDOS)

    if resp.status_code == 401:
        raise ApifyAuthError(
            "401 Unauthorized: token inválido, revogado ou sem permissão para este actor. "
            "Gere um novo em apify.com/console/account/integrations."
        )
    if resp.status_code in (402, 429):
        raise ApifyAuthError(
            f"Status {resp.status_code}: provável limite de cota/plano atingido "
            f"(não é erro de token). Corpo: {resp.text[:300]}"
        )

    # run-sync-get-dataset-items da Apify responde 200 OU 201 em caso de sucesso
    # (201 = run síncrono concluído com itens no dataset). Só >=300 é falha real.
    if resp.status_code >= 300:
        raise RuntimeError(f"Status {resp.status_code}: {resp.text[:1000]}")

    try:
        data = resp.json()
    except ValueError as e:
        # Resposta não é JSON válido -- salva o corpo cru inteiro para inspeção,
        # sem truncar, em vez de mascarar como "erro genérico"
        raise RuntimeError(f"Resposta não é JSON (status {resp.status_code}): {resp.text}") from e

    # run-sync-get-dataset-items normalmente retorna uma lista direto;
    # mantém resiliência caso algum actor devolva objeto encapsulado
    if isinstance(data, dict):
        return data.get("results") or data.get("items") or [data]
    return data


def main():
    print("[+] Inicializando Esteira de Sourcing de Fornecedores Concorrentes (script v3 - aceita 200/201, sem truncar JSON)...")

    if not APIFY_TOKEN:
        sys.exit(
            "[-] Erro: variável de ambiente APIFY_TOKEN não definida.\n"
            "    Defina antes de rodar, ex.: export APIFY_TOKEN=\"seu_token\""
        )

    resultado_bruto = {}
    total = len(TERMOS_DUROS)

    for i, (chave, termo) in enumerate(TERMOS_DUROS.items(), start=1):
        print(f"\n[{i}/{total}] Enviando requisição Apify para: '{termo}'...")
        try:
            itens = rodar_actor(termo, MAX_ITEMS_POR_TERMO)
            resultado_bruto[chave] = itens
            print(f"  [OK] {len(itens)} registros recebidos.")
        except ApifyAuthError as e:
            # Erro de autenticação/cota real (status code 401/402/429) -- não faz
            # sentido continuar batendo 30x na API, mas o total de termos já
            # processados fica salvo no output_bruto.json mesmo assim.
            print(f"  [ERRO] {e}")
            resultado_bruto[chave] = {"erro": str(e)}
            print("[-] Abortando: erro de autenticação/cota confirmado pelo status code. Corrija e rode de novo.")
            break
        except Exception as e:
            print(f"  [ERRO] {e}")
            resultado_bruto[chave] = {"erro": str(e)}

        time.sleep(DELAY_ENTRE_CHAMADAS)

    with open("output_bruto.json", "w", encoding="utf-8") as f:
        json.dump(resultado_bruto, f, ensure_ascii=False, indent=2)

    gerar_resumo_csv(resultado_bruto)

    print("\n[CONCLUIDO] Arquivos 'output_bruto.json' e 'output_resumo.csv' gerados.")


def gerar_resumo_csv(resultado_bruto: dict) -> None:
    """
    Achata o JSON bruto em uma linha por item retornado, puxando os campos
    mais úteis para comparar preço/confiabilidade contra o fornecedor atual
    da planilha de curadoria. Usa .get() em tudo porque o nome exato dos
    campos varia por actor -- não travar o script se algum campo não existir.
    """
    linhas = []
    for termo_busca, itens in resultado_bruto.items():
        if isinstance(itens, dict) and "erro" in itens:
            linhas.append({
                "termo_busca": termo_busca,
                "status": "ERRO",
                "erro": itens["erro"],
            })
            continue

        if not itens:
            linhas.append({
                "termo_busca": termo_busca,
                "status": "SEM_RESULTADOS",
            })
            continue

        for item in itens:
            if not isinstance(item, dict):
                continue
            linhas.append({
                "termo_busca": termo_busca,
                "status": "OK",
                "productId": item.get("productId"),
                "title": item.get("title"),
                "priceCurrent": item.get("priceCurrent") or item.get("price"),
                "priceOriginal": item.get("priceOriginal"),
                "rating": item.get("rating") or item.get("averageStarRating"),
                "reviewsCount": item.get("reviewsCount") or item.get("ratingCount"),
                "ordersCount": item.get("ordersCount") or item.get("orders") or item.get("sold"),
                "storeName": item.get("storeName") or item.get("shopName"),
                "productUrl": item.get("productUrl"),
            })

    if not linhas:
        return

    # União de todas as colunas encontradas, preservando ordem de primeira aparição
    colunas = []
    for linha in linhas:
        for chave in linha.keys():
            if chave not in colunas:
                colunas.append(chave)

    with open("output_resumo.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=colunas)
        writer.writeheader()
        writer.writerows(linhas)


if __name__ == "__main__":
    main()