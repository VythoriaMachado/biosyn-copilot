import os
from datetime import date, timedelta
import pandas as pd

if os.environ.get("RENDER"):
    from db_handler import get_all_data as _get_all
    def _get_historical(days):
        records = _get_all()
        if not records:
            return pd.DataFrame()
        df = pd.DataFrame(records)
        df["Data_dt"] = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
        cutoff = date.today() - timedelta(days=days)
        return df[df["Data_dt"].dt.date >= cutoff]
else:
    from excel_handler import get_historical_data as _get_historical


def generate_insights(days=30):
    df = _get_historical(days=days)
    if df is None or df.empty:
        return _default_insights()

    # Normalizar nomes de colunas para minúsculo
    df.columns = [c.lower().strip() for c in df.columns]

    total = len(df)
    concluidas = len(df[df["status"] == "Concluído"]) if "status" in df.columns else 0
    taxa = round((concluidas / total) * 100, 1) if total > 0 else 0

    insights = []
    alerts = []
    recommendations = []

    if taxa < 70:
        alerts.append({"tipo": "warning", "msg": f"Taxa de conclusão de {taxa}% está abaixo do ideal (>70%)."})
        recommendations.append("Revise a carga diária — pode haver excesso de atividades planejadas.")

    if "titulo" in df.columns:
        reunioes = df[df["titulo"].str.contains("reunião|meeting|call", case=False, na=False)]
        pct_reunioes = round((len(reunioes) / total) * 100, 1) if total > 0 else 0
        if pct_reunioes > 30:
            alerts.append({"tipo": "danger", "msg": f"Reuniões ocupam {pct_reunioes}% do tempo — acima do recomendado."})
    else:
        pct_reunioes = 0

    pct_extras = 0

    if "motivo_atraso" in df.columns:
        motivos = df[df["motivo_atraso"].notna() & (df["motivo_atraso"] != "")]["motivo_atraso"].value_counts()
        if not motivos.empty:
            top_motivo = motivos.index[0]
            insights.append(f"Principal causa de atraso: {top_motivo} ({motivos.iloc[0]} ocorrências).")

    if "dia_semana" in df.columns and "status" in df.columns:
        day_counts = df[df["status"] == "Concluído"].groupby("dia_semana").size()
        if not day_counts.empty:
            melhor_dia = day_counts.idxmax()
            insights.append(f"Dia mais produtivo: {melhor_dia} com maior número de atividades concluídas.")

    if "titulo" in df.columns:
        recorrentes = df.groupby("titulo").size().sort_values(ascending=False).head(3)
        if not recorrentes.empty:
            insights.append(f"Atividades mais recorrentes: {', '.join(recorrentes.index.tolist())}.")
            recommendations.append("Atividades recorrentes podem ser automatizadas ou agrupadas em blocos fixos.")

    if taxa < 60:
        recommendations.append("Reduza o número de atividades diárias e priorize as de alto impacto.")

    return {
        "periodo_dias": days,
        "taxa_conclusao": taxa,
        "pct_reunioes": pct_reunioes,
        "pct_extras": pct_extras,
        "insights": insights,
        "alerts": alerts,
        "recommendations": recommendations,
    }


def _default_insights():
    return {
        "periodo_dias": 30,
        "taxa_conclusao": 0,
        "pct_reunioes": 0,
        "pct_extras": 0,
        "insights": ["Sem dados históricos suficientes para análise. Continue registrando suas atividades."],
        "alerts": [],
        "recommendations": ["Registre suas atividades diariamente para gerar insights personalizados."],
    }
