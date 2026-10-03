import requests
import json
import csv
import time
from datetime import datetime

APIFY_TOKEN = "apify_api_qj0E00JZ6QxHaifdlfamUFfSMaQafb4lxyZT"
ACTOR_ID = "scrapebase~alibaba-listings-scraper"
MAX_ITEMS_POR_TERMO = 15
DELAY_ENTRE_REQUISICOES = 2

MODO_TESTE = True  # deixa True até confirmar que o actor devolve resultado de verdade

# Só os 31 SKUs "APROVADO - SUBIR" (nome do catálogo -> termo duro em inglês)
# Ajuste/complete esse dicionário com os SKUs reais da sua planilha final.
PRODUTOS_TERMO_DURO = {
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

def rodar_actor(termo: str, max_items: int):
    url = f"https://api.apify.com/v2/acts/{unrivaled_fortress/google-shopping-scraper}/run-sync-get-dataset-items"
    params = {"token": "apify_api_qj0E00JZ6QxHaifdlfamUFfSMaQafb4lxyZT"}
    payload = {"urls": [termo], "maxItems": max_items}
    try:
        resp = requests.post(url, params=params, json=payload, timeout=180)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        return {"erro": str(e), "termo": termo}


def salvar_resultado_bruto(dados: dict, timestamp: str) -> str:
    filename = f"output_bruto_{timestamp}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    return filename


def salvar_resumo_csv(dados: dict, timestamp: str) -> str:
    filename = f"resumo_buscas_{timestamp}.csv"
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Produto", "Termo Buscado", "Itens Encontrados", "Status"])
        for produto, resultado in dados.items():
            if "erro" in resultado:
                writer.writerow([produto, resultado.get("termo_buscado", resultado.get("termo", "N/A")),
                                  0, f"ERRO: {resultado['erro']}"])
            else:
                # FIX: pega a contagem real salva em 'itens_encontrados', não len(dict)
                writer.writerow([produto, resultado.get("termo_buscado", "N/A"),
                                  resultado.get("itens_encontrados", 0), "OK"])
    return filename


def main():
    if APIFY_TOKEN =="apify_api_qj0E00JZ6QxHaifdlfamUFfSMaQafb4lxyZT":
        raise SystemExit("Preencha APIFY_TOKEN antes de rodar.")

    itens_produtos = list(PRODUTOS_TERMO_DURO.items())
    if MODO_TESTE:
        itens_produtos = itens_produtos[:1]
        print("MODO_TESTE ativo — rodando só 1 produto pra validar o actor.\n")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    resultado_bruto = {}
    sucesso, erro = 0, 0

    for idx, (produto, termo) in enumerate(itens_produtos, 1):
        print(f"[{idx}/{len(itens_produtos)}] Buscando: {termo}")
        itens = rodar_actor(termo, MAX_ITEMS_POR_TERMO)

        if isinstance(itens, list):
            resultado_bruto[produto] = {"termo_buscado": termo, "itens_encontrados": len(itens), "dados": itens}
            sucesso += 1
            print(f"  OK - {len(itens)} itens")
        else:
            resultado_bruto[produto] = {"termo_buscado": termo, "erro": str(itens), "itens_encontrados": 0}
            erro += 1
            print(f"  ERRO: {str(itens)[:120]}")

        time.sleep(DELAY_ENTRE_REQUISICOES)

    json_file = salvar_resultado_bruto(resultado_bruto, timestamp)
    csv_file = salvar_resumo_csv(resultado_bruto, timestamp)

    print(f"\nSucessos: {sucesso}/{len(itens_produtos)} | Erros: {erro}/{len(itens_produtos)}")
    print(f"Arquivos: {json_file} | {csv_file}")
    if MODO_TESTE:
        print("\nSe o resultado veio com dados reais (não vazio/erro), troque MODO_TESTE=False e rode os 31.")
        print("Se veio vazio ou erro de schema, o actor provavelmente exige URL de busca montada,")
        print("não uma keyword solta em 'urls' — me manda o erro que eu ajusto o payload.")


if __name__ == "__main__":
    main()