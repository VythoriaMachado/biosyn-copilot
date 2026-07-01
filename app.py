import os
import json
import subprocess
from datetime import date, datetime, timedelta
from flask import Flask, render_template, jsonify, request, send_file
from config import DOWNLOADS_PATH
# Nuvem (Render) → SQLite | Local → Excel
if os.environ.get("RENDER"):
    from db_handler import (
        get_today_activities, get_all_data, save_checklist,
        get_weekly_data, get_managerial_data, propose_next_day_schedule,
        _get_weekday,
    )
else:
    from excel_handler import (
        get_today_activities, get_all_data, save_checklist,
        get_weekly_data, get_managerial_data, propose_next_day_schedule,
        _get_weekday,
    )
from outlook_handler import get_today_outlook_events, get_next_day_events, is_authenticated, _fetch_events as _fetch_full_events
from insights import generate_insights
from dashboard_generator import generate_weekly_html

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


# ── TODAY DASHBOARD ─────────────────────────────────────────────────────────

@app.route("/api/today")
def api_today():
    # Checklist usa sempre o dia anterior; dashboard usa hoje
    is_checklist = request.args.get("checklist") == "1"
    ics_url = request.args.get("ics_url") or None
    usuario = request.args.get("usuario") or "Usuário"

    force_date = request.args.get("force_date") or None
    if force_date:
        try:
            target = datetime.strptime(force_date, "%d/%m/%Y").date()
        except Exception:
            target = date.today() - timedelta(days=1)
    elif is_checklist:
        target = date.today() - timedelta(days=1)
        if target.weekday() >= 5:
            target = target - timedelta(days=target.weekday() - 4)
    else:
        target = date.today()

    all_activities = get_next_day_events(target_date=target, ics_url=ics_url) if is_checklist else get_today_outlook_events(ics_url=ics_url)

    if is_checklist:
        # get_next_day_events retorna formato resumido; expandir para formato completo
        all_activities = _fetch_full_events(target, ics_url)

    all_activities.sort(key=lambda x: x.get("horario_inicio", "00:00"))
    for a in all_activities:
        a["responsavel"] = usuario

    horas_planejadas = sum(a.get("tempo_previsto", 60) for a in all_activities) / 60
    reunioes = [a for a in all_activities if a.get("tipo") == "reuniao" or
                any(w in a.get("titulo", "").lower() for w in ["reunião", "meeting", "call", "sync", "alinhamento"])]

    # Buscar registros já salvos (usa o handler correto: SQLite na nuvem, Excel local)
    target_str = target.strftime("%d/%m/%Y")
    all_records = get_all_data()
    usuario_lower = usuario.strip().lower() if usuario else ""
    # Filtra por data + usuário; se não achar nada, usa só data (retrocompatibilidade)
    excel_dia = [r for r in all_records if r.get("data", "") == target_str
                 and (not usuario_lower or r.get("responsavel", "").strip().lower() == usuario_lower)]
    if not excel_dia and usuario_lower:
        excel_dia = [r for r in all_records if r.get("data", "") == target_str]

    # Para o dashboard: pendências são do dia de hoje (filtradas por usuário)
    excel_hoje = [r for r in all_records if r.get("data", "") == date.today().strftime("%d/%m/%Y")
                  and (not usuario_lower or r.get("responsavel", "").strip().lower() == usuario_lower)]
    pendencias = [a for a in excel_hoje if a.get("status") in ["Parcial", "Não realizado"]]

    # Montar mapa de respostas já salvas (por título)
    respostas_salvas = {}
    for r in excel_dia:
        titulo = r.get("titulo", "").strip().lower()
        if titulo:
            respostas_salvas[titulo] = {
                "status":               r.get("status", ""),
                "houve_atraso":         r.get("houve_atraso", ""),
                "motivo_atraso":        r.get("motivo_atraso", ""),
                "tempo_executado":      r.get("tempo_executado", ""),
                "tempo_excedente":      r.get("tempo_excedente", ""),
                "reagendado":           r.get("reagendado", ""),
                "prioridade":           r.get("prioridade", ""),
                "atividade_extra":      r.get("atividade_extra", ""),
                "categoria_extra":      r.get("categoria_extra", ""),
                "nome_atividade_extra": r.get("nome_atividade_extra", ""),
                "tempo_extra_label":    r.get("tempo_extra_label", ""),
                "tempo_extra":          r.get("tempo_extra", 0),
                "solicitante_extra":    r.get("solicitante_extra", ""),
                "observacoes":          r.get("observacoes", ""),
            }

    # Atividades do Excel do dia que não estão no Outlook
    titulos_outlook = {a.get("titulo","").strip().lower() for a in all_activities}
    extras_excel = [
        {**r, "origem": "Excel"} for r in excel_dia
        if r.get("titulo","").strip().lower() not in titulos_outlook
           and r.get("titulo","").strip()
    ]
    all_activities = all_activities + extras_excel

    dias_pt = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]

    return jsonify({
        "data":        target.strftime("%d/%m/%Y"),
        "dia_semana":  dias_pt[target.weekday()],
        "atividades":  all_activities,
        "respostas_salvas": respostas_salvas,
        "ja_preenchido": len(respostas_salvas) > 0,
        "stats": {
            "total_atividades": len(all_activities),
            "total_reunioes":   len(reunioes),
            "horas_planejadas": round(horas_planejadas, 1),
            "horas_livres":     round(max(0, 8 - horas_planejadas), 1),
            "pendencias":       len(pendencias),
        },
    })


# ── CHECKLIST ───────────────────────────────────────────────────────────────

@app.route("/api/checklist/save", methods=["POST"])
def api_save_checklist():
    data = request.get_json()
    entries = data.get("entries", [])
    if not entries:
        return jsonify({"error": "Nenhuma entrada recebida"}), 400
    try:
        save_checklist(entries)
        return jsonify({"success": True, "saved": len(entries)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── AUTH STATUS ─────────────────────────────────────────────────────────────

@app.route("/api/auth/status")
def api_auth_status():
    return jsonify({"authenticated": is_authenticated()})

@app.route("/api/auth/connect", methods=["POST"])
def api_auth_connect():
    try:
        from outlook_handler import _get_token
        token = _get_token()
        return jsonify({"success": bool(token)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── WEEKLY DASHBOARD ────────────────────────────────────────────────────────

@app.route("/api/dashboard/weekly")
def api_weekly():
    usuario = request.args.get("usuario", "")
    stats = get_weekly_data(usuario=usuario)
    insights = generate_insights(days=7, usuario=usuario)
    return jsonify({**stats, "insights": insights})


@app.route("/api/dashboard/weekly/export")
def api_weekly_export():
    usuario = request.args.get("usuario", "")
    stats = get_weekly_data(usuario=usuario)
    insights = generate_insights(days=7, usuario=usuario)
    html_path = generate_weekly_html(stats, insights)
    if html_path and os.path.exists(html_path):
        subprocess.Popen(["start", "", html_path], shell=True)
        return jsonify({"success": True, "path": html_path})
    return jsonify({"error": "Falha ao gerar dashboard"}), 500


# ── MANAGERIAL PANEL ────────────────────────────────────────────────────────

@app.route("/api/managerial")
def api_managerial():
    period = request.args.get("period", "month")
    usuario = request.args.get("usuario", "")
    data = get_managerial_data(period=period, usuario=usuario)
    insights = generate_insights(days={"month": 30, "quarter": 90, "year": 365}.get(period, 30), usuario=usuario)
    return jsonify({**data, "insights": insights})


# ── PLANNING ────────────────────────────────────────────────────────────────

@app.route("/api/planning/next-day")
def api_next_day():
    ics_url = request.args.get("ics_url") or None
    next_events = get_next_day_events(ics_url=ics_url)
    proposal = propose_next_day_schedule(outlook_events=next_events)
    return jsonify(proposal)


@app.route("/api/planning/add-pending", methods=["POST"])
def api_add_pending():
    data = request.get_json()
    today = date.today()
    next_day = today + timedelta(days=1)
    if next_day.weekday() >= 5:
        next_day = today + timedelta(days=7 - today.weekday())
    dias_pt = ["Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado","Domingo"]
    try:
        save_checklist([{
            "data":           next_day.strftime("%d/%m/%Y"),
            "dia_semana":     dias_pt[next_day.weekday()],
            "titulo":         data.get("titulo", "Demanda pendente"),
            "horario_inicio": "",
            "horario_fim":    "",
            "tempo_previsto": 0,
            "descricao":      data.get("descricao", ""),
            "responsavel":    data.get("responsavel", ""),
            "origem":         "Agendado",
            "status":         "Pendente",
            "prioridade":     "Alta",
            "solicitante_extra": data.get("solicitante", ""),
            "categoria_extra":   data.get("departamento", ""),
        }])
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/planning/apply", methods=["POST"])
def api_apply_planning():
    return jsonify({"success": True})


# ── INSIGHTS ────────────────────────────────────────────────────────────────

@app.route("/api/insights")
def api_insights():
    days = int(request.args.get("days", 30))
    usuario = request.args.get("usuario", "")
    return jsonify(generate_insights(days=days, usuario=usuario))


# ── HISTORY ─────────────────────────────────────────────────────────────────

@app.route("/api/history")
def api_history():
    data = get_all_data()
    return jsonify({"records": data, "total": len(data)})


@app.route("/api/history/date")
def api_history_date():
    data_str = request.args.get("data", "")
    usuario  = request.args.get("usuario", "")
    all_records = get_all_data()
    records = [r for r in all_records if r.get("data", "") == data_str]
    if usuario:
        records = [r for r in records if r.get("responsavel", "").strip().lower() == usuario.strip().lower()]
    return jsonify({"records": records, "total": len(records)})


@app.route("/api/history/delete-date", methods=["POST"])
def api_history_delete_date():
    data = request.get_json()
    date_str = data.get("data", "")
    usuario  = data.get("usuario", "")
    if not date_str:
        return jsonify({"error": "Data não informada"}), 400
    try:
        from db_handler import delete_by_date_user
        delete_by_date_user(date_str, usuario)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/update", methods=["POST"])
def api_history_update():
    data = request.get_json()
    record_id  = data.get("id")
    status     = data.get("status", "")
    houve_atraso = data.get("houve_atraso", "")
    observacoes  = data.get("observacoes", "")
    if not record_id:
        return jsonify({"error": "ID não informado"}), 400
    try:
        from db_handler import update_checklist_entry
        update_checklist_entry(record_id, status, houve_atraso, observacoes)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/status")
def api_status():
    """Diagnóstico: testa conexão e retorna contagem de registros."""
    try:
        records = get_all_data()
        usuarios = list({r.get("responsavel","") for r in records if r.get("responsavel")})
        datas = sorted({r.get("data","") for r in records if r.get("data")}, reverse=True)[:5]
        return jsonify({
            "ok": True,
            "total_registros": len(records),
            "usuarios": usuarios,
            "ultimas_datas": datas,
            "banco": "Supabase" if os.environ.get("SUPABASE_URL") else "SQLite local",
        })
    except Exception as e:
        return jsonify({"ok": False, "erro": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(debug=False, host="0.0.0.0", port=port)
