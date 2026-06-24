import os
import json
from datetime import date
from config import DOWNLOADS_PATH


def generate_weekly_html(stats, insights):
    today = date.today()
    filename = f"Dashboard_Semanal_{today.strftime('%Y-%m-%d')}.html"
    filepath = os.path.join(DOWNLOADS_PATH, filename)

    by_day_labels = json.dumps(list(stats.get("by_day", {}).keys()))
    by_day_total = json.dumps([v["total"] for v in stats.get("by_day", {}).values()])
    by_day_done = json.dumps([v["concluidas"] for v in stats.get("by_day", {}).values()])

    motivos_labels = json.dumps(list(stats.get("motivos_atraso", {}).keys()))
    motivos_vals = json.dumps(list(stats.get("motivos_atraso", {}).values()))

    cat_labels = json.dumps(list(stats.get("categorias_extras", {}).keys()))
    cat_vals = json.dumps(list(stats.get("categorias_extras", {}).values()))

    act_labels = json.dumps([a.get("Titulo", "")[:25] for a in stats.get("atividades_detail", [])[:10]])
    act_previsto = json.dumps([int(a.get("Tempo Previsto (min)", 0)) for a in stats.get("atividades_detail", [])[:10]])

    alerts_html = "".join(
        f'<div class="alert alert-{a["tipo"]}">{a["msg"]}</div>'
        for a in insights.get("alerts", [])
    )
    insights_html = "".join(f"<li>{i}</li>" for i in insights.get("insights", []))
    recs_html = "".join(f"<li>{r}</li>" for r in insights.get("recommendations", []))

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard Semanal — BioSyn | {today.strftime('%d/%m/%Y')}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  :root {{
    --navy: #002468;
    --sky: #099CD6;
    --white: #FFFFFF;
    --green: #1DB954;
    --yellow: #F4A900;
    --red: #E53935;
    --gray: #F4F6F9;
    --text: #1A2035;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Calibri', 'Segoe UI', sans-serif; background: var(--gray); color: var(--text); }}
  .header {{ background: var(--navy); color: white; padding: 28px 40px; display: flex; justify-content: space-between; align-items: center; }}
  .header h1 {{ font-size: 24px; font-weight: 300; letter-spacing: 1px; }}
  .header .date-badge {{ background: var(--sky); padding: 8px 20px; border-radius: 20px; font-size: 14px; }}
  .container {{ max-width: 1400px; margin: 0 auto; padding: 30px 40px; }}
  .cards {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }}
  .card {{ background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,.06); border-top: 4px solid var(--sky); }}
  .card .label {{ font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }}
  .card .value {{ font-size: 32px; font-weight: 700; color: var(--navy); }}
  .card .sub {{ font-size: 12px; color: #aaa; margin-top: 4px; }}
  .charts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px; }}
  .chart-box {{ background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }}
  .chart-box h3 {{ font-size: 15px; color: var(--navy); margin-bottom: 16px; font-weight: 600; }}
  .insights-section {{ background: white; border-radius: 12px; padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,.06); margin-bottom: 24px; }}
  .insights-section h3 {{ font-size: 16px; color: var(--navy); margin-bottom: 16px; border-bottom: 2px solid var(--sky); padding-bottom: 8px; }}
  .insights-section ul {{ padding-left: 20px; line-height: 1.8; }}
  .alert {{ padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; font-size: 14px; }}
  .alert-warning {{ background: #FFF8E1; border-left: 4px solid var(--yellow); color: #7B5900; }}
  .alert-danger {{ background: #FDECEA; border-left: 4px solid var(--red); color: #7B1A1A; }}
  .alert-info {{ background: #E3F2FD; border-left: 4px solid var(--sky); color: #0D3B52; }}
  .footer {{ text-align: center; padding: 20px; color: #aaa; font-size: 12px; }}
  .badge-green {{ color: var(--green); font-weight: 700; }}
  .badge-yellow {{ color: var(--yellow); font-weight: 700; }}
  .badge-red {{ color: var(--red); font-weight: 700; }}
</style>
</head>
<body>
<div class="header">
  <div>
    <div style="font-size:11px;opacity:.7;margin-bottom:4px;text-transform:uppercase;letter-spacing:2px">BioSyn Saúde Animal</div>
    <h1>Dashboard Semanal de Produtividade</h1>
  </div>
  <div class="date-badge">{today.strftime('%d/%m/%Y')}</div>
</div>

<div class="container">

  <div class="cards">
    <div class="card">
      <div class="label">Horas Planejadas</div>
      <div class="value">{stats.get('horas_previstas', 0)}h</div>
      <div class="sub">Total da semana</div>
    </div>
    <div class="card" style="border-top-color:var(--green)">
      <div class="label">Horas Executadas</div>
      <div class="value badge-green">{stats.get('horas_executadas', 0)}h</div>
      <div class="sub">Efetivamente realizadas</div>
    </div>
    <div class="card" style="border-top-color:var(--yellow)">
      <div class="label">Taxa de Conclusão</div>
      <div class="value badge-yellow">{stats.get('taxa_conclusao', 0)}%</div>
      <div class="sub">{stats.get('concluidas', 0)} de {stats.get('total', 0)} atividades</div>
    </div>
    <div class="card" style="border-top-color:var(--red)">
      <div class="label">Pendências</div>
      <div class="value badge-red">{stats.get('nao_realizadas', 0)}</div>
      <div class="sub">Atividades não realizadas</div>
    </div>
    <div class="card">
      <div class="label">Reuniões</div>
      <div class="value">{stats.get('reunioes', 0)}</div>
      <div class="sub">Realizadas na semana</div>
    </div>
    <div class="card">
      <div class="label">Horas Extras</div>
      <div class="value">{stats.get('horas_extras', 0)}h</div>
      <div class="sub">Em atividades não planejadas</div>
    </div>
    <div class="card">
      <div class="label">Parciais</div>
      <div class="value">{stats.get('parciais', 0)}</div>
      <div class="sub">Atividades parciais</div>
    </div>
    <div class="card" style="border-top-color:var(--sky)">
      <div class="label">Produtividade</div>
      <div class="value" style="color:var(--sky)">{stats.get('taxa_produtividade', 0)}%</div>
      <div class="sub">Executado / Planejado</div>
    </div>
  </div>

  {alerts_html}

  <div class="charts">
    <div class="chart-box">
      <h3>Planejado × Executado por Dia</h3>
      <canvas id="chartDays" height="200"></canvas>
    </div>
    <div class="chart-box">
      <h3>Atividades por Tempo Previsto (min)</h3>
      <canvas id="chartActivities" height="200"></canvas>
    </div>
    <div class="chart-box">
      <h3>Demandas Extras por Categoria</h3>
      <canvas id="chartExtras" height="200"></canvas>
    </div>
    <div class="chart-box">
      <h3>Motivos de Atraso</h3>
      <canvas id="chartMotivos" height="200"></canvas>
    </div>
  </div>

  <div class="insights-section">
    <h3>Insights da Semana</h3>
    <ul>{insights_html}</ul>
  </div>

  <div class="insights-section">
    <h3>Recomendações para a Próxima Semana</h3>
    <ul>{recs_html}</ul>
  </div>

</div>

<div class="footer">Gerado automaticamente pelo Sistema de Cronograma BioSyn &bull; {today.strftime('%d/%m/%Y %H:%M')}</div>

<script>
const navyColor = '#002468';
const skyColor = '#099CD6';
const greenColor = '#1DB954';
const yellowColor = '#F4A900';

new Chart(document.getElementById('chartDays'), {{
  type: 'bar',
  data: {{
    labels: {by_day_labels},
    datasets: [
      {{ label: 'Total', data: {by_day_total}, backgroundColor: skyColor + '88' }},
      {{ label: 'Concluídas', data: {by_day_done}, backgroundColor: greenColor + 'AA' }},
    ]
  }},
  options: {{ responsive: true, plugins: {{ legend: {{ position: 'top' }} }} }}
}});

new Chart(document.getElementById('chartActivities'), {{
  type: 'bar',
  data: {{
    labels: {act_labels},
    datasets: [{{ label: 'Min Previstos', data: {act_previsto}, backgroundColor: navyColor + '99' }}]
  }},
  options: {{ indexAxis: 'y', responsive: true, plugins: {{ legend: {{ display: false }} }} }}
}});

new Chart(document.getElementById('chartExtras'), {{
  type: 'pie',
  data: {{
    labels: {cat_labels},
    datasets: [{{ data: {cat_vals}, backgroundColor: ['#002468','#099CD6','#1DB954','#F4A900','#E53935','#9C27B0','#FF5722'] }}]
  }},
  options: {{ responsive: true }}
}});

new Chart(document.getElementById('chartMotivos'), {{
  type: 'bar',
  data: {{
    labels: {motivos_labels},
    datasets: [{{ label: 'Ocorrências', data: {motivos_vals}, backgroundColor: yellowColor + 'BB' }}]
  }},
  options: {{ responsive: true, plugins: {{ legend: {{ display: false }} }} }}
}});
</script>
</body>
</html>"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    return filepath
