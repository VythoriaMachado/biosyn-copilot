"""
Banco de dados PostgreSQL (Supabase) — usado na versão cloud (Render).
Mesma interface que excel_handler.py.
Fallback para SQLite se DATABASE_URL não estiver configurado.
"""
import os
from datetime import date, datetime, timedelta

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if DATABASE_URL:
    import pg8000.dbapi
    import re

    def _parse_db_url(url):
        # Formato: postgresql://user:pass@host:port/db
        # O user pode conter pontos (ex: postgres.fyehelkbmbbysikvqeke)
        m = re.match(
            r"postgresql://([^:]+):(.+)@([^:/]+):(\d+)/(.+)",
            url
        )
        if not m:
            raise ValueError(f"DATABASE_URL inválida: {url}")
        from urllib.parse import unquote
        return {
            "user":     m.group(1),
            "password": unquote(m.group(2)),
            "host":     m.group(3),
            "port":     int(m.group(4)),
            "database": m.group(5),
        }

    _DB_PARAMS = _parse_db_url(DATABASE_URL)

    def _conn():
        return pg8000.dbapi.connect(
            host=_DB_PARAMS["host"],
            port=_DB_PARAMS["port"],
            user=_DB_PARAMS["user"],
            password=_DB_PARAMS["password"],
            database=_DB_PARAMS["database"],
            ssl_context=True,
            timeout=10,
        )

    def _ensure_db():
        try:
            c = _conn()
            cur = c.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS checklist (
                    id SERIAL PRIMARY KEY,
                    data TEXT, dia_semana TEXT, titulo TEXT,
                    horario_inicio TEXT, horario_fim TEXT, tempo_previsto INTEGER,
                    descricao TEXT, responsavel TEXT, origem TEXT, status TEXT,
                    tempo_executado TEXT, houve_atraso TEXT, motivo_atraso TEXT,
                    reagendado TEXT, prioridade TEXT, atividade_extra TEXT,
                    categoria_extra TEXT, nome_atividade_extra TEXT, tempo_extra INTEGER,
                    solicitante_extra TEXT, observacoes TEXT, timestamp_registro TEXT
                )
            """)
            c.commit()
            cur.close()
            c.close()
            print("[DB] Conectado ao PostgreSQL (Supabase)")
        except Exception as e:
            print(f"[DB] Aviso: não foi possível conectar ao PostgreSQL: {e}")

    _ensure_db()

    def _cols():
        return ["id","data","dia_semana","titulo","horario_inicio","horario_fim",
                "tempo_previsto","descricao","responsavel","origem","status",
                "tempo_executado","houve_atraso","motivo_atraso","reagendado",
                "prioridade","atividade_extra","categoria_extra","nome_atividade_extra",
                "tempo_extra","solicitante_extra","observacoes","timestamp_registro"]

    def _rows_to_dicts(rows):
        cols = _cols()
        return [dict(zip(cols, row)) for row in rows]

    def save_checklist(entries):
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        try:
            c = _conn()
            cur = c.cursor()
            for e in entries:
                cur.execute("""
                    INSERT INTO checklist (
                        data, dia_semana, titulo, horario_inicio, horario_fim,
                        tempo_previsto, descricao, responsavel, origem, status,
                        tempo_executado, houve_atraso, motivo_atraso, reagendado,
                        prioridade, atividade_extra, categoria_extra,
                        nome_atividade_extra, tempo_extra, solicitante_extra,
                        observacoes, timestamp_registro
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (
                    e.get("data",""), e.get("dia_semana",""), e.get("titulo",""),
                    e.get("horario_inicio",""), e.get("horario_fim",""),
                    int(e.get("tempo_previsto") or 0), e.get("descricao",""),
                    e.get("responsavel",""), e.get("origem",""), e.get("status",""),
                    e.get("tempo_executado",""), e.get("houve_atraso","Não"),
                    e.get("motivo_atraso",""), e.get("reagendado","Não"),
                    e.get("prioridade","Média"), e.get("atividade_extra","Não"),
                    e.get("categoria_extra",""), e.get("nome_atividade_extra",""),
                    int(e.get("tempo_extra") or 0), e.get("solicitante_extra",""),
                    e.get("observacoes",""), now
                ))
            c.commit()
            cur.close()
            c.close()
        except Exception as e:
            print(f"[DB] save_checklist erro: {e}")
            raise RuntimeError(f"Erro ao salvar no banco: {e}")

    def get_all_data():
        try:
            c = _conn()
            cur = c.cursor()
            cur.execute("SELECT * FROM checklist ORDER BY data DESC, horario_inicio")
            rows = _rows_to_dicts(cur.fetchall())
            cur.close(); c.close()
            return rows
        except Exception as e:
            print(f"[DB] get_all_data erro: {e}")
            return []

    def get_today_activities(usuario=None):
        try:
            today_str = date.today().strftime("%d/%m/%Y")
            c = _conn()
            cur = c.cursor()
            if usuario:
                cur.execute("SELECT * FROM checklist WHERE data=%s AND responsavel=%s", (today_str, usuario))
            else:
                cur.execute("SELECT * FROM checklist WHERE data=%s", (today_str,))
            rows = _rows_to_dicts(cur.fetchall())
            cur.close(); c.close()
            return rows
        except Exception as e:
            print(f"[DB] get_today_activities erro: {e}")
            return []

else:
    # Fallback SQLite para desenvolvimento local sem DATABASE_URL
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
                    tempo_executado TEXT, houve_atraso TEXT, motivo_atraso TEXT,
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
                        tempo_executado, houve_atraso, motivo_atraso, reagendado,
                        prioridade, atividade_extra, categoria_extra,
                        nome_atividade_extra, tempo_extra, solicitante_extra,
                        observacoes, timestamp_registro
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    e.get("data",""), e.get("dia_semana",""), e.get("titulo",""),
                    e.get("horario_inicio",""), e.get("horario_fim",""),
                    e.get("tempo_previsto",0), e.get("descricao",""),
                    e.get("responsavel",""), e.get("origem",""), e.get("status",""),
                    e.get("tempo_executado",""), e.get("houve_atraso","Não"),
                    e.get("motivo_atraso",""), e.get("reagendado","Não"),
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


# Funções compartilhadas (independente do backend)

def get_weekly_data(reference_date=None):
    import pandas as pd
    if reference_date is None:
        reference_date = date.today()
    # Últimos 7 dias úteis (inclui semana anterior quando é início de semana)
    start = reference_date - timedelta(days=7)
    end = reference_date

    records = get_all_data()
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
    reunioes = len(week_df[week_df["titulo"].str.contains("reunião|meeting|call", case=False, na=False)])
    taxa = round((concluidas / total) * 100, 1) if total > 0 else 0

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
        "horas_previstas": 0, "horas_executadas": 0,
        "horas_extras": 0, "horas_pendentes": 0,
        "taxa_conclusao": taxa, "taxa_produtividade": 0,
        "by_day": by_day, "motivos_atraso": {}, "categorias_extras": {},
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


def get_managerial_data(period="month"):
    days = {"month": 30, "quarter": 90, "year": 365}.get(period, 30)
    cutoff = date.today() - timedelta(days=days)
    records = get_all_data()

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
