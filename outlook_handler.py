import requests
import recurring_ical_events
from datetime import datetime, date, timedelta
from icalendar import Calendar

DEFAULT_ICS_URL = "https://outlook.office365.com/owa/calendar/b4f371367d784fee84e647b6698d8e72@biosyn.com.br/48a30a356a004b48b4b44e9a323ab20913391635065337886648/calendar.ics"

# Cache por URL: { url -> { content, fetched_at } }
_ics_cache = {}


def _get_calendar(ics_url=None):
    """Faz download do ICS (cache 5 min por URL)."""
    url = ics_url or DEFAULT_ICS_URL
    now = datetime.now()
    cached = _ics_cache.get(url)
    if cached is None or (now - cached["fetched_at"]).seconds > 300:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        _ics_cache[url] = {"content": r.content, "fetched_at": now}
    return Calendar.from_ical(_ics_cache[url]["content"])


def _fetch_events(target_date, ics_url=None):
    try:
        cal = _get_calendar(ics_url)

        # Intervalo do dia inteiro (sem timezone → naive)
        start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0)
        end   = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)

        # recurring_ical_events expande RRULEs automaticamente
        raw_events = recurring_ical_events.of(cal).between(start, end)

        events = []
        for component in raw_events:
            try:
                dtstart = component.get("DTSTART").dt
                dtend   = component.get("DTEND").dt

                # Pular eventos de dia inteiro (sem hora)
                if not hasattr(dtstart, "hour"):
                    continue

                # Normalizar para naive local
                if dtstart.tzinfo:
                    dtstart = dtstart.astimezone(tz=None).replace(tzinfo=None)
                if dtend.tzinfo:
                    dtend = dtend.astimezone(tz=None).replace(tzinfo=None)

                # Garantir que o evento é de fato no target_date após conversão de fuso
                if dtstart.date() != target_date:
                    continue

                subject  = str(component.get("SUMMARY", "Sem título"))
                body     = str(component.get("DESCRIPTION", ""))[:200]
                duration = max(15, int((dtend - dtstart).seconds / 60))

                events.append({
                    "titulo":         subject,
                    "horario_inicio": dtstart.strftime("%H:%M"),
                    "horario_fim":    dtend.strftime("%H:%M"),
                    "tempo_previsto": duration,
                    "descricao":      body.strip(),
                    "responsavel":    "Vythoria",
                    "origem":         "Outlook",
                    "tipo":           _classify(subject),
                    "inicio_min":     dtstart.hour * 60 + dtstart.minute,
                    "fim_min":        dtend.hour * 60 + dtend.minute,
                })
            except Exception as e:
                print(f"[ICS] Evento ignorado: {e}")
                continue

        events.sort(key=lambda x: x["inicio_min"])
        return events

    except Exception as e:
        print(f"[ICS] Erro ao buscar calendário: {e}")
        return []


def get_today_outlook_events(ics_url=None):
    return _fetch_events(date.today(), ics_url=ics_url)


def get_next_day_events(target_date=None, ics_url=None):
    if target_date is None:
        target_date = date.today() + timedelta(days=1)
        if target_date.weekday() >= 5:  # Sáb/Dom → próxima segunda
            target_date += timedelta(days=7 - target_date.weekday())

    raw = _fetch_events(target_date, ics_url=ics_url)
    return [{
        "titulo":  e["titulo"],
        "inicio":  e["inicio_min"],
        "fim":     e["fim_min"],
        "duracao": e["tempo_previsto"],
    } for e in raw]


def is_authenticated():
    return True  # ICS não requer autenticação


def _classify(subject):
    s = (subject or "").lower()
    if any(w in s for w in ["reunião", "meeting", "call", "sync", "alinhamento", "review", "conference"]):
        return "reuniao"
    if any(w in s for w in ["almoço", "lunch", "intervalo", "bloqueio", "fora", "médico", "medico", "consulta"]):
        return "bloqueio"
    return "evento"
