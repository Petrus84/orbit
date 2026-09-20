"""
ORBIT_V41.PY (reproduzido fielmente a partir do documento compartilhado)
Motor de análise psicográfica de conteúdo Instagram
"""

import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum

import numpy as np


class PankseppSystem(Enum):
    SEEKING = "seeking"
    RAGE = "rage"
    FEAR = "fear"
    LUST = "lust"
    CARE = "care"
    PANIC = "panic"
    PLAY = "play"


class SchwatzValue(Enum):
    SELF_DIRECTION = "self_direction"
    STIMULATION = "stimulation"
    HEDONISM = "hedonism"
    ACHIEVEMENT = "achievement"
    POWER = "power"
    SECURITY = "security"
    CONFORMITY = "conformity"
    TRADITION = "tradition"
    BENEVOLENCE = "benevolence"
    UNIVERSALISM = "universalism"


PSYCHOGRAPHIC_LEXICON = {
    "seeking": {
        "keywords": [
            "descubra", "explore", "novo", "inovação", "tendência", "segredo",
            "revelação", "surpresa", "desafio", "oportunidade", "possibilidade",
            "transformação", "evolução", "crescimento", "aprendizado", "conhecimento",
            "dica", "truque", "hack", "método", "estratégia", "passo a passo",
            "como", "tutorial", "guia", "fórmula", "receita"
        ],
        "weight": 1.0
    },
    "rage": {
        "keywords": [
            "chega", "basta", "problema", "erro", "falha", "injustiça",
            "raiva", "indignação", "crítica", "confronto", "debate",
            "verdade incômoda", "realidade dura", "sem filtro", "polêmica",
            "controvérsia", "desacordo", "discordância", "oposição"
        ],
        "weight": 0.8
    },
    "fear": {
        "keywords": [
            "cuidado", "atenção", "aviso", "alerta", "perigo", "risco",
            "proteção", "segurança", "defesa", "precaução", "evitar",
            "cuidar", "proteger", "resguardar", "salvaguarda", "ameaça",
            "medo", "ansiedade", "preocupação", "incerteza"
        ],
        "weight": 0.7
    },
    "lust": {
        "keywords": [
            "desejo", "atração", "sedução", "sensualidade", "beleza",
            "perfeição", "admiração", "encanto", "fascínio", "magnetismo",
            "irresistível", "tentação", "paixão", "amor", "romance",
            "corpo", "visual", "estética", "estilo", "elegância"
        ],
        "weight": 0.9
    },
    "care": {
        "keywords": [
            "amor", "cuidado", "empatia", "compaixão", "solidariedade",
            "apoio", "ajuda", "suporte", "proteção", "bem-estar",
            "saúde", "felicidade", "conforto", "acolhimento", "abraço",
            "família", "comunidade", "juntos", "união", "conexão"
        ],
        "weight": 1.0
    },
    "panic": {
        "keywords": [
            "perda", "separação", "solidão", "abandono", "desespero",
            "urgência", "pressa", "tempo", "agora", "já", "último",
            "ansiedade", "estresse", "pressão", "sobrecarga", "crise",
            "emergência", "situação crítica", "momento decisivo"
        ],
        "weight": 0.8
    },
    "play": {
        "keywords": [
            "diversão", "brincadeira", "riso", "humor", "piada", "meme",
            "leveza", "alegria", "felicidade", "descontração", "relaxamento",
            "jogo", "competição amigável", "desafio divertido", "aventura",
            "espontaneidade", "criatividade", "improviso", "surpresa"
        ],
        "weight": 1.0
    },
}

SCHWARTZ_LEXICON = {
    "self_direction": ["liberdade", "autonomia", "criatividade", "independência", "escolha"],
    "stimulation": ["novidade", "variedade", "desafio", "emoção", "adrenalina"],
    "hedonism": ["prazer", "diversão", "satisfação", "gozo", "desfrutar"],
    "achievement": ["sucesso", "vitória", "conquista", "competência", "excelência"],
    "power": ["poder", "controle", "domínio", "autoridade", "influência"],
    "security": ["segurança", "estabilidade", "proteção", "confiança", "certeza"],
    "conformity": ["obediência", "regra", "norma", "tradição", "respeito"],
    "tradition": ["história", "cultura", "herança", "passado", "raiz"],
    "benevolence": ["bem comum", "altruísmo", "generosidade", "sacrifício", "bem-estar"],
    "universalism": ["igualdade", "justiça", "ambiente", "natureza", "humanidade"],
}


@dataclass
class InstagramPost:
    post_id: str
    caption: str
    likes: int
    comments: int
    shares: int
    reach: int
    impressions: int
    saves: int
    published_at: str
    format_type: str

    @property
    def engagement_rate(self) -> float:
        if self.reach == 0:
            return 0.0
        return (self.likes + self.comments + self.shares) / self.reach

    @property
    def virality_potential_score(self) -> float:
        if self.reach == 0:
            return 0.0
        return (self.shares + self.saves) / self.reach


@dataclass
class ClientAvatar:
    name: str
    sector: str
    target_age_min: int
    target_age_max: int
    target_gender: str
    target_interests: List[str]
    target_values: List[SchwatzValue]
    expected_tone: str


@dataclass
class PsychographicScore:
    post_id: str
    panksepp_scores: Dict[str, float]
    schwartz_scores: Dict[str, float]
    dominant_system: str
    dominant_value: str
    alignment_score: float
    recommendation: str
    confidence: float


@dataclass
class AnalysisResult:
    client_name: str
    posts_analyzed: int
    avg_alignment_score: float
    correlation_alignment_vs_er: float
    correlation_alignment_vs_vps: float
    top_performing_systems: List[Tuple[str, float]]
    recommendations: List[str]
    timestamp: str


class PsychographicAnalyzer:
    def __init__(self):
        self.lexicon = PSYCHOGRAPHIC_LEXICON
        self.schwartz_lexicon = SCHWARTZ_LEXICON

    def analyze_post(self, post: InstagramPost, avatar: ClientAvatar) -> PsychographicScore:
        caption_lower = post.caption.lower()
        panksepp_scores = self._calculate_panksepp_scores(caption_lower)
        schwartz_scores = self._calculate_schwartz_scores(caption_lower)
        dominant_system = max(panksepp_scores, key=panksepp_scores.get)
        dominant_value = max(schwartz_scores, key=schwartz_scores.get)
        alignment_score = self._calculate_alignment(panksepp_scores, schwartz_scores, avatar)
        recommendation = self._generate_recommendation(alignment_score, dominant_system, dominant_value, avatar)
        signal_count = sum(1 for v in panksepp_scores.values() if v > 0.3)
        confidence = min(signal_count / 3, 1.0)
        return PsychographicScore(
            post_id=post.post_id,
            panksepp_scores=panksepp_scores,
            schwartz_scores=schwartz_scores,
            dominant_system=dominant_system,
            dominant_value=dominant_value,
            alignment_score=alignment_score,
            recommendation=recommendation,
            confidence=confidence
        )

    def _calculate_panksepp_scores(self, text: str) -> Dict[str, float]:
        scores = {}
        for system, data in self.lexicon.items():
            keywords = data["keywords"]
            weight = data["weight"]
            matches = sum(text.count(keyword) for keyword in keywords)
            total_words = len(text.split())
            if total_words == 0:
                scores[system] = 0.0
            else:
                raw_score = (matches / total_words) * weight
                scores[system] = min(raw_score, 1.0)
        return scores

    def _calculate_schwartz_scores(self, text: str) -> Dict[str, float]:
        scores = {}
        for value, keywords in self.schwartz_lexicon.items():
            matches = sum(text.count(keyword) for keyword in keywords)
            total_words = len(text.split())
            if total_words == 0:
                scores[value] = 0.0
            else:
                raw_score = matches / total_words
                scores[value] = min(raw_score, 1.0)
        return scores

    def _calculate_alignment(self, panksepp_scores, schwartz_scores, avatar: ClientAvatar) -> float:
        expected_values = [v.value for v in avatar.target_values]
        value_alignment = 0.0
        if expected_values:
            for value in expected_values:
                if value in schwartz_scores:
                    value_alignment += schwartz_scores[value]
            value_alignment = value_alignment / len(expected_values)
        tone_penalty = 0.0
        if avatar.expected_tone == "inspirador":
            if panksepp_scores.get("rage", 0) > 0.5:
                tone_penalty = 0.3
        elif avatar.expected_tone == "descontraído":
            if panksepp_scores.get("fear", 0) > 0.5:
                tone_penalty = 0.2
        alignment = max(0, value_alignment - tone_penalty)
        return min(alignment, 1.0)

    def _generate_recommendation(self, alignment_score, dominant_system, dominant_value, avatar: ClientAvatar) -> str:
        if alignment_score >= 0.75:
            status = "✅ EXCELENTE ALINHAMENTO"
            action = "Continue com essa abordagem psicográfica."
        elif alignment_score >= 0.5:
            status = "⚠️ ALINHAMENTO PARCIAL"
            action = f"Considere amplificar {dominant_value} para melhorar ressonância."
        else:
            status = "❌ BAIXO ALINHAMENTO"
            action = f"Post comunica {dominant_system} mas avatar espera {avatar.expected_tone}. Revise estratégia."
        return f"{status} | {action}"


SECTOR_BENCHMARKS = {
    "ecommerce": {
        "avg_er": 0.045, "avg_vps": 0.008,
        "dominant_systems": ["seeking", "lust", "play"],
        "expected_values": ["achievement", "hedonism", "self_direction"],
        "description": "E-commerce direto: foco em produto, desejo, conversão"
    },
    "infoproduto": {
        "avg_er": 0.065, "avg_vps": 0.012,
        "dominant_systems": ["seeking", "care", "achievement"],
        "expected_values": ["achievement", "self_direction", "universalism"],
        "description": "Infoproduto: educação, transformação, conhecimento"
    },
    "coaching": {
        "avg_er": 0.055, "avg_vps": 0.010,
        "dominant_systems": ["care", "seeking", "play"],
        "expected_values": ["benevolence", "achievement", "self_direction"],
        "description": "Coaching: inspiração, transformação pessoal, empatia"
    },
    "agencia": {
        "avg_er": 0.040, "avg_vps": 0.007,
        "dominant_systems": ["seeking", "achievement", "lust"],
        "expected_values": ["achievement", "power", "self_direction"],
        "description": "Agência: portfólio, case, expertise"
    },
}


class CorrelationAnalyzer:
    @staticmethod
    def calculate_correlation(scores: List[PsychographicScore], posts: List[InstagramPost]) -> Tuple[float, float]:
        if len(scores) < 2:
            return 0.0, 0.0
        score_map = {s.post_id: s.alignment_score for s in scores}
        alignment_values, er_values, vps_values = [], [], []
        for post in posts:
            if post.post_id in score_map:
                alignment_values.append(score_map[post.post_id])
                er_values.append(post.engagement_rate)
                vps_values.append(post.virality_potential_score)
        if len(alignment_values) < 2:
            return 0.0, 0.0
        corr_er = np.corrcoef(alignment_values, er_values)[0, 1]
        corr_vps = np.corrcoef(alignment_values, vps_values)[0, 1]
        corr_er = 0.0 if np.isnan(corr_er) else corr_er
        corr_vps = 0.0 if np.isnan(corr_vps) else corr_vps
        return corr_er, corr_vps


class OrbitV41Engine:
    def __init__(self):
        self.analyzer = PsychographicAnalyzer()
        self.correlation = CorrelationAnalyzer()

    def run_analysis(self, posts: List[InstagramPost], avatar: ClientAvatar) -> AnalysisResult:
        scores = [self.analyzer.analyze_post(post, avatar) for post in posts]
        corr_er, corr_vps = self.correlation.calculate_correlation(scores, posts)
        avg_alignment = float(np.mean([s.alignment_score for s in scores])) if scores else 0.0
        system_performance = self._calculate_system_performance(scores, posts)
        recommendations = self._generate_strategic_recommendations(scores, posts, avatar, corr_er, corr_vps)
        return AnalysisResult(
            client_name=avatar.name,
            posts_analyzed=len(posts),
            avg_alignment_score=avg_alignment,
            correlation_alignment_vs_er=float(corr_er),
            correlation_alignment_vs_vps=float(corr_vps),
            top_performing_systems=system_performance,
            recommendations=recommendations,
            timestamp=datetime.now().isoformat()
        ), scores

    def _calculate_system_performance(self, scores, posts):
        system_ers = {}
        for score, post in zip(scores, posts):
            system = score.dominant_system
            system_ers.setdefault(system, []).append(post.engagement_rate)
        system_avg = {system: float(np.mean(ers)) for system, ers in system_ers.items()}
        return sorted(system_avg.items(), key=lambda x: x[1], reverse=True)

    def _generate_strategic_recommendations(self, scores, posts, avatar: ClientAvatar, corr_er, corr_vps):
        recommendations = []
        if corr_er > 0.5:
            recommendations.append(f"✅ Forte correlação (r={corr_er:.2f}) entre alinhamento psicográfico e ER real. Continue com essa estratégia.")
        elif corr_er > 0.2:
            recommendations.append(f"⚠️ Correlação moderada (r={corr_er:.2f}). Psicografia importa, mas outros fatores também.")
        else:
            recommendations.append(f"❌ Baixa correlação (r={corr_er:.2f}). Score psicográfico pode não ser preditor de performance. Revise hipótese ou aumente amostra.")

        avg_alignment = float(np.mean([s.alignment_score for s in scores])) if scores else 0.0
        if avg_alignment < 0.4:
            recommendations.append(
                f"⚠️ Alinhamento médio baixo ({avg_alignment:.1%}). Posts não comunicam valores esperados. "
                f"Avatar espera: {', '.join([v.value for v in avatar.target_values])}"
            )

        benchmark = SECTOR_BENCHMARKS.get(avatar.sector)
        if benchmark and posts:
            avg_er = float(np.mean([p.engagement_rate for p in posts]))
            if avg_er < benchmark["avg_er"]:
                recommendations.append(
                    f"📊 ER médio ({avg_er:.1%}) abaixo do benchmark de {avatar.sector} ({benchmark['avg_er']:.1%}). "
                    f"Considere amplificar: {', '.join(benchmark['dominant_systems'])}"
                )
            else:
                recommendations.append(
                    f"📊 ER médio ({avg_er:.1%}) ACIMA do benchmark de {avatar.sector} ({benchmark['avg_er']:.1%})."
                )

        recommendations.append("🔄 Próximo passo: Teste conteúdo com sistemas psicográficos diferentes e meça impacto em 2-4 semanas.")
        return recommendations
