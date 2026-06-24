import os
import shutil
from datetime import datetime, date, timedelta
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import pandas as pd
from config import EXCEL_PATH, SHEET_CHECKLIST, EXCEL_HEADERS


def _backup_excel():
    if os.path.exists(EXCEL_PATH):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = os.path.dirname(EXCEL_PATH)
        backup_name = f"Cronograma_Tarefas_Financeiro_BACKUP_{ts}.xlsm"
        backup_path = os.path.join(backup_dir, backup_name)
        shutil.copy2(EXCEL_PATH, backup_path)


def _load_workbook():
    if not os.path.exists(EXCEL_PATH):
        raise FileNotFoundError(f"Planilha não encontrada: {EXCEL_PATH}")
    return openpyxl.load_workbook(EXCEL_PATH, keep_vba=True)


def _ensure_sheet(wb):
    if SHEET_CHECKLIST not in wb.sheetnames:
        ws = wb.create_sheet(SHEET_CHECKLIST)
        for col, header in enumerate(EXCEL_HEADERS, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True, color="FFFFFF", name="Calibri")
            cell.fill = PatternFill("solid", start_color="002468")
            cell.alignment = Alignment(horizontal="center")
        ws.freeze_panes = "A2"
    return wb[SHEET_CHECKLIST]


def get_today_activities(usuario=None):
    try:
        wb = _load_workbook()
        ws = _ensure_sheet(wb)
        today_str = date.today().strftime("%d/%m/%Y")
        activities = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not (row[0] and str(row[0]).startswith(today_str[:10])):
                continue
            if usuario and row[7] and str(row[7]).strip().lower() != usuario.strip().lower():
                continue
            if True:
                activities.append({
                    "data": str(row[0]) if row[0] else "",
                    "titulo": str(row[2]) if row[2] else "",
                    "horario_inicio": str(row[3]) if row[3] else "",
                    "horario_fim": str(row[4]) if row[4] else "",
                    "tempo_previsto": int(row[5]) if row[5] else 60,
                    "descricao": str(row[6]) if row[6] else "",
                    "responsavel": str(row[7]) if row[7] else "Vythoria",
                    "origem": str(row[8]) if row[8] else "Manual",
                    "status": str(row[9]) if row[9] else "",
                    "prioridade": str(row[14]) if row[14] else "Média",
                })
        wb.close()
        return activities
    except Exception as e:
        return []


def get_all_data():
    try:
        wb = _load_workbook()
        ws = _ensure_sheet(wb)
        data = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if row[0]:
                data.append(dict(zip(EXCEL_HEADERS, row)))
        wb.close()
        return data
    except Exception:
        return []


def save_checklist(entries):
    try:
        wb = _load_workbook()
        ws = _ensure_sheet(wb)
        timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

        for entry in entries:
            next_row = ws.max_row + 1
            values = [
                entry.get("data", date.today().strftime("%d/%m/%Y")),
                entry.get("dia_semana", _get_weekday()),
                entry.get("titulo", ""),
                entry.get("horario_inicio", ""),
                entry.get("horario_fim", ""),
                entry.get("tempo_previsto", 60),
                entry.get("descricao", ""),
                entry.get("responsavel", "Vythoria"),
                entry.get("origem", "Manual"),
                entry.get("status", ""),
                entry.get("tempo_executado", ""),
                entry.get("houve_atraso", "Não"),
                entry.get("motivo_atraso", ""),
                entry.get("reagendado", "Não"),
                entry.get("prioridade", "Média"),
                entry.get("atividade_extra", "Não"),
                entry.get("categoria_extra", ""),
                entry.get("nome_atividade_extra", ""),
                entry.get("tempo_extra", ""),
                entry.get("solicitante_extra", ""),
                entry.get("observacoes", ""),
                timestamp,
            ]
            for col, val in enumerate(values, 1):
                cell = ws.cell(row=next_row, column=col, value=val)
                cell.font = Font(name="Calibri", size=10)
                if next_row % 2 == 0:
                    cell.fill = PatternFill("solid", start_color="EBF5FB")
                cell.border = Border(
                    bottom=Side(style="thin", color="DDDDDD")
                )
                cell.alignment = Alignment(wrap_text=False)

        wb.save(EXCEL_PATH)
        wb.close()
        return True
    except Exception as e:
        raise RuntimeError(f"Erro ao salvar: {e}")


def get_weekly_data(reference_date=None):
    if reference_date is None:
        reference_date = date.today()
    start = reference_date - timedelta(days=reference_date.weekday())
    end = start + timedelta(days=4)

    try:
        df = pd.DataFrame(get_all_data())
        if df.empty:
            return _empty_weekly()
        df["Data_dt"] = pd.to_datetime(df["Data"], format="%d/%m/%Y", errors="coerce")
        mask = (df["Data_dt"].dt.date >= start) & (df["Data_dt"].dt.date <= end)
        week_df = df[mask].copy()
        if week_df.empty:
            return _empty_weekly()
        return _compute_weekly_stats(week_df)
    except Exception:
        return _empty_weekly()


def get_historical_data(days=90):
    try:
        df = pd.DataFrame(get_all_data())
        if df.empty:
            return pd.DataFrame()
        df["Data_dt"] = pd.to_datetime(df["Data"], format="%d/%m/%Y", errors="coerce")
        cutoff = date.today() - timedelta(days=days)
        return df[df["Data_dt"].dt.date >= cutoff]
    except Exception:
        return pd.DataFrame()


def _compute_weekly_stats(df):
    def parse_time(t):
        mapping = {
            "Menos de 15 minutos": 10,
            "15–30 minutos": 22,
            "30–60 minutos": 45,
            "Igual ao planejado": None,
            "Acima do planejado": None,
        }
        if t in mapping:
            v = mapping[t]
            return v if v else 60
        try:
            return int(t)
        except Exception:
            return 60

    total = len(df)
    concluidas = len(df[df["Status"] == "Concluído"])
    parciais = len(df[df["Status"] == "Parcial"])
    nao_realizadas = len(df[df["Status"] == "Não realizado"])
    reunioes = len(df[df["Titulo"].str.contains("reunião|meeting|call", case=False, na=False)])
    horas_previstas = df["Tempo Previsto (min)"].apply(lambda x: int(x) if str(x).isdigit() else 60).sum() / 60
    horas_executadas = df["Tempo Executado"].apply(parse_time).sum() / 60
    extras = df[df["Atividade Extra"] == "Sim"]
    horas_extras = extras["Tempo Extra (min)"].apply(lambda x: int(x) if str(x).isdigit() else 0).sum() / 60
    taxa_conclusao = round((concluidas / total) * 100, 1) if total > 0 else 0
    taxa_produtividade = round((horas_executadas / horas_previstas) * 100, 1) if horas_previstas > 0 else 0

    by_day = {}
    for _, row in df.iterrows():
        day = str(row.get("Dia Semana", ""))
        if day not in by_day:
            by_day[day] = {"concluidas": 0, "total": 0}
        by_day[day]["total"] += 1
        if row.get("Status") == "Concluído":
            by_day[day]["concluidas"] += 1

    motivos = df[df["Motivo Atraso"] != ""]["Motivo Atraso"].value_counts().to_dict()
    categorias_extras = extras["Categoria Extra"].value_counts().to_dict()

    return {
        "total": total,
        "concluidas": concluidas,
        "parciais": parciais,
        "nao_realizadas": nao_realizadas,
        "reunioes": reunioes,
        "horas_previstas": round(horas_previstas, 1),
        "horas_executadas": round(horas_executadas, 1),
        "horas_extras": round(horas_extras, 1),
        "horas_pendentes": round(horas_previstas - horas_executadas, 1),
        "taxa_conclusao": taxa_conclusao,
        "taxa_produtividade": taxa_produtividade,
        "by_day": by_day,
        "motivos_atraso": motivos,
        "categorias_extras": categorias_extras,
        "atividades_detail": df[["Titulo", "Status", "Tempo Previsto (min)", "Tempo Executado", "Dia Semana"]].to_dict("records"),
    }


def _empty_weekly():
    return {
        "total": 0, "concluidas": 0, "parciais": 0, "nao_realizadas": 0,
        "reunioes": 0, "horas_previstas": 0, "horas_executadas": 0,
        "horas_extras": 0, "horas_pendentes": 0, "taxa_conclusao": 0,
        "taxa_produtividade": 0, "by_day": {}, "motivos_atraso": {},
        "categorias_extras": {}, "atividades_detail": [],
    }


def get_managerial_data(period="month"):
    days_map = {"month": 30, "quarter": 90, "year": 365}
    df = get_historical_data(days=days_map.get(period, 30))
    if df.empty:
        return {}

    total = len(df)
    concluidas = len(df[df["Status"] == "Concluído"])
    taxa = round((concluidas / total) * 100, 1) if total > 0 else 0

    by_cat = {}
    extras = df[df["Atividade Extra"] == "Sim"]
    for _, row in extras.iterrows():
        cat = str(row.get("Categoria Extra", "Outro"))
        if cat not in by_cat:
            by_cat[cat] = 0
        by_cat[cat] += 1

    heatmap_days = {d: 0 for d in ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]}
    for _, row in df.iterrows():
        day = str(row.get("Dia Semana", ""))
        if day in heatmap_days:
            heatmap_days[day] += 1

    top_activities = df.groupby("Titulo").size().sort_values(ascending=False).head(10).to_dict()
    motivos = df[df["Motivo Atraso"].notna() & (df["Motivo Atraso"] != "")]["Motivo Atraso"].value_counts().head(10).to_dict()

    reunioes = len(df[df["Titulo"].str.contains("reunião|meeting|call", case=False, na=False)])
    extras_total = len(extras)

    return {
        "period": period,
        "total_atividades": total,
        "concluidas": concluidas,
        "taxa_conclusao": taxa,
        "reunioes": reunioes,
        "extras_total": extras_total,
        "by_categoria": by_cat,
        "heatmap_days": heatmap_days,
        "top_activities": top_activities,
        "motivos_atraso": motivos,
    }


def propose_next_day_schedule(outlook_events=None):
    today = date.today()
    next_day = today + timedelta(days=1)
    if next_day.weekday() >= 5:
        next_day = today + timedelta(days=(7 - today.weekday()))

    df = pd.DataFrame(get_all_data())
    pending = []
    if not df.empty:
        df["Data_dt"] = pd.to_datetime(df["Data"], format="%d/%m/%Y", errors="coerce")
        today_df = df[df["Data_dt"].dt.date == today]
        pending = today_df[today_df["Status"].isin(["Parcial", "Não realizado"])][
            ["Titulo", "Descricao", "Tempo Previsto (min)", "Prioridade"]
        ].to_dict("records")

    schedule = []
    current_time = 8 * 60
    lunch_start = 12 * 60
    lunch_end = 13 * 60
    end_of_day = 18 * 60

    if outlook_events:
        for ev in outlook_events:
            schedule.append({
                "titulo": ev.get("titulo", "Reunião"),
                "horario_inicio": _mins_to_time(ev.get("inicio", current_time)),
                "horario_fim": _mins_to_time(ev.get("fim", current_time + 60)),
                "tempo_previsto": ev.get("duracao", 60),
                "origem": "Outlook",
                "prioridade": "Alta",
                "tipo": "reuniao",
            })

    for item in sorted(pending, key=lambda x: 0 if x.get("Prioridade") == "Alta" else 1):
        if current_time >= lunch_start:
            current_time = lunch_end
        duracao = int(item.get("Tempo Previsto (min)", 60))
        if current_time + duracao <= end_of_day:
            schedule.append({
                "titulo": f"[Pendência] {item.get('Titulo', '')}",
                "horario_inicio": _mins_to_time(current_time),
                "horario_fim": _mins_to_time(current_time + duracao),
                "tempo_previsto": duracao,
                "origem": "Reagendado",
                "prioridade": item.get("Prioridade", "Média"),
                "tipo": "pendencia",
            })
            current_time += duracao + 15

    used_mins = sum(s["tempo_previsto"] for s in schedule)
    available = end_of_day - 8 * 60 - 60
    backlog = max(0, used_mins - available)

    return {
        "data": next_day.strftime("%d/%m/%Y"),
        "dia_semana": _get_weekday(next_day),
        "schedule": schedule,
        "horas_disponiveis": round(available / 60, 1),
        "horas_planejadas": round(used_mins / 60, 1),
        "backlog_min": backlog,
        "ocupacao_pct": round((used_mins / available) * 100, 1) if available > 0 else 0,
    }


def apply_schedule(schedule_data):
    pass


def _mins_to_time(mins):
    h = mins // 60
    m = mins % 60
    return f"{h:02d}:{m:02d}"


def _get_weekday(d=None):
    if d is None:
        d = date.today()
    days = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
    return days[d.weekday()]
