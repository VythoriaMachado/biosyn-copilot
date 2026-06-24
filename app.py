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
from outlook_handler import get_today_outlook_events, get_next_day_events, is_authenticated
from insights import generate_insights
from dashboard_generator import generate_weekly_html

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


# ── TODAY DASHBOARD ─────────────────────────────────────────────────────────

@app.route("/api/today")
def api_today():
    today = date.today()
    ics_url = request.args.get("ics_url") or None
    usuario = request.args.get("usuario") or "Usuário"

    all_activities = get_today_outlook_events(ics_url=ics_url)
    all_activities.sort(key=lambda x: x.get("horario_inicio", "00:00"))
    for a in all_activities:
        a["responsavel"] = usuario

    horas_planejadas = sum(a.get("tempo_previsto", 60) for a in all_activities) / 60
    reunioes = [a for a in all_activities if a.get("tipo") == "reuniao" or
                any(w in a.get("titulo", "").lower() for w in ["reunião", "meeting", "call", "sync", "alinhamento"])]

    excel_hoje = get_today_activities(usuario=usuario)
    pendencias = [a for a in excel_hoje if a.get("status") in ["Parcial", "Não realizado"]]

    dias_pt = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]

    return jsonify({
        "data": today.strftime("%d/%m/%Y"),
        "dia_semana": dias_pt[today.weekday()],
        "atividades": all_activities,
        "stats": {
            "total_atividades": len(all_activities),
            "total_reunioes": len(reunioes),
            "horas_planejadas": round(horas_planejadas, 1),
            "horas_livres": round(max(0, 8 - horas_planejadas), 1),
            "pendencias": len(pendencias),
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
