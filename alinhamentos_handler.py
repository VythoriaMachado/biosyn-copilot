"""Handler para o módulo Alinhamentos Time."""
import os, json
from datetime import datetime

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client
    _sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    USE_SUPABASE = True
else:
    USE_SUPABASE = False

# ─────────────────────────────────────────────────────────────────────────────
#  SUPABASE
# ─────────────────────────────────────────────────────────────────────────────
if USE_SUPABASE:

    def list_alinhamentos(search='', tipo='', status=''):
        q = _sb.table('alinhamentos').select('*').order('criado_em', desc=True)
        if tipo:   q = q.eq('tipo', tipo)
        if status: q = q.eq('status', status)
        rows = q.execute().data or []
        if search:
            s = search.lower()
            rows = [r for r in rows if
                s in r.get('titulo','').lower() or
                s in r.get('descricao','').lower() or
                any(s in p.lower() for p in (r.get('participantes') or []))]
        return rows

    def get_alinhamento(aid):
        r = _sb.table('alinhamentos').select('*').eq('id', aid).single().execute()
        return r.data

    def create_alinhamento(payload):
        r = _sb.table('alinhamentos').insert(payload).execute()
        return r.data[0] if r.data else None

    def update_alinhamento(aid, payload):
        r = _sb.table('alinhamentos').update(payload).eq('id', aid).execute()
        return r.data[0] if r.data else None

    def delete_alinhamento(aid):
        _sb.table('alinhamentos').delete().eq('id', aid).execute()

# ─────────────────────────────────────────────────────────────────────────────
#  FALLBACK LOCAL
# ─────────────────────────────────────────────────────────────────────────────
else:
    _DB = os.path.join(os.path.dirname(__file__), 'alinhamentos_local.json')

    def _read():
        if not os.path.exists(_DB): return []
        with open(_DB, 'r', encoding='utf-8') as f: return json.load(f)

    def _write(data):
        with open(_DB, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def list_alinhamentos(search='', tipo='', status=''):
        rows = _read()
        if tipo:   rows = [r for r in rows if r.get('tipo') == tipo]
        if status: rows = [r for r in rows if r.get('status') == status]
        if search:
            s = search.lower()
            rows = [r for r in rows if
                s in r.get('titulo','').lower() or
                s in r.get('descricao','').lower() or
                any(s in p.lower() for p in (r.get('participantes') or []))]
        return sorted(rows, key=lambda r: r.get('criado_em', 0), reverse=True)

    def get_alinhamento(aid):
        return next((r for r in _read() if r['id'] == aid), None)

    def create_alinhamento(payload):
        rows = _read(); rows.insert(0, payload); _write(rows); return payload

    def update_alinhamento(aid, payload):
        rows = _read()
        for i, r in enumerate(rows):
            if r['id'] == aid:
                rows[i] = {**r, **payload}
                _write(rows)
                return rows[i]
        return None

    def delete_alinhamento(aid):
        _write([r for r in _read() if r['id'] != aid])
