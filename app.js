// ==============================================
//  CONTROLE FINANCEIRO — App principal
// ==============================================

const DEFAULT_DATA = {
  settings: {
    appName: 'Controle Financeiro',
    appSubtitle: 'Controle financeiro familiar',
    accentColor: '#2563eb',
    logoLetter: 'C',
  },
  expenses: [],
  incomes: [],
  cards: [
    { id: 'card-1', name: 'Nubank', color: '#820ad1', closingDay: 25, dueDay: 5 },
  ],
  cardPurchases: [],
  paidInvoices: {},
  expenseCategories: [
    { id: 'cat-1', name: 'Moradia', color: '#2563eb' },
    { id: 'cat-2', name: 'Alimentação', color: '#059669' },
    { id: 'cat-3', name: 'Transporte', color: '#d97706' },
    { id: 'cat-4', name: 'Saúde', color: '#dc2626' },
    { id: 'cat-5', name: 'Educação', color: '#7c3aed' },
    { id: 'cat-6', name: 'Lazer', color: '#db2777' },
    { id: 'cat-7', name: 'Vestuário', color: '#0891b2' },
    { id: 'cat-8', name: 'Contas (Água, Luz, Internet)', color: '#ca8a04' },
    { id: 'cat-9', name: 'Outros', color: '#64748b' },
  ],
  incomeCategories: [
    { id: 'inc-1', name: 'Salário', color: '#059669' },
    { id: 'inc-2', name: 'Freelance', color: '#2563eb' },
    { id: 'inc-3', name: 'Investimentos', color: '#7c3aed' },
    { id: 'inc-4', name: 'Outros', color: '#64748b' },
  ],
  paymentMethods: [
    { id: 'pm-1', name: 'Dinheiro' },
    { id: 'pm-2', name: 'PIX' },
    { id: 'pm-3', name: 'Cartão de Débito' },
    { id: 'pm-4', name: 'Transferência' },
  ],
  budgets: {},
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let ui = {
  tab: 'dashboard',
  settingsTab: 'personalize',
  selectedMonth: new Date().toISOString().slice(0, 7),
  search: '',
  filterCat: 'all',
};

// ==============================================
//  UTILS
// ==============================================
const formatBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseBRLInput = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const c = String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(c) || 0;
};
const formatDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (iso) => iso ? iso.slice(0, 7) : '';
const monthLabel = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${meses[parseInt(m, 10) - 1]} de ${y}`;
};
const monthShort = (key) => {
  const [y, m] = key.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(m, 10) - 1]}`;
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Máscara de moeda automática
function formatMoneyInput(value) {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function applyMoneyMask(input) {
  const digits = (input.value || '').replace(/\D/g, '');
  input.value = formatMoneyInput(digits);
  if (typeof updateInstallmentPreview === 'function') updateInstallmentPreview();
}

function initMoneyInputs(container) {
  const inputs = (container || document).querySelectorAll('.money-input');
  inputs.forEach(input => {
    if (input.value && !isNaN(Number(input.value))) {
      const num = Number(input.value);
      if (num > 0) input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    input.addEventListener('input', () => applyMoneyMask(input));
    input.setAttribute('inputmode', 'numeric');
  });
}

// Cálculos de fatura
function getInvoiceMonthForPurchase(purchaseDate, closingDay) {
  const [y, m, d] = purchaseDate.split('-').map(Number);
  if (d <= closingDay) return `${y}-${String(m).padStart(2, '0')}`;
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(mk, delta) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCardInstallments(card) {
  const result = [];
  state.cardPurchases.forEach(p => {
    if (p.cardId !== card.id) return;
    const baseInvoiceMonth = getInvoiceMonthForPurchase(p.date, card.closingDay);
    const n = p.installments || 1;
    const valuePerInstallment = p.amount / n;
    for (let i = 0; i < n; i++) {
      result.push({
        purchaseId: p.id, installmentIndex: i + 1, installmentTotal: n,
        cardId: p.cardId, date: p.date, description: p.description,
        amountTotal: p.amount, amount: valuePerInstallment,
        invoiceMonth: addMonths(baseInvoiceMonth, i),
        categoryId: p.categoryId, notes: p.notes,
      });
    }
  });
  return result;
}

function getInvoice(card, mk) {
  const installments = getCardInstallments(card).filter(i => i.invoiceMonth === mk);
  const total = installments.reduce((s, i) => s + i.amount, 0);
  const paidKey = `${card.id}:${mk}`;
  const isPaid = !!state.paidInvoices[paidKey];
  return { installments, total, isPaid, paidInfo: state.paidInvoices[paidKey] };
}

function lighten(hex, percent) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  const lg = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  const lb = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

function getAllExpensesForMonth(targetMonth) {
  const result = [];
  state.expenses.forEach(e => {
    if (monthKey(e.date) === targetMonth) {
      result.push({
        id: e.id, kind: 'cash', date: e.date, description: e.description,
        amount: Number(e.amount), categoryId: e.categoryId,
        paymentMethodId: e.paymentMethodId, notes: e.notes,
      });
    }
  });
  state.cardPurchases.forEach(p => {
    const card = state.cards.find(c => c.id === p.cardId);
    if (!card) return;
    const baseInvoiceMonth = getInvoiceMonthForPurchase(p.date, card.closingDay);
    const n = p.installments || 1;
    const valuePerInstallment = Number(p.amount) / n;
    for (let i = 0; i < n; i++) {
      const invMonth = addMonths(baseInvoiceMonth, i);
      if (invMonth === targetMonth) {
        result.push({
          id: p.id, kind: 'card', date: p.date, description: p.description,
          amount: valuePerInstallment, amountTotal: Number(p.amount),
          categoryId: p.categoryId, cardId: p.cardId,
          cardName: card.name, cardColor: card.color,
          installmentIndex: i + 1, installmentTotal: n,
          notes: p.notes, invoiceMonth: invMonth,
        });
      }
    }
  });
  return result;
}

// ==============================================
//  AUTENTICAÇÃO + SINCRONIZAÇÃO (FIREBASE)
// ==============================================
let currentUser = null;
let workspaceId = null;
let unsubscribeData = null;
let isFirebaseConfigured = true;

function showAuthScreen() {
  document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:20px;background:var(--bg)">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:32px 28px;max-width:420px;width:100%;box-shadow:var(--shadow-md)">
        <div style="text-align:center;margin-bottom:24px">
          <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 70%,white));color:white;display:grid;place-items:center;font-size:28px;font-weight:700;margin:0 auto 14px;box-shadow:0 4px 16px color-mix(in srgb,var(--accent) 35%,transparent)">${escapeHtml(state.settings.logoLetter)}</div>
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.4px">${escapeHtml(state.settings.appName)}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px">${escapeHtml(state.settings.appSubtitle)}</div>
        </div>
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px">
          <button onclick="setAuthMode('login')" id="auth-tab-login" style="flex:1;padding:10px;background:transparent;border:none;border-bottom:2px solid var(--accent);color:var(--accent);font-weight:600;cursor:pointer">Entrar</button>
          <button onclick="setAuthMode('signup')" id="auth-tab-signup" style="flex:1;padding:10px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-weight:600;cursor:pointer">Criar conta</button>
        </div>
        <div id="auth-error" style="display:none;background:var(--danger-soft);color:var(--danger);padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:14px"></div>
        <form id="auth-form" onsubmit="submitAuth(event)">
          <div class="form-grid">
            <div class="field full">
              <label class="field-label">E-mail</label>
              <input class="input" type="email" name="email" required autocomplete="email" placeholder="seu@email.com" />
            </div>
            <div class="field full">
              <label class="field-label">Senha</label>
              <input class="input" type="password" name="password" required minlength="6" autocomplete="current-password" placeholder="Mínimo 6 caracteres" />
            </div>
            <div class="field full">
              <button type="submit" class="btn" style="width:100%" id="auth-submit">Entrar</button>
            </div>
            <div class="field full" style="text-align:center">
              <button type="button" onclick="resetPassword()" class="link-btn" style="font-size:12px">Esqueci a senha</button>
            </div>
          </div>
        </form>
        <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);line-height:1.6;text-align:center">
          Seus dados ficam protegidos na nuvem.<br/>Acesse de qualquer dispositivo e compartilhe com a família.
        </div>
      </div>
    </div>
  `;
}

let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('auth-tab-login').style.borderBottomColor = mode === 'login' ? 'var(--accent)' : 'transparent';
  document.getElementById('auth-tab-login').style.color = mode === 'login' ? 'var(--accent)' : 'var(--muted)';
  document.getElementById('auth-tab-signup').style.borderBottomColor = mode === 'signup' ? 'var(--accent)' : 'transparent';
  document.getElementById('auth-tab-signup').style.color = mode === 'signup' ? 'var(--accent)' : 'var(--muted)';
  document.getElementById('auth-submit').textContent = mode === 'signup' ? 'Criar minha conta' : 'Entrar';
  document.getElementById('auth-error').style.display = 'none';
}

async function submitAuth(ev) {
  ev.preventDefault();
  const f = ev.target;
  const email = f.email.value.trim();
  const pwd = f.password.value;
  const errorEl = document.getElementById('auth-error');
  errorEl.style.display = 'none';
  try {
    if (authMode === 'signup') {
      await window.fbFns.createUserWithEmailAndPassword(window.fbAuth, email, pwd);
    } else {
      await window.fbFns.signInWithEmailAndPassword(window.fbAuth, email, pwd);
    }
  } catch (e) {
    errorEl.style.display = 'block';
    errorEl.textContent = traduzirErroFirebase(e.code) || e.message;
  }
}

async function resetPassword() {
  const email = document.querySelector('input[name="email"]').value.trim();
  if (!email) { toast('Digite seu e-mail primeiro', 'error'); return; }
  try {
    await window.fbFns.sendPasswordResetEmail(window.fbAuth, email);
    toast('E-mail de redefinição enviado!');
  } catch (e) {
    toast(traduzirErroFirebase(e.code) || 'Erro ao enviar', 'error');
  }
}

function traduzirErroFirebase(code) {
  const m = {
    'auth/invalid-email': 'E-mail inválido',
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/invalid-credential': 'E-mail ou senha incorretos',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado',
    'auth/weak-password': 'Senha muito fraca (use no mínimo 6 caracteres)',
    'auth/network-request-failed': 'Sem conexão com a internet',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos',
    'auth/api-key-not-valid': '⚠️ Configure as credenciais Firebase no index.html',
  };
  return m[code];
}

async function logout() {
  if (!confirm('Sair da sua conta?')) return;
  if (unsubscribeData) { unsubscribeData(); unsubscribeData = null; }
  await window.fbFns.signOut(window.fbAuth);
}

function hideInitialLoading() {
  const el = document.getElementById('initial-loading');
  if (el) el.remove();
}

function setupAuthListener() {
  // Caso 1: Firebase NÃO configurado (apiKey ainda é o placeholder)
  if (window.FIREBASE_NAO_CONFIGURADO) {
    isFirebaseConfigured = false;
    showFirebaseNotConfiguredScreen();
    return;
  }
  // Caso 2: Erro ao carregar Firebase (rede, etc.)
  if (window.FIREBASE_ERRO_CARGA) {
    showFirebaseLoadError(window.FIREBASE_ERRO_CARGA);
    return;
  }
  // Caso 3: Firebase carregou mas algo deu errado
  if (!window.fbAuth || !window.fbFns) {
    showFirebaseLoadError('Firebase não inicializou corretamente. Verifique sua conexão e recarregue a página.');
    return;
  }

  // Tudo OK: ativa listener de autenticação
  window.fbFns.onAuthStateChanged(window.fbAuth, async (user) => {
    try {
      if (user) {
        currentUser = user;
        await loadOrCreateWorkspace();
        subscribeToData();
      } else {
        currentUser = null;
        workspaceId = null;
        hideInitialLoading();
        showAuthScreen();
      }
    } catch (e) {
      console.error('Erro no auth listener:', e);
      hideInitialLoading();
      showFirebaseLoadError('Erro ao conectar com o Firebase: ' + (e.message || e.code || 'desconhecido'));
    }
  });
}

function showFirebaseNotConfiguredScreen() {
  hideInitialLoading();
  document.getElementById('app').innerHTML = `
    <div class="error-screen">
      <div class="error-card">
        <div style="font-size:48px;text-align:center;margin-bottom:12px">🔧</div>
        <h1 style="text-align:center">Configuração Pendente</h1>
        <p style="text-align:center">
          Você precisa configurar suas credenciais do Firebase antes de usar o app pela primeira vez.
        </p>
        <div class="error-steps">
          <strong>📋 O que fazer:</strong>
          <ol>
            <li>Abra o arquivo <code>TUTORIAL.md</code> que veio junto</li>
            <li>Siga as <strong>Partes 1 a 5</strong> para criar seu projeto no Firebase (grátis)</li>
            <li>Copie as credenciais do Firebase para o arquivo <code>index.html</code></li>
            <li>Suba a versão atualizada no GitHub</li>
            <li>Aguarde 1-2 minutos e recarregue esta página</li>
          </ol>
        </div>
        <p style="margin-top:16px;font-size:12px;text-align:center">
          ⚙️ Após configurar, esta tela será substituída pela tela de login automaticamente.
        </p>
      </div>
    </div>
  `;
}

function showFirebaseLoadError(msg) {
  hideInitialLoading();
  document.getElementById('app').innerHTML = `
    <div class="error-screen">
      <div class="error-card" style="border-color:var(--danger)">
        <div style="font-size:48px;text-align:center;margin-bottom:12px">⚠️</div>
        <h1 style="text-align:center;color:var(--danger)">Erro ao conectar com o Firebase</h1>
        <p style="text-align:center"><code>${escapeHtml(msg)}</code></p>
        <div class="error-steps">
          <strong>🔍 Possíveis causas:</strong>
          <ol>
            <li>Sem conexão com a internet — verifique seu Wi-Fi/dados</li>
            <li>Credenciais Firebase incorretas no <code>index.html</code></li>
            <li>Authentication não foi ativada no console Firebase</li>
            <li>Regras do Firestore não foram publicadas</li>
          </ol>
          <p style="margin-top:8px"><strong>Solução:</strong> verifique cada passo do <code>TUTORIAL.md</code> e tente novamente.</p>
        </div>
        <div style="text-align:center;margin-top:16px">
          <button onclick="location.reload()" class="btn">Tentar novamente</button>
        </div>
      </div>
    </div>
  `;
}

async function loadOrCreateWorkspace() {
  const userDocRef = window.fbFns.doc(window.fbDb, 'users', currentUser.uid);
  const userSnap = await window.fbFns.getDoc(userDocRef);
  if (userSnap.exists() && userSnap.data().workspaceId) {
    workspaceId = userSnap.data().workspaceId;
  } else {
    workspaceId = currentUser.uid;
    await window.fbFns.setDoc(userDocRef, {
      email: currentUser.email,
      workspaceId: workspaceId,
      createdAt: window.fbFns.serverTimestamp(),
    });
    const wsRef = window.fbFns.doc(window.fbDb, 'workspaces', workspaceId);
    await window.fbFns.setDoc(wsRef, {
      ownerId: currentUser.uid,
      name: 'Minha família',
      members: [currentUser.uid],
      createdAt: window.fbFns.serverTimestamp(),
      data: DEFAULT_DATA,
    });
  }
}

function subscribeToData() {
  const wsRef = window.fbFns.doc(window.fbDb, 'workspaces', workspaceId);
  unsubscribeData = window.fbFns.onSnapshot(wsRef, (snap) => {
    if (!snap.exists()) return;
    const ws = snap.data();
    if (ws.data) {
      state = {
        ...DEFAULT_DATA,
        ...ws.data,
        settings: { ...DEFAULT_DATA.settings, ...(ws.data.settings || {}) },
      };
    }
    render();
  });
}

let saveTimer = null;
function save() {
  if (!workspaceId) return;
  showSaving();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const wsRef = window.fbFns.doc(window.fbDb, 'workspaces', workspaceId);
      await window.fbFns.setDoc(wsRef, { data: state, updatedAt: window.fbFns.serverTimestamp() }, { merge: true });
      hideSaving();
    } catch (e) {
      console.error(e);
      toast('Erro ao salvar — sem conexão?', 'error');
      hideSaving();
    }
  }, 400);
}

function openShareWorkspace() {
  showModal({
    title: 'Compartilhar com a família',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);border-radius:10px;padding:14px;font-size:13px;line-height:1.6">
          Para compartilhar suas finanças com outra pessoa, peça pra ela criar uma conta e usar o <strong>código abaixo</strong> em "Entrar com código".
        </div>
        <div class="field full">
          <label class="field-label">Código da sua família</label>
          <div style="display:flex;gap:8px">
            <input class="input" type="text" value="${escapeHtml(workspaceId)}" readonly id="ws-code" style="font-family:monospace;font-size:13px" />
            <button class="btn" onclick="copyWorkspaceCode()">Copiar</button>
          </div>
          <span class="field-hint">⚠️ Quem tiver este código terá acesso total às suas finanças</span>
        </div>
        <div class="form-foot">
          <button type="button" class="btn ghost" onclick="closeModal()">Fechar</button>
        </div>
      </div>
    `,
  });
}

function copyWorkspaceCode() {
  const inp = document.getElementById('ws-code');
  inp.select();
  navigator.clipboard.writeText(inp.value).then(() => toast('Código copiado!')).catch(() => toast('Selecione e copie manualmente', 'error'));
}

function openJoinWorkspace() {
  showModal({
    title: 'Entrar em uma família',
    body: `
      <form onsubmit="submitJoinWorkspace(event)">
        <div style="background:var(--warning-soft);border:1px solid color-mix(in srgb,var(--warning) 25%,transparent);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;margin-bottom:14px">
          ⚠️ Ao entrar em outra família, seus dados atuais ficam separados.
        </div>
        <div class="form-grid">
          <div class="field full">
            <label class="field-label">Código da família</label>
            <input class="input" type="text" name="code" required placeholder="Cole aqui o código compartilhado" style="font-family:monospace" />
          </div>
          <div class="form-foot">
            <button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn">Entrar nesta família</button>
          </div>
        </div>
      </form>
    `,
  });
}

async function submitJoinWorkspace(ev) {
  ev.preventDefault();
  const code = ev.target.code.value.trim();
  if (!code || code === workspaceId) { toast('Código inválido', 'error'); return; }
  try {
    const wsRef = window.fbFns.doc(window.fbDb, 'workspaces', code);
    const snap = await window.fbFns.getDoc(wsRef);
    if (!snap.exists()) { toast('Família não encontrada', 'error'); return; }
    if (!confirm('Tem certeza que deseja entrar nesta família?')) return;
    const ws = snap.data();
    const members = Array.from(new Set([...(ws.members || []), currentUser.uid]));
    await window.fbFns.setDoc(wsRef, { members }, { merge: true });
    const userRef = window.fbFns.doc(window.fbDb, 'users', currentUser.uid);
    await window.fbFns.setDoc(userRef, { workspaceId: code }, { merge: true });
    if (unsubscribeData) unsubscribeData();
    workspaceId = code;
    subscribeToData();
    closeModal();
    toast('Você agora faz parte desta família!');
  } catch (e) {
    console.error(e);
    toast('Erro ao entrar na família', 'error');
  }
}

// ==============================================
//  TOAST + SAVING
// ==============================================
function toast(msg, type = 'success') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' : '<polyline points="20 6 9 17 4 12"/>'}</svg> ${escapeHtml(msg)}`;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function showSaving() {
  const el = document.getElementById('saving-indicator');
  if (el) el.classList.remove('hidden');
}
function hideSaving() {
  const el = document.getElementById('saving-indicator');
  if (el) el.classList.add('hidden');
}

// ==============================================
//  ÍCONES
// ==============================================
const icons = {
  dashboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  expenses: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  incomes: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>',
  card: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  pencil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  arrowUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 17 17 7"/><polyline points="7 7 17 7 17 17"/></svg>',
  arrowDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 7 7 17"/><polyline points="17 17 7 17 7 7"/></svg>',
  wallet: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  tag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  target: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  palette: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.946.756-1.687 1.688-1.687h1.997c3.103 0 5.542-2.547 5.542-5.625C22 6.072 17.523 2 12 2z"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

// ==============================================
//  RENDER
// ==============================================
function applyTheme() {
  document.documentElement.style.setProperty('--accent', state.settings.accentColor);
  document.documentElement.style.setProperty('--accent-hover', lighten(state.settings.accentColor, -15));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.settings.accentColor);
  document.title = state.settings.appName;
}

function render() {
  hideInitialLoading();
  applyTheme();
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <div class="brand-mark">${escapeHtml(state.settings.logoLetter)}</div>
          <div class="brand-text">
            <div class="brand-title">${escapeHtml(state.settings.appName)}</div>
            <div class="brand-sub">${escapeHtml(state.settings.appSubtitle)}</div>
          </div>
        </div>
        <div class="header-right">
          <span id="saving-indicator" class="pill saving hidden">Salvando…</span>
          <span class="pill">Sincronizado</span>
          <div class="month-picker">
            <button class="month-btn" onclick="changeMonth(-1)" aria-label="Mês anterior">‹</button>
            <span class="month-label">${monthLabel(ui.selectedMonth)}</span>
            <button class="month-btn" onclick="changeMonth(1)" aria-label="Próximo mês">›</button>
          </div>
        </div>
      </div>
      <nav class="nav">
        ${navTab('dashboard', icons.dashboard, 'Painel')}
        ${navTab('expenses', icons.expenses, 'Despesas')}
        ${navTab('incomes', icons.incomes, 'Receitas')}
        ${navTab('cards', icons.card, 'Cartões')}
        ${navTab('settings', icons.settings, 'Configurações')}
      </nav>
    </header>
    <main>${renderTab()}</main>
    <footer>Seus dados são salvos na nuvem · Sincronizados em tempo real</footer>
    <nav class="bottom-nav">
      ${bottomTab('dashboard', icons.dashboard, 'Painel')}
      ${bottomTab('expenses', icons.expenses, 'Despesas')}
      ${bottomTab('incomes', icons.incomes, 'Receitas')}
      ${bottomTab('cards', icons.card, 'Cartões')}
      ${bottomTab('settings', icons.settings, 'Ajustes')}
    </nav>
  `;
  const fab = document.getElementById('fab');
  fab.style.display = ['expenses', 'incomes', 'cards'].includes(ui.tab) ? '' : 'none';
  attachChartListeners();
  initMoneyInputs(document.querySelector('main'));
}

function navTab(id, icon, label) {
  const active = ui.tab === id ? ' active' : '';
  return `<button class="nav-tab${active}" onclick="setTab('${id}')">${icon} ${label}</button>`;
}

function bottomTab(id, icon, label) {
  const active = ui.tab === id ? ' active' : '';
  return `<button class="bottom-nav-item${active}" onclick="setTab('${id}')"><span>${icon.replace('width="14" height="14"', 'width="22" height="22"')}</span><span>${label}</span></button>`;
}

function renderTab() {
  switch (ui.tab) {
    case 'dashboard': return renderDashboard();
    case 'expenses': return renderExpenses();
    case 'incomes': return renderIncomes();
    case 'cards': return renderCards();
    case 'settings': return renderSettings();
    default: return '';
  }
}

function setTab(t) { ui.tab = t; window.scrollTo(0, 0); render(); }
function setSettingsTab(t) { ui.settingsTab = t; render(); }

function changeMonth(delta) {
  const [y, m] = ui.selectedMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  ui.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
}

function onFabClick() {
  if (ui.tab === 'expenses') openExpenseForm();
  else if (ui.tab === 'incomes') openIncomeForm();
  else if (ui.tab === 'cards') openExpenseFormForCard();
}

// ==============================================
//  DASHBOARD
// ==============================================
function renderDashboard() {
  const m = ui.selectedMonth;
  const allExpenses = getAllExpensesForMonth(m);
  const monthIncomes = state.incomes.filter(e => monthKey(e.date) === m);
  const totalExp = allExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalInc = monthIncomes.reduce((s, e) => s + Number(e.amount), 0);
  const cardExpenses = allExpenses.filter(e => e.kind === 'card');
  const totalCard = cardExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalInc - totalExp;

  const byCat = {};
  allExpenses.forEach(e => { byCat[e.categoryId] = (byCat[e.categoryId] || 0) + Number(e.amount); });
  const catData = state.expenseCategories
    .map(c => ({ ...c, value: byCat[c.id] || 0 }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const trend = [];
  const [yy, mm] = m.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(yy, mm - 1 - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const exp = getAllExpensesForMonth(k).reduce((s, e) => s + Number(e.amount), 0);
    const inc = state.incomes.filter(e => monthKey(e.date) === k).reduce((s, e) => s + Number(e.amount), 0);
    trend.push({ label: monthShort(k), inc, exp });
  }
  const maxTrend = Math.max(1, ...trend.flatMap(t => [t.inc, t.exp]));

  const recent = [
    ...allExpenses.map(e => ({ ...e, _kind: 'exp' })),
    ...monthIncomes.map(e => ({ ...e, _kind: 'inc' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const budgets = state.expenseCategories
    .filter(c => state.budgets[c.id])
    .map(c => {
      const spent = allExpenses.filter(e => e.categoryId === c.id).reduce((s, e) => s + Number(e.amount), 0);
      const limit = state.budgets[c.id];
      return { ...c, spent, limit, pct: Math.min(100, (spent / limit) * 100) };
    });

  return `
    <div class="view-wrap">
      <div class="section-header">
        <div>
          <div class="kicker">Visão geral</div>
          <h1>${monthLabel(m)}</h1>
          <p class="subtitle">Resumo financeiro do período selecionado</p>
        </div>
      </div>
      <div class="stats-grid">
        ${statCard('Receitas', formatBRL(totalInc), 'up', icons.arrowUp, `${monthIncomes.length} lanç.`, 'success')}
        ${statCard('Despesas total', formatBRL(totalExp), 'down', icons.arrowDown, `${allExpenses.length} lanç.`, 'danger')}
        ${statCard('No cartão', formatBRL(totalCard), 'card', icons.card, `${cardExpenses.length} compra${cardExpenses.length === 1 ? '' : 's'}`, 'purple')}
        ${statCard('Saldo', formatBRL(balance), 'balance', icons.wallet, balance >= 0 ? 'no azul' : 'no vermelho', balance >= 0 ? 'success' : 'danger')}
      </div>
      <div class="two-col">
        <div class="panel">
          <div class="panel-head">
            <div><div class="panel-kicker">Distribuição</div><div class="panel-title">Despesas por categoria</div></div>
          </div>
          ${catData.length === 0
            ? `<div class="empty"><div class="empty-text">Nenhuma despesa neste mês</div><button class="btn" onclick="setTab('expenses')">${icons.plus} Cadastrar</button></div>`
            : `<div class="pie-row">
                <div class="chart-box"><canvas id="catChart"></canvas></div>
                <div class="legend-list">
                  ${catData.slice(0, 6).map(c => `
                    <div class="legend-item">
                      <span class="legend-dot" style="background:${c.color}"></span>
                      <span class="legend-name">${escapeHtml(c.name)}</span>
                      <span class="legend-value">${formatBRL(c.value)}</span>
                    </div>`).join('')}
                </div>
              </div>`
          }
        </div>
        <div class="panel">
          <div class="panel-head"><div><div class="panel-kicker">Histórico</div><div class="panel-title">Últimos 6 meses</div></div></div>
          <div class="bars">
            ${trend.map(t => `
              <div class="bar-group">
                <div class="bar-pair">
                  <div class="bar" title="Receitas: ${formatBRL(t.inc)}" style="height:${(t.inc / maxTrend) * 100}%"></div>
                  <div class="bar down" title="Despesas: ${formatBRL(t.exp)}" style="height:${(t.exp / maxTrend) * 100}%"></div>
                </div>
                <div class="bar-label">${t.label}</div>
              </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:center;gap:18px;margin-top:14px;font-size:12px;color:var(--muted);">
            <span style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:var(--accent);border-radius:2px;"></span> Receitas</span>
            <span style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:#cbd5e1;border-radius:2px;"></span> Despesas</span>
          </div>
        </div>
      </div>
      ${budgets.length > 0 ? `
        <div class="panel">
          <div class="panel-head">
            <div><div class="panel-kicker">Limites</div><div class="panel-title">Orçamentos do mês</div></div>
            <button class="link-btn" onclick="setTab('settings');setSettingsTab('budget')">Ajustar →</button>
          </div>
          ${budgets.map(b => `
            <div class="budget-row">
              <div class="budget-row-head">
                <span class="name">${escapeHtml(b.name)}</span>
                <span class="vals">${formatBRL(b.spent)} / ${formatBRL(b.limit)}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${b.pct}%;background:${b.pct >= 100 ? 'var(--danger)' : b.pct >= 80 ? 'var(--warning)' : b.color}"></div>
              </div>
            </div>`).join('')}
        </div>` : ''}
      <div class="panel">
        <div class="panel-head"><div><div class="panel-kicker">Atividade</div><div class="panel-title">Lançamentos recentes</div></div></div>
        ${recent.length === 0
          ? `<div class="empty"><div class="empty-text">Nenhum lançamento neste mês ainda</div></div>`
          : `<div class="mobile-list">
              ${recent.map(item => {
                const cat = item._kind === 'exp'
                  ? state.expenseCategories.find(c => c.id === item.categoryId)
                  : state.incomeCategories.find(c => c.id === item.categoryId);
                const isCard = item._kind === 'exp' && item.kind === 'card';
                const iconClass = item._kind === 'inc' ? 'inc' : (isCard ? 'card' : 'exp');
                const iconHtml = item._kind === 'inc' ? icons.arrowUp : (isCard ? icons.card : icons.arrowDown);
                const valColor = item._kind === 'inc' ? 'success' : (isCard ? 'purple' : 'danger');
                const sign = item._kind === 'exp' ? '−' : '+';
                return `
                  <div class="list-card">
                    <span class="kind ${iconClass}">${iconHtml}</span>
                    <div class="list-card-body">
                      <div class="list-card-title">${escapeHtml(item.description)}</div>
                      <div class="list-card-meta">${escapeHtml(cat?.name || '—')} • ${formatDate(item.date)}${isCard ? ` • 💳 ${escapeHtml(item.cardName)}` : ''}</div>
                    </div>
                    <div class="list-card-amount ${valColor}">${sign} ${formatBRL(item.amount)}</div>
                  </div>`;
              }).join('')}
            </div>
            <table>
              <tbody>
                ${recent.map(item => {
                  const cat = item._kind === 'exp'
                    ? state.expenseCategories.find(c => c.id === item.categoryId)
                    : state.incomeCategories.find(c => c.id === item.categoryId);
                  const isCard = item._kind === 'exp' && item.kind === 'card';
                  const iconClass = item._kind === 'inc' ? 'inc' : (isCard ? 'card' : 'exp');
                  const iconHtml = item._kind === 'inc' ? icons.arrowUp : (isCard ? icons.card : icons.arrowDown);
                  const valColor = item._kind === 'inc' ? 'success' : (isCard ? 'purple' : 'danger');
                  const sign = item._kind === 'exp' ? '−' : '+';
                  return `
                    <tr>
                      <td style="width:48px"><span class="kind ${iconClass}">${iconHtml}</span></td>
                      <td><div class="row-desc">${escapeHtml(item.description)}</div><div class="row-meta">${escapeHtml(cat?.name || '—')} • ${formatDate(item.date)}${isCard ? ` • 💳 ${escapeHtml(item.cardName)}` : ''}</div></td>
                      <td class="num ${valColor}">${sign} ${formatBRL(item.amount)}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>`;
}

function statCard(label, value, iconClass, iconHtml, count, valueColor) {
  return `<div class="stat-card">
    <div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${iconClass}">${iconHtml}</span></div>
    <div class="stat-value ${valueColor || ''}">${value}</div>
    <div class="stat-count">${count}</div>
  </div>`;
}

function attachChartListeners() {
  if (ui.tab !== 'dashboard') return;
  const m = ui.selectedMonth;
  const allExpenses = getAllExpensesForMonth(m);
  const byCat = {};
  allExpenses.forEach(e => { byCat[e.categoryId] = (byCat[e.categoryId] || 0) + Number(e.amount); });
  const catData = state.expenseCategories.map(c => ({ ...c, value: byCat[c.id] || 0 })).filter(c => c.value > 0);
  const canvas = document.getElementById('catChart');
  if (!canvas || catData.length === 0) return;
  new Chart(canvas, {
    type: 'doughnut',
    data: { labels: catData.map(c => c.name), datasets: [{ data: catData.map(c => c.value), backgroundColor: catData.map(c => c.color), borderWidth: 2, borderColor: '#ffffff' }] },
    options: { cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatBRL(ctx.raw)}` } } }, responsive: true, maintainAspectRatio: false },
  });
}

// ==============================================
//  DESPESAS (à vista + cartão unificado)
// ==============================================
function renderExpenses() {
  const m = ui.selectedMonth;
  let list = getAllExpensesForMonth(m);
  if (ui.filterCat !== 'all') list = list.filter(e => e.categoryId === ui.filterCat);
  if (ui.search) list = list.filter(e => e.description.toLowerCase().includes(ui.search.toLowerCase()));
  list.sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  const cashCount = list.filter(e => e.kind === 'cash').length;
  const cardCount = list.filter(e => e.kind === 'card').length;

  return `
    <div class="view-wrap">
      <div class="section-header">
        <div>
          <div class="kicker">Saídas</div>
          <h1>Despesas</h1>
          <p class="subtitle">${list.length} lanç. (${cashCount} à vista${cardCount > 0 ? ` + ${cardCount} cartão` : ''}) · ${formatBRL(total)}</p>
        </div>
        <button class="btn" onclick="openExpenseForm()">${icons.plus} Nova despesa</button>
      </div>
      <div class="filter-bar">
        <div class="search-wrap">
          ${icons.search}
          <input class="search-input" type="text" value="${escapeHtml(ui.search)}" placeholder="Buscar descrição…" oninput="ui.search = this.value; refreshExpenseList()" />
        </div>
        <select class="select" onchange="ui.filterCat = this.value; refreshExpenseList()">
          <option value="all"${ui.filterCat === 'all' ? ' selected' : ''}>Todas categorias</option>
          ${state.expenseCategories.map(c => `<option value="${c.id}"${ui.filterCat === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div id="exp-list">${renderExpenseListContent(list)}</div>
    </div>`;
}

function renderExpenseListContent(list) {
  if (list.length === 0) {
    return `<div class="table-wrap"><div class="empty"><div class="empty-text">Nenhuma despesa para mostrar</div><button class="btn" onclick="openExpenseForm()">${icons.plus} Cadastrar</button></div></div>`;
  }
  return `
    <div class="mobile-list">
      ${list.map(e => {
        const cat = state.expenseCategories.find(c => c.id === e.categoryId);
        const pm = e.kind === 'cash' ? state.paymentMethods.find(p => p.id === e.paymentMethodId) : null;
        const isCard = e.kind === 'card';
        return `
          <div class="list-card">
            <span class="kind ${isCard ? 'card' : 'exp'}">${isCard ? icons.card : icons.arrowDown}</span>
            <div class="list-card-body">
              <div class="list-card-row">
                <div class="list-card-title">${escapeHtml(e.description)}${e.installmentTotal > 1 ? `<span class="installment-tag">${e.installmentIndex}/${e.installmentTotal}</span>` : ''}</div>
                <div class="list-card-amount ${isCard ? 'purple' : 'danger'}">− ${formatBRL(e.amount)}</div>
              </div>
              <div class="list-card-meta">
                <span>${formatDate(e.date)}</span>
                <span class="tag" style="background:${(cat?.color || '#888')}1a;color:${cat?.color || '#666'}">${escapeHtml(cat?.name || '—')}</span>
                ${isCard ? `<span class="tag" style="background:${e.cardColor}1a;color:${e.cardColor};font-weight:600">💳 ${escapeHtml(e.cardName)}</span>` : (pm ? `<span>· ${escapeHtml(pm.name)}</span>` : '')}
              </div>
            </div>
            <div class="list-card-actions">
              <button class="icon-btn" onclick='openExpenseForm("${e.id}")'>${icons.pencil}</button>
              <button class="icon-btn danger" onclick='deleteExpense("${e.id}")'>${icons.trash}</button>
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th class="text-right">Valor</th><th class="col-actions"></th></tr></thead>
      <tbody>
        ${list.map(e => {
          const cat = state.expenseCategories.find(c => c.id === e.categoryId);
          const pm = e.kind === 'cash' ? state.paymentMethods.find(p => p.id === e.paymentMethodId) : null;
          const isCard = e.kind === 'card';
          return `
            <tr>
              <td style="width:48px"><span class="kind ${isCard ? 'card' : 'exp'}">${isCard ? icons.card : icons.arrowDown}</span></td>
              <td>${formatDate(e.date)}</td>
              <td><div class="row-desc">${escapeHtml(e.description)}${e.installmentTotal > 1 ? `<span class="installment-tag">${e.installmentIndex}/${e.installmentTotal}</span>` : ''}</div>${e.notes ? `<div class="row-meta">${escapeHtml(e.notes)}</div>` : ''}</td>
              <td><span class="tag" style="background:${(cat?.color || '#888')}1a;color:${cat?.color || '#666'}">${escapeHtml(cat?.name || '—')}</span></td>
              <td style="color:var(--muted)">
                ${isCard ? `<span class="tag" style="background:${e.cardColor}1a;color:${e.cardColor};font-weight:600">💳 ${escapeHtml(e.cardName)}</span>` : escapeHtml(pm?.name || '—')}
              </td>
              <td class="num ${isCard ? 'purple' : 'danger'}">− ${formatBRL(e.amount)}</td>
              <td class="text-right">
                <button class="icon-btn" onclick='openExpenseForm("${e.id}")'>${icons.pencil}</button>
                <button class="icon-btn danger" onclick='deleteExpense("${e.id}")'>${icons.trash}</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
}

function refreshExpenseList() {
  const m = ui.selectedMonth;
  let list = getAllExpensesForMonth(m);
  if (ui.filterCat !== 'all') list = list.filter(e => e.categoryId === ui.filterCat);
  if (ui.search) list = list.filter(e => e.description.toLowerCase().includes(ui.search.toLowerCase()));
  list.sort((a, b) => b.date.localeCompare(a.date));
  const wrap = document.getElementById('exp-list');
  if (wrap) wrap.innerHTML = renderExpenseListContent(list);
}

function openExpenseForm(id) {
  const editingCash = id ? state.expenses.find(e => e.id === id) : null;
  const editingCard = id ? state.cardPurchases.find(p => p.id === id) : null;
  const editing = editingCash || editingCard;
  const form = editing || {
    date: today(), description: '', amount: '',
    categoryId: state.expenseCategories[0]?.id,
    paymentMethodId: state.paymentMethods[0]?.id,
    notes: '', cardId: state.cards[0]?.id || '', installments: 1,
  };
  const isCard = !!editingCard;
  showModal({
    title: editing ? 'Editar despesa' : 'Nova despesa',
    body: `
      <form onsubmit="submitExpense(event, ${editing ? `'${editing.id}'` : 'null'})">
        <div class="form-grid">
          <div class="field">
            <label class="field-label">Data</label>
            <input class="input" type="date" name="date" value="${form.date}" required />
          </div>
          <div class="field">
            <label class="field-label">Valor (R$)</label>
            <input class="input money-input" type="text" inputmode="numeric" name="amount" value="${form.amount || ''}" placeholder="0,00" required />
          </div>
          <div class="field full">
            <label class="field-label">Descrição</label>
            <input class="input" type="text" name="description" value="${escapeHtml(form.description)}" placeholder="Ex.: Mercado da semana" required />
          </div>
          <div class="field">
            <label class="field-label">Categoria</label>
            <select class="input" name="categoryId">
              ${state.expenseCategories.map(c => `<option value="${c.id}"${form.categoryId === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">Forma de pagamento</label>
            <select class="input" name="paymentType" onchange="toggleCardFields(this.value)">
              <option value="cash"${!isCard ? ' selected' : ''}>À vista (dinheiro, PIX, débito…)</option>
              <option value="card"${isCard ? ' selected' : ''}>💳 Cartão de Crédito</option>
            </select>
          </div>
          <div class="field full" id="cash-fields" style="${isCard ? 'display:none' : ''}">
            <label class="field-label">Tipo (PIX, dinheiro, débito…)</label>
            <select class="input" name="paymentMethodId">
              ${state.paymentMethods.map(p => `<option value="${p.id}"${form.paymentMethodId === p.id ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div id="card-fields" style="${!isCard ? 'display:none' : ''}">
            <div class="form-grid" style="margin-bottom:0">
              <div class="field">
                <label class="field-label">Qual cartão</label>
                <select class="input" name="cardId">
                  ${state.cards.length === 0 ? '<option value="">— Nenhum cartão —</option>' : state.cards.map(c => `<option value="${c.id}"${form.cardId === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                </select>
                ${state.cards.length === 0 ? '<span class="field-hint" style="color:var(--danger)">Cadastre um cartão antes em Configurações</span>' : ''}
              </div>
              <div class="field">
                <label class="field-label">Parcelas</label>
                <input class="input" type="number" min="1" max="48" name="installments" value="${form.installments || 1}" oninput="updateInstallmentPreview()" />
                <span class="field-hint">Use 1 para à vista no cartão</span>
              </div>
              <div class="field full" id="installment-preview" style="display:none">
                <div style="background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.5">
                  <span id="installment-preview-text"></span>
                </div>
              </div>
            </div>
          </div>
          <div class="field full">
            <label class="field-label">Observações (opcional)</label>
            <input class="input" type="text" name="notes" value="${escapeHtml(form.notes || '')}" />
          </div>
          <div class="form-foot">
            <button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn">${editing ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      </form>`,
  });
}

function toggleCardFields(value) {
  const isCard = value === 'card';
  document.getElementById('cash-fields').style.display = isCard ? 'none' : '';
  document.getElementById('card-fields').style.display = isCard ? '' : 'none';
  updateInstallmentPreview();
}

function updateInstallmentPreview() {
  const preview = document.getElementById('installment-preview');
  const previewText = document.getElementById('installment-preview-text');
  if (!preview || !previewText) return;
  const form = preview.closest('form');
  if (!form) return;
  const isCard = form.paymentType && form.paymentType.value === 'card';
  if (!isCard) { preview.style.display = 'none'; return; }
  const total = parseBRLInput(form.amount.value);
  const n = Math.max(1, parseInt(form.installments.value) || 1);
  if (total <= 0 || n <= 1) { preview.style.display = 'none'; return; }
  const valuePerInstallment = total / n;
  preview.style.display = '';
  previewText.innerHTML = `<strong>📊 ${n}× de ${formatBRL(valuePerInstallment)}</strong> · Total: ${formatBRL(total)}`;
}

function openExpenseFormForCard(preselectedCardId) {
  if (state.cards.length === 0) {
    toast('Cadastre um cartão antes', 'error');
    setTab('settings'); setSettingsTab('cards');
    return;
  }
  openExpenseForm();
  setTimeout(() => {
    const typeSel = document.querySelector('select[name="paymentType"]');
    if (typeSel) { typeSel.value = 'card'; toggleCardFields('card'); }
    if (preselectedCardId) {
      const cardSel = document.querySelector('select[name="cardId"]');
      if (cardSel) cardSel.value = preselectedCardId;
    }
  }, 50);
}

function submitExpense(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  const isCard = f.paymentType.value === 'card';
  if (isCard) {
    if (!f.cardId.value) { toast('Selecione um cartão', 'error'); return; }
    const data = {
      date: f.date.value, amount: parseBRLInput(f.amount.value),
      description: f.description.value.trim(), categoryId: f.categoryId.value,
      cardId: f.cardId.value,
      installments: Math.max(1, parseInt(f.installments.value) || 1),
      notes: f.notes.value.trim(),
    };
    if (!data.description || data.amount <= 0) { toast('Preencha todos os campos', 'error'); return; }
    const card = state.cards.find(c => c.id === data.cardId);
    const baseInvoiceMonth = card ? getInvoiceMonthForPurchase(data.date, card.closingDay) : null;
    if (id) {
      state.expenses = state.expenses.filter(e => e.id !== id);
      state.cardPurchases = state.cardPurchases.filter(p => p.id !== id);
      state.cardPurchases.push({ ...data, id });
      toast('Despesa atualizada');
    } else {
      state.cardPurchases.push({ ...data, id: uid() });
      if (baseInvoiceMonth) {
        ui.selectedMonth = baseInvoiceMonth;
        const msg = data.installments > 1
          ? `Compra registrada · 1ª parcela em ${monthLabel(baseInvoiceMonth)}`
          : `Compra registrada na fatura de ${monthLabel(baseInvoiceMonth)}`;
        toast(msg);
      } else { toast('Despesa cadastrada'); }
    }
  } else {
    const data = {
      date: f.date.value, amount: parseBRLInput(f.amount.value),
      description: f.description.value.trim(), categoryId: f.categoryId.value,
      paymentMethodId: f.paymentMethodId.value, notes: f.notes.value.trim(),
    };
    if (!data.description || data.amount <= 0) { toast('Preencha todos os campos', 'error'); return; }
    if (id) {
      state.expenses = state.expenses.filter(e => e.id !== id);
      state.cardPurchases = state.cardPurchases.filter(p => p.id !== id);
      state.expenses.push({ ...data, id });
      toast('Despesa atualizada');
    } else {
      state.expenses.push({ ...data, id: uid() });
      toast('Despesa cadastrada');
    }
  }
  save(); closeModal(); render();
}

function deleteExpense(id) {
  const inCards = state.cardPurchases.find(p => p.id === id);
  if (inCards && (inCards.installments || 1) > 1) {
    if (!confirm(`Esta é uma compra parcelada (${inCards.installments}x). Excluir todas as parcelas?`)) return;
  } else {
    if (!confirm('Excluir esta despesa?')) return;
  }
  state.expenses = state.expenses.filter(e => e.id !== id);
  state.cardPurchases = state.cardPurchases.filter(p => p.id !== id);
  save(); render(); toast('Despesa excluída');
}

// ==============================================
//  RECEITAS
// ==============================================
function renderIncomes() {
  const m = ui.selectedMonth;
  const list = state.incomes.filter(e => monthKey(e.date) === m).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  return `
    <div class="view-wrap">
      <div class="section-header">
        <div>
          <div class="kicker">Entradas</div>
          <h1>Receitas</h1>
          <p class="subtitle">${list.length} lançamento${list.length === 1 ? '' : 's'} · ${formatBRL(total)}</p>
        </div>
        <button class="btn" onclick="openIncomeForm()">${icons.plus} Nova receita</button>
      </div>
      ${list.length === 0
        ? `<div class="table-wrap"><div class="empty"><div class="empty-text">Nenhuma receita para mostrar</div><button class="btn" onclick="openIncomeForm()">${icons.plus} Cadastrar</button></div></div>`
        : `<div class="mobile-list">
            ${list.map(e => {
              const cat = state.incomeCategories.find(c => c.id === e.categoryId);
              return `
                <div class="list-card">
                  <span class="kind inc">${icons.arrowUp}</span>
                  <div class="list-card-body">
                    <div class="list-card-row">
                      <div class="list-card-title">${escapeHtml(e.description)}</div>
                      <div class="list-card-amount success">+ ${formatBRL(e.amount)}</div>
                    </div>
                    <div class="list-card-meta">
                      <span>${formatDate(e.date)}</span>
                      <span class="tag" style="background:${(cat?.color || '#888')}1a;color:${cat?.color || '#666'}">${escapeHtml(cat?.name || '—')}</span>
                    </div>
                  </div>
                  <div class="list-card-actions">
                    <button class="icon-btn" onclick='openIncomeForm("${e.id}")'>${icons.pencil}</button>
                    <button class="icon-btn danger" onclick='deleteIncome("${e.id}")'>${icons.trash}</button>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th class="text-right">Valor</th><th class="col-actions"></th></tr></thead>
            <tbody>
              ${list.map(e => {
                const cat = state.incomeCategories.find(c => c.id === e.categoryId);
                return `
                  <tr>
                    <td>${formatDate(e.date)}</td>
                    <td><div class="row-desc">${escapeHtml(e.description)}</div></td>
                    <td><span class="tag" style="background:${(cat?.color || '#888')}1a;color:${cat?.color || '#666'}">${escapeHtml(cat?.name || '—')}</span></td>
                    <td class="num success">+ ${formatBRL(e.amount)}</td>
                    <td class="text-right">
                      <button class="icon-btn" onclick='openIncomeForm("${e.id}")'>${icons.pencil}</button>
                      <button class="icon-btn danger" onclick='deleteIncome("${e.id}")'>${icons.trash}</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table></div>`}
    </div>`;
}

function openIncomeForm(id) {
  const editing = id ? state.incomes.find(e => e.id === id) : null;
  const form = editing || { date: today(), description: '', amount: '', categoryId: state.incomeCategories[0]?.id };
  showModal({
    title: editing ? 'Editar receita' : 'Nova receita',
    body: `
      <form onsubmit="submitIncome(event, ${editing ? `'${editing.id}'` : 'null'})">
        <div class="form-grid">
          <div class="field">
            <label class="field-label">Data</label>
            <input class="input" type="date" name="date" value="${form.date}" required />
          </div>
          <div class="field">
            <label class="field-label">Valor (R$)</label>
            <input class="input money-input" type="text" inputmode="numeric" name="amount" value="${form.amount || ''}" placeholder="0,00" required />
          </div>
          <div class="field full">
            <label class="field-label">Descrição</label>
            <input class="input" type="text" name="description" value="${escapeHtml(form.description)}" placeholder="Ex.: Salário" required />
          </div>
          <div class="field full">
            <label class="field-label">Origem</label>
            <select class="input" name="categoryId">
              ${state.incomeCategories.map(c => `<option value="${c.id}"${form.categoryId === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-foot">
            <button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn">${editing ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      </form>`,
  });
}

function submitIncome(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  const data = {
    date: f.date.value, amount: parseBRLInput(f.amount.value),
    description: f.description.value.trim(), categoryId: f.categoryId.value,
  };
  if (!data.description || data.amount <= 0) { toast('Preencha todos os campos', 'error'); return; }
  if (id) {
    state.incomes = state.incomes.map(e => e.id === id ? { ...e, ...data } : e);
    toast('Receita atualizada');
  } else {
    state.incomes.push({ ...data, id: uid() });
    toast('Receita cadastrada');
  }
  save(); closeModal(); render();
}

function deleteIncome(id) {
  if (!confirm('Excluir esta receita?')) return;
  state.incomes = state.incomes.filter(e => e.id !== id);
  save(); render(); toast('Receita excluída');
}

// ==============================================
//  CARTÕES (visão consolidada)
// ==============================================
function renderCards() {
  const m = ui.selectedMonth;
  if (state.cards.length === 0) {
    return `
      <div class="view-wrap">
        <div class="section-header">
          <div><div class="kicker">Crédito</div><h1>Cartões</h1><p class="subtitle">Cadastre seus cartões para começar</p></div>
        </div>
        <div class="panel">
          <div class="empty">
            <div class="empty-text">Nenhum cartão cadastrado</div>
            <button class="btn" onclick="setTab('settings');setSettingsTab('cards')">${icons.plus} Cadastrar cartão</button>
          </div>
        </div>
      </div>`;
  }
  const totalOpen = state.cards.reduce((s, c) => {
    const inv = getInvoice(c, m);
    return s + (inv.isPaid ? 0 : inv.total);
  }, 0);
  return `
    <div class="view-wrap">
      <div class="section-header">
        <div>
          <div class="kicker">Crédito</div>
          <h1>Cartões</h1>
          <p class="subtitle">Faturas de ${monthLabel(m)} · Total aberto ${formatBRL(totalOpen)}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" onclick="setTab('settings');setSettingsTab('cards')">${icons.settings} Gerenciar</button>
          <button class="btn" onclick="openExpenseFormForCard()">${icons.plus} Nova compra</button>
        </div>
      </div>
      <div class="card-grid">
        ${state.cards.map(card => {
          const inv = getInvoice(card, m);
          return `
            <div class="credit-card" style="--card-color:${card.color};--card-color-2:${lighten(card.color, 18)}">
              <div class="cc-top">
                <div><div class="cc-name">Cartão</div><div class="cc-title">${escapeHtml(card.name)}</div></div>
                <div class="cc-actions">
                  <button class="icon-btn" onclick='openExpenseFormForCard("${card.id}")' title="Nova compra">${icons.plus}</button>
                </div>
              </div>
              <div class="cc-bottom">
                <div>
                  <div class="cc-info">${inv.isPaid ? 'Fatura paga' : 'Fatura aberta'}</div>
                  <div class="cc-amount">${formatBRL(inv.total)}</div>
                </div>
                <div class="cc-dates">Fecha dia ${card.closingDay}<br/>Vence dia ${card.dueDay}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      ${state.cards.map(card => renderInvoiceSection(card, m)).join('')}
    </div>`;
}

function renderInvoiceSection(card, m) {
  const inv = getInvoice(card, m);
  const items = inv.installments.sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="fatura-section">
      <div class="fatura-head">
        <div class="fatura-info">
          <div class="fatura-color" style="background:${card.color}"></div>
          <div>
            <div class="fatura-name">${escapeHtml(card.name)}</div>
            <div class="fatura-meta">${monthLabel(m)} · ${items.length} item${items.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <div style="text-align:right">
            <div class="fatura-meta">Total</div>
            <div class="fatura-total">${formatBRL(inv.total)}</div>
          </div>
          <div class="fatura-actions">
            ${inv.isPaid
              ? `<span class="paid-tag">${icons.check} Paga em ${formatDate(inv.paidInfo.paidAt)}</span><button class="btn ghost" onclick='unpayInvoice("${card.id}", "${m}")'>Desfazer</button>`
              : (inv.total > 0 ? `<button class="btn success" onclick='payInvoice("${card.id}", "${m}")'>${icons.check} Marcar paga</button>` : `<span class="paid-tag" style="background:var(--bg);color:var(--muted)">Sem lançamentos</span>`)}
          </div>
        </div>
      </div>
      ${items.length === 0
        ? `<div class="empty"><div class="empty-text">Nenhuma compra nesta fatura</div></div>`
        : `<div class="mobile-list">
            ${items.map(it => {
              const cat = state.expenseCategories.find(c => c.id === it.categoryId);
              return `
                <div class="list-card">
                  <span class="kind card">${icons.card}</span>
                  <div class="list-card-body">
                    <div class="list-card-row">
                      <div class="list-card-title">${escapeHtml(it.description)}${it.installmentTotal > 1 ? `<span class="installment-tag">${it.installmentIndex}/${it.installmentTotal}</span>` : ''}</div>
                      <div class="list-card-amount purple">${formatBRL(it.amount)}</div>
                    </div>
                    <div class="list-card-meta">
                      <span>${formatDate(it.date)}</span>
                      <span class="tag" style="background:${(cat?.color || '#888')}1a;color:${cat?.color || '#666'}">${escapeHtml(cat?.name || '—')}</span>
                      ${it.installmentTotal > 1 ? `<span>· total ${formatBRL(it.amountTotal)}</span>` : ''}
                    </div>
                  </div>
                  <div class="list-card-actions">
                    <button class="icon-btn" onclick='openExpenseForm("${it.purchaseId}")'>${icons.pencil}</button>
                    <button class="icon-btn danger" onclick='deleteExpense("${it.purchaseId}")'>${icons.trash}</button>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="text-right">Valor</th><th class="col-actions"></th></tr></thead>
            <tbody>
              ${items.map(it => {
                const cat = state.expenseCategories.find(c => c.id === it.categoryId);
                return `
                  <tr>
                    <td>${formatDate(it.date)}</td>
                    <td>
                      <div class="row-desc">${escapeHtml(it.description)}${it.installmentTotal > 1 ? `<span class="installment-tag">${it.installmentIndex}/${it.installmentTotal}</span>` : ''}</div>
                      ${it.installmentTotal > 1 ? `<div class="row-meta">Total: ${formatBRL(it.amountTotal)}</div>` : (it.notes ? `<div class="row-meta">${escapeHtml(it.notes)}</div>` : '')}
                    </td>
                    <td><span class="tag" style="background:${(cat?.color || '#888')}1a;color:${cat?.color || '#666'}">${escapeHtml(cat?.name || '—')}</span></td>
                    <td class="num purple">${formatBRL(it.amount)}</td>
                    <td class="text-right">
                      <button class="icon-btn" onclick='openExpenseForm("${it.purchaseId}")'>${icons.pencil}</button>
                      <button class="icon-btn danger" onclick='deleteExpense("${it.purchaseId}")'>${icons.trash}</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>`}
    </div>`;
}

function payInvoice(cardId, m) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const inv = getInvoice(card, m);
  if (inv.total <= 0) { toast('Fatura sem valor', 'error'); return; }
  if (!confirm(`Marcar fatura de ${card.name} (${monthLabel(m)}) — ${formatBRL(inv.total)} — como paga?\n\nAs compras já estão contabilizadas. Esta ação só marca a fatura como quitada.`)) return;
  state.paidInvoices[`${cardId}:${m}`] = { paidAt: today(), amount: inv.total };
  save(); render();
  toast(`Fatura ${card.name} marcada como paga`);
}

function unpayInvoice(cardId, m) {
  if (!confirm('Desfazer marcação de pagamento?')) return;
  delete state.paidInvoices[`${cardId}:${m}`];
  save(); render(); toast('Marcação desfeita');
}

// ==============================================
//  CONFIGURAÇÕES
// ==============================================
function renderSettings() {
  return `
    <div class="view-wrap">
      <div class="section-header">
        <div><div class="kicker">Personalização</div><h1>Configurações</h1><p class="subtitle">Adapte o sistema ao seu jeito</p></div>
      </div>
      <div class="sub-tabs">
        ${subTab('personalize', icons.palette, 'Aparência')}
        ${subTab('exp-cat', icons.tag, 'Cat. despesa')}
        ${subTab('inc-cat', icons.tag, 'Cat. receita')}
        ${subTab('cards', icons.card, 'Cartões')}
        ${subTab('pay', icons.wallet, 'Pagamentos')}
        ${subTab('budget', icons.target, 'Orçamentos')}
        ${subTab('account', icons.user, 'Conta')}
      </div>
      ${ui.settingsTab === 'personalize' ? renderPersonalizeTab() : ''}
      ${ui.settingsTab === 'exp-cat' ? renderCategoryManager('expense') : ''}
      ${ui.settingsTab === 'inc-cat' ? renderCategoryManager('income') : ''}
      ${ui.settingsTab === 'cards' ? renderCardsManager() : ''}
      ${ui.settingsTab === 'pay' ? renderPaymentManager() : ''}
      ${ui.settingsTab === 'budget' ? renderBudgetManager() : ''}
      ${ui.settingsTab === 'account' ? renderAccountTab() : ''}
    </div>`;
}

function subTab(id, icon, label) {
  const active = ui.settingsTab === id ? ' active' : '';
  return `<button class="sub-tab${active}" onclick="setSettingsTab('${id}')">${icon} ${label}</button>`;
}

function renderPersonalizeTab() {
  const s = state.settings;
  const colorOptions = ['#2563eb','#1d4ed8','#7c3aed','#db2777','#dc2626','#ea580c','#d97706','#65a30d','#059669','#0891b2','#0284c7','#1e293b'];
  return `
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Aparência do app</div><div style="font-size:13px;color:var(--muted);margin-top:2px">Personalize o nome, subtítulo e cor</div></div>
      </div>
      <form onsubmit="submitPersonalize(event)">
        <div class="form-grid">
          <div class="field full">
            <label class="field-label">Nome do app</label>
            <input class="input" type="text" name="appName" value="${escapeHtml(s.appName)}" placeholder="Ex.: Finanças Família Silva" required maxlength="40" />
          </div>
          <div class="field full">
            <label class="field-label">Subtítulo</label>
            <input class="input" type="text" name="appSubtitle" value="${escapeHtml(s.appSubtitle)}" placeholder="Ex.: Controle financeiro familiar" maxlength="60" />
          </div>
          <div class="field full">
            <label class="field-label">Cor principal</label>
            <div class="color-row" id="theme-color-row">
              ${colorOptions.map(c => `<button type="button" class="color-option ${c === s.accentColor ? 'selected' : ''}" style="background:${c}" onclick="selectThemeColor(this, '${c}')"></button>`).join('')}
            </div>
            <input type="hidden" name="accentColor" id="accent-input" value="${s.accentColor}" />
          </div>
          <div class="form-foot">
            <button type="submit" class="btn">${icons.check} Salvar alterações</button>
          </div>
        </div>
      </form>
    </div>`;
}

function selectThemeColor(btn, color) {
  document.querySelectorAll('#theme-color-row .color-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('accent-input').value = color;
  document.documentElement.style.setProperty('--accent', color);
}

function submitPersonalize(ev) {
  ev.preventDefault();
  const f = ev.target;
  state.settings.appName = f.appName.value.trim() || 'Controle Financeiro';
  state.settings.appSubtitle = f.appSubtitle.value.trim();
  state.settings.accentColor = f.accentColor.value;
  state.settings.logoLetter = state.settings.appName.charAt(0).toUpperCase() || 'C';
  save(); render(); toast('Aparência atualizada');
}

function renderCategoryManager(kind) {
  const list = kind === 'expense' ? state.expenseCategories : state.incomeCategories;
  const title = kind === 'expense' ? 'Categorias de despesa' : 'Categorias de receita';
  return `
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">${title}</div><div style="font-size:13px;color:var(--muted);margin-top:2px">${kind === 'expense' ? 'Classifique despesas (Moradia, Mercado…)' : 'Origens das receitas (Salário, Freelance…)'}</div></div>
        <button class="btn" onclick="openCategoryForm('${kind}')">${icons.plus} Adicionar</button>
      </div>
      <div class="item-list">
        ${list.map(c => `
          <div class="item-row">
            <div class="item-row-info">
              <span class="color-chip" style="background:${c.color}"></span>
              <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name)}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="icon-btn" onclick='openCategoryForm("${kind}", "${c.id}")'>${icons.pencil}</button>
              <button class="icon-btn danger" onclick='deleteCategory("${kind}", "${c.id}")'>${icons.trash}</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

const PALETTE = ['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#db2777','#ca8a04','#65a30d','#9333ea','#0d9488','#e11d48','#64748b','#1e293b'];

function openCategoryForm(kind, id) {
  const list = kind === 'expense' ? state.expenseCategories : state.incomeCategories;
  const editing = id ? list.find(c => c.id === id) : null;
  const form = editing || { name: '', color: PALETTE[0] };
  showModal({
    title: editing ? 'Editar categoria' : 'Nova categoria',
    body: `
      <form onsubmit="submitCategory(event, '${kind}', ${editing ? `'${editing.id}'` : 'null'})">
        <div class="form-grid">
          <div class="field full">
            <label class="field-label">Nome</label>
            <input class="input" type="text" name="name" value="${escapeHtml(form.name)}" placeholder="Ex.: Moradia, Pets" required autofocus />
          </div>
          <div class="field full">
            <label class="field-label">Cor</label>
            <div class="color-row" id="color-row">
              ${PALETTE.map(c => `<button type="button" class="color-option ${c === form.color ? 'selected' : ''}" style="background:${c}" onclick="selectColor(this, '${c}')"></button>`).join('')}
            </div>
            <input type="hidden" name="color" id="color-input" value="${form.color}" />
          </div>
          <div class="form-foot">
            <button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn">${editing ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </div>
      </form>`,
  });
}

function selectColor(btn, color) {
  document.querySelectorAll('#color-row .color-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('color-input').value = color;
}

function submitCategory(ev, kind, id) {
  ev.preventDefault();
  const f = ev.target;
  const data = { name: f.name.value.trim(), color: f.color.value };
  if (!data.name) return;
  const key = kind === 'expense' ? 'expenseCategories' : 'incomeCategories';
  if (id) {
    state[key] = state[key].map(c => c.id === id ? { ...c, ...data } : c);
    toast('Categoria atualizada');
  } else {
    state[key].push({ ...data, id: 'cat-' + uid() });
    toast('Categoria adicionada');
  }
  save(); closeModal(); render();
}

function deleteCategory(kind, id) {
  const items = kind === 'expense' ? state.expenses : state.incomes;
  const inUse = items.some(i => i.categoryId === id) || (kind === 'expense' && state.cardPurchases.some(p => p.categoryId === id));
  if (inUse) { toast('Categoria em uso', 'error'); return; }
  if (!confirm('Excluir esta categoria?')) return;
  const key = kind === 'expense' ? 'expenseCategories' : 'incomeCategories';
  state[key] = state[key].filter(c => c.id !== id);
  if (kind === 'expense' && state.budgets[id]) delete state.budgets[id];
  save(); render(); toast('Categoria excluída');
}

function renderCardsManager() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Cartões de crédito</div><div style="font-size:13px;color:var(--muted);margin-top:2px">Cadastre seus cartões com fechamento e vencimento</div></div>
        <button class="btn" onclick="openCardForm()">${icons.plus} Novo cartão</button>
      </div>
      <div class="item-list">
        ${state.cards.length === 0
          ? `<div class="empty"><div class="empty-text">Nenhum cartão cadastrado</div></div>`
          : state.cards.map(c => `
            <div class="item-row">
              <div class="item-row-info">
                <span class="color-chip" style="background:${c.color};width:18px;height:18px"></span>
                <div>
                  <div style="font-weight:600">${escapeHtml(c.name)}</div>
                  <div style="font-size:12px;color:var(--muted)">Fecha ${c.closingDay} · Vence ${c.dueDay}</div>
                </div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="icon-btn" onclick='openCardForm("${c.id}")'>${icons.pencil}</button>
                <button class="icon-btn danger" onclick='deleteCard("${c.id}")'>${icons.trash}</button>
              </div>
            </div>`).join('')}
      </div>
    </div>`;
}

const CARD_PALETTE = ['#820ad1','#2563eb','#dc2626','#059669','#d97706','#7c3aed','#0891b2','#db2777','#1e293b','#ea580c'];

function openCardForm(id) {
  const editing = id ? state.cards.find(c => c.id === id) : null;
  const form = editing || { name: '', color: CARD_PALETTE[0], closingDay: 25, dueDay: 5 };
  showModal({
    title: editing ? 'Editar cartão' : 'Novo cartão',
    body: `
      <form onsubmit="submitCard(event, ${editing ? `'${editing.id}'` : 'null'})">
        <div class="form-grid">
          <div class="field full">
            <label class="field-label">Nome do cartão</label>
            <input class="input" type="text" name="name" value="${escapeHtml(form.name)}" placeholder="Ex.: Nubank, Itaú" required autofocus />
          </div>
          <div class="field">
            <label class="field-label">Dia do fechamento</label>
            <input class="input" type="number" min="1" max="31" name="closingDay" value="${form.closingDay}" required />
            <span class="field-hint">Compras até este dia entram na fatura do mês</span>
          </div>
          <div class="field">
            <label class="field-label">Dia do vencimento</label>
            <input class="input" type="number" min="1" max="31" name="dueDay" value="${form.dueDay}" required />
            <span class="field-hint">Dia em que a fatura precisa ser paga</span>
          </div>
          <div class="field full">
            <label class="field-label">Cor</label>
            <div class="color-row" id="color-row">
              ${CARD_PALETTE.map(c => `<button type="button" class="color-option ${c === form.color ? 'selected' : ''}" style="background:${c}" onclick="selectColor(this, '${c}')"></button>`).join('')}
            </div>
            <input type="hidden" name="color" id="color-input" value="${form.color}" />
          </div>
          <div class="form-foot">
            <button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn">${editing ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </div>
      </form>`,
  });
}

function submitCard(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  const data = {
    name: f.name.value.trim(), color: f.color.value,
    closingDay: Math.min(31, Math.max(1, parseInt(f.closingDay.value) || 25)),
    dueDay: Math.min(31, Math.max(1, parseInt(f.dueDay.value) || 5)),
  };
  if (!data.name) return;
  if (id) {
    state.cards = state.cards.map(c => c.id === id ? { ...c, ...data } : c);
    toast('Cartão atualizado');
  } else {
    state.cards.push({ ...data, id: 'card-' + uid() });
    toast('Cartão adicionado');
  }
  save(); closeModal(); render();
}

function deleteCard(id) {
  const inUse = state.cardPurchases.some(p => p.cardId === id);
  if (inUse) {
    if (!confirm('Este cartão tem compras lançadas. Excluir vai remover todas. Continuar?')) return;
    state.cardPurchases = state.cardPurchases.filter(p => p.cardId !== id);
    Object.keys(state.paidInvoices).forEach(k => { if (k.startsWith(id + ':')) delete state.paidInvoices[k]; });
  } else {
    if (!confirm('Excluir este cartão?')) return;
  }
  state.cards = state.cards.filter(c => c.id !== id);
  save(); render(); toast('Cartão excluído');
}

function renderPaymentManager() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Formas de pagamento</div><div style="font-size:13px;color:var(--muted);margin-top:2px">PIX, débito, dinheiro…</div></div>
        <button class="btn" onclick="openPaymentForm()">${icons.plus} Adicionar</button>
      </div>
      <div class="item-list">
        ${state.paymentMethods.map(p => `
          <div class="item-row">
            <div class="item-row-info">
              ${icons.wallet}
              <span style="font-weight:600">${escapeHtml(p.name)}</span>
            </div>
            <div style="display:flex;gap:4px">
              <button class="icon-btn" onclick='openPaymentForm("${p.id}")'>${icons.pencil}</button>
              <button class="icon-btn danger" onclick='deletePayment("${p.id}")'>${icons.trash}</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function openPaymentForm(id) {
  const editing = id ? state.paymentMethods.find(p => p.id === id) : null;
  const form = editing || { name: '' };
  showModal({
    title: editing ? 'Editar forma de pagamento' : 'Nova forma de pagamento',
    body: `
      <form onsubmit="submitPayment(event, ${editing ? `'${editing.id}'` : 'null'})">
        <div class="form-grid">
          <div class="field full">
            <label class="field-label">Nome</label>
            <input class="input" type="text" name="name" value="${escapeHtml(form.name)}" placeholder="Ex.: Cartão Nubank Débito" required autofocus />
          </div>
          <div class="form-foot">
            <button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn">${editing ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </div>
      </form>`,
  });
}

function submitPayment(ev, id) {
  ev.preventDefault();
  const name = ev.target.name.value.trim();
  if (!name) return;
  if (id) {
    state.paymentMethods = state.paymentMethods.map(p => p.id === id ? { ...p, name } : p);
    toast('Atualizado');
  } else {
    state.paymentMethods.push({ id: 'pm-' + uid(), name });
    toast('Adicionado');
  }
  save(); closeModal(); render();
}

function deletePayment(id) {
  const inUse = state.expenses.some(e => e.paymentMethodId === id);
  if (inUse) { toast('Em uso, não pode excluir', 'error'); return; }
  if (!confirm('Excluir?')) return;
  state.paymentMethods = state.paymentMethods.filter(p => p.id !== id);
  save(); render(); toast('Excluído');
}

function renderBudgetManager() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Orçamentos mensais</div><div style="font-size:13px;color:var(--muted);margin-top:2px">Defina um teto de gasto por categoria</div></div>
      </div>
      <div class="item-list">
        ${state.expenseCategories.map(c => `
          <div class="item-row">
            <div class="item-row-info">
              <span class="color-chip" style="background:${c.color}"></span>
              <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--muted);font-size:13px">R$</span>
              <input class="input money-input" id="budget-${c.id}" type="text" inputmode="numeric" value="${state.budgets[c.id] || ''}" placeholder="0,00" style="width:120px;text-align:right" />
              <button class="btn" onclick='setBudget("${c.id}")'>Salvar</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function setBudget(id) {
  const val = parseBRLInput(document.getElementById('budget-' + id).value);
  if (!val || val <= 0) {
    delete state.budgets[id];
    toast('Orçamento removido');
  } else {
    state.budgets[id] = val;
    toast('Orçamento atualizado');
  }
  save();
}

function renderAccountTab() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Sua conta</div><div style="font-size:13px;color:var(--muted);margin-top:2px">Compartilhe com a família e gerencie sua conta</div></div>
      </div>
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Logado como</div>
        <div style="font-weight:600">${escapeHtml(currentUser?.email || '—')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:10px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-weight:600;margin-bottom:4px">Compartilhar com a família</div>
              <div style="font-size:13px;color:var(--muted)">Convide membros da família</div>
            </div>
            <button class="btn" onclick="openShareWorkspace()">${icons.plus} Convidar</button>
          </div>
        </div>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-weight:600;margin-bottom:4px">Entrar em uma família</div>
              <div style="font-size:13px;color:var(--muted)">Use o código compartilhado</div>
            </div>
            <button class="btn ghost" onclick="openJoinWorkspace()">Entrar com código</button>
          </div>
        </div>
        <div style="background:var(--danger-soft);border:1px solid color-mix(in srgb,var(--danger) 20%,transparent);border-radius:10px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-weight:600;margin-bottom:4px;color:var(--danger)">Sair da conta</div>
              <div style="font-size:13px;color:var(--muted)">Encerre sua sessão</div>
            </div>
            <button class="btn danger" onclick="logout()">Sair</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ==============================================
//  MODAL
// ==============================================
function showModal({ title, body }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title">${title}</div>
          <button class="icon-btn" onclick="closeModal()">${icons.x}</button>
        </div>
        ${body}
      </div>
    </div>`;
  document.body.style.overflow = 'hidden';
  initMoneyInputs(root);
  setTimeout(() => { if (typeof updateInstallmentPreview === 'function') updateInstallmentPreview(); }, 0);
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.body.style.overflow = '';
}

// ==============================================
//  INIT
// ==============================================
if (window.fbAuth) {
  setupAuthListener();
} else {
  window.addEventListener('firebase-ready', () => setupAuthListener(), { once: true });
}

// Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW falhou:', err));
  });
}
