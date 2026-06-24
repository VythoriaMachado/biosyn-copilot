from datetime import date, timedelta
import pandas as pd
from excel_handler import get_historical_data


def generate_insights(days=30):
    df = get_historical_data(days=days)
    if df.empty:
        return _default_insights()

    total = len(df)
    concluidas = len(df[df["Status"] == "Concluído"])
    taxa = round((concluidas / total) * 100, 1) if total > 0 else 0

    insights = []
    alerts = []
    recommendations = []

    if taxa < 70:
        alerts.append({"tipo": "warning", "msg": f"Taxa de conclusão de {taxa}% está abaixo do ideal (>70%)."})
        recommendations.append("Revise a carga diária — pode haver excesso de atividades planejadas.")

    reunioes = df[df["Titulo"].str.contains("reunião|meeting|call", case=False, na=False)]
    pct_reunioes = round((len(reunioes) / total) * 100, 1) if total > 0 else 0
    if pct_reunioes > 30:
        alerts.append({"tipo": "danger", "msg": f"Reuniões ocupam {pct_reunioes}% do tempo — acima do recomendado."})

    extras = df[df["Atividade Extra"] == "Sim"]
    pct_extras = round((len(extras) / total) * 100, 1) if total > 0 else 0
    if pct_extras > 25:
        alerts.append({"tipo": "warning", "msg": f"Demandas extraordinárias representam {pct_extras}% das atividades."})
        recommendations.append("Identifique as principais fontes de demandas extras e tente antecipar ou delegar.")

    motivos = df[df["Motivo Atraso"].notna() & (df["Motivo Atraso"] != "")]["Motivo Atraso"].value_counts()
    if not motivos.empty:
        top_motivo = motivos.index[0]
        insights.append(f"Principal causa de atraso: {top_motivo} ({motivos.iloc[0]} ocorrências).")

    if not df.empty and "Dia Semana" in df.columns:
        day_counts = df[df["Status"] == "Concluído"].groupby("Dia Semana").size()
        if not day_counts.empty:
            melhor_dia = day_counts.idxmax()
            insights.append(f"Dia mais produtivo: {melhor_dia} com maior número de atividades concluídas.")

    if not extras.empty and "Categoria Extra" in extras.columns:
        top_setor = extras["Categoria Extra"].value_counts().idxmax()
        insights.append(f"Setor que mais gera demandas extras: {top_setor}.")
        recommendations.append(f"Considere reservar um bloco semanal para demandas de {top_setor}.")

    if not df.empty and "Titulo" in df.columns:
        recorrentes = df.groupby("Titulo").size().sort_values(ascending=False).head(3)
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
