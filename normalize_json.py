import json
import sys

mapping = {
    'Intervalo de datas': 'DATE_RANGE',
    'Curtidas do post': 'LIKES_POST',
    'Salvamentos do post': 'SAVES_POST',
    'Respostas ao story': 'COMMENTS_POST',
    'Compartilhamento de story': 'SHARES_POST',
    'Curtidas em vídeos do Reels': 'LIKES_REELS',
    'Comentários em reels': 'COMMENTS_REELS',
    'Compartilhamentos de vídeos do Reels': 'SHARES_REELS',
}

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)

# Normalizar chaves
for interaction in data.get('organic_insights_interactions', []):
    new_smd = {}
    for key, value in interaction.get('string_map_data', {}).items():
        new_key = mapping.get(key, key)
        new_smd[new_key] = value
    interaction['string_map_data'] = new_smd

with open(sys.argv[1], 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("✅ JSON normalizado!")
