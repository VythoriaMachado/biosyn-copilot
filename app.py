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

    target = date.today() - timedelta(days=1) if is_checklist else date.today()

    # Pular fins de semana no checklist (sexta → segunda anterior não faz sentido)
    if is_checklist and target.weekday() >= 5:
        # Voltar para sexta-feira anterior
        target = target - timedelta(days=target.weekday() - 4)

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
    excel_dia = [r for r in all_records if r.get("data", "") == target_str
                 and (not usuario_lower or r.get("responsavel", "").strip().lower() == usuario_lower)]

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
                "status":        r.get("status", ""),
                "houve_atraso":  r.get("houve_atraso", ""),
                "motivo_atraso": r.get("motivo_atraso", ""),
                "solicitante_extra": r.get("solicitante_extra", ""),
                "observacoes":   r.get("observacoes", ""),
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
    stats = get_weekly_data()
    insights = generate_insights(days=7)
    return jsonify({**stats, "insights": insights})


@app.route("/api/dashboard/weekly/export")
def api_weekly_export():
    stats = get_weekly_data()
    insights = generate_insights(days=7)
    html_path = generate_weekly_html(stats, insights)
    if html_path and os.path.exists(html_path):
        subprocess.Popen(["start", "", html_path], shell=True)
        return jsonify({"success": True, "path": html_path})
    return jsonify({"error": "Falha ao gerar dashboard"}), 500


# ── MANAGERIAL PANEL ────────────────────────────────────────────────────────

@app.route("/api/managerial")
def api_managerial():
    period = request.args.get("period", "month")
    data = get_managerial_data(period=period)
    insights = generate_insights(days={"month": 30, "quarter": 90, "year": 365}.get(period, 30))
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
    return jsonify(generate_insights(days=days))


# ── HISTORY ─────────────────────────────────────────────────────────────────

@app.route("/api/history")
def api_history():
    data = get_all_data()
    return jsonify({"records": data, "total": len(data)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(debug=False, host="0.0.0.0", port=port)
