"""
Handler para o módulo Documentos.
Upload: reutiliza upload_midia do guias_handler (mesmo bucket Guia-Midias).
Metadados: tabela 'documentos' no Supabase ou JSON local.
"""
import os, json
from datetime import datetime

# Upload: reutiliza exatamente a mesma função dos Guias (mesmo bucket, mesmo cliente)
from guias_handler import upload_midia as upload_documento

# Conexão Supabase para operações na tabela 'documentos'
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client
    _sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    USE_SUPABASE = True
else:
    USE_SUPABASE = False


def _tipo_arquivo(nome):
    ext = nome.rsplit('.', 1)[-1].lower() if '.' in nome else ''
    if ext == 'pdf':                                    return 'pdf'
    if ext in ('xls', 'xlsx', 'xlsm', 'csv'):          return 'excel'
    if ext in ('png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'): return 'imagem'
    if ext in ('doc', 'docx'):                          return 'word'
    return 'outro'


# ─────────────────────────────────────────────────────────────────────────────
#  SUPABASE
# ─────────────────────────────────────────────────────────────────────────────
if USE_SUPABASE:

    def list_documentos(search='', categoria='', tipo=''):
        q = _sb.table('documentos').select('*').order('criado_em', desc=True)
        if search:    q = q.ilike('nome', f'%{search}%')
        if categoria: q = q.eq('categoria', categoria)
        if tipo:      q = q.eq('tipo', tipo)
        return q.execute().data or []

    def get_documento(doc_id):
        r = _sb.table('documentos').select('*').eq('id', doc_id).single().execute()
        return r.data

    def create_documento(payload):
        payload['criado_em'] = datetime.utcnow().isoformat()
        r = _sb.table('documentos').insert(payload).execute()
        return r.data[0] if r.data else None

    def delete_documento(doc_id):
        _sb.table('documentos').delete().eq('id', doc_id).execute()

    def get_categorias_doc():
        r = _sb.table('documentos').select('categoria').execute()
        return sorted({row['categoria'] for row in (r.data or []) if row.get('categoria')})

# ─────────────────────────────────────────────────────────────────────────────
#  FALLBACK LOCAL
# ─────────────────────────────────────────────────────────────────────────────
else:
    _DB_FILE = os.path.join(os.path.dirname(__file__), 'documentos_local.json')

    def _read():
        if not os.path.exists(_DB_FILE):
            return []
        with open(_DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _write(data):
        with open(_DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def list_documentos(search='', categoria='', tipo=''):
        docs = _read()
        if search:    docs = [d for d in docs if search.lower() in d.get('nome', '').lower()]
        if categoria: docs = [d for d in docs if d.get('categoria') == categoria]
        if tipo:      docs = [d for d in docs if d.get('tipo') == tipo]
        return sorted(docs, key=lambda d: d.get('criado_em', ''), reverse=True)

    def get_documento(doc_id):
        return next((d for d in _read() if str(d['id']) == str(doc_id)), None)

    def create_documento(payload):
        docs = _read()
        payload['id'] = max((d['id'] for d in docs), default=0) + 1
        payload['criado_em'] = datetime.utcnow().isoformat()
        docs.append(payload)
        _write(docs)
        return payload

    def delete_documento(doc_id):
        _write([d for d in _read() if str(d['id']) != str(doc_id)])

    def get_categorias_doc():
        return sorted({d.get('categoria', '') for d in _read() if d.get('categoria')})
