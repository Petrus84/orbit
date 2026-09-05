import os
from urllib.parse import urlparse

import pandas as pd
from supabase import Client, create_client


# ============================================================
# CONFIGURAÇÃO
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError(
        "A variável de ambiente SUPABASE_URL não foi configurada."
    )

if not SUPABASE_KEY:
    raise RuntimeError(
        "A variável de ambiente "
        "SUPABASE_SERVICE_ROLE_KEY não foi configurada."
    )

# UUID da CP Import Store
CLIENT_ID = "2141d077-0d82-4fda-83df-558377f105ff"

CSV_FILENAME = (
    "May-16-2026_Aug-29-2026_1581998513621477.csv"
)

# Comece sempre com true.
# Para realmente inserir, defina DRY_RUN=false no ambiente.
DRY_RUN = (
    os.environ.get("DRY_RUN", "true").lower()
    in {"1", "true", "yes", "sim"}
)

# Quantidade de registros por lote.
BATCH_SIZE = 100

# O horário do CSV não contém fuso.
# Deixe vazio se você ainda não confirmou o fuso da exportação.
#
# Exemplos:
#   CSV_TIMEZONE=America/Sao_Paulo
#   CSV_TIMEZONE=UTC
CSV_TIMEZONE = os.environ.get("CSV_TIMEZONE")


# ============================================================
# CLIENTE SUPABASE
# ============================================================

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
)


def orbit_table(table_name):
    return (
        supabase
        .schema("orbit")
        .table(table_name)
    )


# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================

def nullable_text(value):
    """
    Converte células vazias/NaN em None.
    """
    if pd.isna(value):
        return None

    text = str(value).strip()

    if not text or text.lower() == "nan":
        return None

    return text


def nullable_int(value):
    """
    Converte números para int e preserva ausência como None.
    """
    if pd.isna(value):
        return None

    if isinstance(value, str):
        value = value.strip().replace(",", "")

        if not value:
            return None

    return int(float(value))


def extract_shortcode(permalink):
    """
    Extrai o shortcode de URLs como:

    https://www.instagram.com/reel/ABC123/
    https://www.instagram.com/p/ABC123/
    """
    if not permalink:
        return None

    parsed_url = urlparse(permalink)

    parts = [
        part
        for part in parsed_url.path.split("/")
        if part
    ]

    if len(parts) < 2:
        return None

    # Exemplo:
    # /reel/ABC123/ -> ["reel", "ABC123"]
    # /p/ABC123/ -> ["p", "ABC123"]
    if parts[-2] in ("reel", "p", "tv"):
        return parts[-1]

    # Fallback para outros formatos de URL.
    return parts[-1]


def parse_published_at(value):
    """
    O CSV usa o formato:

    MM/DD/YYYY HH:MM

    Exemplo:
    08/14/2026 09:33
    """
    if pd.isna(value):
        raise ValueError(
            "Horário de publicação ausente."
        )

    timestamp = pd.to_datetime(
        str(value).strip(),
        format="%m/%d/%Y %H:%M",
        errors="raise",
    )

    if CSV_TIMEZONE:
        try:
            timestamp = timestamp.tz_localize(
                CSV_TIMEZONE
            ).tz_convert("UTC")
        except Exception as error:
            raise ValueError(
                f"Fuso horário inválido: {CSV_TIMEZONE}"
            ) from error

    return timestamp.isoformat()


def validate_required_columns(df):
    required_columns = {
        "Identificação do post",
        "Identificação da conta",
        "Nome de usuário da conta",
        "Nome da conta",
        "Descrição",
        "Duração (s)",
        "Horário de publicação",
        "Link permanente",
        "Tipo de post",
        "Data",
        "Visualizações",
        "Alcance",
        "Curtidas",
        "Compartilhamentos",
        "Seguimentos",
        "Comentários",
        "Salvamentos",
    }

    missing_columns = sorted(
        required_columns - set(df.columns)
    )

    if missing_columns:
        raise ValueError(
            "Colunas ausentes no CSV:\n- "
            + "\n- ".join(missing_columns)
        )


def is_valid_post_type(post_type):
    """
    Confirma que o registro é um tipo válido:
    Reel, Reels, Vídeo, Video, Carrossel ou Imagem.
    """
    if pd.isna(post_type):
        return False

    post_type_str = str(post_type).lower()

    return any(
        keyword in post_type_str
        for keyword in (
            "reel",
            "vídeo",
            "video",
            "post",
            "carrossel",
            "imagem",
        )
    )


def get_content_format(post_type):
    """
    Determina o formato do conteúdo baseado no tipo.
    """
    if pd.isna(post_type):
        return "post"

    post_type_str = str(post_type).lower()

    if "reel" in post_type_str:
        return "reel"
    elif "vídeo" in post_type_str or "video" in post_type_str:
        return "video"
    elif "carrossel" in post_type_str:
        return "carousel"
    elif "imagem" in post_type_str:
        return "image"
    else:
        return "post"


def build_payload(row):
    permalink = nullable_text(
        row["Link permanente"]
    )

    if not permalink:
        raise ValueError(
            "Link permanente ausente."
        )

    if not is_valid_post_type(row["Tipo de post"]):
        raise ValueError(
            "O registro não é um tipo válido "
            "(Reel, Reels, Vídeo, Video, Carrossel ou Imagem)."
        )

    shortcode = extract_shortcode(permalink)

    if not shortcode:
        raise ValueError(
            f"Não foi possível extrair o shortcode: "
            f"{permalink}"
        )

    content_format = get_content_format(
        row["Tipo de post"]
    )

    return {
        "client_id": CLIENT_ID,
        "ig_post_uri": permalink,
        "ig_shortcode": shortcode,
        "published_at": parse_published_at(
            row["Horário de publicação"]
        ),
        "content_format": content_format,
        "caption": nullable_text(
            row["Descrição"]
        ),
        "reach": nullable_int(
            row["Alcance"]
        ),
        "impressions": nullable_int(
            row["Visualizações"]
        ),
        "likes": nullable_int(
            row["Curtidas"]
        ),
        "comments": nullable_int(
            row["Comentários"]
        ),
        "shares": nullable_int(
            row["Compartilhamentos"]
        ),
        "saves": nullable_int(
            row["Salvamentos"]
        ),
        "follows_from": nullable_int(
            row["Seguimentos"]
        ),
        "reel_duration_sec": nullable_int(
            row["Duração (s)"]
        ),
    }


def load_csv():
    if not os.path.exists(CSV_FILENAME):
        raise FileNotFoundError(
            f"Arquivo não encontrado: {CSV_FILENAME}"
        )

    # utf-8-sig também lida melhor com CSVs exportados
    # contendo BOM no início do arquivo.
    df = pd.read_csv(
        CSV_FILENAME,
        encoding="utf-8-sig",
    )

    if df.empty:
        raise ValueError(
            "O CSV está vazio."
        )

    validate_required_columns(df)

    return df


def fetch_existing_shortcodes():
    """
    Busca os shortcodes existentes na tabela.

    O endpoint pode paginar resultados. Por isso a consulta
    é feita em blocos.
    """
    existing = set()
    offset = 0

    while True:
        response = (
            orbit_table("ig_posts")
            .select("ig_shortcode")
            .range(
                offset,
                offset + 999,
            )
            .execute()
        )

        rows = response.data or []

        for row in rows:
            shortcode = row.get("ig_shortcode")

            if shortcode:
                existing.add(shortcode)

        if len(rows) < 1000:
            break

        offset += 1000

    return existing


def prepare_payloads(df, existing_shortcodes):
    valid_payloads = []
    validation_errors = []
    csv_shortcodes = set()

    for index, row in df.iterrows():
        csv_line = index + 2

        try:
            payload = build_payload(row)
            shortcode = payload["ig_shortcode"]

            if shortcode in csv_shortcodes:
                raise ValueError(
                    f"Shortcode duplicado dentro do CSV: "
                    f"{shortcode}"
                )

            csv_shortcodes.add(shortcode)

            if shortcode in existing_shortcodes:
                validation_errors.append(
                    {
                        "line": csv_line,
                        "type": "already_exists",
                        "shortcode": shortcode,
                        "message": (
                            "Post já existente; "
                            "não será inserido novamente."
                        ),
                    }
                )
                continue

            valid_payloads.append(payload)

        except Exception as error:
            validation_errors.append(
                {
                    "line": csv_line,
                    "type": "invalid",
                    "shortcode": None,
                    "message": str(error),
                }
            )

    return valid_payloads, validation_errors


def print_validation_report(
    df,
    payloads,
    errors,
):
    print("\n==============================")
    print("RELATÓRIO DE VALIDAÇÃO")
    print("==============================")
    print(f"Arquivo: {CSV_FILENAME}")
    print(f"Cliente: {CLIENT_ID}")
    print(f"Registros no CSV: {len(df)}")
    print(f"Payloads novos: {len(payloads)}")
    print(f"Alertas/erros: {len(errors)}")
    print(f"DRY_RUN: {DRY_RUN}")
    print(f"Fuso do CSV: {CSV_TIMEZONE or 'não informado'}")

    if errors:
        print("\nOcorrências:")

        for error in errors:
            print(
                f"- Linha {error['line']} "
                f"[{error['type']}]: "
                f"{error['message']}"
            )

    if payloads:
        print("\nPrimeiro payload:")
        print(payloads[0])


def insert_in_batches(payloads):
    total_inserted = 0
    total_failed = 0

    for start in range(
        0,
        len(payloads),
        BATCH_SIZE,
    ):
        batch = payloads[
            start:start + BATCH_SIZE
        ]

        batch_number = (
            start // BATCH_SIZE
        ) + 1

        try:
            response = (
                orbit_table("ig_posts")
                .insert(batch)
                .execute()
            )

            inserted_rows = response.data or []
            inserted_count = len(inserted_rows)

            total_inserted += inserted_count

            print(
                f"Lote {batch_number}: "
                f"{inserted_count} inseridos."
            )

        except Exception as error:
            total_failed += len(batch)

            print(
                f"Lote {batch_number} falhou "
                f"({len(batch)} registros): {error}"
            )

    return total_inserted, total_failed


# ============================================================
# INGESTÃO PRINCIPAL
# ============================================================

def run_ingestion():
    print("Iniciando validação da ingestão...")

    df = load_csv()

    print(
        f"CSV carregado com {len(df)} registros."
    )

    print(
        "Consultando posts existentes para evitar "
        "duplicidades..."
    )

    existing_shortcodes = (
        fetch_existing_shortcodes()
    )

    print(
        f"Shortcodes já existentes: "
        f"{len(existing_shortcodes)}"
    )

    payloads, errors = prepare_payloads(
        df,
        existing_shortcodes,
    )

    print_validation_report(
        df,
        payloads,
        errors,
    )

    if DRY_RUN:
        print(
            "\nDRY_RUN ativo. "
            "Nenhuma alteração foi feita no banco."
        )
        return

    if not payloads:
        print(
            "\nNenhum registro novo para inserir."
        )
        return

    print(
        f"\nInserindo {len(payloads)} registros..."
    )

    inserted_count, failed_count = (
        insert_in_batches(payloads)
    )

    print("\n==============================")
    print("INGESTÃO FINALIZADA")
    print("==============================")
    print(f"Inseridos: {inserted_count}")
    print(f"Falharam: {failed_count}")
    print(
        f"Ignorados ou com erro de validação: "
        f"{len(errors)}"
    )


if __name__ == "__main__":
    run_ingestion()