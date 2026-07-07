"""
Handler para Guias de Execução — "Como Fazer".
Supabase (nuvem) ou SQLite (local), mesma interface.
"""
import os, json, uuid, mimetypes
from datetime import datetime

STORAGE_BUCKET = "Guia-Midias"


def upload_midia(file):
    """Faz upload de arquivo e retorna a URL pública."""
    ext      = file.filename.rsplit('.', 1)[-1].lower() if '.' in (file.filename or '') else 'bin'
    filename = f"{uuid.uuid4().hex}.{ext}"
    ctype    = file.content_type or mimetypes.guess_type(file.filename or '')[0] or 'application/octet-stream'
    data     = file.read()

    if USE_SUPABASE:
        _sb.storage.from_(STORAGE_BUCKET).upload(
            filename, data, {"content-type": ctype, "x-upsert": "true"}
        )
        return _sb.storage.from_(STORAGE_BUCKET).get_public_url(filename)
    else:
        # fallback local: salva em static/uploads/
        uploads = os.path.join(os.path.dirname(__file__), "static", "uploads")
        os.makedirs(uploads, exist_ok=True)
        dest = os.path.join(uploads, filename)
        with open(dest, 'wb') as f:
            f.write(data)
        return f"/static/uploads/{filename}"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client
    _sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    USE_SUPABASE = True
    print("[GUIAS] Conectado ao Supabase")
else:
    USE_SUPABASE = False
    print("[GUIAS] Usando SQLite local")


# ════════════════════════════════════════════════════════════════
#  SUPABASE
# ════════════════════════════════════════════════════════════════
if USE_SUPABASE:

    def list_guias(search='', categoria='', favoritos_only=False):
        try:
            q = _sb.table("guias").select(
                "id,titulo,objetivo,categoria,favorito,mais_usado,versao,criado_por,atualizado_em,tempo_estimado"
            ).order("mais_usado", desc=True)
            if search:
                q = q.ilike("titulo", f"%{search}%")
            if categoria:
                q = q.eq("categoria", categoria)
            if favoritos_only:
                q = q.eq("favorito", True)
            res = q.execute()
            return res.data or []
        except Exception as e:
            print(f"[GUIAS] list_guias erro: {e}")
            return []

    def get_guia(guia_id):
        try:
            res = _sb.table("guias").select("*").eq("id", guia_id).single().execute()
            guia = res.data
            if not guia:
                return None
            midias = _sb.table("guia_midias").select("*").eq("guia_id", guia_id).order("ordem").execute()
            guia["midias"] = midias.data or []
            ativs = _sb.table("guia_atividades").select("*").eq("guia_id", guia_id).execute()
            guia["atividades_vinculadas"] = [a["titulo_atividade"] for a in (ativs.data or [])]
            return guia
        except Exception as e:
            print(f"[GUIAS] get_guia erro: {e}")
            return None

    def get_guia_por_atividade(titulo_atividade):
        try:
            res = _sb.table("guia_atividades").select("guia_id").ilike(
                "titulo_atividade", titulo_atividade
            ).limit(1).execute()
            if not res.data:
                return None
            guia_id = res.data[0]["guia_id"]
            _sb.table("guias").update({"mais_usado": _sb.table("guias").select("mais_usado").eq("id", guia_id).single().execute().data.get("mais_usado", 0) + 1}).eq("id", guia_id).execute()
            return get_guia(guia_id)
        except Exception as e:
            print(f"[GUIAS] get_guia_por_atividade erro: {e}")
            return None

    def create_guia(data, usuario=''):
        try:
            now = datetime.now().isoformat()
            row = {
                "titulo":          data.get("titulo", "").strip(),
                "objetivo":        data.get("objetivo", ""),
                "passos":          data.get("passos", []),
                "tempo_estimado":  data.get("tempo_estimado", ""),
                "materiais":       data.get("materiais", []),
                "dicas":           data.get("dicas", ""),
                "erros_comuns":    data.get("erros_comuns", ""),
                "categoria":       data.get("categoria", "Geral"),
                "favorito":        False,
                "mais_usado":      0,
                "versao":          1,
                "criado_por":      usuario,
                "criado_em":       now,
                "atualizado_em":   now,
            }
            res = _sb.table("guias").insert(row).execute()
            guia_id = res.data[0]["id"]
            titulo_atividade = data.get("titulo_atividade", "")
            if titulo_atividade:
                _sb.table("guia_atividades").insert({
                    "guia_id": guia_id, "titulo_atividade": titulo_atividade.strip()
                }).execute()
            for i, m in enumerate(data.get("midias", [])):
                _sb.table("guia_midias").insert({
                    "guia_id": guia_id, "tipo": m.get("tipo", "link"),
                    "url": m.get("url", ""), "nome": m.get("nome", ""), "ordem": i
                }).execute()
            return guia_id
        except Exception as e:
            print(f"[GUIAS] create_guia erro: {e}")
            raise RuntimeError(str(e))

    def update_guia(guia_id, data, usuario=''):
        try:
            atual = _sb.table("guias").select("*").eq("id", guia_id).single().execute().data
            versao_atual = atual.get("versao", 1) if atual else 1
            if atual:
                _sb.table("guia_versoes").insert({
                    "guia_id":    guia_id,
                    "dados":      atual,
                    "versao":     versao_atual,
                    "criado_em":  datetime.now().isoformat(),
                    "criado_por": usuario,
                }).execute()
            row = {
                "titulo":        data.get("titulo", "").strip(),
                "objetivo":      data.get("objetivo", ""),
                "passos":        data.get("passos", []),
                "tempo_estimado": data.get("tempo_estimado", ""),
                "materiais":     data.get("materiais", []),
                "dicas":         data.get("dicas", ""),
                "erros_comuns":  data.get("erros_comuns", ""),
                "categoria":     data.get("categoria", "Geral"),
                "versao":        versao_atual + 1,
                "atualizado_em": datetime.now().isoformat(),
            }
            _sb.table("guias").update(row).eq("id", guia_id).execute()
            _sb.table("guia_midias").delete().eq("guia_id", guia_id).execute()
            for i, m in enumerate(data.get("midias", [])):
                _sb.table("guia_midias").insert({
                    "guia_id": guia_id, "tipo": m.get("tipo", "link"),
                    "url": m.get("url", ""), "nome": m.get("nome", ""), "ordem": i
                }).execute()
            titulo_atividade = data.get("titulo_atividade", "")
            if titulo_atividade:
                _sb.table("guia_atividades").delete().eq("guia_id", guia_id).execute()
                _sb.table("guia_atividades").insert({
                    "guia_id": guia_id, "titulo_atividade": titulo_atividade.strip()
                }).execute()
            return True
        except Exception as e:
            print(f"[GUIAS] update_guia erro: {e}")
            raise RuntimeError(str(e))

    def delete_guia(guia_id):
        try:
            _sb.table("guia_midias").delete().eq("guia_id", guia_id).execute()
            _sb.table("guia_atividades").delete().eq("guia_id", guia_id).execute()
            _sb.table("guia_versoes").delete().eq("guia_id", guia_id).execute()
            _sb.table("guias").delete().eq("id", guia_id).execute()
            return True
        except Exception as e:
            print(f"[GUIAS] delete_guia erro: {e}")
            raise RuntimeError(str(e))

    def toggle_favorito(guia_id):
        try:
            res = _sb.table("guias").select("favorito").eq("id", guia_id).single().execute()
            atual = res.data.get("favorito", False) if res.data else False
            _sb.table("guias").update({"favorito": not atual}).eq("id", guia_id).execute()
            return not atual
        except Exception as e:
            print(f"[GUIAS] toggle_favorito erro: {e}")
            raise RuntimeError(str(e))

    def duplicar_guia(guia_id, usuario=''):
        guia = get_guia(guia_id)
        if not guia:
            raise RuntimeError("Guia não encontrado")
        new_data = {
            "titulo":         f"{guia['titulo']} (cópia)",
            "objetivo":       guia.get("objetivo", ""),
            "passos":         guia.get("passos", []),
            "tempo_estimado": guia.get("tempo_estimado", ""),
            "materiais":      guia.get("materiais", []),
            "dicas":          guia.get("dicas", ""),
            "erros_comuns":   guia.get("erros_comuns", ""),
            "categoria":      guia.get("categoria", "Geral"),
            "midias":         guia.get("midias", []),
        }
        return create_guia(new_data, usuario)

    def vincular_guia(guia_id, titulo_atividade):
        try:
            _sb.table("guia_atividades").delete().ilike("titulo_atividade", titulo_atividade).execute()
            _sb.table("guia_atividades").insert({
                "guia_id": guia_id, "titulo_atividade": titulo_atividade.strip()
            }).execute()
            return True
        except Exception as e:
            print(f"[GUIAS] vincular_guia erro: {e}")
            raise RuntimeError(str(e))

    def get_versoes(guia_id):
        try:
            res = _sb.table("guia_versoes").select("id,versao,criado_em,criado_por").eq(
                "guia_id", guia_id
            ).order("versao", desc=True).execute()
            return res.data or []
        except Exception as e:
            return []

    def get_categorias():
        try:
            res = _sb.table("guias").select("categoria").execute()
            cats = list(set(r["categoria"] for r in (res.data or []) if r.get("categoria")))
            return sorted(cats)
        except Exception:
            return ["Geral"]


# ════════════════════════════════════════════════════════════════
#  SQLITE FALLBACK
# ════════════════════════════════════════════════════════════════
else:
    import sqlite3
    DB_PATH = os.path.join(os.path.dirname(__file__), "cronograma.db")

    def _conn():
        c = sqlite3.connect(DB_PATH)
        c.row_factory = sqlite3.Row
        return c

    def _ensure_tables():
        with _conn() as c:
            c.execute("""CREATE TABLE IF NOT EXISTS guias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT, objetivo TEXT DEFAULT '',
                passos TEXT DEFAULT '[]', tempo_estimado TEXT DEFAULT '',
                materiais TEXT DEFAULT '[]', dicas TEXT DEFAULT '',
                erros_comuns TEXT DEFAULT '', categoria TEXT DEFAULT 'Geral',
                favorito INTEGER DEFAULT 0, mais_usado INTEGER DEFAULT 0,
                versao INTEGER DEFAULT 1, criado_por TEXT DEFAULT '',
                criado_em TEXT, atualizado_em TEXT)""")
            c.execute("""CREATE TABLE IF NOT EXISTS guia_midias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guia_id INTEGER, tipo TEXT DEFAULT 'link',
                url TEXT DEFAULT '', nome TEXT DEFAULT '', ordem INTEGER DEFAULT 0)""")
            c.execute("""CREATE TABLE IF NOT EXISTS guia_atividades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guia_id INTEGER, titulo_atividade TEXT)""")
            c.execute("""CREATE TABLE IF NOT EXISTS guia_versoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guia_id INTEGER, dados TEXT, versao INTEGER,
                criado_em TEXT, criado_por TEXT DEFAULT '')""")
            c.commit()

    _ensure_tables()

    def _to_dict(row):
        if row is None:
            return None
        d = dict(row)
        for f in ("passos", "materiais"):
            if isinstance(d.get(f), str):
                try:
                    d[f] = json.loads(d[f])
                except Exception:
                    d[f] = []
        d["favorito"] = bool(d.get("favorito", 0))
        return d

    def list_guias(search='', categoria='', favoritos_only=False):
        with _conn() as c:
            q = "SELECT id,titulo,objetivo,categoria,favorito,mais_usado,versao,criado_por,atualizado_em,tempo_estimado FROM guias WHERE 1=1"
            params = []
            if search:
                q += " AND titulo LIKE ?"
                params.append(f"%{search}%")
            if categoria:
                q += " AND categoria=?"
                params.append(categoria)
            if favoritos_only:
                q += " AND favorito=1"
            q += " ORDER BY mais_usado DESC"
            return [_to_dict(r) for r in c.execute(q, params).fetchall()]

    def get_guia(guia_id):
        with _conn() as c:
            row = c.execute("SELECT * FROM guias WHERE id=?", (guia_id,)).fetchone()
            if not row:
                return None
            guia = _to_dict(row)
            guia["midias"] = [dict(m) for m in c.execute(
                "SELECT * FROM guia_midias WHERE guia_id=? ORDER BY ordem", (guia_id,)).fetchall()]
            guia["atividades_vinculadas"] = [
                a["titulo_atividade"] for a in c.execute(
                    "SELECT titulo_atividade FROM guia_atividades WHERE guia_id=?", (guia_id,)).fetchall()]
            return guia

    def get_guia_por_atividade(titulo_atividade):
        with _conn() as c:
            row = c.execute(
                "SELECT guia_id FROM guia_atividades WHERE LOWER(titulo_atividade)=LOWER(?)",
                (titulo_atividade,)).fetchone()
            if not row:
                return None
            guia_id = row["guia_id"]
            c.execute("UPDATE guias SET mais_usado=mais_usado+1 WHERE id=?", (guia_id,))
            c.commit()
        return get_guia(guia_id)

    def create_guia(data, usuario=''):
        now = datetime.now().strftime("%d/%m/%Y %H:%M")
        with _conn() as c:
            cur = c.execute(
                """INSERT INTO guias (titulo,objetivo,passos,tempo_estimado,materiais,dicas,
                   erros_comuns,categoria,favorito,mais_usado,versao,criado_por,criado_em,atualizado_em)
                   VALUES (?,?,?,?,?,?,?,?,0,0,1,?,?,?)""",
                (data.get("titulo",""), data.get("objetivo",""),
                 json.dumps(data.get("passos",[])), data.get("tempo_estimado",""),
                 json.dumps(data.get("materiais",[])), data.get("dicas",""),
                 data.get("erros_comuns",""), data.get("categoria","Geral"),
                 usuario, now, now))
            guia_id = cur.lastrowid
            titulo_atividade = data.get("titulo_atividade", "")
            if titulo_atividade:
                c.execute("INSERT INTO guia_atividades (guia_id,titulo_atividade) VALUES (?,?)",
                          (guia_id, titulo_atividade.strip()))
            for i, m in enumerate(data.get("midias", [])):
                c.execute("INSERT INTO guia_midias (guia_id,tipo,url,nome,ordem) VALUES (?,?,?,?,?)",
                          (guia_id, m.get("tipo","link"), m.get("url",""), m.get("nome",""), i))
            c.commit()
            return guia_id

    def update_guia(guia_id, data, usuario=''):
        now = datetime.now().strftime("%d/%m/%Y %H:%M")
        with _conn() as c:
            row = c.execute("SELECT * FROM guias WHERE id=?", (guia_id,)).fetchone()
            versao_atual = (row["versao"] or 1) if row else 1
            if row:
                c.execute("INSERT INTO guia_versoes (guia_id,dados,versao,criado_em,criado_por) VALUES (?,?,?,?,?)",
                          (guia_id, json.dumps(dict(row)), versao_atual, now, usuario))
            c.execute("""UPDATE guias SET titulo=?,objetivo=?,passos=?,tempo_estimado=?,materiais=?,
                dicas=?,erros_comuns=?,categoria=?,versao=?,atualizado_em=? WHERE id=?""",
                (data.get("titulo",""), data.get("objetivo",""),
                 json.dumps(data.get("passos",[])), data.get("tempo_estimado",""),
                 json.dumps(data.get("materiais",[])), data.get("dicas",""),
                 data.get("erros_comuns",""), data.get("categoria","Geral"),
                 versao_atual+1, now, guia_id))
            c.execute("DELETE FROM guia_midias WHERE guia_id=?", (guia_id,))
            for i, m in enumerate(data.get("midias", [])):
                c.execute("INSERT INTO guia_midias (guia_id,tipo,url,nome,ordem) VALUES (?,?,?,?,?)",
                          (guia_id, m.get("tipo","link"), m.get("url",""), m.get("nome",""), i))
            titulo_atividade = data.get("titulo_atividade","")
            if titulo_atividade:
                c.execute("DELETE FROM guia_atividades WHERE guia_id=?", (guia_id,))
                c.execute("INSERT INTO guia_atividades (guia_id,titulo_atividade) VALUES (?,?)",
                          (guia_id, titulo_atividade.strip()))
            c.commit()
        return True

    def delete_guia(guia_id):
        with _conn() as c:
            for tbl in ("guia_midias","guia_atividades","guia_versoes","guias"):
                col = "guia_id" if tbl != "guias" else "id"
                c.execute(f"DELETE FROM {tbl} WHERE {col}=?", (guia_id,))
            c.commit()
        return True

    def toggle_favorito(guia_id):
        with _conn() as c:
            row = c.execute("SELECT favorito FROM guias WHERE id=?", (guia_id,)).fetchone()
            atual = bool(row["favorito"]) if row else False
            c.execute("UPDATE guias SET favorito=? WHERE id=?", (not atual, guia_id))
            c.commit()
        return not atual

    def duplicar_guia(guia_id, usuario=''):
        guia = get_guia(guia_id)
        if not guia:
            raise RuntimeError("Guia não encontrado")
        return create_guia({
            "titulo":         f"{guia['titulo']} (cópia)",
            "objetivo":       guia.get("objetivo",""),
            "passos":         guia.get("passos",[]),
            "tempo_estimado": guia.get("tempo_estimado",""),
            "materiais":      guia.get("materiais",[]),
            "dicas":          guia.get("dicas",""),
            "erros_comuns":   guia.get("erros_comuns",""),
            "categoria":      guia.get("categoria","Geral"),
            "midias":         guia.get("midias",[]),
        }, usuario)

    def vincular_guia(guia_id, titulo_atividade):
        with _conn() as c:
            c.execute("DELETE FROM guia_atividades WHERE LOWER(titulo_atividade)=LOWER(?)", (titulo_atividade,))
            c.execute("INSERT INTO guia_atividades (guia_id,titulo_atividade) VALUES (?,?)",
                      (guia_id, titulo_atividade.strip()))
            c.commit()
        return True

    def get_versoes(guia_id):
        with _conn() as c:
            rows = c.execute(
                "SELECT id,versao,criado_em,criado_por FROM guia_versoes WHERE guia_id=? ORDER BY versao DESC",
                (guia_id,)).fetchall()
            return [dict(r) for r in rows]

    def get_categorias():
        with _conn() as c:
            rows = c.execute(
                "SELECT DISTINCT categoria FROM guias WHERE categoria IS NOT NULL ORDER BY categoria"
            ).fetchall()
            return [r["categoria"] for r in rows] or ["Geral"]
