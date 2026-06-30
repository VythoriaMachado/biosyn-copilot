"""
Banco de dados PostgreSQL (Supabase) — usado na versão cloud (Render).
Mesma interface que excel_handler.py.
Fallback para SQLite se SUPABASE_URL não estiver configurado.
"""
import os
from datetime import date, datetime, timedelta

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client
    _sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    def _ensure_db():
        # Supabase gerencia o schema; apenas valida conexão
        try:
            _sb.table("checklist").select("id").limit(1).execute()
            print("[DB] Conectado ao Supabase REST API")
        except Exception as e:
            print(f"[DB] Aviso: {e}")

    _ensure_db()

    def save_checklist(entries):
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        rows = []
        for e in entries:
            rows.append({
                "data":                  e.get("data", ""),
                "dia_semana":            e.get("dia_semana", ""),
                "titulo":                e.get("titulo", ""),
                "horario_inicio":        e.get("horario_inicio", ""),
                "horario_fim":           e.get("horario_fim", ""),
                "tempo_previsto":        int(e.get("tempo_previsto") or 0),
                "descricao":             e.get("descricao", ""),
                "responsavel":           e.get("responsavel", ""),
                "origem":                e.get("origem", ""),
                "status":                e.get("status", ""),
                "tempo_executado":       e.get("tempo_executado", ""),
                "tempo_excedente":       e.get("tempo_excedente", ""),
                "houve_atraso":          e.get("houve_atraso", "Não"),
                "motivo_atraso":         e.get("motivo_atraso", ""),
                "reagendado":            e.get("reagendado", "Não"),
                "prioridade":            e.get("prioridade", "Média"),
                "atividade_extra":       e.get("atividade_extra", "Não"),
                "categoria_extra":       e.get("categoria_extra", ""),
                "nome_atividade_extra":  e.get("nome_atividade_extra", ""),
                "tempo_extra":           int(e.get("tempo_extra") or 0),
                "solicitante_extra":     e.get("solicitante_extra", ""),
                "observacoes":           e.get("observacoes", ""),
                "timestamp_registro":    now,
            })
        try:
            _sb.table("checklist").insert(rows).execute()
        except Exception as e:
            print(f"[DB] save_checklist erro: {e}")
            raise RuntimeError(f"Erro ao salvar no banco: {e}")

    def get_all_data():
        try:
            res = _sb.table("checklist").select("*").order("data", desc=True).execute()
            return res.data or []
        except Exception as e:
            print(f"[DB] get_all_data erro: {e}")
            return []

    def get_today_activities(usuario=None):
        try:
            today_str = date.today().strftime("%d/%m/%Y")
            q = _sb.table("checklist").select("*").eq("data", today_str)
            if usuario:
                q = q.eq("responsavel", usuario)
            res = q.execute()
            return res.data or []
        except Exception as e:
            print(f"[DB] get_today_activities erro: {e}")
            return []

    def update_checklist_entry(record_id, status, houve_atraso, observacoes):
        try:
            _sb.table("checklist").update({
                "status":       status,
                "houve_atraso": houve_atraso,
                "observacoes":  observacoes,
            }).eq("id", record_id).execute()
        except Exception as e:
            print(f"[DB] update_checklist_entry erro: {e}")
            raise RuntimeError(f"Erro ao atualizar registro: {e}")

    def delete_by_date_user(date_str, usuario):
        try:
            q = _sb.table("checklist").delete().eq("data", date_str)
            if usuario:
                q = q.eq("responsavel", usuario)
            q.execute()
        except Exception as e:
            print(f"[DB] delete_by_date_user erro: {e}")
            raise RuntimeError(f"Erro ao deletar registros: {e}")

else:
    # Fallback SQLite para desenvolvimento local
    import sqlite3

    DB_PATH = os.path.join(os.path.dirname(__file__), "cronograma.db")

    def _conn():
        c = sqlite3.connect(DB_PATH)
        c.row_factory = sqlite3.Row
        return c

    def _ensure_db():
        with _conn() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS checklist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT, dia_semana TEXT, titulo TEXT,
                    horario_inicio TEXT, horario_fim TEXT, tempo_previsto INTEGER,
                    descricao TEXT, responsavel TEXT, origem TEXT, status TEXT,
                    tempo_executado TEXT, tempo_excedente TEXT, houve_atraso TEXT, motivo_atraso TEXT,
                    reagendado TEXT, prioridade TEXT, atividade_extra TEXT,
                    categoria_extra TEXT, nome_atividade_extra TEXT, tempo_extra INTEGER,
                    solicitante_extra TEXT, observacoes TEXT, timestamp_registro TEXT
                )
            """)

    _ensure_db()

    def save_checklist(entries):
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        with _conn() as c:
            for e in entries:
                c.execute("""
                    INSERT INTO checklist (
                        data, dia_semana, titulo, horario_inicio, horario_fim,
                        tempo_previsto, descricao, responsavel, origem, status,
                        tempo_executado, tempo_excedente, houve_atraso, motivo_atraso, reagendado,
                        prioridade, atividade_extra, categoria_extra,
                        nome_atividade_extra, tempo_extra, solicitante_extra,
                        observacoes, timestamp_registro
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    e.get("data",""), e.get("dia_semana",""), e.get("titulo",""),
                    e.get("horario_inicio",""), e.get("horario_fim",""),
                    e.get("tempo_previsto",0), e.get("descricao",""),
                    e.get("responsavel",""), e.get("origem",""), e.get("status",""),
                    e.get("tempo_executado",""), e.get("tempo_excedente",""),
                    e.get("houve_atraso","Não"), e.get("motivo_atraso",""), e.get("reagendado","Não"),
                    e.get("prioridade","Média"), e.get("atividade_extra","Não"),
                    e.get("categoria_extra",""), e.get("nome_atividade_extra",""),
                    e.get("tempo_extra",0), e.get("solicitante_extra",""),
                    e.get("observacoes",""), now
                ))

    def get_all_data():
        with _conn() as c:
            rows = c.execute("SELECT * FROM checklist ORDER BY data DESC, horario_inicio").fetchall()
        return [dict(r) for r in rows]

    def get_today_activities(usuario=None):
        today_str = date.today().strftime("%d/%m/%Y")
        with _conn() as c:
            if usuario:
                rows = c.execute("SELECT * FROM checklist WHERE data=? AND responsavel=?", (today_str, usuario)).fetchall()
            else:
                rows = c.execute("SELECT * FROM checklist WHERE data=?", (today_str,)).fetchall()
        return [dict(r) for r in rows]

    def update_checklist_entry(record_id, status, houve_atraso, observacoes):
        with _conn() as c:
            c.execute(
                "UPDATE checklist SET status=?, houve_atraso=?, observacoes=? WHERE id=?",
                (status, houve_atraso, observacoes, record_id)
            )

    def delete_by_date_user(date_str, usuario):
        with _conn() as c:
            if usuario:
                c.execute("DELETE FROM checklist WHERE data=? AND responsavel=?", (date_str, usuario))
            else:
                c.execute("DELETE FROM checklist WHERE data=?", (date_str,))


# Funções compartilhadas (independente do backend)

def get_weekly_data(reference_date=None, usuario=None):
    import pandas as pd
    if reference_date is None:
        reference_date = date.today()
    start = reference_date - timedelta(days=7)
    end = reference_date

    records = get_all_data()
    if usuario:
        u = usuario.strip().lower()
        records = [r for r in records if r.get("responsavel", "").strip().lower() == u]
    if not records:
        return _empty_weekly()

    df = pd.DataFrame(records)
    df["Data_dt"] = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
    week_df = df[(df["Data_dt"].dt.date >= start) & (df["Data_dt"].dt.date <= end)]
    if week_df.empty:
        return _empty_weekly()

    total = len(week_df)
    concluidas = len(week_df[week_df["status"] == "Concluído"])
    parciais = len(week_df[week_df["status"] == "Parcial"])
    nao_real = len(week_df[week_df["status"] == "Não realizado"])
    reunioes = len(week_df[week_df["titulo"].str.contains("reunião|meeting|call|sync|alinhamento", case=False, na=False)])
    taxa = round((concluidas / total) * 100, 1) if total > 0 else 0

    # Horas planejadas: soma de tempo_previsto (minutos → horas)
    horas_previstas = round(week_df["tempo_previsto"].apply(lambda x: int(x) if str(x).isdigit() else 0).sum() / 60, 1)

    # Horas executadas: estimativa baseada em tempo_executado
    _exec_map = {
        "Menos de 15 minutos": 10,
        "15-30 minutos": 22,
        "30-60 minutos": 45,
        "Igual ao planejado": None,   # usa tempo_previsto
        "Acima do planejado": None,   # usa tempo_previsto * 1.2
    }
    horas_exec_min = 0
    for _, row in week_df.iterrows():
        te = str(row.get("tempo_executado", ""))
        tp = int(row.get("tempo_previsto") or 0)
        if te in _exec_map and _exec_map[te] is not None:
            horas_exec_min += _exec_map[te]
        elif te == "Igual ao planejado":
            horas_exec_min += tp
        elif te == "Acima do planejado":
            horas_exec_min += int(tp * 1.2)
        elif row.get("status") == "Concluído":
            horas_exec_min += tp
    horas_executadas = round(horas_exec_min / 60, 1)

    # Extras
    extras_df = week_df[week_df["atividade_extra"] == "Sim"] if "atividade_extra" in week_df.columns else week_df.iloc[0:0]
    horas_extras = round(extras_df["tempo_extra"].apply(lambda x: int(x) if str(x).isdigit() else 0).sum() / 60, 1)

    # Motivos de atraso
    motivos = {}
    if "motivo_atraso" in week_df.columns:
        for m in week_df[week_df["motivo_atraso"].notna()]["motivo_atraso"]:
            if m and str(m).strip():
                motivos[str(m)] = motivos.get(str(m), 0) + 1

    # Categorias extras
    categorias = {}
    if "categoria_extra" in week_df.columns:
        for c in week_df[week_df["categoria_extra"].notna()]["categoria_extra"]:
            if c and str(c).strip():
                categorias[str(c)] = categorias.get(str(c), 0) + 1

    taxa_prod = round((horas_executadas / horas_previstas) * 100, 1) if horas_previstas > 0 else 0

    by_day = {}
    for _, row in week_df.iterrows():
        day = str(row.get("dia_semana", ""))
        if day not in by_day:
            by_day[day] = {"concluidas": 0, "total": 0}
        by_day[day]["total"] += 1
        if row.get("status") == "Concluído":
            by_day[day]["concluidas"] += 1

    return {
        "total": total, "concluidas": concluidas, "parciais": parciais,
        "nao_realizadas": nao_real, "reunioes": reunioes,
        "horas_previstas": horas_previstas, "horas_executadas": horas_executadas,
        "horas_extras": horas_extras, "horas_pendentes": 0,
        "taxa_conclusao": taxa, "taxa_produtividade": taxa_prod,
        "by_day": by_day, "motivos_atraso": motivos, "categorias_extras": categorias,
        "atividades_detail": week_df[["titulo","status","tempo_previsto","dia_semana"]].to_dict("records"),
    }


def _empty_weekly():
    return {
        "total": 0, "concluidas": 0, "parciais": 0, "nao_realizadas": 0,
        "reunioes": 0, "horas_previstas": 0, "horas_executadas": 0,
        "horas_extras": 0, "horas_pendentes": 0, "taxa_conclusao": 0,
        "taxa_produtividade": 0, "by_day": {}, "motivos_atraso": {},
        "categorias_extras": {}, "atividades_detail": [],
    }


def get_managerial_data(period="month", usuario=None):
    days = {"month": 30, "quarter": 90, "year": 365}.get(period, 30)
    cutoff = date.today() - timedelta(days=days)
    records = get_all_data()

    if usuario:
        u = usuario.strip().lower()
        records = [r for r in records if r.get("responsavel", "").strip().lower() == u]

    def _dt(s):
        try:
            return datetime.strptime(s, "%d/%m/%Y").date()
        except:
            return date.min

    records = [r for r in records if _dt(r.get("data", "")) >= cutoff]
    total = len(records)
    concluidas = sum(1 for r in records if r.get("status") == "Concluído")
    taxa = round((concluidas / total) * 100, 1) if total > 0 else 0

    heatmap = {d: 0 for d in ["Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira"]}
    for r in records:
        day = str(r.get("dia_semana", ""))
        if day in heatmap:
            heatmap[day] += 1

    return {
        "period": period, "total_atividades": total,
        "concluidas": concluidas, "taxa_conclusao": taxa,
        "reunioes": 0, "extras_total": 0,
        "by_categoria": {}, "heatmap_days": heatmap,
        "top_activities": {}, "motivos_atraso": {},
    }


def _mins_to_time(mins):
    try:
        m = int(mins)
        return f"{m//60:02d}:{m%60:02d}"
    except:
        return "00:00"


def propose_next_day_schedule(outlook_events=None):
    today = date.today()
    next_day = today + timedelta(days=1)
    if next_day.weekday() >= 5:
        next_day = today + timedelta(days=7 - today.weekday())

    schedule = []

    # Itens pendentes agendados via checklist
    next_day_str = next_day.strftime("%d/%m/%Y")
    try:
        all_records = get_all_data()
        pending = [r for r in all_records
                   if r.get("data") == next_day_str and r.get("origem") == "Agendado"]
        for r in pending:
            schedule.append({
                "titulo":         r.get("titulo", "Demanda pendente"),
                "horario_inicio": "",
                "horario_fim":    "",
                "tempo_previsto": int(r.get("tempo_previsto") or 60),
                "origem":         "Agendado",
                "prioridade":     "Alta",
                "tipo":           "pendente",
                "descricao":      r.get("descricao", ""),
            })
    except Exception:
        pass

    for ev in (outlook_events or []):
        schedule.append({
            "titulo":         ev.get("titulo", "Evento"),
            "horario_inicio": _mins_to_time(ev.get("inicio", 8*60)),
            "horario_fim":    _mins_to_time(ev.get("fim", 9*60)),
            "tempo_previsto": ev.get("duracao", 60),
            "origem":         "Outlook",
            "prioridade":     "Alta",
            "tipo":           "evento",
        })

    used = sum(s["tempo_previsto"] for s in schedule)
    available = 8 * 60

    return {
        "data":              next_day.strftime("%d/%m/%Y"),
        "dia_semana":        _get_weekday(next_day),
        "schedule":          schedule,
        "horas_disponiveis": round(available / 60, 1),
        "horas_planejadas":  round(used / 60, 1),
        "backlog_min":       max(0, used - available),
        "ocupacao_pct":      round((used / available) * 100, 1) if available > 0 else 0,
    }


def _get_weekday(d=None):
    if d is None:
        d = date.today()
    days = ["Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado","Domingo"]
    return days[d.weekday()]
