/* ═══════════════════════════════════════════════════════════════════════
   BioSyn Cronograma — Frontend Application
   ═══════════════════════════════════════════════════════════════════════ */

// ── UTILITIES ────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function API(url) {
  const profile = UserProfile.get();
  if (profile) {
    const sep = url.includes('?') ? '&' : '?';
    // No modo gestor, omite usuario para retornar dados de todos
    const params = AdminMode.active
      ? new URLSearchParams({ ics_url: profile.ics_url })
      : new URLSearchParams({ usuario: profile.name, ics_url: profile.ics_url });
    // Se gestor filtrou por uma pessoa específica
    if (AdminMode.active && AdminMode.filtroUsuario) {
      params.set('usuario', AdminMode.filtroUsuario);
    }
    url = url + sep + params.toString();
  }
  return fetch(url).then(r => r.json());
}

function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

function fmtHours(h) { return `${h}h`; }
function fmtPct(p)   { return `${p}%`; }

function getOccupancyClass(pct) {
  if (pct <= 70) return 'occupancy-green';
  if (pct <= 90) return 'occupancy-yellow';
  return 'occupancy-red';
}

function getOccupancyLabel(pct) {
  if (pct <= 70) return '🟢 Baixa';
  if (pct <= 90) return '🟡 Moderada';
  return '🔴 Alta';
}

// ── NAVIGATION ───────────────────────────────────────────────────────────

const App = {
  currentView: 'dashboard',

  init() {
    // Topbar date
    const now = new Date();
    $('topbarDate').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    // Sidebar nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const view = el.dataset.view;
        App.switchView(view);
      });
    });

    // Sidebar toggle
    $('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Load initial view
    App.switchView('dashboard');
  },

  switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const viewEl = $(`view-${name}`);
    if (viewEl) viewEl.classList.add('active');
    const navEl = document.querySelector(`.nav-item[data-view="${name}"]`);
    if (navEl) navEl.classList.add('active');

    const titles = {
      dashboard:  'Dashboard do Dia',
      checklist:  'Checklist Diário',
      planning:   'Planejamento',
      weekly:     'Dashboard Semanal',
      managerial: 'Painel Gerencial',
      insights:   'Insights de IA',
    };
    $('viewTitle').textContent = titles[name] || '';

    const exportBtn = $('btnExportWeekly');
    exportBtn.style.display = name === 'weekly' ? 'flex' : 'none';
    exportBtn.onclick = name === 'weekly' ? () => Weekly.export() : null;

    this.currentView = name;
    if (name === 'dashboard')  Dashboard.load();
    if (name === 'checklist')  Checklist.init();
    if (name === 'planning')   Planning.load();
    if (name === 'weekly')     Weekly.load();
    if (name === 'managerial') Managerial.load();
    if (name === 'insights')   InsightsView.load(30);
  },

  loadChecklist() { App.switchView('checklist'); },
};

// ── DASHBOARD ────────────────────────────────────────────────────────────

const Dashboard = {
  async load() {
    try {
      const data = await API('/api/today');

      // Hero date
      const d = new Date();
      $('dashDate').textContent = `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
      $('dashDay').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long' }).charAt(0).toUpperCase() + d.toLocaleDateString('pt-BR', { weekday: 'long' }).slice(1);

      // Stats
      const s = data.stats;
      $('sc-ativ-val').textContent  = s.total_atividades;
      $('sc-reun-val').textContent  = s.total_reunioes;
      $('sc-horas-val').textContent = fmtHours(s.horas_planejadas);
      $('sc-livres-val').textContent = fmtHours(s.horas_livres);
      $('sc-pend-val').textContent  = s.pendencias;

      // Activities list
      const list = $('activitiesList');
      if (!data.atividades || data.atividades.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-sun"></i><h3>Nenhuma atividade hoje</h3><p>Sua agenda está livre.</p></div>`;
        return;
      }

      list.innerHTML = data.atividades.map(a => {
        const originClass = a.origem === 'Outlook' ? 'badge-outlook' : 'badge-manual';
        const isReuniao = (a.tipo === 'reuniao') || ['reunião','meeting','call'].some(w => (a.titulo||'').toLowerCase().includes(w));
        const prioClass = a.prioridade === 'Alta' ? 'badge-alta' : a.prioridade === 'Baixa' ? 'badge-baixa' : 'badge-media';
        const statusBadge = a.status ? `<span class="badge badge-${a.status === 'Concluído' ? 'concluido' : a.status === 'Parcial' ? 'parcial' : 'pendente'}">${a.status}</span>` : '';
        return `
          <div class="activity-row">
            <div class="act-time">
              ${a.horario_inicio || '—'} ${a.horario_fim ? '→ '+a.horario_fim : ''}
            </div>
            <div class="act-info">
              <div class="act-title">${a.titulo}</div>
              <div class="act-desc">${a.descricao || ''}</div>
            </div>
            <div class="act-badges">
              <span class="badge ${originClass}">${a.origem || 'Manual'}</span>
              ${isReuniao ? '<span class="badge badge-reuniao">Reunião</span>' : ''}
              <span class="badge ${prioClass}">${a.prioridade || 'Média'}</span>
              ${statusBadge}
              <span class="badge badge-manual">${a.tempo_previsto || 60} min</span>
            </div>
          </div>`;
      }).join('');
    } catch(e) {
      $('activitiesList').innerHTML = `<div class="alert-strip alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível carregar a agenda. Verifique se o servidor está rodando.</div>`;
    }
  }
};

// ── CHECKLIST ────────────────────────────────────────────────────────────

const Checklist = {
  activities: [],
  current: 0,
  answers: [],
  demandas: [],
  editingDemanda: null,
  checklistDate: null,
  checklistDiaSemana: null,

  _hideAll() {
    $('checklistCard').style.display = 'none';
    $('checklistSummary').style.display = 'none';
    $('checklistEmpty').style.display = 'none';
    $('checklistDemandas').style.display = 'none';
  },

  historyMode: false,
  historyDate: null,

  async init(forceDate) {
    this.current = 0;
    this.answers = [];
    this.demandas = [];
    this.editingDemanda = null;
    this.historyMode = !!forceDate;
    this.historyDate = forceDate || null;
    this._hideAll();

    const url = forceDate
      ? `/api/today?checklist=1&force_date=${encodeURIComponent(forceDate)}`
      : '/api/today?checklist=1';

    try {
      const data = await API(url);
      this.checklistDate = data.data;
      this.checklistDiaSemana = data.dia_semana;
      this.activities = data.atividades || [];
      const respostas = data.respostas_salvas || {};

      // Exibir banner com a data do checklist
      if (this.checklistDate) {
        const modeLabel = this.historyMode
          ? ' <span style="color:#F4A900;font-size:11px">✏ modo edição de histórico</span>'
          : (data.ja_preenchido ? ' <span style="color:#1DB954;font-size:11px">(respostas carregadas)</span>' : '');
        $('checklistDateLabel').innerHTML = `${this.checklistDate} — ${this.checklistDiaSemana}${modeLabel}`;
        $('checklistDateBanner').style.display = 'block';
      }

      if (this.activities.length === 0) {
        $('checklistEmpty').style.display = 'block';
        return;
      }

      // Pré-preencher respostas já salvas no banco
      this.answers = this.activities.map(a => {
        const key = (a.titulo || '').trim().toLowerCase();
        const saved = respostas[key];
        if (saved && saved.status) {
          return {
            status:             saved.status,
            houve_atraso:       saved.houve_atraso || 'Não',
            motivo_atraso:      saved.motivo_atraso || '',
            solicitante_extra:  saved.solicitante_extra || '',
            observacoes:        saved.observacoes || '',
          };
        }
        return {};
      });

      // Restaurar rascunho local (respostas em progresso não salvas no banco)
      if (!this.historyMode) {
        const draft = this._loadDraft();
        if (draft && draft.answers && draft.answers.length === this.activities.length) {
          // Mescla: rascunho tem prioridade sobre o banco (é mais recente)
          this.answers = draft.answers;
          this.current = draft.current || 0;
          $('checklistDateLabel').innerHTML += ' <span style="color:#099CD6;font-size:11px">↩ rascunho recuperado</span>';
        }
      }

      this.goToActivity(this.current || 0);
    } catch(e) {
      $('checklistEmpty').style.display = 'block';
    }
  },

  goToActivity(idx) {
    if (idx >= this.activities.length) {
      this.showDemandasScreen();
      return;
    }
    this.current = idx;
    this._hideAll();
    $('checklistCard').style.display = 'block';
    this.renderActivity();
    this.updateProgress();
  },

  updateProgress() {
    const total = this.activities.length;
    const pct = total > 0 ? Math.round((this.current / total) * 100) : 0;
    $('progressFill').style.width = pct + '%';
    $('progressText').textContent = `${this.current} / ${total}`;
  },

  renderActivity() {
    const a = this.activities[this.current];
    const ans = this.answers[this.current];

    const isReuniao = ['reunião','meeting','call'].some(w => (a.titulo||'').toLowerCase().includes(w));
    $('actOriginBadge').textContent = a.origem || 'Manual';
    $('actTiming').textContent = `${a.horario_inicio || '—'} – ${a.horario_fim || '—'}`;
    $('actDuration').textContent = a.tempo_previsto || 60;
    $('actTitle').textContent = a.titulo || '';
    $('actDesc').textContent = a.descricao || '';
    $('actMeta').innerHTML = `
      <span class="meta-item"><i class="fa-solid fa-user"></i> ${a.responsavel || 'Vythoria'}</span>
      <span class="meta-item"><i class="fa-solid fa-tag"></i> Prioridade ${a.prioridade || 'Média'}</span>
    `;

    $('btnPrev').style.display = this.current === 0 ? 'none' : 'flex';
    const isLast = this.current === this.activities.length - 1;
    $('btnNext').innerHTML = isLast
      ? '<i class="fa-solid fa-check"></i> Finalizar'
      : 'Próxima <i class="fa-solid fa-arrow-right"></i>';

    $('formSections').innerHTML = this.buildForm(a, ans);
  },

  buildForm(a, ans) {
    const sel = (val, current, colorClass='') => {
      const cls = current === val ? (colorClass || 'selected') : '';
      return `<button class="opt-btn ${cls}" onclick="Checklist.pick(this,'${val}')">${val}</button>`;
    };

    const statusColor = v => v === 'Concluído' ? 'selected-green' : v === 'Parcial' ? 'selected-yellow' : 'selected-red';

    let html = `
    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-circle-check"></i> Status <span class="req">*</span></div>
      <div class="btn-group" data-field="status">
        ${['Concluído','Parcial','Não realizado'].map(v => `<button class="opt-btn ${ans.status===v?statusColor(v):''}" onclick="Checklist.pick(this,'${v}',true)">${v}</button>`).join('')}
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-stopwatch"></i> Tempo executado</div>
      <div class="btn-group" data-field="tempo_executado">
        ${['Menos de 15 minutos','15–30 minutos','30–60 minutos','Igual ao planejado','Acima do planejado'].map(v => sel(v, ans.tempo_executado)).join('')}
      </div>
    </div>

    ${ans.tempo_executado === 'Acima do planejado' ? `
    <div class="form-section sub-section-acima">
      <div class="form-section-label" style="color:#E53935"><i class="fa-solid fa-clock-rotate-left"></i> Quanto tempo acima do planejado?</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <input class="form-input tempo-excedente-input" id="tempoExcedenteInput" type="text"
          placeholder="Ex: 30 min, 1h, 1h30…"
          value="${ans.tempo_excedente || ''}"
          oninput="Checklist.setField('tempo_excedente', this.value)">
        <span style="font-size:12px;color:var(--gray-400)">Digite livremente o tempo extra gasto</span>
      </div>
    </div>` : ''}

    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-clock-rotate-left"></i> Houve atraso?</div>
      <div class="btn-group" data-field="houve_atraso">
        ${['Não','Sim'].map(v => sel(v, ans.houve_atraso)).join('')}
      </div>
    </div>`;

    if (ans.houve_atraso === 'Sim') {
      html += `
    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-circle-question"></i> Motivo do atraso</div>
      <div class="btn-group" data-field="motivo_atraso">
        ${['Demanda urgente','Reunião inesperada','Sistema','Aguardando retorno','Prioridade alterada','Outro'].map(v => sel(v, ans.motivo_atraso)).join('')}
      </div>
    </div>`;
    }

    html += `
    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-calendar-plus"></i> Deseja reagendar?</div>
      <div class="btn-group" data-field="reagendado">
        ${['Não','Sim'].map(v => sel(v, ans.reagendado)).join('')}
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-arrow-up-wide-short"></i> Prioridade</div>
      <div class="btn-group" data-field="prioridade">
        ${['Alta','Média','Baixa'].map(v => sel(v, ans.prioridade || 'Média')).join('')}
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-plus-circle"></i> Realizou outra atividade?</div>
      <div class="btn-group" data-field="atividade_extra">
        ${['Não','Sim'].map(v => sel(v, ans.atividade_extra)).join('')}
      </div>
    </div>`;

    if (ans.atividade_extra === 'Sim') {
      html += `
    <div class="sub-section">
      <div class="form-section">
        <div class="form-section-label" style="color:var(--sky)"><i class="fa-solid fa-layer-group"></i> Categoria</div>
        <div class="btn-group" data-field="categoria_extra">
          ${['Financeiro','Contabilidade','RH','Diretoria','Comercial','Fiscal','Outro'].map(v => sel(v, ans.categoria_extra)).join('')}
        </div>
      </div>
      <div class="form-section" style="margin-top:12px">
        <div class="form-section-label" style="color:var(--sky)"><i class="fa-solid fa-pen"></i> Nome da atividade</div>
        <input class="form-input" id="extraName" type="text" placeholder="Descreva a atividade realizada..." value="${ans.nome_atividade_extra||''}" oninput="Checklist.setField('nome_atividade_extra',this.value)">
      </div>
      <div class="form-section" style="margin-top:12px">
        <div class="form-section-label" style="color:var(--sky)"><i class="fa-solid fa-hourglass"></i> Tempo gasto</div>
        <div class="btn-group" data-field="tempo_extra_label">
          ${['15 min','30 min','45 min','60 min','Mais de 1h'].map(v => sel(v, ans.tempo_extra_label)).join('')}
        </div>
      </div>
      <div class="form-section" style="margin-top:12px">
        <div class="form-section-label" style="color:var(--sky)"><i class="fa-solid fa-user-tie"></i> Solicitante</div>
        <input class="form-input" id="extraSolic" type="text" placeholder="Quem solicitou?" value="${ans.solicitante_extra||''}" oninput="Checklist.setField('solicitante_extra',this.value)">
      </div>
    </div>`;
    }

    return html;
  },

  pick(btn, val, useStatusColor = false) {
    const group = btn.closest('[data-field]');
    if (!group) return;
    const field = group.dataset.field;

    group.querySelectorAll('.opt-btn').forEach(b => {
      b.className = 'opt-btn';
    });

    if (useStatusColor) {
      const colorMap = { 'Concluído': 'selected-green', 'Parcial': 'selected-yellow', 'Não realizado': 'selected-red' };
      btn.classList.add(colorMap[val] || 'selected');
    } else {
      btn.classList.add('selected');
    }

    this.setField(field, val);

    // Re-render only if conditional sections change
    if (['houve_atraso','atividade_extra'].includes(field)) {
      this.renderActivity();
    }
  },

  setField(field, val) {
    if (!this.answers[this.current]) this.answers[this.current] = {};
    this.answers[this.current][field] = val;

    // Map tempo_extra_label to minutes
    if (field === 'tempo_extra_label') {
      const map = { '15 min': 15, '30 min': 30, '45 min': 45, '60 min': 60, 'Mais de 1h': 75 };
      this.answers[this.current]['tempo_extra'] = map[val] || 30;
    }

    // Re-render se campo condicional mudou
    if (field === 'tempo_executado') {
      this.renderActivity();
    }

    this._autosave();
  },

  _autosaveKey() {
    const profile = UserProfile.get();
    const user = profile ? profile.name : 'guest';
    const date = this.checklistDate || 'nodate';
    return `biosyn_checklist_draft_${user}_${date}`;
  },

  _autosave() {
    if (this.historyMode) return; // não autosalva em modo histórico
    try {
      localStorage.setItem(this._autosaveKey(), JSON.stringify({
        answers: this.answers,
        current: this.current,
        saved_at: new Date().toISOString(),
      }));
    } catch {}
  },

  _loadDraft() {
    try {
      const raw = localStorage.getItem(this._autosaveKey());
      if (!raw) return null;
      const draft = JSON.parse(raw);
      // Descarta rascunhos com mais de 2 dias
      const age = Date.now() - new Date(draft.saved_at).getTime();
      if (age > 2 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this._autosaveKey());
        return null;
      }
      return draft;
    } catch { return null; }
  },

  _clearDraft() {
    try { localStorage.removeItem(this._autosaveKey()); } catch {}
  },

  prev() {
    if (this.current > 0) this.goToActivity(this.current - 1);
  },

  next() {
    const ans = this.answers[this.current];
    if (!ans.status) {
      showToast('Selecione o status da atividade.', 'warning');
      return;
    }
    this.goToActivity(this.current + 1);
  },

  // ── TELA DE DEMANDAS ──────────────────────────────────────────────────

  showDemandasScreen() {
    this._hideAll();
    $('checklistDemandas').style.display = 'block';
    $('progressFill').style.width = '100%';
    $('progressText').textContent = `${this.activities.length} / ${this.activities.length}`;
    this.editingDemanda = null;
    this.renderDemandasScreen();
  },

  renderDemandasScreen() {
    // Lista de demandas já adicionadas
    let listHtml = '';
    if (this.demandas.length === 0) {
      listHtml = `
        <div class="demandas-empty">
          <i class="fa-solid fa-inbox"></i>
          <p>Nenhuma demanda adicionada. Clique em <b>Adicionar Demanda</b> se recebeu alguma.</p>
        </div>`;
    } else {
      listHtml = this.demandas.map((d, i) => `
        <div class="demanda-card" style="flex-wrap:wrap;gap:8px">
          <div class="demanda-num">${i+1}</div>
          <div class="demanda-body">
            <div class="demanda-title">${d.descricao || '(sem descrição)'}</div>
            <div class="demanda-meta">
              <i class="fa-solid fa-user"></i> ${d.solicitante || '—'}
              &nbsp;·&nbsp;
              <i class="fa-solid fa-building"></i> ${d.departamento || '—'}
              &nbsp;·&nbsp;
              <i class="fa-solid fa-circle-check" style="color:${d.concluida==='Sim'?'#1DB954':'#F4A900'}"></i> ${d.concluida || '—'}
              ${d.agendada ? '&nbsp;·&nbsp;<i class="fa-solid fa-calendar-check" style="color:var(--sky)"></i> <span style="color:var(--sky);font-size:11px">Agendada para amanhã</span>' : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${d.concluida !== 'Sim' && !d.agendada ? `<button class="btn-agenda-amanha" onclick="Checklist.agendarParaAmanha(${i})" title="Agendar para amanhã"><i class="fa-solid fa-calendar-plus"></i> Agendar para amanhã</button>` : ''}
            <button class="demanda-remove" onclick="Checklist.removeDemanda(${i})" title="Remover">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>`).join('');
    }
    $('demandasList').innerHTML = listHtml;

    // Formulário de nova demanda (se estiver adicionando)
    if (this.editingDemanda !== null) {
      const d = this.editingDemanda;
      const sel = (val, cur) => `<button class="opt-btn ${cur===val?'selected':''}" onclick="Checklist._setDemandaField(this,'${val}')" data-val="${val}">${val}</button>`;
      $('demandasForm').innerHTML = `
        <div class="demanda-form-box">
          <div class="form-section">
            <div class="form-section-label"><i class="fa-solid fa-building"></i> Departamento solicitante</div>
            <div class="btn-group" data-demanda-field="departamento">
              ${['Financeiro','Contabilidade','RH','Diretoria','Comercial','Fiscal','TI','Produção','Outro'].map(v => sel(v, d.departamento)).join('')}
            </div>
          </div>
          <div class="form-section" style="margin-top:14px">
            <div class="form-section-label"><i class="fa-solid fa-user-tie"></i> Quem solicitou?</div>
            <input class="form-input" id="demandaSolicitante" type="text" placeholder="Nome da pessoa que solicitou..." value="${d.solicitante||''}" oninput="Checklist._setDemandaInput('solicitante',this.value)">
          </div>
          <div class="form-section" style="margin-top:14px">
            <div class="form-section-label"><i class="fa-solid fa-pen"></i> Descreva a demanda <span style="font-weight:400;opacity:.7">(opcional)</span></div>
            <input class="form-input" id="demandaDescricao" type="text" placeholder="O que foi solicitado?" value="${d.descricao||''}" oninput="Checklist._setDemandaInput('descricao',this.value)">
          </div>
          <div class="form-section" style="margin-top:14px">
            <div class="form-section-label"><i class="fa-solid fa-circle-check"></i> Foi concluída?</div>
            <div class="btn-group" data-demanda-field="concluida">
              ${['Sim','Parcial','Não'].map(v => sel(v, d.concluida)).join('')}
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:18px">
            <button class="btn-secondary" onclick="Checklist._cancelDemanda()">
              <i class="fa-solid fa-xmark"></i> Cancelar
            </button>
            <button class="btn-primary" onclick="Checklist._saveDemanda()">
              <i class="fa-solid fa-check"></i> Confirmar Demanda
            </button>
          </div>
        </div>`;
      $('btnAddDemanda').style.display = 'none';
    } else {
      $('demandasForm').innerHTML = '';
      $('btnAddDemanda').style.display = 'flex';
    }
  },

  addDemanda() {
    this.editingDemanda = { departamento: '', solicitante: '', descricao: '', concluida: '' };
    this.renderDemandasScreen();
  },

  _setDemandaField(btn, val) {
    const group = btn.closest('[data-demanda-field]');
    if (!group) return;
    const field = group.dataset.demandaField;
    group.querySelectorAll('.opt-btn').forEach(b => b.className = 'opt-btn');
    btn.classList.add('selected');
    this.editingDemanda[field] = val;
  },

  _setDemandaInput(field, val) {
    if (this.editingDemanda) this.editingDemanda[field] = val;
  },

  _saveDemanda() {
    const d = this.editingDemanda;
    if (!d.solicitante && !d.departamento) {
      showToast('Informe ao menos o solicitante ou o departamento.', 'warning');
      return;
    }
    this.demandas.push({ ...d });
    this.editingDemanda = null;
    this.renderDemandasScreen();
  },

  _cancelDemanda() {
    this.editingDemanda = null;
    this.renderDemandasScreen();
  },

  removeDemanda(idx) {
    this.demandas.splice(idx, 1);
    this.renderDemandasScreen();
  },

  async agendarParaAmanha(idx) {
    const d = this.demandas[idx];
    const profile = UserProfile.get();
    try {
      const res = await fetch('/api/planning/add-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo:      d.descricao || 'Demanda pendente',
          descricao:   `Solicitante: ${d.solicitante || '—'} | Depto: ${d.departamento || '—'}`,
          responsavel: profile ? profile.name : '',
          solicitante: d.solicitante || '',
          departamento: d.departamento || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        this.demandas[idx].agendada = true;
        this.renderDemandasScreen();
        showToast('Demanda agendada para o planejamento de amanhã!', 'success');
      } else {
        showToast('Erro ao agendar: ' + (data.error || 'tente novamente'), 'error');
      }
    } catch (e) {
      showToast('Erro ao agendar demanda.', 'error');
    }
  },

  finishDemandas() {
    if (this.editingDemanda !== null) {
      showToast('Confirme ou cancele a demanda atual antes de continuar.', 'warning');
      return;
    }
    this.showSummary();
  },

  // ── RESUMO ────────────────────────────────────────────────────────────

  showSummary() {
    this._hideAll();
    $('checklistSummary').style.display = 'block';
    $('progressFill').style.width = '100%';
    $('progressText').textContent = `${this.activities.length} / ${this.activities.length}`;

    const items = this.activities.map((a, i) => {
      const ans = this.answers[i];
      const statusColor = ans.status === 'Concluído' ? '#1DB954' : ans.status === 'Parcial' ? '#F4A900' : '#E53935';
      let detail = `<b style="color:${statusColor}">${ans.status || '—'}</b>`;
      if (ans.tempo_executado) detail += ` · ${ans.tempo_executado}`;
      if (ans.tempo_executado === 'Acima do planejado' && ans.tempo_excedente) detail += ` (+${ans.tempo_excedente})`;
      if (ans.houve_atraso === 'Sim') detail += ` · Atraso: ${ans.motivo_atraso || 'não informado'}`;
      if (ans.atividade_extra === 'Sim') detail += ` · Extra: ${ans.nome_atividade_extra || ans.categoria_extra || '—'}`;
      return `
        <div class="summary-item">
          <div class="summary-item-num">${i+1}</div>
          <div>
            <div class="summary-item-title">${a.titulo}</div>
            <div class="summary-item-detail">${detail}</div>
          </div>
        </div>`;
    }).join('');

    // Seção de demandas no resumo
    let demandasSection = '';
    if (this.demandas.length > 0) {
      const dItems = this.demandas.map((d, i) => `
        <div class="summary-item">
          <div class="summary-item-num" style="background:var(--sky)">${i+1}</div>
          <div>
            <div class="summary-item-title">${d.descricao || 'Demanda ' + (i+1)}</div>
            <div class="summary-item-detail">
              <i class="fa-solid fa-user"></i> ${d.solicitante || '—'}
              &nbsp;·&nbsp;
              <i class="fa-solid fa-building"></i> ${d.departamento || '—'}
              &nbsp;·&nbsp;
              <b style="color:${d.concluida==='Sim'?'#1DB954':d.concluida==='Parcial'?'#F4A900':'#E53935'}">${d.concluida || '—'}</b>
            </div>
          </div>
        </div>`).join('');
      demandasSection = `
        <div style="margin-top:16px">
          <div style="padding:14px 24px;background:var(--navy);color:white;font-weight:700;font-size:13px;border-radius:12px 12px 0 0">
            <i class="fa-solid fa-bell" style="color:var(--sky)"></i>&nbsp; Demandas Recebidas (${this.demandas.length})
          </div>
          ${dItems}
        </div>`;
    }

    $('summaryContent').innerHTML = items + demandasSection;
  },

  async save() {
    // Modo histórico: pede PIN antes de salvar
    if (this.historyMode && !ChecklistHistory._adminUnlocked) {
      ChecklistHistory._pinCallback = () => this._doSave();
      $('adminPinInput').value = '';
      $('adminPinModal').style.display = 'flex';
      setTimeout(() => $('adminPinInput').focus(), 100);
      return;
    }
    this._doSave();
  },

  async _doSave() {
    const todayStr = this.checklistDate || new Date().toLocaleDateString('pt-BR');
    const days = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const diaSemana = this.checklistDiaSemana || days[new Date().getDay()];

    const entries = this.activities.map((a, i) => {
      const ans = this.answers[i];
      return {
        data: todayStr,
        dia_semana: diaSemana,
        titulo: a.titulo,
        horario_inicio: a.horario_inicio,
        horario_fim: a.horario_fim,
        tempo_previsto: a.tempo_previsto,
        descricao: a.descricao,
        responsavel: a.responsavel || 'Vythoria',
        origem: a.origem || 'Manual',
        status: ans.status || '',
        tempo_executado: ans.tempo_executado || '',
        tempo_excedente: ans.tempo_executado === 'Acima do planejado' ? (ans.tempo_excedente || '') : '',
        houve_atraso: ans.houve_atraso || 'Não',
        motivo_atraso: ans.motivo_atraso || '',
        reagendado: ans.reagendado || 'Não',
        prioridade: ans.prioridade || a.prioridade || 'Média',
        atividade_extra: ans.atividade_extra || 'Não',
        categoria_extra: ans.categoria_extra || '',
        nome_atividade_extra: ans.nome_atividade_extra || '',
        tempo_extra: ans.tempo_extra || '',
        solicitante_extra: ans.solicitante_extra || '',
      };
    });

    // Demandas solicitadas salvas como linhas extras
    this.demandas.forEach(d => {
      entries.push({
        data: todayStr,
        dia_semana: diaSemana,
        titulo: d.descricao || 'Demanda solicitada',
        horario_inicio: '',
        horario_fim: '',
        tempo_previsto: 0,
        descricao: `Solicitante: ${d.solicitante || '—'} | Depto: ${d.departamento || '—'}`,
        responsavel: 'Vythoria',
        origem: 'Demanda Solicitada',
        status: d.concluida === 'Sim' ? 'Concluído' : d.concluida === 'Parcial' ? 'Parcial' : 'Não realizado',
        tempo_executado: '',
        houve_atraso: 'Não',
        motivo_atraso: '',
        reagendado: 'Não',
        prioridade: 'Alta',
        atividade_extra: 'Não',
        categoria_extra: d.departamento || '',
        nome_atividade_extra: '',
        tempo_extra: '',
        solicitante_extra: d.solicitante || '',
      });
    });

    try {
      // Modo histórico: apaga registros antigos antes de re-salvar
      if (this.historyMode) {
        const profile = UserProfile.get();
        await fetch('/api/history/delete-date', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: todayStr, usuario: profile ? profile.name : '' }),
        });
      }

      const res = await fetch('/api/checklist/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });
      const json = await res.json();
      if (json.success) {
        ChecklistHistory._adminUnlocked = false;
        this._clearDraft();
        showToast(`✓ ${json.saved} atividades salvas com sucesso!`, 'success');
        if (this.historyMode) {
          ChecklistHistory.clear();
        } else {
          setTimeout(() => App.switchView('planning'), 1500);
        }
      } else {
        showToast(json.error || 'Erro ao salvar.', 'error');
      }
    } catch(e) {
      showToast('Erro de comunicação com o servidor.', 'error');
    }
  }
};

// ── PLANNING ─────────────────────────────────────────────────────────────

const Planning = {
  data: null,

  async load() {
    $('planningContent').innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Gerando proposta...</div>';
    try {
      this.data = await API('/api/planning/next-day');
      this.render();
    } catch(e) {
      $('planningContent').innerHTML = '<div class="alert-strip alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível gerar a proposta.</div>';
    }
  },

  render() {
    const d = this.data;
    if (!d) return;

    const occupancyClass = getOccupancyClass(d.ocupacao_pct);
    const occupancyLabel = getOccupancyLabel(d.ocupacao_pct);

    const backlogHtml = d.backlog_min > 0
      ? `<div class="backlog-alert"><i class="fa-solid fa-triangle-exclamation"></i> Backlog estimado: ${Math.round(d.backlog_min / 60 * 10) / 10}h — algumas atividades podem não caber no dia.</div>`
      : '';

    const timeline = (d.schedule || []).map(item => `
      <div class="plan-item ${item.tipo || ''}">
        <div class="plan-time">${item.horario_inicio} – ${item.horario_fim}</div>
        <div class="plan-title">${item.titulo}</div>
        <div class="plan-dur">${item.tempo_previsto} min</div>
        <span class="badge ${item.origem === 'Outlook' ? 'badge-outlook' : item.tipo === 'pendencia' ? 'badge-pendente' : 'badge-manual'}">${item.origem}</span>
      </div>`).join('');

    $('planningContent').innerHTML = `
      <div class="planning-header">
        <div class="plan-metric">
          <div class="plan-metric-val">${d.horas_disponiveis}h</div>
          <div class="plan-metric-label">Horas disponíveis</div>
        </div>
        <div class="plan-metric">
          <div class="plan-metric-val">${d.horas_planejadas}h</div>
          <div class="plan-metric-label">Horas planejadas</div>
        </div>
        <div class="plan-metric">
          <div class="plan-metric-val" style="color:${d.ocupacao_pct > 90 ? 'var(--red)' : d.ocupacao_pct > 70 ? 'var(--yellow)' : 'var(--green)'}">${d.ocupacao_pct}%</div>
          <div class="plan-metric-label">Taxa de ocupação</div>
        </div>
        <div class="plan-metric">
          <div class="plan-metric-val" style="font-size:20px">${occupancyLabel}</div>
          <div class="plan-metric-label">Carga de trabalho</div>
        </div>
        <div class="plan-occupancy">
          <span style="font-size:12px;color:var(--gray-600)">Ocupação:</span>
          <div class="occupancy-bar">
            <div class="occupancy-fill ${occupancyClass}" style="width:${Math.min(d.ocupacao_pct,100)}%"></div>
          </div>
          <span style="font-size:12px;color:var(--gray-600)">${d.ocupacao_pct}%</span>
        </div>
      </div>

      ${backlogHtml}

      <h3 class="section-title"><i class="fa-solid fa-calendar-day"></i> Proposta para ${d.dia_semana}, ${d.data}</h3>
      <div class="planning-timeline">${timeline || '<div class="empty-state"><i class="fa-regular fa-calendar"></i><h3>Sem atividades pendentes</h3></div>'}</div>

      <div class="plan-actions">
        <button class="btn-secondary" onclick="Planning.load()"><i class="fa-solid fa-rotate"></i> Regenerar</button>
        <button class="btn-primary" onclick="Planning.apply()"><i class="fa-solid fa-check"></i> Aplicar Cronograma</button>
      </div>`;
  },

  async apply() {
    if (!this.data) return;
    const conf = confirm(`Aplicar este cronograma para ${this.data.data}?`);
    if (!conf) return;
    try {
      await fetch('/api/planning/apply', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(this.data) });
      showToast('Cronograma aplicado com sucesso!', 'success');
    } catch(e) {
      showToast('Erro ao aplicar cronograma.', 'error');
    }
  }
};

// ── WEEKLY ───────────────────────────────────────────────────────────────

const Weekly = {
  charts: {},

  async load() {
    try {
      const data = await API('/api/dashboard/weekly');
      this.render(data);
    } catch(e) {
      $('weeklyStats').innerHTML = '<div class="alert-strip alert-warning">Erro ao carregar dados semanais.</div>';
    }
  },

  render(data) {
    // Stats
    $('weeklyStats').innerHTML = `
      <div class="stat-card"><div class="stat-icon" style="background:#E8F4FD"><i class="fa-solid fa-clock" style="color:#099CD6"></i></div><div class="stat-body"><div class="stat-label">Horas Planejadas</div><div class="stat-value">${data.horas_previstas}h</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#E8F5E9"><i class="fa-solid fa-check-circle" style="color:#1DB954"></i></div><div class="stat-body"><div class="stat-label">Horas Executadas</div><div class="stat-value" style="color:var(--green)">${data.horas_executadas}h</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#FFF3E0"><i class="fa-solid fa-star" style="color:#F4A900"></i></div><div class="stat-body"><div class="stat-label">Taxa de Conclusão</div><div class="stat-value" style="color:var(--yellow)">${data.taxa_conclusao}%</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#FDECEA"><i class="fa-solid fa-triangle-exclamation" style="color:#E53935"></i></div><div class="stat-body"><div class="stat-label">Não Realizadas</div><div class="stat-value" style="color:var(--red)">${data.nao_realizadas}</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#F3E5F5"><i class="fa-solid fa-people-group" style="color:#9C27B0"></i></div><div class="stat-body"><div class="stat-label">Reuniões</div><div class="stat-value">${data.reunioes}</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#E8F4FD"><i class="fa-solid fa-bolt" style="color:#099CD6"></i></div><div class="stat-body"><div class="stat-label">Extras</div><div class="stat-value">${data.horas_extras}h</div></div></div>
    `;

    // Charts
    const days = Object.keys(data.by_day || {});
    const dayTotal = days.map(d => data.by_day[d].total);
    const dayDone  = days.map(d => data.by_day[d].concluidas);
    const motLabels = Object.keys(data.motivos_atraso || {});
    const motVals   = Object.values(data.motivos_atraso || {});
    const catLabels = Object.keys(data.categorias_extras || {});
    const catVals   = Object.values(data.categorias_extras || {});

    $('weeklyCharts').innerHTML = `
      <div class="chart-card"><h4><i class="fa-solid fa-chart-bar" style="color:var(--sky)"></i> Planejado × Executado por Dia</h4><canvas id="cDays" class="chart-canvas"></canvas></div>
      <div class="chart-card"><h4><i class="fa-solid fa-chart-pie" style="color:var(--sky)"></i> Demandas Extras por Categoria</h4><canvas id="cExtras" class="chart-canvas"></canvas></div>
      <div class="chart-card"><h4><i class="fa-solid fa-chart-column" style="color:var(--sky)"></i> Motivos de Atraso</h4><canvas id="cMotivos" class="chart-canvas"></canvas></div>
      <div class="chart-card"><h4><i class="fa-solid fa-circle-check" style="color:var(--sky)"></i> Conclusão por Dia</h4><canvas id="cConclusao" class="chart-canvas"></canvas></div>
    `;

    // Destroy old charts
    Object.values(this.charts).forEach(c => c.destroy());
    this.charts = {};

    this.charts.days = new Chart($('cDays'), {
      type: 'bar',
      data: { labels: days, datasets: [
        { label: 'Total', data: dayTotal, backgroundColor: '#099CD688' },
        { label: 'Concluídas', data: dayDone, backgroundColor: '#1DB954AA' },
      ]},
      options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });

    if (catLabels.length > 0) {
      this.charts.extras = new Chart($('cExtras'), {
        type: 'doughnut',
        data: { labels: catLabels, datasets: [{ data: catVals, backgroundColor: ['#002468','#099CD6','#1DB954','#F4A900','#E53935','#9C27B0','#FF5722'] }]},
        options: { responsive: true }
      });
    }

    if (motLabels.length > 0) {
      this.charts.motivos = new Chart($('cMotivos'), {
        type: 'bar',
        data: { labels: motLabels, datasets: [{ label: 'Ocorrências', data: motVals, backgroundColor: '#F4A900BB' }]},
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
      });
    }

    const pctDone = days.map(d => {
      const t = data.by_day[d].total;
      return t > 0 ? Math.round((data.by_day[d].concluidas / t) * 100) : 0;
    });
    this.charts.conclusao = new Chart($('cConclusao'), {
      type: 'line',
      data: { labels: days, datasets: [{ label: '% Concluído', data: pctDone, borderColor: '#1DB954', backgroundColor: '#1DB95422', tension: .3, fill: true }]},
      options: { responsive: true, scales: { y: { min: 0, max: 100 } } }
    });

    // Insights
    const ins = data.insights || {};
    const alertsHtml = (ins.alerts || []).map(a => `<div class="alert-strip alert-${a.tipo}"><i class="fa-solid fa-bell"></i> ${a.msg}</div>`).join('');
    const insHtml = (ins.insights || []).map(i => `<li>${i}</li>`).join('');
    const recHtml = (ins.recommendations || []).map(r => `<li>${r}</li>`).join('');

    $('weeklyInsights').innerHTML = `
      ${alertsHtml}
      <div class="insights-card">
        <h4><i class="fa-solid fa-magnifying-glass-chart" style="color:var(--sky)"></i> Análise da Semana</h4>
        <ul class="insights-list">${insHtml || '<li>Registre mais atividades para gerar insights.</li>'}</ul>
      </div>
      <div class="insights-card">
        <h4><i class="fa-solid fa-lightbulb" style="color:var(--sky)"></i> Recomendações</h4>
        <ul class="insights-list">${recHtml || '<li>Continue registrando para receber sugestões personalizadas.</li>'}</ul>
      </div>`;
  },

  async export() {
    try {
      const res = await fetch('/api/dashboard/weekly/export');
      const json = await res.json();
      if (json.success) showToast('Dashboard exportado e aberto no navegador!', 'success');
      else showToast(json.error || 'Erro ao exportar.', 'error');
    } catch(e) {
      showToast('Erro ao exportar dashboard.', 'error');
    }
  }
};

// ── MANAGERIAL ────────────────────────────────────────────────────────────

const Managerial = {
  charts: {},
  period: 'month',

  setPeriod(period, btn) {
    document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.period = period;
    this.load();
  },

  async load() {
    $('managerialContent').innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Carregando dados...</div>';
    try {
      const data = await API(`/api/managerial?period=${this.period}`);
      this.render(data);
    } catch(e) {
      $('managerialContent').innerHTML = '<div class="alert-strip alert-warning">Erro ao carregar painel gerencial.</div>';
    }
  },

  render(data) {
    const heatmapHtml = Object.entries(data.heatmap_days || {}).map(([day, count]) => {
      const h = Math.min(count / 10, 1);
      const bg = `rgba(0,36,104,${0.1 + h * 0.85})`;
      return `<div style="flex:1;background:${bg};color:white;text-align:center;padding:16px 8px;border-radius:8px;font-size:13px;font-weight:600"><div style="font-size:22px;font-weight:700">${count}</div>${day.slice(0,3)}</div>`;
    }).join('');

    const topActivities = Object.entries(data.top_activities || {}).slice(0, 8).map(([k, v]) =>
      `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:13px;flex:1;color:var(--navy)">${k}</div>
        <div style="background:var(--sky);color:white;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:700">${v}x</div>
      </div>`
    ).join('');

    const topMotivos = Object.entries(data.motivos_atraso || {}).slice(0, 5).map(([k, v]) =>
      `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:13px;flex:1;color:var(--navy)">${k}</div>
        <div style="background:var(--yellow);color:white;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:700">${v}</div>
      </div>`
    ).join('');

    const ins = data.insights || {};
    const alertsHtml = (ins.alerts || []).map(a => `<div class="alert-strip alert-${a.tipo}"><i class="fa-solid fa-bell"></i> ${a.msg}</div>`).join('');

    $('managerialContent').innerHTML = `
      ${alertsHtml}

      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card"><div class="stat-icon" style="background:#E8F4FD"><i class="fa-solid fa-list" style="color:#099CD6"></i></div><div class="stat-body"><div class="stat-label">Total Atividades</div><div class="stat-value">${data.total_atividades}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#E8F5E9"><i class="fa-solid fa-circle-check" style="color:#1DB954"></i></div><div class="stat-body"><div class="stat-label">Concluídas</div><div class="stat-value" style="color:var(--green)">${data.concluidas}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#FFF3E0"><i class="fa-solid fa-percent" style="color:#F4A900"></i></div><div class="stat-body"><div class="stat-label">Taxa Conclusão</div><div class="stat-value" style="color:var(--yellow)">${data.taxa_conclusao}%</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#F3E5F5"><i class="fa-solid fa-people-group" style="color:#9C27B0"></i></div><div class="stat-body"><div class="stat-label">Reuniões</div><div class="stat-value">${data.reunioes}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#FDECEA"><i class="fa-solid fa-bolt" style="color:#E53935"></i></div><div class="stat-body"><div class="stat-label">Demandas Extras</div><div class="stat-value">${data.extras_total}</div></div></div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h4><i class="fa-solid fa-fire" style="color:var(--sky)"></i> Heatmap — Carga por Dia da Semana</h4>
          <div style="display:flex;gap:8px;margin-top:8px">${heatmapHtml}</div>
        </div>
        <div class="chart-card">
          <h4><i class="fa-solid fa-chart-pie" style="color:var(--sky)"></i> Demandas Extras por Categoria</h4>
          <canvas id="mExtras" class="chart-canvas"></canvas>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h4><i class="fa-solid fa-trophy" style="color:var(--sky)"></i> Top Atividades Recorrentes</h4>
          ${topActivities || '<p style="color:var(--gray-400);font-size:13px">Sem dados suficientes.</p>'}
        </div>
        <div class="chart-card">
          <h4><i class="fa-solid fa-circle-xmark" style="color:var(--sky)"></i> Principais Causas de Atraso</h4>
          ${topMotivos || '<p style="color:var(--gray-400);font-size:13px">Sem dados suficientes.</p>'}
        </div>
      </div>

      <div class="insights-card">
        <h4><i class="fa-solid fa-robot" style="color:var(--sky)"></i> Recomendações Inteligentes</h4>
        <ul class="insights-list">
          ${(ins.recommendations || []).map(r => `<li>${r}</li>`).join('') || '<li>Registre mais atividades para receber recomendações personalizadas.</li>'}
        </ul>
      </div>`;

    Object.values(this.charts).forEach(c => c.destroy());
    this.charts = {};

    const catLabels = Object.keys(data.by_categoria || {});
    const catVals = Object.values(data.by_categoria || {});
    if (catLabels.length > 0) {
      this.charts.extras = new Chart($('mExtras'), {
        type: 'doughnut',
        data: { labels: catLabels, datasets: [{ data: catVals, backgroundColor: ['#002468','#099CD6','#1DB954','#F4A900','#E53935','#9C27B0','#FF5722'] }]},
        options: { responsive: true }
      });
    }
  }
};

// ── INSIGHTS VIEW ─────────────────────────────────────────────────────────

const InsightsView = {
  async load(days, btn) {
    if (btn) {
      document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    $('insightsContent').innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Analisando histórico...</div>';
    try {
      const data = await API(`/api/insights?days=${days}`);
      this.render(data);
    } catch(e) {
      $('insightsContent').innerHTML = '<div class="alert-strip alert-warning">Erro ao carregar insights.</div>';
    }
  },

  render(data) {
    const alertsHtml = (data.alerts || []).map(a =>
      `<div class="alert-strip alert-${a.tipo}"><i class="fa-solid fa-bell"></i> ${a.msg}</div>`
    ).join('');

    const kpis = [
      { label: 'Taxa de Conclusão', val: `${data.taxa_conclusao}%`, color: data.taxa_conclusao >= 70 ? 'var(--green)' : data.taxa_conclusao >= 50 ? 'var(--yellow)' : 'var(--red)' },
      { label: 'Reuniões / Total', val: `${data.pct_reunioes}%`, color: data.pct_reunioes <= 30 ? 'var(--green)' : 'var(--yellow)' },
      { label: 'Demandas Extras', val: `${data.pct_extras}%`, color: data.pct_extras <= 25 ? 'var(--green)' : 'var(--red)' },
      { label: 'Período Analisado', val: `${data.periodo_dias} dias`, color: 'var(--sky)' },
    ];

    const kpisHtml = kpis.map(k =>
      `<div class="stat-card"><div class="stat-body"><div class="stat-label">${k.label}</div><div class="stat-value" style="color:${k.color}">${k.val}</div></div></div>`
    ).join('');

    $('insightsContent').innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">${kpisHtml}</div>
      ${alertsHtml}
      <div class="insights-card">
        <h4><i class="fa-solid fa-magnifying-glass-chart" style="color:var(--sky)"></i> Padrões Identificados</h4>
        <ul class="insights-list">
          ${(data.insights || []).map(i => `<li>${i}</li>`).join('') || '<li>Sem dados suficientes. Continue registrando suas atividades.</li>'}
        </ul>
      </div>
      <div class="insights-card">
        <h4><i class="fa-solid fa-lightbulb" style="color:var(--sky)"></i> Sugestões de Melhoria</h4>
        <ul class="insights-list">
          ${(data.recommendations || []).map(r => `<li>${r}</li>`).join('') || '<li>Registre mais atividades para receber sugestões personalizadas.</li>'}
        </ul>
      </div>`;
  }
};

// ── USER PROFILE ─────────────────────────────────────────────────────────

const UserProfile = {
  STORAGE_KEY: 'biosyn_cronograma_user',

  get() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)); } catch { return null; }
  },

  save() {
    const name    = ($('onbName').value || '').trim();
    const ics_url = ($('onbIcs').value  || '').trim();
    if (!name) { showToast('Informe seu nome para continuar.', 'warning'); return; }
    if (!ics_url || !ics_url.startsWith('http')) { showToast('Cole o link ICS do seu Outlook.', 'warning'); return; }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ name, ics_url }));
    $('onboardingOverlay').style.display = 'none';
    this._updateSidebar({ name });
    App.switchView('dashboard');
  },

  showEdit() {
    const p = this.get();
    if (p) {
      $('onbName').value = p.name;
      $('onbIcs').value  = p.ics_url;
    }
    $('onboardingOverlay').style.display = 'flex';
  },

  _updateSidebar(profile) {
    const initials = (profile.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    $('sidebarAvatar').textContent = initials;
    $('sidebarName').textContent   = profile.name.split(' ')[0];
  },

  check() {
    const p = this.get();
    if (!p || !p.name || !p.ics_url) {
      $('onboardingOverlay').style.display = 'flex';
      return false;
    }
    this._updateSidebar(p);
    return true;
  }
};

// ── CHECKLIST HISTORY ─────────────────────────────────────────────────────

const ChecklistHistory = {
  _pinCallback: null,
  _adminUnlocked: false,

  load(dateValue) {
    if (!dateValue) return;
    const [y, m, d] = dateValue.split('-');
    const dataBR = `${d}/${m}/${y}`;
    $('historyPanel').style.display = 'none';
    $('btnHistoryClear').style.display = 'flex';
    // Abre o checklist completo para a data selecionada
    Checklist.init(dataBR);
  },

  confirmPin() {
    const pin = $('adminPinInput').value.trim();
    if (pin !== '0768') {
      showToast('PIN incorreto.', 'error');
      $('adminPinInput').value = '';
      return;
    }
    this._adminUnlocked = true;
    $('adminPinModal').style.display = 'none';
    if (this._pinCallback) { this._pinCallback(); this._pinCallback = null; }
  },

  closePin() {
    $('adminPinModal').style.display = 'none';
    this._pinCallback = null;
  },

  clear() {
    $('historyPanel').style.display = 'none';
    $('btnHistoryClear').style.display = 'none';
    $('historyDatePicker').value = '';
    this._adminUnlocked = false;
    Checklist.init();
  },
};

// ── ADMIN MODE (GESTOR) ──────────────────────────────────────────────────

const AdminMode = {
  active: false,
  filtroUsuario: '',
  ADMIN_PIN: '0768',

  toggle() {
    if (this.active) {
      this.exit();
    } else {
      this._requestPin();
    }
  },

  _requestPin() {
    $('gestorPinInput').value = '';
    $('gestorPinModal').style.display = 'flex';
    setTimeout(() => $('gestorPinInput').focus(), 100);
  },

  confirmPin() {
    const pin = $('gestorPinInput').value.trim();
    if (pin !== this.ADMIN_PIN) {
      showToast('PIN incorreto.', 'error');
      $('gestorPinInput').value = '';
      return;
    }
    $('gestorPinModal').style.display = 'none';
    this.enter();
  },

  closePin() {
    $('gestorPinModal').style.display = 'none';
  },

  enter() {
    this.active = true;
    this.filtroUsuario = '';
    // Banner de modo gestor
    $('gestorBanner').style.display = 'flex';
    // Atualizar nav item
    const navGestor = document.querySelector('.nav-item[data-view="gestor"]');
    if (navGestor) navGestor.classList.add('gestor-active');
    showToast('Modo Gestor ativado — visualizando dados de toda a equipe.', 'success');
    // Carregar usuários disponíveis para filtro
    this._loadUsers();
    // Recarregar view atual com dados de todos
    App.switchView(App.currentView);
  },

  exit() {
    this.active = false;
    this.filtroUsuario = '';
    $('gestorBanner').style.display = 'none';
    const navGestor = document.querySelector('.nav-item[data-view="gestor"]');
    if (navGestor) navGestor.classList.remove('gestor-active');
    showToast('Modo Gestor desativado.', '');
    App.switchView(App.currentView);
  },

  async _loadUsers() {
    try {
      const data = await fetch('/api/history').then(r => r.json());
      const records = data.records || [];
      const users = [...new Set(records.map(r => r.responsavel).filter(Boolean))].sort();
      const sel = $('gestorUserFilter');
      sel.innerHTML = '<option value="">Toda a equipe</option>' +
        users.map(u => `<option value="${u}">${u}</option>`).join('');
    } catch {}
  },

  applyFilter() {
    this.filtroUsuario = $('gestorUserFilter').value;
    App.switchView(App.currentView);
  },
};

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  UserProfile.check();
  App.init();
});
