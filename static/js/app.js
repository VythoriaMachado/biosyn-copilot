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

    // Sidebar toggle
    $('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Load initial view
    WorkHub.open();
  },

  switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = $(`view-${name}`);
    if (viewEl) viewEl.classList.add('active');

    // sync workhub tab highlight
    document.querySelectorAll('.wh-tab').forEach(t => t.classList.remove('active'));
    const tabEl = document.querySelector(`.wh-tab[data-view="${name}"]`);
    if (tabEl) tabEl.classList.add('active');

    // show/hide workhub tab bar + highlight correct nav item
    const tabBar = $('workhubTabs');
    const sidebarViews = ['desenvolvimento', 'documentos'];
    const isDevView = sidebarViews.includes(name);
    if (tabBar) tabBar.style.display = isDevView ? 'none' : 'flex';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-view="${isDevView ? name : 'workhub'}"]`);
    if (activeNav) activeNav.classList.add('active');

    const exportBtn = $('btnExportWeekly');
    exportBtn.style.display = name === 'weekly' ? 'flex' : 'none';
    exportBtn.onclick = name === 'weekly' ? () => Weekly.export() : null;

    this.currentView = name;
    if (name === 'dashboard')       Dashboard.load();
    if (name === 'checklist')       Checklist.init();
    if (name === 'planning')        Planning.load();
    if (name === 'weekly')          Weekly.load();
    if (name === 'managerial')      Managerial.load();
    if (name === 'insights')        InsightsView.load(30);
    if (name === 'biblioteca')      GuiaBiblioteca.load();
    if (name === 'documentos')      Documentos.load();
    if (name === 'desenvolvimento') MeuDev.load();
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
        const tituloEsc = (a.titulo||'').replace(/'/g,"&#39;");
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
              <button class="btn-como-fazer" onclick="GuiaDrawer.abrir('${tituloEsc}')" title="Ver guia de execução">
                <i class="fa-solid fa-book-open"></i> Como Fazer
              </button>
            </div>
          </div>`;
      }).join('');
      // Verificar quais atividades têm guia e destacar o botão
      Dashboard._marcarGuias(data.atividades);
    } catch(e) {
      $('activitiesList').innerHTML = `<div class="alert-strip alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível carregar a agenda. Verifique se o servidor está rodando.</div>`;
    }
  },

  async _marcarGuias(atividades) {
    // Para cada atividade, verifica silenciosamente se tem guia e ajusta o botão
    for (const a of atividades) {
      try {
        const res = await fetch(`/api/guias/por-atividade?titulo=${encodeURIComponent(a.titulo)}`).then(r => r.json());
        if (res.guia) {
          // Encontra o botão pelo título e adiciona classe "tem-guia"
          const btns = document.querySelectorAll('.btn-como-fazer');
          btns.forEach(btn => {
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(
              (a.titulo||'').replace(/'/g,"&#39;").substring(0, 20)
            )) {
              btn.classList.add('tem-guia');
              btn.title = `Guia disponível: ${res.guia.titulo}`;
            }
          });
        }
      } catch(_) {}
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
    // Reseta barra de progresso
    $('progressFill').style.width = '0%';
    $('progressText').textContent = '0 / 0';

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
            status:               saved.status,
            houve_atraso:         saved.houve_atraso || 'Não',
            motivo_atraso:        saved.motivo_atraso || '',
            tempo_executado:      saved.tempo_executado || '',
            tempo_excedente:      saved.tempo_excedente || '',
            reagendado:           saved.reagendado || 'Não',
            prioridade:           saved.prioridade || '',
            atividade_extra:      saved.atividade_extra || 'Não',
            categoria_extra:      saved.categoria_extra || '',
            nome_atividade_extra: saved.nome_atividade_extra || '',
            tempo_extra_label:    saved.tempo_extra_label || '',
            tempo_extra:          saved.tempo_extra || 0,
            solicitante_extra:    saved.solicitante_extra || '',
            observacoes:          saved.observacoes || '',
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
    const isReuniao = ['reunião','reuniao','meeting','call'].some(w => (a.titulo||'').toLowerCase().includes(w));

    let html = `
    <div class="form-section">
      <div class="form-section-label"><i class="fa-solid fa-circle-check"></i> Status <span class="req">*</span></div>
      <div class="btn-group" data-field="status">
        ${['Concluído','Parcial','Não realizado'].map(v => `<button class="opt-btn ${ans.status===v?statusColor(v):''}" onclick="Checklist.pick(this,'${v}',true)">${v}</button>`).join('')}
      </div>
    </div>

    ${isReuniao ? `
    <div class="form-section reuniao-pauta-section">
      <div class="form-section-label" style="color:var(--sky)"><i class="fa-solid fa-users"></i> Pauta da Reunião</div>
      <textarea class="form-input" rows="4"
        placeholder="Descreva os tópicos discutidos, decisões tomadas e próximos passos..."
        oninput="Checklist.setField('pauta_reuniao', this.value)"
        style="width:100%;resize:vertical;font-family:inherit"
      >${ans.pauta_reuniao || ''}</textarea>
    </div>` : ''}

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

  _startManual() {
    // Cria uma atividade manual em branco para o usuário preencher
    const profile = UserProfile.get();
    const hoje = this.checklistDate || new Date().toLocaleDateString('pt-BR');
    const diaSemana = this.checklistDiaSemana || ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][new Date().getDay()];
    this.activities = [{
      titulo: 'Atividade manual',
      descricao: '',
      horario_inicio: '',
      horario_fim: '',
      tempo_previsto: 60,
      origem: 'Manual',
      tipo: 'tarefa',
      prioridade: 'Média',
      responsavel: profile ? profile.name : '',
    }];
    this.checklistDate = hoje;
    this.checklistDiaSemana = diaSemana;
    this.answers = [{}];
    $('checklistEmpty').style.display = 'none';
    $('checklistDateBanner').style.display = 'block';
    $('checklistDateLabel').innerHTML = `${hoje} — ${diaSemana} <span style="color:#099CD6;font-size:11px">✎ entrada manual</span>`;
    this.goToActivity(0);
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
      const pautaHtml = ans.pauta_reuniao ? `
        <div class="summary-pauta"><i class="fa-solid fa-users" style="color:var(--sky)"></i> <b>Pauta:</b> ${ans.pauta_reuniao}</div>` : '';
      return `
        <div class="summary-item">
          <div class="summary-item-num">${i+1}</div>
          <div>
            <div class="summary-item-title">${a.titulo}</div>
            <div class="summary-item-detail">${detail}</div>
            ${pautaHtml}
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
        responsavel: a.responsavel || UserProfile.get()?.name || '',
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
        pauta_reuniao: ans.pauta_reuniao || '',
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
        responsavel: UserProfile.get()?.name || '',
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
        <div class="stat-card"><div class="stat-icon" style="background:#FFF8E1"><i class="fa-solid fa-circle-half-stroke" style="color:#F4A900"></i></div><div class="stat-body"><div class="stat-label">Parciais</div><div class="stat-value" style="color:var(--yellow)">${data.parciais ?? '—'}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#FDECEA"><i class="fa-solid fa-circle-xmark" style="color:#E53935"></i></div><div class="stat-body"><div class="stat-label">Não realizadas</div><div class="stat-value" style="color:var(--red)">${data.nao_realizadas ?? '—'}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#FFF3E0"><i class="fa-solid fa-percent" style="color:#F4A900"></i></div><div class="stat-body"><div class="stat-label">Taxa Conclusão</div><div class="stat-value" style="color:var(--yellow)">${data.taxa_conclusao}%</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#E8F4FD"><i class="fa-solid fa-clock" style="color:#099CD6"></i></div><div class="stat-body"><div class="stat-label">Horas Planejadas</div><div class="stat-value">${data.horas_previstas ?? '—'}h</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#E8F5E9"><i class="fa-solid fa-clock" style="color:#1DB954"></i></div><div class="stat-body"><div class="stat-label">Horas Executadas</div><div class="stat-value" style="color:var(--green)">${data.horas_executadas ?? '—'}h</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#F3E5F5"><i class="fa-solid fa-people-group" style="color:#9C27B0"></i></div><div class="stat-body"><div class="stat-label">Reuniões</div><div class="stat-value">${data.reunioes}</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#E8F4FD"><i class="fa-solid fa-bolt" style="color:#099CD6"></i></div><div class="stat-body"><div class="stat-label">Demandas Extras</div><div class="stat-value">${data.extras_total}</div></div></div>
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

// ── GUIA DRAWER ──────────────────────────────────────────────────────────

const GuiaDrawer = {
  guia:            null,
  tituloAtividade: null,
  modoEdicao:      false,
  stepsDone:       new Set(),
  _todosGuias:     [],

  async abrir(tituloAtividade) {
    this.tituloAtividade = tituloAtividade;
    this.stepsDone = new Set();
    this.modoEdicao = false;
    $('guiaDrawerTitle').textContent = tituloAtividade;
    $('guiaDrawer').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    $('guiaDrawerBody').innerHTML = '<div class="loading-spinner" style="padding:40px"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>';
    $('guiaEditBtn').style.display = 'none';
    $('guiaFavBtn').style.display = 'none';
    try {
      const res = await fetch(`/api/guias/por-atividade?titulo=${encodeURIComponent(tituloAtividade)}`).then(r => r.json());
      this.guia = res.guia;
      if (this.guia) {
        this._renderGuia();
      } else {
        this._renderVazio();
      }
    } catch(e) {
      $('guiaDrawerBody').innerHTML = '<div class="guia-empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Erro ao carregar</h3></div>';
    }
  },

  async abrirPorId(id) {
    this.tituloAtividade = null;
    this.stepsDone = new Set();
    this.modoEdicao = false;
    $('guiaDrawer').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    $('guiaDrawerBody').innerHTML = '<div class="loading-spinner" style="padding:40px"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>';
    try {
      const guia = await fetch(`/api/guias/${id}`).then(r => r.json());
      this.guia = guia;
      $('guiaDrawerTitle').textContent = guia.titulo || 'Guia';
      this._renderGuia();
    } catch(e) {
      $('guiaDrawerBody').innerHTML = '<div class="guia-empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Erro ao carregar</h3></div>';
    }
  },

  fechar() {
    $('guiaDrawer').style.display = 'none';
    document.body.style.overflow = '';
    this.guia = null;
    this.modoEdicao = false;
  },

  _renderGuia() {
    const g = this.guia;
    $('guiaDrawerTitle').textContent = g.titulo || 'Guia';
    $('guiaEditBtn').style.display = '';
    $('guiaFavBtn').style.display = '';
    const favIcon = g.favorito ? 'fa-solid fa-star' : 'fa-regular fa-star';
    $('guiaFavBtn').innerHTML = `<i class="${favIcon}"></i>`;
    $('guiaFavBtn').classList.toggle('fav-ativo', !!g.favorito);

    const passos = Array.isArray(g.passos) ? g.passos : [];
    const materiais = Array.isArray(g.materiais) ? g.materiais : [];
    const midias = Array.isArray(g.midias) ? g.midias : [];
    const total = passos.length;
    const done = this.stepsDone.size;

    const midiasHtml = midias.length ? midias.map(m => {
      const iconMap = { video:'fa-brands fa-youtube', pdf:'fa-regular fa-file-pdf', imagem:'fa-regular fa-image', link:'fa-solid fa-link', arquivo:'fa-solid fa-paperclip' };
      const clsMap  = { video:'midia-video', pdf:'midia-pdf', imagem:'midia-imagem', link:'midia-link', arquivo:'midia-arquivo' };
      const icon = iconMap[m.tipo] || 'fa-solid fa-link';
      const cls  = clsMap[m.tipo] || 'midia-link';
      return `<div class="guia-midia-item">
        <div class="guia-midia-icon ${cls}"><i class="${icon}"></i></div>
        <div class="guia-midia-info">
          <a href="${m.url}" target="_blank" rel="noopener">${m.nome || m.url}</a>
          <div class="guia-midia-tipo">${m.tipo || 'link'}</div>
        </div>
      </div>`;
    }).join('') : '<p style="font-size:13px;color:var(--gray-400);font-style:italic">Nenhuma mídia anexada.</p>';

    const versoesHtml = `<div class="guia-section">
      <div class="guia-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Versões</div>
      <div id="guiaVersoesContent"><button class="btn-add-item" onclick="GuiaDrawer._carregarVersoes()"><i class="fa-solid fa-eye"></i> Ver histórico</button></div>
    </div>`;

    $('guiaDrawerBody').innerHTML = `
      <div class="guia-tabs">
        <button class="guia-tab active" onclick="GuiaDrawer._tab(this,'tab-execucao')">Execução</button>
        <button class="guia-tab" onclick="GuiaDrawer._tab(this,'tab-materiais')">Materiais</button>
        <button class="guia-tab" onclick="GuiaDrawer._tab(this,'tab-midias')">Mídias ${midias.length ? `<span style="background:var(--sky);color:white;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">${midias.length}</span>` : ''}</button>
        <button class="guia-tab" onclick="GuiaDrawer._tab(this,'tab-mais')">Mais</button>
      </div>

      <!-- TAB EXECUÇÃO -->
      <div class="guia-tab-content active" id="tab-execucao">
        <div class="guia-meta">
          ${g.tempo_estimado ? `<span class="guia-meta-chip"><i class="fa-solid fa-clock"></i> ${g.tempo_estimado}</span>` : ''}
          ${g.categoria ? `<span class="guia-meta-chip"><i class="fa-solid fa-tag"></i> ${g.categoria}</span>` : ''}
          <span class="guia-meta-chip"><i class="fa-solid fa-code-branch"></i> v${g.versao || 1}</span>
        </div>
        ${g.objetivo ? `<div class="guia-section">
          <div class="guia-section-title"><i class="fa-solid fa-bullseye"></i> Objetivo</div>
          <div class="guia-section-body guia-objetivo">${g.objetivo}</div>
        </div>` : ''}
        ${passos.length ? `<div class="guia-section">
          <div class="guia-section-title"><i class="fa-solid fa-list-check"></i> Passo a Passo</div>
          <div class="guia-progress-bar-wrap">
            <div class="guia-progress-label">
              <span>Progresso</span><span id="guiaStepCount">${done}/${total} concluídos</span>
            </div>
            <div class="guia-progress-bar">
              <div class="guia-progress-fill" id="guiaStepBar" style="width:${total ? Math.round(done/total*100) : 0}%"></div>
            </div>
          </div>
          <ul class="guia-steps">
            ${passos.map((p, i) => `
              <li class="guia-step${this.stepsDone.has(i) ? ' done' : ''}" onclick="GuiaDrawer.toggleStep(${i})">
                <div class="guia-step-num">${i+1}</div>
                <div class="guia-step-text">${p}</div>
                <i class="fa-solid ${this.stepsDone.has(i) ? 'fa-circle-check' : 'fa-circle'} guia-step-check"></i>
              </li>`).join('')}
          </ul>
        </div>` : ''}
      </div>

      <!-- TAB MATERIAIS -->
      <div class="guia-tab-content" id="tab-materiais">
        ${materiais.length ? `<div class="guia-section">
          <div class="guia-section-title"><i class="fa-solid fa-box-open"></i> Materiais Necessários</div>
          <ul class="guia-materiais">${materiais.map(m => `<li><i class="fa-solid fa-circle-dot" style="color:var(--sky);margin-right:7px;font-size:10px"></i>${m}</li>`).join('')}</ul>
        </div>` : '<p style="padding:20px;font-size:13px;color:var(--gray-400);font-style:italic">Nenhum material listado.</p>'}
        ${g.dicas ? `<div class="guia-section">
          <div class="guia-section-title"><i class="fa-solid fa-lightbulb"></i> Dicas de Execução</div>
          <div class="guia-section-body">${g.dicas}</div>
        </div>` : ''}
        ${g.erros_comuns ? `<div class="guia-section">
          <div class="guia-section-title"><i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Erros Comuns</div>
          <div class="guia-section-body" style="border-color:var(--red);background:#FFF5F5">${g.erros_comuns}</div>
        </div>` : ''}
      </div>

      <!-- TAB MÍDIAS -->
      <div class="guia-tab-content" id="tab-midias">
        <div class="guia-section">
          <div class="guia-section-title"><i class="fa-solid fa-paperclip"></i> Recursos Anexados</div>
          <div class="guia-midias-list">${midiasHtml}</div>
        </div>
      </div>

      <!-- TAB MAIS -->
      <div class="guia-tab-content" id="tab-mais">
        ${versoesHtml}
        <div class="guia-section">
          <div class="guia-section-title"><i class="fa-solid fa-link"></i> Atividades Vinculadas</div>
          <div class="guia-section-body">
            ${(g.atividades_vinculadas||[]).length
              ? (g.atividades_vinculadas||[]).map(t => `<div style="font-size:13px;padding:3px 0;border-bottom:1px solid var(--gray-200)">${t}</div>`).join('')
              : '<span style="color:var(--gray-400);font-style:italic;font-size:13px">Nenhuma atividade vinculada.</span>'}
            ${this.tituloAtividade && !(g.atividades_vinculadas||[]).includes(this.tituloAtividade) ? `
              <button class="btn-add-item" style="margin-top:8px" onclick="GuiaDrawer._vincularAtividade()">
                <i class="fa-solid fa-link"></i> Vincular à atividade atual
              </button>` : ''}
          </div>
        </div>
        <div style="padding:0 0 16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-secondary" onclick="GuiaDrawer.duplicar()">
            <i class="fa-solid fa-copy"></i> Duplicar guia
          </button>
          <button class="btn-secondary" style="color:var(--red);border-color:var(--red)" onclick="GuiaDrawer.excluir()">
            <i class="fa-solid fa-trash"></i> Excluir
          </button>
        </div>
      </div>`;
  },

  _tab(btn, id) {
    btn.closest('.guia-drawer-panel').querySelectorAll('.guia-tab').forEach(t => t.classList.remove('active'));
    btn.closest('.guia-drawer-panel').querySelectorAll('.guia-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $(id).classList.add('active');
  },

  toggleStep(idx) {
    if (this.stepsDone.has(idx)) {
      this.stepsDone.delete(idx);
    } else {
      this.stepsDone.add(idx);
    }
    const passos = Array.isArray(this.guia?.passos) ? this.guia.passos : [];
    const total  = passos.length;
    const done   = this.stepsDone.size;
    // Atualizar UI sem re-render completo
    const steps = document.querySelectorAll('.guia-step');
    steps.forEach((el, i) => {
      const isDone = this.stepsDone.has(i);
      el.classList.toggle('done', isDone);
      el.querySelector('.guia-step-check').className = `fa-solid ${isDone ? 'fa-circle-check' : 'fa-circle'} guia-step-check`;
    });
    const bar = $('guiaStepBar');
    const cnt = $('guiaStepCount');
    if (bar) bar.style.width = `${total ? Math.round(done/total*100) : 0}%`;
    if (cnt) cnt.textContent = `${done}/${total} concluídos`;
  },

  async toggleFavorito() {
    if (!this.guia) return;
    try {
      const res = await fetch(`/api/guias/${this.guia.id}/favorito`, {method:'POST'}).then(r => r.json());
      this.guia.favorito = res.favorito;
      const favIcon = res.favorito ? 'fa-solid fa-star' : 'fa-regular fa-star';
      $('guiaFavBtn').innerHTML = `<i class="${favIcon}"></i>`;
      $('guiaFavBtn').classList.toggle('fav-ativo', res.favorito);
      showToast(res.favorito ? 'Adicionado aos favoritos!' : 'Removido dos favoritos.', 'success');
    } catch(e) { showToast('Erro ao favoritar.', 'error'); }
  },

  async duplicar() {
    if (!this.guia) return;
    const usuario = UserProfile.get()?.name || '';
    try {
      const res = await fetch(`/api/guias/${this.guia.id}/duplicar`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({usuario})
      }).then(r => r.json());
      showToast('Guia duplicado com sucesso!', 'success');
      this.fechar();
      GuiaBiblioteca.load();
    } catch(e) { showToast('Erro ao duplicar.', 'error'); }
  },

  async excluir() {
    if (!this.guia) return;
    if (!confirm(`Excluir o guia "${this.guia.titulo}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await fetch(`/api/guias/${this.guia.id}`, {method:'DELETE'});
      showToast('Guia excluído.', '');
      this.fechar();
      GuiaBiblioteca.load();
    } catch(e) { showToast('Erro ao excluir.', 'error'); }
  },

  async _vincularAtividade() {
    if (!this.guia || !this.tituloAtividade) return;
    try {
      await fetch(`/api/guias/${this.guia.id}/vincular`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({titulo_atividade: this.tituloAtividade})
      });
      showToast('Atividade vinculada ao guia!', 'success');
      this.guia.atividades_vinculadas = [...(this.guia.atividades_vinculadas||[]), this.tituloAtividade];
      this._renderGuia();
      this._tab(document.querySelector('.guia-tab'), 'tab-execucao');
    } catch(e) { showToast('Erro ao vincular.', 'error'); }
  },

  async _carregarVersoes() {
    if (!this.guia) return;
    try {
      const res = await fetch(`/api/guias/${this.guia.id}/versoes`).then(r => r.json());
      const versoes = res.versoes || [];
      $('guiaVersoesContent').innerHTML = versoes.length
        ? `<div class="guia-versoes-list">${versoes.map(v => `
            <div class="guia-versao-item">
              <span class="guia-versao-badge">v${v.versao}</span>
              <span>${v.criado_em || ''}</span>
              <span style="margin-left:auto;color:var(--gray-400)">${v.criado_por || '—'}</span>
            </div>`).join('')}
          </div>`
        : '<p style="font-size:13px;color:var(--gray-400)">Sem histórico de versões.</p>';
    } catch(e) {}
  },

  _renderVazio() {
    $('guiaEditBtn').style.display = 'none';
    $('guiaFavBtn').style.display = 'none';
    $('guiaDrawerBody').innerHTML = `
      <div class="guia-empty-state">
        <i class="fa-regular fa-file-lines"></i>
        <h3>Nenhum guia encontrado</h3>
        <p>Esta atividade ainda não possui um guia de execução.<br>Crie um agora ou vincule um guia existente da biblioteca.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn-primary" onclick="GuiaDrawer.criarNovo()">
            <i class="fa-solid fa-plus"></i> Criar Guia
          </button>
          <button class="btn-secondary" onclick="GuiaDrawer.selecionarDaBiblioteca()">
            <i class="fa-solid fa-book-open"></i> Usar da Biblioteca
          </button>
        </div>
      </div>`;
  },

  criarNovo() {
    this.guia = null;
    this.modoEdicao = true;
    $('guiaEditBtn').style.display = 'none';
    $('guiaFavBtn').style.display = 'none';
    $('guiaDrawerTitle').textContent = 'Criar Guia';
    this._renderForm({});
  },

  entrarEdicao() {
    this.modoEdicao = true;
    $('guiaEditBtn').style.display = 'none';
    $('guiaFavBtn').style.display = 'none';
    $('guiaDrawerTitle').textContent = 'Editar Guia';
    this._renderForm(this.guia || {});
  },

  _renderForm(g) {
    const passos    = Array.isArray(g.passos)    ? g.passos    : [];
    const materiais = Array.isArray(g.materiais) ? g.materiais : [];
    const midias    = Array.isArray(g.midias)    ? g.midias    : [];

    const passosHtml = passos.map((p, i) => `
      <div class="guia-passo-row" data-idx="${i}">
        <span style="font-size:12px;font-weight:700;color:var(--gray-400);min-width:18px">${i+1}.</span>
        <input type="text" value="${(p||'').replace(/"/g,'&quot;')}" placeholder="Descreva o passo...">
        <button class="btn-remove-item" onclick="GuiaDrawer._removePasso(this)"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('');

    const materiaisHtml = materiais.map((m, i) => `
      <div class="guia-passo-row" data-idx="${i}">
        <input type="text" value="${(m||'').replace(/"/g,'&quot;')}" placeholder="Material necessário...">
        <button class="btn-remove-item" onclick="GuiaDrawer._removeMaterial(this)"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('');

    const midiasHtml = midias.map((m, i) => `
      <div class="guia-passo-row midia-row" data-idx="${i}" style="flex-wrap:wrap;gap:6px;align-items:center">
        <select class="midia-tipo-sel" style="border:1px solid var(--gray-200);border-radius:8px;padding:7px;font-size:12px;font-family:inherit">
          ${['link','video','pdf','imagem','excel','arquivo'].map(t => `<option value="${t}"${m.tipo===t?' selected':''}>${t}</option>`).join('')}
        </select>
        <input type="text" class="midia-nome" value="${(m.nome||'').replace(/"/g,'&quot;')}" placeholder="Nome/título" style="flex:1;min-width:100px">
        <input type="url" class="midia-url" value="${(m.url||'').replace(/"/g,'&quot;')}" placeholder="URL" style="flex:2;min-width:120px">
        <label class="btn-upload-midia" title="Substituir por arquivo">
          <i class="fa-solid fa-paperclip"></i>
          <input type="file" style="display:none" onchange="GuiaDrawer._uploadArquivo(this)">
        </label>
        <button class="btn-remove-item" onclick="GuiaDrawer._removeMidia(this)"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('');

    $('guiaDrawerBody').innerHTML = `
      <div class="guia-form" id="guiaFormBody">
        <div class="guia-form-group">
          <label class="guia-form-label">Título do Guia *</label>
          <input type="text" id="gfTitulo" value="${(g.titulo||this.tituloAtividade||'').replace(/"/g,'&quot;')}" placeholder="Ex: Como conduzir reunião de alinhamento">
        </div>
        <div class="guia-form-group">
          <label class="guia-form-label">Categoria</label>
          <input type="text" id="gfCategoria" value="${(g.categoria||'Geral').replace(/"/g,'&quot;')}" placeholder="Ex: Comercial, Administrativo, Marketing...">
        </div>
        <div class="guia-form-group">
          <label class="guia-form-label">Objetivo</label>
          <textarea id="gfObjetivo" rows="2" placeholder="O que se espera alcançar com esta atividade?">${g.objetivo||''}</textarea>
        </div>
        <div class="guia-form-group">
          <label class="guia-form-label">Tempo Estimado</label>
          <input type="text" id="gfTempo" value="${(g.tempo_estimado||'').replace(/"/g,'&quot;')}" placeholder="Ex: 30 min, 1h30...">
        </div>

        <div class="guia-form-group">
          <label class="guia-form-label"><i class="fa-solid fa-list-check" style="color:var(--sky)"></i> Passo a Passo</label>
          <div class="guia-passos-editor" id="gfPassos">${passosHtml}</div>
          <button class="btn-add-item" onclick="GuiaDrawer._addPasso()"><i class="fa-solid fa-plus"></i> Adicionar passo</button>
        </div>

        <div class="guia-form-group">
          <label class="guia-form-label"><i class="fa-solid fa-box-open" style="color:var(--sky)"></i> Materiais Necessários</label>
          <div class="guia-passos-editor" id="gfMateriais">${materiaisHtml}</div>
          <button class="btn-add-item" onclick="GuiaDrawer._addMaterial()"><i class="fa-solid fa-plus"></i> Adicionar material</button>
        </div>

        <div class="guia-form-group">
          <label class="guia-form-label">Dicas de Execução</label>
          <textarea id="gfDicas" rows="3" placeholder="Dicas práticas para executar bem esta atividade...">${g.dicas||''}</textarea>
        </div>
        <div class="guia-form-group">
          <label class="guia-form-label">Erros Comuns</label>
          <textarea id="gfErros" rows="3" placeholder="O que costuma dar errado e como evitar...">${g.erros_comuns||''}</textarea>
        </div>

        <div class="guia-form-group">
          <label class="guia-form-label"><i class="fa-solid fa-paperclip" style="color:var(--sky)"></i> Mídias e Recursos</label>
          <div class="guia-passos-editor" id="gfMidias">${midiasHtml}</div>
          <button class="btn-add-item" onclick="GuiaDrawer._addMidia()"><i class="fa-solid fa-plus"></i> Adicionar mídia/link</button>
        </div>
      </div>
      <div class="guia-form-actions">
        <button class="btn-secondary" onclick="GuiaDrawer._cancelarEdicao()"><i class="fa-solid fa-xmark"></i> Cancelar</button>
        <button class="btn-primary" onclick="GuiaDrawer.salvar()"><i class="fa-solid fa-floppy-disk"></i> Salvar Guia</button>
      </div>`;
  },

  _cancelarEdicao() {
    if (this.guia) {
      this.modoEdicao = false;
      $('guiaDrawerTitle').textContent = this.guia.titulo;
      $('guiaEditBtn').style.display = '';
      $('guiaFavBtn').style.display = '';
      this._renderGuia();
    } else {
      this.fechar();
    }
  },

  _addPasso() {
    const c = $('gfPassos');
    const idx = c.children.length;
    const div = document.createElement('div');
    div.className = 'guia-passo-row';
    div.dataset.idx = idx;
    div.innerHTML = `<span style="font-size:12px;font-weight:700;color:var(--gray-400);min-width:18px">${idx+1}.</span>
      <input type="text" placeholder="Descreva o passo...">
      <button class="btn-remove-item" onclick="GuiaDrawer._removePasso(this)"><i class="fa-solid fa-xmark"></i></button>`;
    c.appendChild(div);
    div.querySelector('input').focus();
  },

  _removePasso(btn) { btn.closest('.guia-passo-row').remove(); this._renumerar('gfPassos'); },

  _renumerar(containerId) {
    const rows = $(`${containerId}`).querySelectorAll('.guia-passo-row');
    rows.forEach((r, i) => { const s = r.querySelector('span'); if(s) s.textContent = `${i+1}.`; });
  },

  _addMaterial() {
    const c = $('gfMateriais');
    const div = document.createElement('div');
    div.className = 'guia-passo-row';
    div.innerHTML = `<input type="text" placeholder="Material necessário...">
      <button class="btn-remove-item" onclick="GuiaDrawer._removeMaterial(this)"><i class="fa-solid fa-xmark"></i></button>`;
    c.appendChild(div);
    div.querySelector('input').focus();
  },

  _removeMaterial(btn) { btn.closest('.guia-passo-row').remove(); },

  _addMidia() {
    const c = $('gfMidias');
    const div = document.createElement('div');
    div.className = 'guia-passo-row midia-row';
    div.style.cssText = 'flex-wrap:wrap;gap:6px;align-items:center';
    div.innerHTML = `
      <select class="midia-tipo-sel" style="border:1px solid var(--gray-200);border-radius:8px;padding:7px;font-size:12px;font-family:inherit">
        ${['link','video','pdf','imagem','excel','arquivo'].map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
      <input type="text" class="midia-nome" placeholder="Nome/título" style="flex:1;min-width:100px">
      <input type="url" class="midia-url" placeholder="URL (https://...)" style="flex:2;min-width:120px">
      <label class="btn-upload-midia" title="Escolher arquivo do computador">
        <i class="fa-solid fa-paperclip"></i>
        <input type="file" style="display:none" onchange="GuiaDrawer._uploadArquivo(this)">
      </label>
      <button class="btn-remove-item" onclick="GuiaDrawer._removeMidia(this)"><i class="fa-solid fa-xmark"></i></button>`;
    c.appendChild(div);
    div.querySelector('.midia-nome').focus();
  },

  async _uploadArquivo(input) {
    const file = input.files[0];
    if (!file) return;
    const row = input.closest('.midia-row');
    const urlInput  = row.querySelector('.midia-url');
    const nomeInput = row.querySelector('.midia-nome');
    const tipoSel   = row.querySelector('.midia-tipo-sel');
    const label     = input.closest('.btn-upload-midia');

    label.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    label.style.pointerEvents = 'none';

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/guias/upload', {method:'POST', body: form}).then(r => r.json());
      if (res.error) throw new Error(res.error);
      urlInput.value  = res.url;
      if (!nomeInput.value) nomeInput.value = file.name;
      // auto-detectar tipo
      const ext = file.name.split('.').pop().toLowerCase();
      const tipoMap = { pdf:'pdf', xlsx:'excel', xls:'excel', png:'imagem', jpg:'imagem', jpeg:'imagem', gif:'imagem', mp4:'video', avi:'video', mov:'video' };
      if (tipoMap[ext]) tipoSel.value = tipoMap[ext];
      else if (!['link','video','pdf','imagem','excel'].includes(tipoSel.value)) tipoSel.value = 'arquivo';
      showToast('Arquivo enviado com sucesso!', 'success');
    } catch(e) {
      showToast(`Erro no upload: ${e.message}`, 'error');
    } finally {
      label.innerHTML = '<i class="fa-solid fa-paperclip"></i><input type="file" style="display:none" onchange="GuiaDrawer._uploadArquivo(this)">';
      label.style.pointerEvents = '';
    }
  },

  _removeMidia(btn) { btn.closest('.guia-passo-row').remove(); },

  _coletarForm() {
    const passos    = [...$('gfPassos').querySelectorAll('.guia-passo-row input[type=text]')].map(i => i.value.trim()).filter(Boolean);
    const materiais = [...$('gfMateriais').querySelectorAll('input[type=text]')].map(i => i.value.trim()).filter(Boolean);
    const midias    = [...$('gfMidias').querySelectorAll('.guia-passo-row')].map(row => ({
      tipo: row.querySelector('.midia-tipo-sel, select')?.value || 'link',
      nome: row.querySelector('.midia-nome')?.value.trim() || '',
      url:  row.querySelector('.midia-url')?.value.trim()  || '',
    })).filter(m => m.url);
    return {
      titulo:          ($('gfTitulo')?.value||'').trim(),
      categoria:       ($('gfCategoria')?.value||'Geral').trim(),
      objetivo:        $('gfObjetivo')?.value||'',
      tempo_estimado:  $('gfTempo')?.value||'',
      dicas:           $('gfDicas')?.value||'',
      erros_comuns:    $('gfErros')?.value||'',
      titulo_atividade: this.tituloAtividade || '',
      passos, materiais, midias,
      usuario: UserProfile.get()?.name || '',
    };
  },

  async salvar() {
    const data = this._coletarForm();
    if (!data.titulo) { showToast('Informe o título do guia.', 'warning'); return; }
    try {
      if (this.guia?.id) {
        await fetch(`/api/guias/${this.guia.id}`, {
          method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
        });
        showToast('Guia atualizado!', 'success');
        const updated = await fetch(`/api/guias/${this.guia.id}`).then(r => r.json());
        this.guia = updated;
      } else {
        const res = await fetch('/api/guias', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
        }).then(r => r.json());
        showToast('Guia criado com sucesso!', 'success');
        const updated = await fetch(`/api/guias/${res.id}`).then(r => r.json());
        this.guia = updated;
      }
      this.modoEdicao = false;
      $('guiaEditBtn').style.display = '';
      $('guiaFavBtn').style.display = '';
      $('guiaDrawerTitle').textContent = this.guia.titulo;
      this._renderGuia();
      if (typeof GuiaBiblioteca !== 'undefined') GuiaBiblioteca.load();
      Dashboard._marcarGuias([{titulo: this.tituloAtividade || ''}]);
    } catch(e) {
      showToast('Erro ao salvar guia.', 'error');
    }
  },

  async selecionarDaBiblioteca() {
    // Abre modal com lista de guias para vincular
    try {
      const res = await fetch('/api/guias').then(r => r.json());
      this._todosGuias = res.guias || [];
      this._renderModalSelecionar(this._todosGuias);
      $('guiaSelecionarModal').style.display = 'flex';
    } catch(e) { showToast('Erro ao carregar biblioteca.', 'error'); }
  },

  _renderModalSelecionar(guias) {
    $('guiaSelecionarList').innerHTML = guias.length
      ? guias.map(g => `
          <div class="guia-select-item" onclick="GuiaDrawer._vincularExistente(${g.id})">
            <div style="flex:1">
              <div class="guia-select-item-title">${g.titulo}</div>
              <div class="guia-select-item-cat">${g.categoria||'Geral'} · v${g.versao||1}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:var(--gray-400)"></i>
          </div>`).join('')
      : '<p style="font-size:13px;color:var(--gray-400);padding:16px 0">Nenhum guia na biblioteca ainda.</p>';
  },

  filtrarModal() {
    const q = ($('guiaSelecionarSearch')?.value||'').toLowerCase();
    const filtrados = this._todosGuias.filter(g => (g.titulo||'').toLowerCase().includes(q));
    this._renderModalSelecionar(filtrados);
  },

  fecharModal() { $('guiaSelecionarModal').style.display = 'none'; },

  async _vincularExistente(guiaId) {
    this.fecharModal();
    try {
      await fetch(`/api/guias/${guiaId}/vincular`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({titulo_atividade: this.tituloAtividade || ''})
      });
      showToast('Guia vinculado à atividade!', 'success');
      this.fechar();
      await this.abrir(this.tituloAtividade);
    } catch(e) { showToast('Erro ao vincular.', 'error'); }
  },
};

// ── GUIA BIBLIOTECA ───────────────────────────────────────────────────────

const GuiaBiblioteca = {
  guias:        [],
  soFavoritos:  false,

  async load() {
    await this._carregarCategorias();
    await this.buscar();
  },

  async _carregarCategorias() {
    try {
      const res = await fetch('/api/guias/categorias').then(r => r.json());
      const cats = res.categorias || [];
      const sel = $('bibCategoria');
      if (!sel) return;
      sel.innerHTML = '<option value="">Todas as categorias</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
    } catch(_) {}
  },

  async buscar() {
    const search    = ($('bibSearch')?.value||'').trim();
    const categoria = $('bibCategoria')?.value||'';
    const favParam  = this.soFavoritos ? '&favoritos=1' : '';
    try {
      const res = await fetch(`/api/guias?search=${encodeURIComponent(search)}&categoria=${encodeURIComponent(categoria)}${favParam}`).then(r => r.json());
      this.guias = res.guias || [];
      this._render();
    } catch(e) {
      $('bibGrid').innerHTML = '<p style="color:var(--gray-400);font-size:13px">Erro ao carregar guias.</p>';
    }
  },

  toggleFav() {
    this.soFavoritos = !this.soFavoritos;
    const btn = $('bibFavBtn');
    if (btn) btn.classList.toggle('ativo', this.soFavoritos);
    this.buscar();
  },

  _render() {
    const grid = $('bibGrid');
    if (!grid) return;
    if (!this.guias.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px">
        <i class="fa-regular fa-folder-open" style="font-size:36px;color:var(--gray-200);display:block;margin-bottom:12px"></i>
        <p style="font-size:14px;color:var(--gray-400)">Nenhum guia encontrado.<br>Crie o primeiro guia clicando em "Novo Guia".</p>
      </div>`;
      return;
    }
    grid.innerHTML = this.guias.map(g => `
      <div class="bib-card" onclick="GuiaBiblioteca.abrir(${g.id})">
        <div class="bib-card-header">
          <div class="bib-card-title">${g.titulo}</div>
          ${g.favorito ? '<i class="fa-solid fa-star bib-card-fav"></i>' : ''}
        </div>
        ${g.objetivo ? `<div class="bib-card-objetivo">${g.objetivo.substring(0,100)}${g.objetivo.length>100?'…':''}</div>` : ''}
        <div class="bib-card-footer">
          <span class="bib-card-chip cat"><i class="fa-solid fa-tag"></i> ${g.categoria||'Geral'}</span>
          ${g.mais_usado ? `<span class="bib-card-chip uso"><i class="fa-solid fa-fire"></i> ${g.mais_usado}× usado</span>` : ''}
          <span class="bib-card-chip ver">v${g.versao||1}</span>
        </div>
        <div class="bib-card-actions" onclick="event.stopPropagation()">
          <button onclick="GuiaBiblioteca.editar(${g.id})"><i class="fa-solid fa-pen"></i> Editar</button>
          <button onclick="GuiaBiblioteca.duplicar(${g.id})"><i class="fa-solid fa-copy"></i> Duplicar</button>
          <button onclick="GuiaBiblioteca.excluir(${g.id}, '${(g.titulo||'').replace(/'/g,'&#39;')}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>`).join('');
  },

  abrir(id) {
    GuiaDrawer.abrirPorId(id);
  },

  editar(id) {
    GuiaDrawer.abrirPorId(id).then(() => {
      setTimeout(() => GuiaDrawer.entrarEdicao(), 300);
    });
  },

  async duplicar(id) {
    const usuario = UserProfile.get()?.name || '';
    try {
      await fetch(`/api/guias/${id}/duplicar`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({usuario})
      });
      showToast('Guia duplicado!', 'success');
      this.buscar();
    } catch(e) { showToast('Erro ao duplicar.', 'error'); }
  },

  async excluir(id, titulo) {
    if (!confirm(`Excluir o guia "${titulo}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await fetch(`/api/guias/${id}`, {method:'DELETE'});
      showToast('Guia excluído.', '');
      this.buscar();
    } catch(e) { showToast('Erro ao excluir.', 'error'); }
  },

  novo() {
    GuiaDrawer.tituloAtividade = null;
    GuiaDrawer.guia = null;
    $('guiaDrawer').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    $('guiaDrawerTitle').textContent = 'Criar Guia';
    $('guiaEditBtn').style.display = 'none';
    $('guiaFavBtn').style.display = 'none';
    GuiaDrawer._renderForm({});
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
    $('gestorBanner').style.display = 'flex';
    const navGestor = document.querySelector('.nav-item[data-view="gestor"]');
    if (navGestor) navGestor.classList.add('gestor-active');
    showToast('Modo Gestor ativado — visualizando dados de toda a equipe.', 'success');
    this._loadUsers();
    GestorChecklist.mostrar();
    App.switchView(App.currentView);
  },

  exit() {
    this.active = false;
    this.filtroUsuario = '';
    $('gestorBanner').style.display = 'none';
    const navGestor = document.querySelector('.nav-item[data-view="gestor"]');
    if (navGestor) navGestor.classList.remove('gestor-active');
    GestorChecklist.ocultar();
    showToast('Modo Gestor desativado.', '');
    App.switchView(App.currentView);
  },

  async _loadUsers() {
    try {
      const data = await fetch('/api/history').then(r => r.json());
      const records = data.records || [];
      const users = [...new Set(records.map(r => r.responsavel).filter(Boolean))].sort();
      // banner filter
      const sel = $('gestorUserFilter');
      sel.innerHTML = '<option value="">Toda a equipe</option>' +
        users.map(u => `<option value="${u}">${u}</option>`).join('');
      // gestor checklist filter
      const sel2 = $('gestorClaboradorSel');
      if (sel2) sel2.innerHTML = '<option value="">Toda a equipe</option>' +
        users.map(u => `<option value="${u}">${u}</option>`).join('');
    } catch {}
  },

  applyFilter() {
    this.filtroUsuario = $('gestorUserFilter').value;
    App.switchView(App.currentView);
  },
};

// ── GESTOR CHECKLIST ──────────────────────────────────────────────────────────
const GestorChecklist = {
  mostrar() {
    const bar = $('gestorChecklistBar');
    if (!bar) return;
    bar.style.display = 'block';
    // preencher datas padrão: mês atual
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const ini = $('gestorDataInicio');
    const fim = $('gestorDataFim');
    if (ini && !ini.value) ini.value = `${y}-${m}-01`;
    if (fim && !fim.value) fim.value = `${y}-${m}-${String(new Date(y, hoje.getMonth()+1, 0).getDate()).padStart(2,'0')}`;
  },

  ocultar() {
    const bar = $('gestorChecklistBar');
    if (bar) bar.style.display = 'none';
  },

  exportar() {
    const ini  = ($('gestorDataInicio')?.value  || '').trim();
    const fim  = ($('gestorDataFim')?.value     || '').trim();
    const user = ($('gestorClaboradorSel')?.value || '').trim();

    if (!ini || !fim) {
      showToast('Selecione o período de início e fim antes de exportar.', 'error');
      return;
    }
    if (ini > fim) {
      showToast('A data de início não pode ser posterior à data fim.', 'error');
      return;
    }

    const params = new URLSearchParams({ data_inicio: ini, data_fim: fim });
    if (user) params.set('usuario', user);

    showToast('Gerando planilha...', '');
    window.location.href = `/api/gestor/checklist/exportar?${params}`;
  },
};

// ── DOCUMENTOS ────────────────────────────────────────────────────────────
const Documentos = {
  _arquivoPendente: null,

  _icone(tipo) {
    return { pdf:'📄', excel:'📊', imagem:'🖼️', word:'📝', outro:'📁' }[tipo] || '📁';
  },
  _chipClass(tipo) {
    return `doc-chip-${tipo || 'outro'}`;
  },
  _tipoLabel(tipo) {
    return { pdf:'PDF', excel:'Excel', imagem:'Imagem', word:'Word', outro:'Outro' }[tipo] || 'Outro';
  },

  async load() {
    await this.buscar();
    await this._carregarCategorias();
  },

  async _carregarCategorias() {
    try {
      const d = await fetch('/api/documentos/categorias').then(r => r.json());
      const sel = $('docFiltroCategoria');
      const cats = d.categorias || [];
      sel.innerHTML = '<option value="">Todas as categorias</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
      // preenche datalist do modal
      const dl = document.getElementById('docCategoriasList');
      if (dl) dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
    } catch {}
  },

  async buscar() {
    const search    = ($('docSearch')?.value || '').trim();
    const tipo      = $('docFiltroTipo')?.value || '';
    const categoria = $('docFiltroCategoria')?.value || '';
    const params    = new URLSearchParams();
    if (search)    params.set('search', search);
    if (tipo)      params.set('tipo', tipo);
    if (categoria) params.set('categoria', categoria);
    try {
      const d = await fetch(`/api/documentos?${params}`).then(r => r.json());
      this._render(d.documentos || []);
    } catch {
      $('docGrid').innerHTML = '<div class="doc-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao carregar documentos.</p></div>';
    }
  },

  _render(docs) {
    const el = $('docGrid');
    if (!docs.length) {
      el.innerHTML = `<div class="doc-empty" style="grid-column:1/-1">
        <i class="fa-solid fa-folder-open"></i>
        <p>Nenhum documento encontrado.<br>Clique em <strong>Enviar Documento</strong> para começar.</p>
      </div>`;
      return;
    }
    el.innerHTML = docs.map(d => {
      const data = d.criado_em ? d.criado_em.slice(0,10).split('-').reverse().join('/') : '';
      const desc = d.descricao ? `<div class="doc-card-desc">${d.descricao}</div>` : '';
      return `<div class="doc-card">
        <div class="doc-card-icon">${this._icone(d.tipo)}</div>
        <div>
          <div class="doc-card-name">${d.nome}</div>
          <div style="margin-top:5px"><span class="doc-chip-tipo ${this._chipClass(d.tipo)}">${this._tipoLabel(d.tipo)}</span>${d.categoria ? ` <span style="font-size:11px;color:var(--gray-400)">${d.categoria}</span>` : ''}</div>
        </div>
        ${desc}
        <div class="doc-card-meta">
          ${d.criado_por ? `<span><i class="fa-solid fa-user" style="width:12px"></i> ${d.criado_por}</span>` : ''}
          ${data ? `<span><i class="fa-solid fa-calendar" style="width:12px"></i> ${data}</span>` : ''}
        </div>
        <div class="doc-card-footer">
          <a class="doc-btn-download" href="${d.url}" target="_blank" download>
            <i class="fa-solid fa-download"></i> Baixar
          </a>
          <button class="doc-btn-del" onclick="Documentos.excluir(${d.id},'${(d.nome||'').replace(/'/g,"\\'")}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  },

  iniciarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const ALLOWED = /\.(pdf|png|jpg|jpeg|webp|gif|xls|xlsx|xlsm|csv|doc|docx)$/i;
    if (!ALLOWED.test(file.name)) {
      showToast('Tipo de arquivo não permitido.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('Arquivo muito grande. Máximo 20MB.', 'error');
      input.value = '';
      return;
    }
    this._arquivoPendente = file;

    // detectar tipo
    const ext = file.name.rsplit ? file.name.rsplit('.',1) : file.name.split('.').pop().toLowerCase();
    const extLow = file.name.split('.').pop().toLowerCase();
    const tipoMap = { pdf:'PDF', xls:'Excel', xlsx:'Excel', xlsm:'Excel', csv:'Excel',
                      png:'Imagem', jpg:'Imagem', jpeg:'Imagem', webp:'Imagem', gif:'Imagem',
                      doc:'Word', docx:'Word' };
    $('docTipoDetectado').value = tipoMap[extLow] || 'Outro';
    $('docNome').value = file.name.replace(/\.[^.]+$/, '');
    $('docDescricao').value = '';

    // preview
    const iconeMap = { pdf:'📄', xls:'📊', xlsx:'📊', xlsm:'📊', csv:'📊',
                       png:'🖼️', jpg:'🖼️', jpeg:'🖼️', webp:'🖼️', gif:'🖼️',
                       doc:'📝', docx:'📝' };
    $('docPreviewArquivo').innerHTML = `<span style="font-size:22px">${iconeMap[extLow]||'📁'}</span><span>${file.name}</span>`;

    $('docUploadModal').style.display = 'flex';
    setTimeout(() => $('docNome').focus(), 100);
  },

  cancelarUpload() {
    this._arquivoPendente = null;
    $('docUploadInput').value = '';
    $('docUploadModal').style.display = 'none';
  },

  async confirmarUpload() {
    const nome = $('docNome').value.trim();
    if (!nome) { showToast('Informe o nome do documento.', 'error'); return; }
    if (!this._arquivoPendente) { showToast('Nenhum arquivo selecionado.', 'error'); return; }

    const btn = $('docBtnEnviar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    const form = new FormData();
    form.append('file',       this._arquivoPendente);
    form.append('nome',       nome);
    form.append('categoria',  $('docCategoria').value.trim());
    form.append('descricao',  $('docDescricao').value.trim());
    form.append('criado_por', UserProfile.get().name || '');

    try {
      const d = await fetch('/api/documentos/upload', { method:'POST', body:form }).then(r => r.json());
      if (d.success) {
        showToast('Documento enviado com sucesso!', 'success');
        this.cancelarUpload();
        await this.load();
      } else {
        showToast(d.error || 'Erro ao enviar.', 'error');
      }
    } catch {
      showToast('Erro ao enviar o documento.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Enviar';
    }
  },

  async excluir(id, nome) {
    if (!confirm(`Excluir "${nome}"?\nEsta ação não pode ser desfeita.`)) return;
    try {
      const d = await fetch(`/api/documentos/${id}`, { method:'DELETE' }).then(r => r.json());
      if (d.success) {
        showToast('Documento excluído.', 'success');
        await this.load();
      } else {
        showToast(d.error || 'Erro ao excluir.', 'error');
      }
    } catch {
      showToast('Erro ao excluir o documento.', 'error');
    }
  },
};

// ── WORKHUB ───────────────────────────────────────────────────────────────
const WorkHub = {
  open() {
    // Mark workhub nav active
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const whNav = document.querySelector('.nav-item[data-view="workhub"]');
    if (whNav) whNav.classList.add('active');
    $('viewTitle').textContent = 'WorkHub';
    // Show last active tab or default to dashboard
    const last = localStorage.getItem('workhub_last_tab') || 'dashboard';
    this.switchTab(last, document.querySelector(`.wh-tab[data-view="${last}"]`));
  },

  switchTab(name, btn) {
    localStorage.setItem('workhub_last_tab', name);
    App.switchView(name);
    // sync tab button active state (switchView already does this via wh-tab selector)
  },
};

// ── MEU DESENVOLVIMENTO ───────────────────────────────────────────────────
const MeuDev = {
  _formacoes: [],
  _competencias: [],
  _perfil: null,
  _pdi: null,

  _storageKey() {
    const u = UserProfile.get();
    return 'meudev_' + (u.name || 'user').toLowerCase().replace(/\s+/g,'_');
  },
  _load() {
    try { return JSON.parse(localStorage.getItem(this._storageKey()) || '{}'); } catch { return {}; }
  },
  _save(data) {
    localStorage.setItem(this._storageKey(), JSON.stringify(data));
  },
  _getData() {
    const d = this._load();
    return {
      formacoes:    d.formacoes    || [],
      competencias: d.competencias || [],
      perfil:       d.perfil       || null,
      pdi:          d.pdi          || null,
    };
  },
  _setData(key, val) {
    const d = this._load();
    d[key] = val;
    this._save(d);
  },

  load() {
    const d = this._getData();
    this._formacoes    = d.formacoes;
    this._competencias = d.competencias;
    this._perfil       = d.perfil;
    this._pdi          = d.pdi;
    this._renderKpis();
    this._renderObjetivo();
    this._renderAndamento();
    this._renderFormacoes();
    this._renderCompetencias();
    this._renderPdi();
    this._renderConquistas();
  },

  switchTab(name, btn) {
    document.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dev-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
    const panel = document.getElementById('devTab-' + name);
    if (panel) panel.classList.add('active');
  },

  // ── KPIs ──
  _renderKpis() {
    const total    = this._formacoes.length;
    const andamento = this._formacoes.filter(f => f.status === 'em_andamento').length;
    const horas    = this._formacoes.reduce((s,f) => s + (parseInt(f.horas)||0), 0);
    const certs    = this._formacoes.filter(f => f.tipo === 'certificacao' && f.status === 'concluido').length;
    $('devKpiCursos').textContent   = total;
    $('devKpiAndamento').textContent = andamento;
    $('devKpiHoras').textContent    = horas + 'h';
    $('devKpiCert').textContent     = certs;
  },

  // ── OBJETIVO ──
  _renderObjetivo() {
    const p = this._perfil;
    const el = $('devObjetivoBody');
    if (!p || !p.cargoDesejado) {
      el.innerHTML = `<div class="dev-empty-inline">Defina seu objetivo profissional para orientar seu desenvolvimento. <button class="dev-link" onclick="MeuDev.editarObjetivo()">Configurar agora</button></div>`;
      return;
    }
    el.innerHTML = `
      <div class="dev-objetivo-grid">
        <div class="dev-objetivo-item"><label>Cargo Atual</label><span>${p.cargoAtual||'—'}</span></div>
        <div class="dev-objetivo-item"><label>Cargo Desejado</label><span>${p.cargoDesejado}</span></div>
        <div class="dev-objetivo-item"><label>Área de Interesse</label><span>${p.area||'—'}</span></div>
        <div class="dev-objetivo-item"><label>Prazo Estimado</label><span>${p.prazo||'—'}</span></div>
      </div>
      ${p.objetivo ? `<div class="dev-objetivo-full">${p.objetivo}</div>` : ''}`;
  },

  editarObjetivo() {
    const p = this._perfil || {};
    $('devObjCargoAtual').value    = p.cargoAtual    || '';
    $('devObjCargoDesejado').value = p.cargoDesejado || '';
    $('devObjArea').value          = p.area          || '';
    $('devObjTexto').value         = p.objetivo      || '';
    $('devObjPrazo').value         = p.prazo         || '';
    $('devObjetivoModal').style.display = 'flex';
  },
  fecharModalObjetivo() { $('devObjetivoModal').style.display = 'none'; },
  salvarObjetivo() {
    const p = {
      cargoAtual:    $('devObjCargoAtual').value.trim(),
      cargoDesejado: $('devObjCargoDesejado').value.trim(),
      area:          $('devObjArea').value.trim(),
      objetivo:      $('devObjTexto').value.trim(),
      prazo:         $('devObjPrazo').value.trim(),
    };
    this._perfil = p;
    this._setData('perfil', p);
    this._renderObjetivo();
    this.fecharModalObjetivo();
    showToast('Objetivo salvo!', 'success');
  },

  // ── ANDAMENTO (visão geral) ──
  _renderAndamento() {
    const el = $('devAndamentoList');
    const lista = this._formacoes.filter(f => f.status === 'em_andamento').slice(0, 4);
    if (!lista.length) {
      el.innerHTML = '<div class="dev-empty-inline">Nenhuma formação em andamento.</div>';
      return;
    }
    el.innerHTML = lista.map(f => {
      const perc = Math.min(100, Math.max(0, parseInt(f.perc)||0));
      const prev = f.prev ? `Previsão: ${f.prev}` : '';
      return `<div class="dev-andamento-item">
        <div class="dev-andamento-top">
          <span class="dev-andamento-nome">${f.titulo}</span>
          <span class="dev-andamento-meta">${prev}</span>
        </div>
        <div class="dev-andamento-bar"><div class="dev-andamento-fill" style="width:${perc}%"></div></div>
      </div>`;
    }).join('');
  },

  // ── FORMAÇÕES ──
  _tipoIcon(tipo) {
    const m = { graduacao:'🎓', pos:'🎓', mba:'🎓', mestrado:'🎓', doutorado:'🎓', certificacao:'🏅', idioma:'🌐', livro:'📖', mentoria:'🤝', workshop:'📋', academia_biosyn:'⭐', curso_interno:'🏢', curso_externo:'💻' };
    return m[tipo] || '📚';
  },
  _chipStatus(s) {
    const m = { planejado:'dev-chip-planejado', em_andamento:'dev-chip-andamento', concluido:'dev-chip-concluido', pausado:'dev-chip-pausado' };
    const lab = { planejado:'Planejado', em_andamento:'Em andamento', concluido:'Concluído', pausado:'Pausado' };
    return `<span class="dev-chip ${m[s]||''}">${lab[s]||s}</span>`;
  },
  _tipoLabel(t) {
    const m = { curso_interno:'Curso Interno', curso_externo:'Curso Externo', academia_biosyn:'Academia BioSyn', graduacao:'Graduação', pos:'Pós-graduação', mba:'MBA', mestrado:'Mestrado', doutorado:'Doutorado', tecnico:'Técnico', certificacao:'Certificação', idioma:'Idioma', workshop:'Workshop', livro:'Livro', mentoria:'Mentoria', outro:'Outro' };
    return m[t] || t;
  },
  _renderFormacoes(lista) {
    const el = $('devFormList');
    const data = lista || this._formacoes;
    if (!data.length) {
      el.innerHTML = `<div class="dev-empty-state"><i class="fa-solid fa-graduation-cap"></i><p>Nenhuma formação registrada ainda.</p><button class="btn-primary" onclick="MeuDev.novaFormacao()"><i class="fa-solid fa-plus"></i> Adicionar primeira formação</button></div>`;
      return;
    }
    el.innerHTML = data.map((f,i) => {
      const perc  = Math.min(100, Math.max(0, parseInt(f.perc)||0));
      const cor   = f.status === 'concluido' ? '#1A9B5C' : f.status === 'pausado' ? '#94A3B8' : '#099CD6';
      const sub   = [f.instituicao, f.horas ? f.horas+'h' : '', f.prev ? `Previsão: ${f.prev}` : ''].filter(Boolean).join(' · ');
      const idx   = this._formacoes.indexOf(f) >= 0 ? this._formacoes.indexOf(f) : i;
      return `<div class="dev-form-item">
        <div class="dev-form-icon">${this._tipoIcon(f.tipo)}</div>
        <div class="dev-form-body">
          <div class="dev-form-titulo">${f.titulo}</div>
          <div class="dev-form-sub">${sub}</div>
          ${f.status !== 'planejado' ? `<div class="dev-form-progress"><div class="dev-form-fill" style="width:${perc}%;background:${cor}"></div></div>` : ''}
          <div class="dev-form-tags">
            ${this._chipStatus(f.status)}
            <span class="dev-chip dev-chip-planejado" style="background:#F0F9FF;color:#0369A1">${this._tipoLabel(f.tipo)}</span>
            ${f.nivel ? `<span class="dev-chip" style="background:#F0FFF4;color:#166534">${f.nivel}</span>` : ''}
            ${f.url ? `<a href="${f.url}" target="_blank" class="dev-chip" style="background:#FFF7ED;color:#9A3412;text-decoration:none">🔗 Certificado</a>` : ''}
          </div>
        </div>
        <div class="dev-form-actions">
          <button class="dev-icon-btn" onclick="MeuDev.editarFormacao(${idx})" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="dev-icon-btn danger" onclick="MeuDev.excluirFormacao(${idx})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  },
  filtrarFormacoes() {
    const q    = ($('devFormSearch').value || '').toLowerCase();
    const tipo = $('devFormTipo').value;
    const st   = $('devFormStatus').value;
    const res  = this._formacoes.filter(f =>
      (!q    || f.titulo.toLowerCase().includes(q) || (f.instituicao||'').toLowerCase().includes(q)) &&
      (!tipo || f.tipo   === tipo) &&
      (!st   || f.status === st)
    );
    this._renderFormacoes(res);
  },

  // ── MODAL FORMAÇÃO ──
  ajustarCampos() {
    const tipo = $('devFTipo').value;
    $('devFGrupoNivel').style.display  = tipo === 'idioma'       ? 'flex' : 'none';
    $('devFGrupoCert').style.display   = tipo === 'certificacao' ? 'flex' : 'none';
    $('devFGrupoHoras').style.display  = tipo === 'livro'        ? 'none' : 'flex';
    $('devFGrupoPerc').style.display   = ['livro','mentoria'].includes(tipo) ? 'none' : 'flex';
  },
  novaFormacao() {
    $('devFormId').value   = '';
    $('devModalTitle').textContent = 'Nova Formação';
    $('devFTipo').value    = 'curso_externo';
    $('devFStatus').value  = 'em_andamento';
    $('devFTitulo').value  = '';
    $('devFInstituicao').value = '';
    $('devFHoras').value   = '';
    $('devFInicio').value  = '';
    $('devFPrev').value    = '';
    $('devFPerc').value    = '';
    $('devFNivel').value   = '';
    $('devFVencimento').value = '';
    $('devFUrl').value     = '';
    $('devFObs').value     = '';
    this.ajustarCampos();
    $('devFormModal').style.display = 'flex';
  },
  editarFormacao(idx) {
    const f = this._formacoes[idx];
    if (!f) return;
    $('devFormId').value   = idx;
    $('devModalTitle').textContent = 'Editar Formação';
    $('devFTipo').value    = f.tipo    || 'curso_externo';
    $('devFStatus').value  = f.status  || 'em_andamento';
    $('devFTitulo').value  = f.titulo  || '';
    $('devFInstituicao').value = f.instituicao || '';
    $('devFHoras').value   = f.horas   || '';
    $('devFInicio').value  = f.inicio  || '';
    $('devFPrev').value    = f.prev    || '';
    $('devFPerc').value    = f.perc    || '';
    $('devFNivel').value   = f.nivel   || '';
    $('devFVencimento').value = f.vencimento || '';
    $('devFUrl').value     = f.url     || '';
    $('devFObs').value     = f.obs     || '';
    this.ajustarCampos();
    this._limparEvidencia();
    if (f.url) {
      const isPdf = f.url.toLowerCase().includes('.pdf');
      const nome  = f.url.split('/').pop() || 'Ver arquivo';
      this._mostrarPreviewEvidencia(f.url, nome, isPdf);
    }
    $('devFormModal').style.display = 'flex';
  },
  _uploadEvidencia(input) {
    const file = input.files[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf';
    const isImg = file.type.startsWith('image/');
    if (!isPdf && !isImg) { showToast('Envie um PDF ou imagem (PNG, JPG, WEBP).', 'error'); input.value = ''; return; }
    const maxMb = 5;
    if (file.size > maxMb * 1024 * 1024) { showToast(`Arquivo muito grande. Máximo ${maxMb}MB.`, 'error'); input.value = ''; return; }

    const btn = input.closest('label');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    const form = new FormData();
    form.append('file', file);
    fetch('/api/guias/upload', { method: 'POST', body: form })
      .then(r => r.json())
      .then(d => {
        if (d.url) {
          $('devFUrl').value = d.url;
          this._mostrarPreviewEvidencia(d.url, file.name, isPdf);
          showToast('Arquivo enviado!', 'success');
        } else {
          showToast('Erro ao enviar arquivo.', 'error');
        }
      })
      .catch(() => showToast('Erro ao enviar arquivo.', 'error'))
      .finally(() => {
        btn.innerHTML = '<i class="fa-solid fa-paperclip"></i> Arquivo<input type="file" id="devFArquivo" accept=".pdf,.png,.jpg,.jpeg,.webp" style="display:none" onchange="MeuDev._uploadEvidencia(this)">';
      });
  },

  _mostrarPreviewEvidencia(url, nome, isPdf) {
    const prev = $('devFEvidenciaPreview');
    const icon = isPdf ? '📄' : '🖼';
    prev.style.display = 'block';
    prev.innerHTML = `<div class="dev-evidencia-preview">
      ${icon} <a href="${url}" target="_blank">${nome || 'Ver arquivo'}</a>
      <button class="dev-prev-remove" onclick="MeuDev._limparEvidencia()" title="Remover"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  },

  _limparEvidencia() {
    $('devFUrl').value = '';
    $('devFEvidenciaPreview').style.display = 'none';
    $('devFEvidenciaPreview').innerHTML = '';
  },

  fecharModal() {
    $('devFormModal').style.display = 'none';
    this._limparEvidencia();
  },
  salvarFormacao() {
    const titulo = $('devFTitulo').value.trim();
    if (!titulo) { showToast('Informe o nome da formação.', 'error'); return; }
    const f = {
      tipo:        $('devFTipo').value,
      status:      $('devFStatus').value,
      titulo,
      instituicao: $('devFInstituicao').value.trim(),
      horas:       $('devFHoras').value,
      inicio:      $('devFInicio').value,
      prev:        $('devFPrev').value,
      perc:        $('devFPerc').value || ($('devFStatus').value === 'concluido' ? '100' : '0'),
      nivel:       $('devFNivel').value,
      vencimento:  $('devFVencimento').value,
      url:         $('devFUrl').value.trim(),
      obs:         $('devFObs').value.trim(),
      criadoEm:    new Date().toISOString(),
    };
    const idxVal = $('devFormId').value;
    if (idxVal !== '') {
      this._formacoes[parseInt(idxVal)] = f;
    } else {
      this._formacoes.unshift(f);
    }
    this._setData('formacoes', this._formacoes);
    this.fecharModal();
    this._renderKpis();
    this._renderAndamento();
    this._renderFormacoes();
    this._renderConquistas();
    showToast('Formação salva!', 'success');
  },
  excluirFormacao(idx) {
    if (!confirm('Excluir esta formação?')) return;
    this._formacoes.splice(idx, 1);
    this._setData('formacoes', this._formacoes);
    this._renderKpis();
    this._renderAndamento();
    this._renderFormacoes();
    this._renderConquistas();
    showToast('Formação excluída.', 'success');
  },

  // ── COMPETÊNCIAS ──
  _renderCompetencias() {
    const tec  = this._competencias.filter(c => c.tipo === 'tecnica');
    const comp = this._competencias.filter(c => c.tipo === 'comportamental');
    const renderList = (lista, elId) => {
      const el = $(elId);
      if (!lista.length) { el.innerHTML = '<div class="dev-comp-empty">Nenhuma registrada ainda.</div>'; return; }
      el.innerHTML = lista.map((c,i) => {
        const realIdx = this._competencias.indexOf(c);
        const labNivel = {basico:'Básico',intermediario:'Intermediário',avancado:'Avançado',especialista:'Especialista'};
        return `<div class="dev-comp-item">
          <span class="dev-comp-name">${c.nome}</span>
          <span class="dev-comp-nivel nivel-${c.nivel}">${labNivel[c.nivel]||c.nivel}</span>
          <button class="dev-icon-btn danger" onclick="MeuDev.excluirCompetencia(${realIdx})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      }).join('');
    };
    renderList(tec, 'devCompTec');
    renderList(comp, 'devCompComp');
  },
  novaCompetencia() { $('devCNome').value=''; $('devCTipo').value='tecnica'; $('devCNivel').value='intermediario'; $('devCompModal').style.display='flex'; },
  fecharModalComp() { $('devCompModal').style.display='none'; },
  salvarCompetencia() {
    const nome = $('devCNome').value.trim();
    if (!nome) { showToast('Informe o nome da competência.', 'error'); return; }
    this._competencias.push({ nome, tipo: $('devCTipo').value, nivel: $('devCNivel').value });
    this._setData('competencias', this._competencias);
    this.fecharModalComp();
    this._renderCompetencias();
    showToast('Competência adicionada!', 'success');
  },
  excluirCompetencia(idx) {
    this._competencias.splice(idx, 1);
    this._setData('competencias', this._competencias);
    this._renderCompetencias();
  },

  // ── PDI ──
  _renderPdi() {
    const el = $('devPdiBody');
    const p  = this._pdi;
    if (!p) {
      el.innerHTML = `<div class="dev-empty-state"><i class="fa-solid fa-bullseye"></i><p>Seu Plano de Desenvolvimento Individual ainda não foi criado.</p><button class="btn-primary" onclick="MeuDev.criarPdi()"><i class="fa-solid fa-plus"></i> Criar PDI</button></div>`;
      return;
    }
    const metas = [
      { prazo: 'Curto Prazo', texto: p.curto },
      { prazo: 'Médio Prazo', texto: p.medio },
      { prazo: 'Longo Prazo', texto: p.longo },
    ].filter(m => m.texto);
    el.innerHTML = `
      <div class="dev-pdi-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="font-size:14px;font-weight:700;color:var(--navy);margin:0">Plano de Desenvolvimento Individual</h3>
          <button class="dev-btn-edit" onclick="MeuDev.criarPdi()"><i class="fa-solid fa-pen"></i> Editar</button>
        </div>
        <div class="dev-pdi-meta-list">
          ${metas.map(m => `<div class="dev-pdi-meta"><span class="dev-pdi-meta-prazo">${m.prazo}</span><span class="dev-pdi-meta-texto">${m.texto}</span></div>`).join('')}
        </div>
        ${p.obs ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100);font-size:13px;color:var(--gray-500)">${p.obs}</div>` : ''}
      </div>`;
  },
  criarPdi() {
    const p = this._pdi || {};
    const html = `<div class="dev-modal-overlay" id="devPdiModal" onclick="if(event.target===this)MeuDev._fecharPdiModal()" style="display:flex">
      <div class="dev-modal" style="max-width:500px">
        <div class="dev-modal-header"><h3>Plano de Desenvolvimento Individual</h3><button class="dev-modal-close" onclick="MeuDev._fecharPdiModal()"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="dev-modal-body">
          <div class="dev-form-group"><label class="dev-label">Meta de Curto Prazo (6 meses)</label><textarea class="dev-input" id="devPdiCurto" rows="2" placeholder="O que quero alcançar nos próximos 6 meses...">${p.curto||''}</textarea></div>
          <div class="dev-form-group"><label class="dev-label">Meta de Médio Prazo (1 ano)</label><textarea class="dev-input" id="devPdiMedio" rows="2" placeholder="Objetivo para os próximos 12 meses...">${p.medio||''}</textarea></div>
          <div class="dev-form-group"><label class="dev-label">Meta de Longo Prazo (3 anos)</label><textarea class="dev-input" id="devPdiLongo" rows="2" placeholder="Onde quero estar em 3 anos...">${p.longo||''}</textarea></div>
          <div class="dev-form-group"><label class="dev-label">Observações</label><textarea class="dev-input" id="devPdiObs" rows="2" placeholder="Pontos de atenção, forças, suporte necessário...">${p.obs||''}</textarea></div>
        </div>
        <div class="dev-modal-footer">
          <button class="dev-btn-cancel" onclick="MeuDev._fecharPdiModal()">Cancelar</button>
          <button class="btn-primary" onclick="MeuDev._salvarPdi()"><i class="fa-solid fa-floppy-disk"></i> Salvar PDI</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },
  _fecharPdiModal() { document.getElementById('devPdiModal')?.remove(); },
  _salvarPdi() {
    this._pdi = {
      curto: $('devPdiCurto').value.trim(),
      medio: $('devPdiMedio').value.trim(),
      longo: $('devPdiLongo').value.trim(),
      obs:   $('devPdiObs').value.trim(),
      atualizadoEm: new Date().toISOString(),
    };
    this._setData('pdi', this._pdi);
    this._fecharPdiModal();
    this._renderPdi();
    showToast('PDI salvo!', 'success');
  },

  // ── CONQUISTAS ──
  _renderConquistas() {
    const badges = [
      { icon:'🎓', nome:'Primeiro Diploma', desc:'Conclua sua primeira formação acadêmica',    check: () => this._formacoes.some(f => ['graduacao','pos','mba','mestrado','doutorado'].includes(f.tipo) && f.status==='concluido') },
      { icon:'⚡', nome:'5 Cursos',         desc:'Registre 5 cursos concluídos',               check: () => this._formacoes.filter(f=>f.status==='concluido').length >= 5 },
      { icon:'🔥', nome:'100 Horas',        desc:'Acumule 100h de capacitação',                check: () => this._formacoes.reduce((s,f)=>s+(parseInt(f.horas)||0),0) >= 100 },
      { icon:'🌐', nome:'Multilíngue',      desc:'Registre 2 ou mais idiomas',                 check: () => this._formacoes.filter(f=>f.tipo==='idioma').length >= 2 },
      { icon:'🏅', nome:'Certificado',      desc:'Obtenha uma certificação válida',             check: () => this._formacoes.some(f=>f.tipo==='certificacao'&&f.status==='concluido') },
      { icon:'📖', nome:'Leitor Ativo',     desc:'Registre 3 livros lidos',                    check: () => this._formacoes.filter(f=>f.tipo==='livro'&&f.status==='concluido').length >= 3 },
      { icon:'🎯', nome:'PDI Completo',     desc:'Preencha todas as metas do PDI',             check: () => !!(this._pdi?.curto && this._pdi?.medio && this._pdi?.longo) },
      { icon:'🤝', nome:'Mentor',           desc:'Registre uma mentoria como mentor',           check: () => this._formacoes.some(f=>f.tipo==='mentoria') },
    ];
    const el = $('devConquistasList');
    el.innerHTML = badges.map(b => {
      const unlocked = b.check();
      return `<div class="dev-badge ${unlocked?'unlocked':'locked'}">
        <div class="dev-badge-icon">${b.icon}</div>
        <div class="dev-badge-name">${b.nome}</div>
        <div class="dev-badge-desc">${unlocked ? '<strong style="color:#107040">Desbloqueado!</strong>' : b.desc}</div>
      </div>`;
    }).join('');
  },
};

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  UserProfile.check();
  App.init();
});
