"""
Banco de dados SQLite — usado na versão cloud (Render).
Mesma interface que excel_handler.py.
"""
import sqlite3
import os
from datetime import date, datetime

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "cronograma.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS checklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    dia_semana TEXT,
    titulo TEXT,
    horario_inicio TEXT,
    horario_fim TEXT,
    tempo_previsto INTEGER,
    descricao TEXT,
    responsavel TEXT,
    origem TEXT,
    status TEXT,
    tempo_executado TEXT,
    houve_atraso TEXT,
    motivo_atraso TEXT,
    reagendado TEXT,
    prioridade TEXT,
    atividade_extra TEXT,
    categoria_extra TEXT,
    nome_atividade_extra TEXT,
    tempo_extra INTEGER,
    solicitante_extra TEXT,
    observacoes TEXT,
    timestamp_registro TEXT
)
"""

def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def _ensure_db():
    with _conn() as c:
        c.execute(SCHEMA)

_ensure_db()


def save_checklist(entries):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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


def get_today_activities(usuario=None):
    today_str = date.today().strftime("%d/%m/%Y")
    with _conn() as c:
        if usuario:
            rows = c.execute(
                "SELECT * FROM checklist WHERE data=? AND responsavel=?",
                (today_str, usuario)
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT * FROM checklist WHERE data=?", (today_str,)
            ).fetchall()
    return [dict(r) for r in rows]


def get_all_data():
    with _conn() as c:
        rows = c.execute("SELECT * FROM checklist ORDER BY data DESC, horario_inicio").fetchall()
    return [dict(r) for r in rows]


def get_weekly_data():
    from datetime import timedelta
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    dates = [(week_start + timedelta(days=i)).strftime("%d/%m/%Y") for i in range(7)]
    with _conn() as c:
        rows = c.execute(
            f"SELECT * FROM checklist WHERE data IN ({','.join('?'*len(dates))})",
            dates
        ).fetchall()
    records = [dict(r) for r in rows]

    total = len(records)
    concluidos = sum(1 for r in records if r.get("status") == "Concluído")
    atrasos    = sum(1 for r in records if r.get("houve_atraso") == "Sim")

    by_day = {}
    for r in records:
        d = r.get("data","")
        if d not in by_day:
            by_day[d] = {"total":0,"concluido":0}
        by_day[d]["total"] += 1
        if r.get("status") == "Concluído":
            by_day[d]["concluido"] += 1

    return {
        "total_atividades": total,
        "taxa_conclusao": round(concluidos/total*100) if total else 0,
        "total_atrasos": atrasos,
        "by_day": by_day,
        "records": records,
    }


def get_managerial_data(period="month"):
    days = {"month":30,"quarter":90,"year":365}.get(period,30)
    from datetime import timedelta
    cutoff = (date.today() - timedelta(days=days)).strftime("%d/%m/%Y")
    with _conn() as c:
        rows = c.execute("SELECT * FROM checklist").fetchall()
    records = [dict(r) for r in rows]

    def _dt(s):
        try: return datetime.strptime(s, "%d/%m/%Y")
        except: return datetime.min

    cutoff_dt = date.today().__class__.today() - __import__("datetime").timedelta(days=days)
    records = [r for r in records if _dt(r.get("data","")) >= datetime.combine(cutoff_dt, datetime.min.time())]

    total = len(records)
    concluidos = sum(1 for r in records if r.get("status") == "Concluído")

    by_user = {}
    for r in records:
        u = r.get("responsavel","?")
        if u not in by_user:
            by_user[u] = {"total":0,"concluido":0}
        by_user[u]["total"] += 1
        if r.get("status") == "Concluído":
            by_user[u]["concluido"] += 1

    return {
        "total_atividades": total,
        "taxa_conclusao": round(concluidos/total*100) if total else 0,
        "by_user": by_user,
        "records": records,
    }


def propose_next_day_schedule(outlook_events=None):
    return {
        "atividades": outlook_events or [],
        "horas_planejadas": round(sum(e.get("duracao",60) for e in (outlook_events or [])) / 60, 1),
        "ocupacao_pct": 0,
        "backlog_min": 0,
    }


def _get_weekday(d): return d.strftime("%A")
