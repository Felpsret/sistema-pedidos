// ── Utilitário debounce ──────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
const renderPedidosDebounced    = debounce(() => renderPedidos(), 200);
const renderCatalogoDebounced   = debounce(() => renderCatalogo(), 200);
const renderCatalogChipsDebounced = debounce(() => renderCatalogChips(), 200);
const filtrarTecnicosDebounced  = debounce((v) => renderTecOptions(v), 150);
window.renderPedidosDebounced    = renderPedidosDebounced;
window.renderCatalogoDebounced   = renderCatalogoDebounced;
window.renderCatalogChipsDebounced = renderCatalogChipsDebounced;
window.filtrarTecnicosDebounced  = filtrarTecnicosDebounced;
// ────────────────────────────────────────────────────────────────────────────


// ── Validação visual de inputs ───────────────────────────────────────────────
function validarCampo(id, condicao, msg) {
  const el = document.getElementById(id);
  if (!el) return true;
  const erro = el.parentElement.querySelector('.input-error-msg');
  if (!condicao) {
    el.classList.add('input-error');
    if (!erro) {
      const d = document.createElement('div');
      d.className = 'input-error-msg';
      d.innerHTML = `<i class="ti ti-alert-circle"></i>${msg}`;
      el.parentElement.appendChild(d);
    }
    el.focus();
    return false;
  }
  el.classList.remove('input-error');
  if (erro) erro.remove();
  return true;
}
function limparErros(...ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('input-error');
    const erro = el.parentElement.querySelector('.input-error-msg');
    if (erro) erro.remove();
  });
}
// ────────────────────────────────────────────────────────────────────────────
// ── Modal de confirmação customizado ────────────────────────────────────────
function confirmar({ titulo, msg, tipo = 'red', labelOk = 'Confirmar', icone = 'ti-alert-triangle' }) {
  return new Promise(resolve => {
    const overlay  = document.getElementById('confirm-overlay');
    const iconEl   = document.getElementById('confirm-icon');
    const titleEl  = document.getElementById('confirm-title');
    const msgEl    = document.getElementById('confirm-msg');
    const okBtn    = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    iconEl.className  = `confirm-icon ${tipo}`;
    iconEl.innerHTML  = `<i class="ti ${icone}"></i>`;
    titleEl.textContent = titulo;
    msgEl.innerHTML   = msg;
    okBtn.className   = `btn confirm-ok-btn ${tipo}`;
    okBtn.textContent = labelOk;
    overlay.classList.add('active');

    const cleanup = (val) => {
      overlay.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(val);
    };
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); }, { once: true });
  });
}
// ────────────────────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCF3WLMNxbsUih3Gg9V2EQVWvo7Rr2Ers",
  authDomain: "pedidosmaterial-b97f5.firebaseapp.com",
  projectId: "pedidosmaterial-b97f5",
  storageBucket: "pedidosmaterial-b97f5.firebasestorage.app",
  messagingSenderId: "803568374697",
  appId: "1:803568374697:web:29001b826d0106bdf36ab8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let pedidos = [];
let catalogo = [];
let itensPedido = [];
let pedidosCarregados = false;
let catalogoCarregado = false;

/* ─── Skeleton loading (placeholders enquanto os dados chegam) ─── */
function skelLines(widths) {
  return widths.map(w => `<div class="skeleton skel-line" style="width:${w}"></div>`).join('');
}
function renderSkeletonPedidos(qtd) {
  qtd = qtd || 4;
  document.getElementById('stats-grid').innerHTML = Array(4).fill(
    `<div class="stat-card">${skelLines(['40%','60%'])}</div>`
  ).join('');
  document.getElementById('pedidos-list').innerHTML = Array(qtd).fill(
    `<div class="skel-card">${skelLines(['30%','55%','85%'])}</div>`
  ).join('');
}
function renderSkeletonCatalogo(qtd) {
  qtd = qtd || 5;
  document.getElementById('cat-list').innerHTML = Array(qtd).fill(
    `<div class="skel-card" style="padding:.7rem 1rem;margin-bottom:6px">${skelLines(['45%'])}</div>`
  ).join('');
}
function renderSkeletonKanban() {
  const cols = [
    {label:'Pendente', icon:'ti-clock'}, {label:'Em Separação', icon:'ti-loader'},
    {label:'Separado', icon:'ti-check'}, {label:'Retirado', icon:'ti-package-export'}
  ];
  document.getElementById('kanban-board').innerHTML = cols.map(c => `
    <div class="kanban-col">
      <div class="kanban-col-header">
        <div class="kanban-col-title"><i class="ti ${c.icon}" aria-hidden="true"></i>${c.label}</div>
      </div>
      <div class="kanban-col-body">
        ${Array(2).fill(`<div class="skel-card" style="margin-bottom:8px">${skelLines(['35%','65%'])}</div>`).join('')}
      </div>
    </div>`).join('');
}
function renderSkeletonMeusPedidos() {
  document.getElementById('meus-pedidos-list').innerHTML = Array(3).fill(
    `<div class="skel-card">${skelLines(['30%','55%','85%'])}</div>`
  ).join('');
}

// Carrega catálogo do cache local imediatamente (evita reset no F5)
try {
  const cached = localStorage.getItem('catalogo_cache');
  if (cached) {
    catalogo = JSON.parse(cached);
    renderCatalogChips();
  }
} catch(e) {}

// Restaura nome do estoque salvo
try {
  const savedEstoque = localStorage.getItem('estoque_nome');
  if (savedEstoque) document.getElementById('estoque-nome').value = savedEstoque;
} catch(e) {}
document.getElementById('estoque-nome').addEventListener('input', function() {
  try { localStorage.setItem('estoque_nome', this.value); } catch(e) {}
});

const subs = { novo:'Técnico — novo pedido', 'meus-pedidos':'Meus Pedidos', pedidos:'Todos os pedidos', estoque:'Kanban do estoque', catalogo:'Catálogo de materiais', config:'Configurações' };

window.showSection = function(s) {
  ['novo','meus-pedidos','pedidos','estoque','catalogo','config'].forEach(k => {
    const sec = document.getElementById('sec-'+k);
    const tab = document.getElementById('tab-'+k);
    if (sec) sec.classList.toggle('active', k===s);
    if (tab) tab.classList.toggle('active', k===s);
  });
  document.getElementById('header-sub').textContent = subs[s] || '';
  if (s==='meus-pedidos') {
    if (!pedidosCarregados) renderSkeletonMeusPedidos(); else renderMeusPedidos();
  }
  if (s==='pedidos') {
    paginaAtual = 1;
    const user = auth.currentUser;
    if (user && user.email.endsWith('@viuinternet.com.br')) {
      document.getElementById('pedidos-auth-wall').style.display = 'none';
      document.getElementById('pedidos-content').style.display = 'block';
      if (!pedidosCarregados) { renderSkeletonPedidos(); } else { renderStats(); renderPedidos(); }
    } else {
      document.getElementById('pedidos-auth-wall').style.display = 'flex';
      document.getElementById('pedidos-content').style.display = 'none';
    }
  }
  if (s==='catalogo') {
    const user = auth.currentUser;
    if (user && user.email.endsWith('@viuinternet.com.br')) {
      document.getElementById('catalogo-auth-wall').style.display = 'none';
      document.getElementById('catalogo-content').style.display = 'block';
      if (!catalogoCarregado) renderSkeletonCatalogo(); else renderCatalogo();
    } else {
      document.getElementById('catalogo-auth-wall').style.display = 'flex';
      document.getElementById('catalogo-content').style.display = 'none';
    }
  }
  if (s==='novo') {
    renderCatalogChips();
    // Se não há técnico logado, mostra overlay de login
    if (!tecnicoLogado) {
      document.getElementById('tecnico-login-overlay').style.display = 'flex';
    }
  }
  if (s==='estoque') {
    const user = auth.currentUser;
    if (user) {
      showEstoqueContent(user);
      if (!pedidosCarregados) { renderSkeletonKanban(); } else { renderKanban(); renderDashboard(); }
    } else {
      document.getElementById('estoque-auth-wall').style.display = 'flex';
      document.getElementById('estoque-content').style.display = 'none';
    }
  }
  if (s==='config') {
    renderConfigSection();
  }
};

/* ─── Auth Google ───────────────────────────────── */
window.loginGoogle = async function() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (!result.user.email.endsWith('@viuinternet.com.br')) {
      await signOut(auth);
      toast('Acesso negado. Use uma conta @viuinternet.com.br', 'red');
      return;
    }
    showEstoqueContent(result.user);
    renderKanban();
    renderDashboard();
    if (document.getElementById('sec-pedidos').classList.contains('active')) {
      document.getElementById('pedidos-auth-wall').style.display = 'none';
      document.getElementById('pedidos-content').style.display = 'block';
      renderStats(); renderPedidos();
    }
    if (document.getElementById('sec-catalogo').classList.contains('active')) {
      document.getElementById('catalogo-auth-wall').style.display = 'none';
      document.getElementById('catalogo-content').style.display = 'block';
      renderCatalogo();
    }
    if (document.getElementById('sec-config').classList.contains('active')) renderConfigSection();
    verificarBannerNotif('estoque');
    toast('Bem-vindo, ' + result.user.displayName + '!', 'green');
  } catch(e) {
    toast('Erro no login: ' + e.message, 'red');
  }
};

window.logoutGoogle = async function() {
  await signOut(auth);
  document.getElementById('estoque-auth-wall').style.display = 'flex';
  document.getElementById('estoque-content').style.display = 'none';
  document.getElementById('pedidos-auth-wall').style.display = 'flex';
  document.getElementById('pedidos-content').style.display = 'none';
  document.getElementById('catalogo-auth-wall').style.display = 'flex';
  document.getElementById('catalogo-content').style.display = 'none';
  if (document.getElementById('sec-config').classList.contains('active')) renderConfigSection();
  toast('Sessão encerrada.', 'blue');
};

function showEstoqueContent(user) {
  document.getElementById('estoque-auth-wall').style.display = 'none';
  document.getElementById('estoque-content').style.display = 'block';
  document.getElementById('user-display-name').textContent = user.displayName || 'Usuário';
  document.getElementById('user-email').textContent = user.email || '';
  const avatar = document.getElementById('user-avatar');
  if (user.photoURL) { avatar.src = user.photoURL; avatar.style.display = ''; }
  else avatar.style.display = 'none';
  // Preenche o campo de nome do estoque automaticamente
  const estoqueNome = document.getElementById('estoque-nome');
  if (estoqueNome && !estoqueNome.value) {
    estoqueNome.value = user.displayName || '';
    try { localStorage.setItem('estoque_nome', estoqueNome.value); } catch(e) {}
  }
}

// Reage a mudanças de autenticação (ex: reload da página)
onAuthStateChanged(auth, user => {
  const authed = user && user.email.endsWith('@viuinternet.com.br');
  if (document.getElementById('sec-estoque').classList.contains('active')) {
    if (authed) {
      showEstoqueContent(user); renderKanban(); renderDashboard();
      verificarBannerNotif('estoque');
    } else {
      if (user) signOut(auth);
      document.getElementById('estoque-auth-wall').style.display = 'flex';
      document.getElementById('estoque-content').style.display = 'none';
    }
  }
  if (document.getElementById('sec-pedidos').classList.contains('active')) {
    if (authed) {
      document.getElementById('pedidos-auth-wall').style.display = 'none';
      document.getElementById('pedidos-content').style.display = 'block';
      renderStats(); renderPedidos();
    } else {
      if (user) signOut(auth);
      document.getElementById('pedidos-auth-wall').style.display = 'flex';
      document.getElementById('pedidos-content').style.display = 'none';
    }
  }
});

function toast(msg, tipo) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.className = 'toast show toast-' + (tipo||'blue');
  setTimeout(() => t.classList.remove('show'), 2800);
}
window.toast = toast;

function badgeFor(s) {
  const l = { pendente:'Pendente', em_separacao:'Em Separação', separado:'Separado', retirado:'Retirado', cancelado:'Cancelado' };
  return `<span class="badge badge-${s}">${l[s]||s}</span>`;
}

/* ─── Técnicos cadastrados ──────────────────── */
let tecnicos = []; // [{id, codigo}]
let tecnicoLogado = null; // string codigo

/* ─── Configurações: Tema (claro/escuro) ──────── */
function temaAtual() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
function atualizarToggleTema() {
  const dark = temaAtual() === 'dark';
  const toggle = document.getElementById('toggle-tema');
  if (toggle) toggle.classList.toggle('on', dark);
  const icon = document.getElementById('theme-quick-icon');
  if (icon) icon.className = 'ti ' + (dark ? 'ti-sun' : 'ti-moon');
}
window.alternarTema = function() {
  const novo = temaAtual() === 'dark' ? 'light' : 'dark';
  if (novo === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('app_theme', novo); } catch(e) {}
  atualizarToggleTema();
};

/* ─── Configurações: Som de notificação ───────── */
function somAtivado() {
  try { return localStorage.getItem('app_som') !== 'off'; } catch(e) { return true; }
}
function atualizarToggleSom() {
  const toggle = document.getElementById('toggle-som');
  if (toggle) toggle.classList.toggle('on', somAtivado());
}
window.alternarSom = function() {
  const novoAtivo = !somAtivado();
  try { localStorage.setItem('app_som', novoAtivo ? 'on' : 'off'); } catch(e) {}
  atualizarToggleSom();
};

/* ─── Configurações: render geral da aba ──────── */
function renderConfigSection() {
  atualizarToggleTema();
  atualizarToggleSom();
  const user = auth.currentUser;
  const ehEstoque = user && user.email.endsWith('@viuinternet.com.br');
  const wrap = document.getElementById('config-tecnicos-wrap');
  const locked = document.getElementById('config-tecnicos-locked');
  if (wrap) wrap.style.display = ehEstoque ? 'block' : 'none';
  if (locked) locked.style.display = ehEstoque ? 'none' : 'flex';
  if (ehEstoque) renderTecChips();
}
// Aplica o estado correto do toggle/ícone assim que o script carrega
atualizarToggleTema();

function renderTecSelect() {
  const sel = document.getElementById('tecnico-select');
  if (sel) {
    sel.innerHTML = '<option value="">— Selecione seu código —</option>' +
      tecnicos.map(t => `<option value="${t.codigo}">${t.codigo}</option>`).join('');
  }
  // Inicializa label do trigger
  const lbl = document.getElementById('tec-trigger-label');
  if (lbl && !tecSelecionado) { lbl.textContent = '— Selecione seu código —'; lbl.classList.add('placeholder'); }
  renderTecOptions('');
}

function renderTecChips() {
  const wrap = document.getElementById('tec-chips-wrap');
  if (!wrap) return;
  if (!tecnicos.length) {
    wrap.innerHTML = '<span style="font-size:13px;color:var(--text-muted)">Nenhum técnico cadastrado.</span>';
    return;
  }
  wrap.innerHTML = tecnicos.map(t =>
    `<div class="tec-chip">
      <i class="ti ti-hard-hat" style="font-size:13px;opacity:.6"></i>${t.codigo}
      <button class="tec-chip-rm" onclick="removerTecnico('${t.id}','${t.codigo}')" title="Remover">
        <i class="ti ti-x"></i>
      </button>
    </div>`
  ).join('');
}

window.cadastrarTecnico = async function() {
  const inp = document.getElementById('tec-novo-codigo');
  const codigo = inp.value.trim().toUpperCase();
  limparErros('tec-novo-codigo');
  if (!codigo) { validarCampo('tec-novo-codigo', false, 'Digite o código do técnico.'); return; }
  if (tecnicos.find(t => t.codigo === codigo)) { toast('Técnico já cadastrado.','red'); return; }
  try {
    await addDoc(collection(db,'tecnicos'), { codigo, criadoEm: serverTimestamp() });
    inp.value = '';
    toast('Técnico ' + codigo + ' cadastrado!','green');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

document.addEventListener('DOMContentLoaded', () => {
  ['cat-nome','tec-novo-codigo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { el.classList.remove('input-error'); const e = el.parentElement.querySelector('.input-error-msg'); if(e) e.remove(); });
  });
});
window.removerTecnico = async function(id, codigo) {
  const ok = await confirmar({
    titulo: 'Remover técnico',
    msg: `Tem certeza que deseja remover <strong>${codigo}</strong>?<br>Ele não conseguirá mais fazer pedidos.`,
    tipo: 'red', labelOk: 'Remover', icone: 'ti-user-minus'
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db,'tecnicos',id));
    toast('Técnico ' + codigo + ' removido.','blue');
  } catch(e) { toast('Erro ao remover.','red'); }
};

/* ── Select com busca: lógica ─────────────────────── */
let tecSelecionado = null;

function renderTecOptions(filtro) {
  const list = document.getElementById('tec-options-list');
  if (!list) return;
  const termo = (filtro || '').toLowerCase();
  const filtrados = tecnicos.filter(t => t.codigo.toLowerCase().includes(termo));
  if (!filtrados.length) {
    list.innerHTML = '<div class="tec-no-results"><i class="ti ti-search-off" style="display:block;font-size:22px;margin-bottom:6px;opacity:.3"></i>Nenhum resultado</div>';
    return;
  }
  list.innerHTML = filtrados.map(t => {
    const sel = tecSelecionado === t.codigo;
    let label = t.codigo;
    if (termo) {
      const idx = t.codigo.toLowerCase().indexOf(termo);
      if (idx >= 0) {
        label = t.codigo.slice(0,idx)
          + '<mark class="tec-option-highlight">' + t.codigo.slice(idx, idx+termo.length) + '</mark>'
          + t.codigo.slice(idx+termo.length);
      }
    }
    return `<div class="tec-option${sel?' selected':''}" onclick="selecionarTecnico('${t.codigo}')">
      <i class="ti ti-hard-hat"></i>${label}
    </div>`;
  }).join('');
}

window.toggleTecDropdown = function() {
  const box = document.getElementById('tec-searchselect');
  const isOpen = box.classList.contains('open');
  if (isOpen) {
    box.classList.remove('open');
  } else {
    box.classList.add('open');
    setTimeout(() => {
      const inp = document.getElementById('tec-search-input');
      if (inp) { inp.value = ''; inp.focus(); }
      renderTecOptions('');
    }, 50);
  }
};

window.filtrarTecnicos = function(val) { renderTecOptions(val); };

window.selecionarTecnico = function(codigo) {
  tecSelecionado = codigo;
  // Atualiza label do trigger
  const lbl = document.getElementById('tec-trigger-label');
  if (lbl) { lbl.textContent = codigo; lbl.classList.remove('placeholder'); }
  // Atualiza o select oculto para compatibilidade
  const sel = document.getElementById('tecnico-select');
  if (sel) sel.value = codigo;
  // Fecha dropdown
  document.getElementById('tec-searchselect').classList.remove('open');
};

// Fecha dropdown ao clicar fora
document.addEventListener('click', function(e) {
  const box = document.getElementById('tec-searchselect');
  if (box && !box.contains(e.target)) box.classList.remove('open');
});

window.irParaEstoque = function() {
  document.getElementById('tecnico-login-overlay').style.display = 'none';
  showSection('estoque');
};

window.confirmarTecnico = function() {
  const codigo = tecSelecionado || document.getElementById('tecnico-select').value;
  if (!codigo) { toast('Selecione seu código antes de entrar.','red'); return; }
  tecnicoLogado = codigo;
  // Preenche campo de nome
  document.getElementById('tecnico-nome').value = codigo;
  try { localStorage.setItem('tecnico_nome', codigo); } catch(e) {}
  // Mostra overlay e barra
  document.getElementById('tecnico-login-overlay').style.display = 'none';
  const bar = document.getElementById('tecnico-logged-bar');
  bar.style.display = 'flex';
  document.getElementById('tecnico-logged-nome').textContent = codigo;
  document.getElementById('card-tecnico-nome').style.display = 'block';
  // Mostra aba Meus Pedidos
  document.getElementById('tab-meus-pedidos').style.display = '';
  // Verifica pedidos prontos
  checkPedidosProntos(codigo);
  // Convida a ativar notificações
  verificarBannerNotif('tec');
  toast('Bem-vindo, ' + codigo + '!','green');
};

window.sairTecnico = function() {
  tecnicoLogado = null;
  tecSelecionado = null;
  const lbl = document.getElementById('tec-trigger-label');
  if (lbl) { lbl.textContent = '— Selecione seu código —'; lbl.classList.add('placeholder'); }
  document.getElementById('tecnico-nome').value = '';
  document.getElementById('tecnico-logged-bar').style.display = 'none';
  document.getElementById('card-tecnico-nome').style.display = 'none';
  document.getElementById('notify-bar').classList.remove('show');
  // Esconde aba Meus Pedidos e volta para Novo Pedido
  document.getElementById('tab-meus-pedidos').style.display = 'none';
  if (document.getElementById('sec-meus-pedidos').classList.contains('active')) showSection('novo');
  document.getElementById('tecnico-login-overlay').style.display = 'flex';
  try { localStorage.removeItem('tecnico_nome'); } catch(e) {}
};

function checkPedidosProntos(codigo) {
  const prontos = pedidos.filter(p =>
    p.tecnico === codigo && p.status === 'separado'
  );
  const emSep = pedidos.filter(p =>
    p.tecnico === codigo && p.status === 'em_separacao'
  );
  const bar = document.getElementById('notify-bar');
  if (prontos.length > 0) {
    bar.classList.add('show');
    document.getElementById('notify-count').textContent = prontos.length;
    document.getElementById('notify-msg').textContent =
      prontos.length === 1
        ? 'Seu pedido está separado. Dirija-se ao estoque!'
        : `Você tem ${prontos.length} pedidos separados. Dirija-se ao estoque!`;
  } else {
    bar.classList.remove('show');
  }
  // Atualiza badge da aba Meus Pedidos
  const badge = document.getElementById('tab-meus-pedidos-badge');
  const total = prontos.length + emSep.length;
  if (badge) {
    if (total > 0) {
      badge.style.display = '';
      badge.textContent = total;
      badge.style.background = prontos.length > 0 ? '#185FA5' : '#7C3AED';
    } else {
      badge.style.display = 'none';
    }
  }
  // Se estiver na aba meus pedidos, re-renderiza
  if (document.getElementById('sec-meus-pedidos').classList.contains('active')) renderMeusPedidos();
}

function renderMeusPedidos() {
  if (!tecnicoLogado) return;
  const el = document.getElementById('meus-pedidos-list');
  const lbl = document.getElementById('meus-pedidos-tec-label');
  if (lbl) lbl.textContent = tecnicoLogado;

  const meus = pedidos.filter(p => p.tecnico === tecnicoLogado && p.status !== 'cancelado');
  const ativos = meus.filter(p => p.status !== 'retirado');
  const retirados = meus.filter(p => p.status === 'retirado');
  const prontos = meus.filter(p => p.status === 'separado');

  // Banner de notificação
  const notifyEl = document.getElementById('meus-pedidos-notify');
  if (notifyEl) {
    if (prontos.length > 0) {
      notifyEl.style.display = 'flex';
      document.getElementById('meus-pedidos-notify-msg').textContent =
        prontos.length === 1
          ? '🎉 Seu pedido está pronto! Dirija-se ao estoque para retirar.'
          : `🎉 Você tem ${prontos.length} pedidos prontos! Dirija-se ao estoque para retirar.`;
    } else {
      notifyEl.style.display = 'none';
    }
  }

  if (!meus.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-inbox" style="font-size:36px;display:block;margin-bottom:10px;opacity:.3"></i>Nenhum pedido encontrado.</div>`;
    return;
  }

  // Ordena ativos: separado primeiro, depois em_separacao, depois pendente
  const ordemAtivo = { separado:0, em_separacao:1, pendente:2 };
  const sortedAtivos = [...ativos].sort((a,b) => (ordemAtivo[a.status]??9) - (ordemAtivo[b.status]??9));

  function renderCard(p) {
    let banner = '';
    if (p.status === 'separado') {
      banner = `<div class="meu-pedido-pronto-banner"><i class="ti ti-bell-ringing" style="font-size:15px;flex-shrink:0"></i> Pronto para retirada! Dirija-se ao estoque.</div>`;
    } else if (p.status === 'em_separacao') {
      banner = `<div class="meu-pedido-em-sep-banner"><i class="ti ti-loader" style="font-size:15px;flex-shrink:0"></i> Em separação — aguarde, logo estará pronto.</div>`;
    } else if (p.status === 'retirado') {
      banner = `<div style="background:var(--green-light);border-radius:var(--radius);padding:7px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;color:var(--green);font-size:13px;font-weight:500"><i class="ti ti-circle-check" style="font-size:15px;flex-shrink:0"></i> Retirado em ${p.dataRetirada||'—'}</div>`;
    }
    const sepInfo = p.separadoPor ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px"><i class="ti ti-user" style="font-size:11px;margin-right:3px"></i>Separado por <strong style="color:var(--brand-dark)">${p.separadoPor}</strong></div>` : '';
    const retInfo = p.retiradoPor ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px"><i class="ti ti-package-export" style="font-size:11px;margin-right:3px"></i>Retirado por <strong style="color:var(--brand-dark)">${p.retiradoPor}</strong></div>` : '';
    const acoes = p.status === 'pendente' ? `
      <div style="margin-top:10px;padding-top:10px;border-top:0.5px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:var(--brand-light);color:var(--brand-dark);border:0.5px solid var(--brand-mid)" onclick="editarPedido('${p._docId}')"><i class="ti ti-edit"></i> Editar pedido</button>
        <button class="btn btn-sm" style="background:var(--red-bg);color:var(--red-text);border:0.5px solid var(--red-text);opacity:.8" onclick="cancelarMeuPedido('${p._docId}','${p.id}')"><i class="ti ti-x"></i> Cancelar pedido</button>
      </div>` : '';
    return `<div class="meu-pedido-card status-${p.status}">
      ${banner}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${p.id}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${p.data}</div>
          ${sepInfo}${retInfo}
        </div>
        <div>${badgeFor(p.status)}</div>
      </div>
      <div class="pedido-mats">${(p.itens||[]).map(it=>`<span class="mat-tag">${it.nome} × ${it.qty}</span>`).join('')}</div>
      ${p.obs?`<div class="pedido-obs"><i class="ti ti-notes" style="font-size:12px;margin-right:4px"></i>${p.obs}</div>`:''}
      ${acoes}
    </div>`;
  }

  let html = '';
  if (!sortedAtivos.length) {
    html += `<div class="empty" style="padding:1.5rem 0"><i class="ti ti-inbox" style="font-size:30px;display:block;margin-bottom:8px;opacity:.3"></i>Nenhum pedido ativo.</div>`;
  } else {
    html += sortedAtivos.map(renderCard).join('');
  }

  // Seção de histórico (retirados) — mostra só os 5 mais recentes, com "Ver mais"
  const HIST_PAGE = 5;
  if (retirados.length > 0) {
    const retiradosOrdenados = [...retirados].sort((a,b) => {
      const da = a.criadoEm?.seconds||0, db2 = b.criadoEm?.seconds||0;
      return db2 - da;
    });
    const visiveis = retiradosOrdenados.slice(0, HIST_PAGE);
    const restantes = retiradosOrdenados.slice(HIST_PAGE);
    const cardsVisiveis = visiveis.map(renderCard).join('');
    const cardsRestantes = restantes.length > 0
      ? `<div id="historico-extra" style="display:none;flex-direction:column;gap:8px">${restantes.map(renderCard).join('')}</div>
         <button id="historico-ver-mais-btn" onclick="toggleHistoricoExtra(this)" style="margin-top:6px;width:100%;padding:8px;background:var(--bg);border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:13px;color:var(--brand-dark);cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:6px">
           <i class="ti ti-chevrons-down"></i> Ver mais ${restantes.length} pedido${restantes.length>1?'s':''} antigo${restantes.length>1?'s':''}
         </button>`
      : '';

    html += `<div style="margin-top:1.25rem">
      <button onclick="toggleHistorico(this)" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--brand-light);border:0.5px solid var(--brand-mid);border-radius:var(--radius);cursor:pointer;font-size:13px;font-weight:500;color:var(--brand-dark);font-family:var(--font)">
        <span><i class="ti ti-history" style="margin-right:6px"></i>Histórico de retiradas</span>
        <span style="display:flex;align-items:center;gap:8px"><span style="background:var(--brand-mid);color:var(--brand-darker);border-radius:99px;padding:1px 9px;font-size:12px">${retirados.length}</span><i class="ti ti-chevron-down" style="transition:transform .2s"></i></span>
      </button>
      <div class="historico-ret-list" style="display:none;margin-top:8px;flex-direction:column;gap:8px">
        ${cardsVisiveis}
        ${cardsRestantes}
      </div>
    </div>`;
  }

  el.innerHTML = html;
  // Garante que o histórico começa colapsado
  el.querySelectorAll('.historico-ret-list').forEach(hl => { hl.style.display = 'none'; });
}
window.renderMeusPedidos = renderMeusPedidos;

window.toggleHistorico = function(btn) {
  const list = btn.nextElementSibling;
  const chevron = btn.querySelector('.ti-chevron-down');
  const isOpen = list.style.display !== 'none' && list.style.display !== '';
  list.style.display = isOpen ? 'none' : 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
};

window.toggleHistoricoExtra = function(btn) {
  const extra = document.getElementById('historico-extra');
  if (!extra) return;
  const isOpen = extra.style.display !== 'none' && extra.style.display !== '';
  if (isOpen) {
    extra.style.display = 'none';
    btn.innerHTML = `<i class="ti ti-chevrons-down"></i> Ver mais pedidos antigos`;
  } else {
    extra.style.display = 'flex';
    extra.style.flexDirection = 'column';
    extra.style.gap = '8px';
    btn.innerHTML = `<i class="ti ti-chevrons-up"></i> Recolher`;
  }
};

window.cancelarMeuPedido = async function(docId, pedidoId) {
  const ok = await confirmar({
    titulo: 'Cancelar pedido',
    msg: `Tem certeza que deseja cancelar o pedido <strong>${pedidoId}</strong>?<br>Esta ação não pode ser desfeita.`,
    tipo: 'yellow', labelOk: 'Cancelar pedido', icone: 'ti-circle-x'
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db,'pedidos',docId), { status:'cancelado' });
    toast('Pedido cancelado.','red');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

// ── Edição de pedido pendente pelo técnico ─────────
let editandoPedidoId = null;
let itensPedidoEdit = [];

window.editarPedido = function(docId) {
  const p = pedidos.find(x => x._docId === docId);
  if (!p || p.status !== 'pendente') return;
  editandoPedidoId = docId;
  itensPedidoEdit = p.itens ? p.itens.map(i => ({...i})) : [];

  const overlay = document.createElement('div');
  overlay.id = 'edit-pedido-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(4,44,83,0.55);z-index:2000;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(2px)';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius-lg);border:0.5px solid var(--border-md);box-shadow:0 8px 40px rgba(4,44,83,.22);width:100%;max-width:520px;max-height:90vh;overflow-y:auto;animation:modal-in .18s ease">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:0.5px solid var(--border)">
        <div>
          <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${p.id}</div>
          <div style="font-size:17px;font-weight:600;color:var(--brand-dark)">Editar pedido</div>
        </div>
        <button onclick="fecharEditPedido()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:20px;padding:2px"><i class="ti ti-x"></i></button>
      </div>
      <div style="padding:1.1rem 1.25rem;display:flex;flex-direction:column;gap:1rem">
        <div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px"><i class="ti ti-package"></i> Materiais</div>
          <div id="edit-items-list" style="display:flex;flex-direction:column;gap:7px;margin-bottom:10px"></div>
          <div style="display:flex;gap:8px;margin-top:6px">
            <input type="text" id="edit-mat-manual" placeholder="Adicionar material..." style="flex:1;padding:8px 10px;border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:14px;font-family:var(--font)" />
            <input type="number" id="edit-mat-qty" value="1" min="1" style="width:70px;padding:8px 10px;border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:14px;font-family:var(--font)" />
            <button class="btn btn-primary btn-sm" onclick="editAddItem()"><i class="ti ti-plus"></i></button>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px"><i class="ti ti-notes"></i> Observação</div>
          <textarea id="edit-obs" style="width:100%;padding:8px 10px;border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:14px;font-family:var(--font);resize:vertical;min-height:68px">${p.obs||''}</textarea>
        </div>
      </div>
      <div style="padding:.9rem 1.25rem;border-top:0.5px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-sm" style="background:var(--bg);color:var(--text-muted);border:0.5px solid var(--border-md)" onclick="fecharEditPedido()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="salvarEdicaoPedido()"><i class="ti ti-check"></i> Salvar alterações</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  renderEditItems();
};

function renderEditItems() {
  const el = document.getElementById('edit-items-list');
  if (!el) return;
  if (!itensPedidoEdit.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:6px 0">Nenhum material. Adicione abaixo.</div>';
    return;
  }
  el.innerHTML = itensPedidoEdit.map((it,i) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border-radius:var(--radius);border:0.5px solid var(--border)">
      <span style="flex:1;font-size:14px">${it.nome}</span>
      <input type="number" value="${it.qty}" min="1" style="width:60px;padding:5px 8px;border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:14px;text-align:center;font-family:var(--font)"
        onchange="editSetQty(${i},this.value)" />
      <button onclick="editRemoveItem(${i})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:2px;display:flex"><i class="ti ti-x"></i></button>
    </div>`
  ).join('');
}

window.editAddItem = function() {
  const n = document.getElementById('edit-mat-manual').value.trim();
  const q = parseInt(document.getElementById('edit-mat-qty').value)||1;
  if (!n) return;
  const ex = itensPedidoEdit.find(x => x.nome.toLowerCase()===n.toLowerCase());
  if (ex) ex.qty+=q; else itensPedidoEdit.push({nome:n,qty:q});
  document.getElementById('edit-mat-manual').value='';
  document.getElementById('edit-mat-qty').value=1;
  renderEditItems();
};

window.editSetQty = function(i, val) { itensPedidoEdit[i].qty = Math.max(1,parseInt(val)||1); };
window.editRemoveItem = function(i) { itensPedidoEdit.splice(i,1); renderEditItems(); };

window.fecharEditPedido = function() {
  const ov = document.getElementById('edit-pedido-overlay');
  if (ov) ov.remove();
  editandoPedidoId = null;
  itensPedidoEdit = [];
};

window.salvarEdicaoPedido = async function() {
  if (!editandoPedidoId) return;
  if (!itensPedidoEdit.length) { toast('Adicione ao menos um material.','red'); return; }
  const obs = document.getElementById('edit-obs').value.trim();
  try {
    await updateDoc(doc(db,'pedidos',editandoPedidoId), { itens:[...itensPedidoEdit], obs });
    toast('Pedido atualizado!','green');
    fecharEditPedido();
  } catch(e) { toast('Erro: '+e.message,'red'); }
};


function renderCatalogChips() {
  const searchEl = document.getElementById('cat-search-novo');
  const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
  const grid = document.getElementById('mat-grid');
  if (!q) { grid.innerHTML = ''; return; }
  const filtered = catalogo.filter(m => m.nome.toLowerCase().includes(q) || (m.categoria||'').toLowerCase().includes(q));
  grid.innerHTML = filtered.map(m =>
    `<button class="mat-chip" onclick="addItemFromCat('${m.id}', this)">
      <i class="ti ti-package" aria-hidden="true" style="font-size:13px;opacity:.5"></i>${m.nome}
    </button>`
  ).join('') || `<span style="font-size:13px;color:var(--text-muted)">Nenhum resultado para "<strong>${q}</strong>".</span>`;
}
window.renderCatalogChips = renderCatalogChips;

window.addItemFromCat = function(id, btnEl) {
  const m = catalogo.find(x => x.id===id);
  if (!m) return;

  // Remove qualquer popover aberto
  closeQtyPopover();

  // Cria overlay de fundo
  const overlay = document.createElement('div');
  overlay.className = 'qty-popover-overlay';
  overlay.id = 'qty-popover-overlay';
  overlay.onclick = closeQtyPopover;
  document.body.appendChild(overlay);

  // Cria popover
  const pop = document.createElement('div');
  pop.className = 'qty-popover';
  pop.id = 'qty-popover';
  pop.innerHTML = `
    <div class="qty-popover-title"><i class="ti ti-package" style="font-size:12px;opacity:.5"></i> Quantidade</div>
    <div class="qty-popover-name"><i class="ti ti-package" style="font-size:14px;opacity:.4;color:var(--brand)"></i>${m.nome}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <div class="qty-stepper">
        <button onclick="stepQty(-1)" tabindex="-1">−</button>
        <input type="number" id="popover-qty" value="1" min="1" max="9999"
          onkeydown="if(event.key==='Enter'){confirmQtyPopover();}"
          style="border-left:0.5px solid var(--border-md);border-right:0.5px solid var(--border-md);border-top:0.5px solid var(--border-md);border-bottom:0.5px solid var(--border-md)" />
        <button onclick="stepQty(1)" tabindex="-1">+</button>
      </div>
      <button class="btn btn-primary" style="flex:1;justify-content:center;padding:7px 12px" onclick="confirmQtyPopover()">
        <i class="ti ti-plus"></i> Adicionar
      </button>
    </div>
  `;
  document.body.appendChild(pop);

  // Posiciona o popover abaixo do botão clicado
  if (btnEl) {
    const r = btnEl.getBoundingClientRect();
    const popW = 250;
    let left = r.left;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    let top = r.bottom + 6;
    if (top + 130 > window.innerHeight) top = r.top - 134;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  } else {
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
  }

  // Guarda referência ao item
  pop._itemNome = m.nome;

  // Foca e seleciona o input
  setTimeout(() => {
    const inp = document.getElementById('popover-qty');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
};

window.stepQty = function(delta) {
  const inp = document.getElementById('popover-qty');
  if (!inp) return;
  const v = Math.max(1, (parseInt(inp.value)||1) + delta);
  inp.value = v;
};

window.confirmQtyPopover = function() {
  const pop = document.getElementById('qty-popover');
  if (!pop) return;
  const nome = pop._itemNome;
  const qty = Math.max(1, parseInt(document.getElementById('popover-qty').value)||1);
  const ex = itensPedido.find(x => x.nome===nome);
  if (ex) ex.qty += qty; else itensPedido.push({ nome, qty });
  closeQtyPopover();
  renderItems();
  // Limpa a busca e os chips após adicionar
  const searchEl = document.getElementById('cat-search-novo');
  if (searchEl) { searchEl.value = ''; searchEl.focus(); }
  document.getElementById('mat-grid').innerHTML = '';
  toast(`${nome} adicionado (×${qty})`, 'green');
};

window.closeQtyPopover = function() {
  const ov = document.getElementById('qty-popover-overlay');
  const pop = document.getElementById('qty-popover');
  if (ov) ov.remove();
  if (pop) pop.remove();
};

window.addItemManual = function() {
  const n = document.getElementById('mat-manual').value.trim();
  const q = parseInt(document.getElementById('mat-qty').value)||1;
  if (!n) return;
  const ex = itensPedido.find(x => x.nome.toLowerCase()===n.toLowerCase());
  if (ex) ex.qty+=q; else itensPedido.push({ nome:n, qty:q });
  document.getElementById('mat-manual').value='';
  document.getElementById('mat-qty').value=1;
  renderItems();
};

document.getElementById('mat-manual').addEventListener('keydown', e => { if (e.key==='Enter') window.addItemManual(); });

function renderItems() {
  const list = document.getElementById('items-list');
  const empty = document.getElementById('items-empty');
  if (!itensPedido.length) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  list.innerHTML = itensPedido.map((it,i) =>
    `<div class="item-row">
      <span class="item-name"><i class="ti ti-package" aria-hidden="true" style="font-size:13px;opacity:.4;margin-right:6px"></i>${it.nome}</span>
      <div class="qty-inline-ctrl">
        <button class="qty-inline-btn" onclick="changeItemQty(${i},-1)" title="Diminuir">−</button>
        <input class="qty-inline-input" type="number" value="${it.qty}" min="1" max="9999"
          onchange="setItemQty(${i},this.value)"
          onkeydown="if(event.key==='Enter')this.blur()"
          title="Editar quantidade" />
        <button class="qty-inline-btn" onclick="changeItemQty(${i},1)" title="Aumentar">+</button>
      </div>
      <span style="font-size:12px;color:var(--text-muted);min-width:20px">un.</span>
      <button class="rm-btn" onclick="removeItem(${i})" title="Remover"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>`
  ).join('');
}

window.changeItemQty = function(i, delta) {
  itensPedido[i].qty = Math.max(1, (itensPedido[i].qty || 1) + delta);
  renderItems();
};

window.setItemQty = function(i, val) {
  const q = Math.max(1, parseInt(val) || 1);
  itensPedido[i].qty = q;
  renderItems();
};

window.removeItem = function(i) { itensPedido.splice(i,1); renderItems(); };

window.addCatalogo = async function() {
  const nome = document.getElementById('cat-nome').value.trim();
  const cat = document.getElementById('cat-cat').value.trim();
  limparErros('cat-nome');
  if (!nome) { validarCampo('cat-nome', false, 'Informe o nome do material.'); return; }
  try {
    await addDoc(collection(db,'catalogo'), { nome, categoria:cat||'Geral', criadoEm:serverTimestamp() });
    limparErros('cat-nome');
    document.getElementById('cat-nome').value='';
    document.getElementById('cat-cat').value='';
    toast('Material adicionado!','green');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

window.removeCatalogo = async function(id, nome) {
  const ok = await confirmar({
    titulo: 'Remover material',
    msg: `Tem certeza que deseja remover <strong>${nome}</strong> do catálogo?<br>Esta ação não pode ser desfeita.`,
    tipo: 'red', labelOk: 'Remover', icone: 'ti-trash'
  });
  if (!ok) return;
  try { await deleteDoc(doc(db,'catalogo',id)); toast('Material removido.','blue'); }
  catch(e) { toast('Erro ao remover.','red'); }
};

function renderCatalogo() {
  const el = document.getElementById('cat-list');
  const searchEl = document.getElementById('cat-search');
  const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
  const filtered = q ? catalogo.filter(m => m.nome.toLowerCase().includes(q) || (m.categoria||'').toLowerCase().includes(q)) : catalogo;
  if (!catalogo.length) { el.innerHTML=`<div class="empty"><i class="ti ti-box" aria-hidden="true"></i>Nenhum material cadastrado.</div>`; return; }
  if (!filtered.length) { el.innerHTML=`<div class="empty"><i class="ti ti-search" aria-hidden="true"></i>Nenhum material encontrado para "<strong>${q}</strong>".</div>`; return; }
  el.innerHTML = filtered.map(m =>
    `<div class="cat-row">
      <i class="ti ti-package" aria-hidden="true" style="font-size:15px;opacity:.4;color:var(--brand)"></i>
      <span style="flex:1;font-size:14px;color:var(--text)">${m.nome}</span>
      <span style="font-size:12px;color:var(--text-muted);margin-right:10px;background:var(--brand-light);padding:2px 8px;border-radius:99px;color:var(--brand-dark)">${m.categoria}</span>
      <button class="rm-btn" onclick="removeCatalogo('${m.id}', ${JSON.stringify(m.nome)})" title="Remover"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>`
  ).join('');
}

/* ─── Pedidos ──────────────────────────────────── */
window.enviarPedido = async function() {
  const nome = document.getElementById('tecnico-nome').value.trim();
  if (!nome) { toast('Selecione seu código antes de enviar.','red'); return; }
  if (!itensPedido.length) { toast('Adicione ao menos um material ao pedido.','red'); return; }
  const obs = document.getElementById('obs').value.trim();
  const id = 'PD' + Date.now().toString(36).toUpperCase().slice(-6);
  const itensCopia = [...itensPedido];
  try {
    await addDoc(collection(db,'pedidos'), {
      id, tecnico:nome, itens:itensCopia, obs,
      status:'pendente',
      data: new Date().toLocaleString('pt-BR'),
      criadoEm: serverTimestamp(),
      separadoPor:null, separadoEm:null, dataRetirada:null, retiradoPor:null, retiradoEm:null
    });
    itensPedido=[];
    document.getElementById('obs').value='';
    renderItems();
    if (tecnicoLogado) checkPedidosProntos(tecnicoLogado);
    // Feedback visual e redirecionamento para Meus Pedidos
    mostrarSucessoPedido(id, itensCopia);
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

function mostrarSucessoPedido(id, itens) {
  // Cria overlay de sucesso
  const ov = document.createElement('div');
  ov.id = 'sucesso-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(4,44,83,0.55);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(2px);animation:modal-in .2s ease';
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius-lg);border:0.5px solid var(--border-md);box-shadow:0 8px 40px rgba(4,44,83,.22);width:100%;max-width:400px;overflow:hidden;animation:modal-in .2s ease;text-align:center">
      <div style="background:var(--green);padding:2rem 1.5rem 1.5rem">
        <div style="width:56px;height:56px;background:rgba(255,255,255,.18);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px;color:#fff">
          <i class="ti ti-circle-check"></i>
        </div>
        <div style="font-size:20px;font-weight:600;color:#fff">Pedido enviado!</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px;font-family:var(--font-mono)">${id}</div>
      </div>
      <div style="padding:1.25rem 1.5rem">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;line-height:1.6">
          Você será notificado quando seu pedido estiver pronto para retirada.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:16px">
          ${itens.slice(0,4).map(it=>`<span style="background:var(--bg);border:0.5px solid var(--border-md);border-radius:99px;padding:3px 10px;font-size:12px;color:var(--brand-dark)">${it.nome} × ${it.qty}</span>`).join('')}
          ${itens.length>4?`<span style="background:var(--bg);border:0.5px solid var(--border-md);border-radius:99px;padding:3px 10px;font-size:12px;color:var(--text-muted)">+${itens.length-4} mais</span>`:''}
        </div>
        <button onclick="fecharSucessoIrParaMeusPedidos()" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:15px">
          <i class="ti ti-clipboard-list"></i> Ver meus pedidos
        </button>
        <button onclick="fecharSucesso()" style="width:100%;margin-top:8px;background:none;border:none;font-size:13px;color:var(--text-muted);cursor:pointer;padding:6px;font-family:var(--font)">
          Fazer novo pedido
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
}

window.fecharSucessoIrParaMeusPedidos = function() {
  const ov = document.getElementById('sucesso-overlay');
  if (ov) ov.remove();
  showSection('meus-pedidos');
};

window.fecharSucesso = function() {
  const ov = document.getElementById('sucesso-overlay');
  if (ov) ov.remove();
};

function renderStats() {
  const total=pedidos.length;
  const pendente=pedidos.filter(p=>p.status==='pendente').length;
  const separado=pedidos.filter(p=>p.status==='separado').length;
  const retirado=pedidos.filter(p=>p.status==='retirado').length;
  document.getElementById('stats-grid').innerHTML=`
    <div class="stat-card"><div class="stat-val">${total}</div><div class="stat-lbl">Total</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--amber-text)">${pendente}</div><div class="stat-lbl">Pendentes</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--brand)">${separado}</div><div class="stat-lbl">Separados</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--green)">${retirado}</div><div class="stat-lbl">Retirados</div></div>
  `;
}

const PEDIDOS_POR_PAGINA = 20;
let paginaAtual = 1;

window.pedidosPagina = function(delta) {
  paginaAtual += delta;
  renderPedidos();
};

function renderPedidos() {
  const ft = document.getElementById('filtro-tecnico').value.toLowerCase();
  const fs = document.getElementById('filtro-status').value;
  const fd = document.getElementById('filtro-data').value;
  // Reset page when filters change
  if (renderPedidos._lastFt !== ft || renderPedidos._lastFs !== fs || renderPedidos._lastFd !== fd) {
    paginaAtual = 1;
    renderPedidos._lastFt = ft; renderPedidos._lastFs = fs; renderPedidos._lastFd = fd;
    renderPedidos._cachedLista = null; // invalida cache de filtro
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  function parsePtBR(str) {
    if (!str) return null;
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return new Date(+m[3], +m[2]-1, +m[1]);
  }

  const lista = pedidos.filter(p => {
    if (ft && !p.tecnico.toLowerCase().includes(ft)) return false;
    if (fs && p.status !== fs) return false;
    if (fd) {
      const d = parsePtBR(p.data);
      if (!d) return false;
      if (fd === 'hoje' && d < startOfDay) return false;
      if (fd === 'semana' && d < startOfWeek) return false;
      if (fd === 'mes' && d < startOfMonth) return false;
    }
    return true;
  });

  const el = document.getElementById('pedidos-list');
  const pagEl = document.getElementById('pedidos-pagination');
  const totalPags = Math.max(1, Math.ceil(lista.length / PEDIDOS_POR_PAGINA));
  paginaAtual = Math.min(Math.max(1, paginaAtual), totalPags);

  if (!lista.length) {
    el.innerHTML=`<div class="empty"><i class="ti ti-inbox" aria-hidden="true"></i>Nenhum pedido encontrado.</div>`;
    pagEl.style.display = 'none';
    return;
  }

  const inicio = (paginaAtual - 1) * PEDIDOS_POR_PAGINA;
  const pagina = lista.slice(inicio, inicio + PEDIDOS_POR_PAGINA);

  el.innerHTML = pagina.map(p => {
    let extra='';
    if (p.separadoPor) extra+=`<div style="font-size:12px;color:var(--text-muted);margin-top:3px"><i class="ti ti-user" aria-hidden="true" style="font-size:12px;margin-right:3px"></i>Separado por <strong style="color:var(--brand-dark)">${p.separadoPor}</strong></div>`;
    if (p.retiradoPor) extra+=`<div style="font-size:12px;color:var(--text-muted);margin-top:2px"><i class="ti ti-package-export" aria-hidden="true" style="font-size:12px;margin-right:3px"></i>Retirado por <strong style="color:var(--brand-dark)">${p.retiradoPor}</strong> em ${p.dataRetirada}</div>`;
    return `<div class="pedido-card">
      <div class="pedido-header">
        <div><div class="pedido-id">${p.id}</div><div class="pedido-tecnico">${p.tecnico}</div>${extra}</div>
        <div style="text-align:right">${badgeFor(p.status)}<div class="pedido-data" style="margin-top:4px">${p.data}</div></div>
      </div>
      <div class="pedido-mats">${p.itens.map(it=>`<span class="mat-tag">${it.nome} × ${it.qty}</span>`).join('')}</div>
      ${p.obs?`<div class="pedido-obs"><i class="ti ti-notes" aria-hidden="true" style="font-size:12px;margin-right:4px"></i>${p.obs}</div>`:''}
    </div>`;
  }).join('');

  // Pagination controls
  if (lista.length > PEDIDOS_POR_PAGINA) {
    pagEl.style.display = 'flex';
    document.getElementById('pag-info').textContent = `Página ${paginaAtual} de ${totalPags} (${lista.length} pedidos)`;
    document.getElementById('pag-prev').disabled = paginaAtual <= 1;
    document.getElementById('pag-next').disabled = paginaAtual >= totalPags;
    document.getElementById('pag-prev').style.opacity = paginaAtual <= 1 ? '.4' : '1';
    document.getElementById('pag-next').style.opacity = paginaAtual >= totalPags ? '.4' : '1';
  } else {
    pagEl.style.display = 'none';
  }
}

/* ─── Kanban ───────────────────────────────────── */
function getNomeEstoque() {
  const n = document.getElementById('estoque-nome').value.trim();
  if (!n) { toast('Informe seu nome antes de continuar.','red'); return null; }
  return n;
}

window.marcarEmSeparacao = async function(docId) {
  const nome = getNomeEstoque(); if (!nome) return;
  try {
    await updateDoc(doc(db,'pedidos',docId), { status:'em_separacao', emSeparacaoPor:nome });
    toast('Pedido em separação!','blue');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

window.marcarSeparado = async function(docId) {
  const nome = getNomeEstoque(); if (!nome) return;
  try {
    await updateDoc(doc(db,'pedidos',docId), {
      status:'separado',
      separadoPor: nome,
      separadoEm: serverTimestamp()
    });
    toast('Pedido marcado como separado!','blue');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

window.confirmarRetirada = async function(docId) {
  const nome = getNomeEstoque(); if (!nome) return;
  try {
    await updateDoc(doc(db,'pedidos',docId), {
      status:'retirado',
      retiradoPor: nome,
      retiradoEm: serverTimestamp(),
      dataRetirada: new Date().toLocaleString('pt-BR')
    });
    toast('Retirada confirmada!','green');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

window.cancelarPedido = async function(docId) {
  const nome = getNomeEstoque(); if (!nome) return;
  try {
    await updateDoc(doc(db,'pedidos',docId), { status:'cancelado' });
    toast('Pedido cancelado.','red');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

window.deletarRetirado = async function(docId) {
  const ok = await confirmar({
    titulo: 'Apagar pedido',
    msg: 'Tem certeza que deseja apagar este pedido retirado?<br>Esta ação <strong>não pode ser desfeita</strong>.',
    tipo: 'red', labelOk: 'Apagar', icone: 'ti-trash'
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db,'pedidos',docId));
    toast('Pedido removido do histórico.','red');
  } catch(e) { toast('Erro: '+e.message,'red'); }
};

window.abrirModal = function(docId) {
  const p = pedidos.find(x => x._docId === docId);
  if (!p) return;
  document.getElementById('modal-id').textContent = p.id;
  document.getElementById('modal-tecnico').textContent = p.tecnico;
  document.getElementById('modal-badge').innerHTML = badgeFor(p.status);
  // Materiais — todos, sem limite
  document.getElementById('modal-mats').innerHTML = p.itens.map(it =>
    `<div class="modal-mat-row">
      <span class="modal-mat-name"><i class="ti ti-package" aria-hidden="true" style="opacity:.4;font-size:13px"></i>${it.nome}</span>
      <span class="modal-mat-qty">${it.qty} un.</span>
    </div>`
  ).join('');
  // Observação
  if (p.obs) {
    document.getElementById('modal-obs').textContent = p.obs;
    document.getElementById('modal-obs-wrap').style.display = 'block';
  } else {
    document.getElementById('modal-obs-wrap').style.display = 'none';
  }
  // Informações
  let infos = `<div class="modal-info-row"><i class="ti ti-calendar" aria-hidden="true"></i> Pedido em <strong>${p.data}</strong></div>`;
  if (p.separadoPor) infos += `<div class="modal-info-row"><i class="ti ti-user" aria-hidden="true"></i> Separado por <strong>${p.separadoPor}</strong></div>`;
  if (p.retiradoPor)  infos += `<div class="modal-info-row"><i class="ti ti-package-export" aria-hidden="true"></i> Retirado por <strong>${p.retiradoPor}</strong> em <strong>${p.dataRetirada}</strong></div>`;
  document.getElementById('modal-infos').innerHTML = infos;
  // Botões no footer
  let footer = '';
  const nome = document.getElementById('estoque-nome').value.trim();
  if (p.status === 'pendente') {
    footer = `<button class="btn btn-sm" style="background:#F3E8FF;color:#5B21B6;border:none" onclick="marcarEmSeparacao('${p._docId}');closeModal()"><i class="ti ti-loader" aria-hidden="true"></i> Iniciar separação</button>
              <button class="btn btn-sm" style="background:var(--red-bg);color:var(--red-text);border:none" onclick="cancelarPedido('${p._docId}');closeModal()"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>`;
  } else if (p.status === 'em_separacao') {
    footer = `<button class="btn btn-primary btn-sm" onclick="marcarSeparado('${p._docId}');closeModal()"><i class="ti ti-check" aria-hidden="true"></i> Marcar como separado</button>`;
  } else if (p.status === 'separado') {
    footer = `<button class="btn btn-success btn-sm" onclick="confirmarRetirada('${p._docId}');closeModal()"><i class="ti ti-package-export" aria-hidden="true"></i> Confirmar retirada</button>`;
  }
  document.getElementById('modal-footer').innerHTML = footer || `<button class="btn btn-sm" style="background:var(--bg);color:var(--text-muted);border:0.5px solid var(--border-md)" onclick="closeModal()">Fechar</button>`;
  document.getElementById('modal-overlay').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('open');
};

window.fecharModal = function(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
};

function kanbanCard(p) {
  const mats = p.itens.slice(0,3).map(it=>`<span class="kanban-mat">${it.nome} ×${it.qty}</span>`).join('');
  const mais = p.itens.length>3 ? `<span class="kanban-mat">+${p.itens.length-3} mais</span>` : '';
  let actions = '';
  if (p.status==='pendente') {
    actions = `
      <button class="btn btn-sm" style="background:#F3E8FF;color:#5B21B6;border:none" onclick="marcarEmSeparacao('${p._docId}')"><i class="ti ti-loader" aria-hidden="true"></i> Iniciar separação</button>
      <button class="btn btn-sm" style="background:var(--red-bg);color:var(--red-text);border:none" onclick="cancelarPedido('${p._docId}')"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>
    `;
  } else if (p.status==='em_separacao') {
    actions = `
      <button class="btn btn-primary btn-sm" onclick="marcarSeparado('${p._docId}')"><i class="ti ti-check" aria-hidden="true"></i> Separado</button>
    `;
  } else if (p.status==='separado') {
    actions = `<button class="btn btn-success btn-sm" onclick="confirmarRetirada('${p._docId}')"><i class="ti ti-package-export" aria-hidden="true"></i> Confirmar retirada</button>`;
  } else if (p.status==='retirado') {
    actions = `<button class="kanban-delete-btn" onclick="deletarRetirado('${p._docId}')"><i class="ti ti-trash" aria-hidden="true"></i> Remover</button>`;
  }
  const sepInfo = p.separadoPor ? `<div class="kanban-sep-by"><i class="ti ti-user" aria-hidden="true" style="font-size:11px;margin-right:3px"></i>Separado por <strong>${p.separadoPor}</strong></div>` : '';
  const retInfo = p.retiradoPor ? `<div class="kanban-sep-by"><i class="ti ti-package-export" aria-hidden="true" style="font-size:11px;margin-right:3px"></i>Retirado por <strong>${p.retiradoPor}</strong>${p.dataRetirada ? ` — ${p.dataRetirada}` : ''}</div>` : '';
  const arrastavel = p.status !== 'retirado';
  return `<div class="kanban-card" onclick="abrirModal('${p._docId}')" style="cursor:pointer" title="Ver detalhes completos"
    draggable="${arrastavel}"
    ondragstart="onKanbanDragStart(event,'${p._docId}','${p.status}')"
    ondragend="onKanbanDragEnd(event)">
    <div class="kanban-card-id">${p.id}</div>
    <div class="kanban-card-tecnico"><i class="ti ti-user" aria-hidden="true" style="font-size:13px;opacity:.5;margin-right:4px"></i>${p.tecnico}</div>
    <div class="kanban-card-mats">${mats}${mais}</div>
    ${p.obs?`<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-bottom:6px">${p.obs}</div>`:''}
    <div class="kanban-card-data"><i class="ti ti-clock" aria-hidden="true" style="font-size:11px;margin-right:3px"></i>${p.data}</div>
    ${sepInfo}${retInfo}
    ${actions?`<div class="kanban-card-actions" onclick="event.stopPropagation()">${actions}</div>`:''}
  </div>`;
}

function renderKanban() {
  const cols = [
    { key:'pendente',     label:'Pendente',     icon:'ti-clock' },
    { key:'em_separacao', label:'Em Separação',  icon:'ti-loader' },
    { key:'separado',     label:'Separado',      icon:'ti-check' },
    { key:'retirado',     label:'Retirado',      icon:'ti-package-export' }
  ];
  const KANBAN_RET_LIMIT = 5;
  document.getElementById('kanban-board').innerHTML = cols.map(col => {
    const items = pedidos.filter(p=>p.status===col.key);
    let cards = '';
    if (!items.length) {
      cards = `<div class="kanban-empty"><i class="ti ${col.icon}" aria-hidden="true"></i>Nenhum pedido</div>`;
    } else if (col.key === 'retirado' && items.length > KANBAN_RET_LIMIT) {
      // Ordena mais recentes primeiro
      const sorted = [...items].sort((a,b)=>(b.criadoEm?.seconds||0)-(a.criadoEm?.seconds||0));
      const visiveis = sorted.slice(0, KANBAN_RET_LIMIT);
      const extras = sorted.slice(KANBAN_RET_LIMIT);
      cards = visiveis.map(kanbanCard).join('');
      cards += `<div id="kanban-ret-extra" style="display:none;flex-direction:column;gap:8px">${extras.map(kanbanCard).join('')}</div>`;
      cards += `<button id="kanban-ret-mais-btn" onclick="toggleKanbanRetExtra(this)" style="margin-top:4px;width:100%;padding:7px;background:var(--bg);border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:12px;color:var(--brand-dark);cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:5px">
        <i class="ti ti-chevrons-down"></i> Ver mais ${extras.length} retirado${extras.length>1?'s':''}
      </button>`;
    } else {
      cards = items.map(kanbanCard).join('');
    }
    return `<div class="kanban-col col-${col.key}">
      <div class="kanban-col-header">
        <div class="kanban-col-title"><i class="ti ${col.icon}" aria-hidden="true"></i>${col.label}</div>
        <span class="col-count">${items.length}</span>
      </div>
      <div class="kanban-col-body"
        ondragover="onKanbanDragOver(event)"
        ondragleave="onKanbanDragLeave(event)"
        ondrop="onKanbanDrop(event,'${col.key}')">${cards}</div>
    </div>`;
  }).join('');
}

window.toggleKanbanRetExtra = function(btn) {
  const extra = document.getElementById('kanban-ret-extra');
  if (!extra) return;
  const isOpen = extra.style.display !== 'none' && extra.style.display !== '';
  if (isOpen) {
    extra.style.display = 'none';
    btn.innerHTML = `<i class="ti ti-chevrons-down"></i> Ver mais retirados`;
  } else {
    extra.style.display = 'flex';
    extra.style.flexDirection = 'column';
    extra.style.gap = '8px';
    btn.innerHTML = `<i class="ti ti-chevrons-up"></i> Recolher`;
  }
};

/* ─── Kanban: arrastar e soltar ──────────────────── */
window.onKanbanDragStart = function(e, docId, status) {
  try { e.dataTransfer.setData('text/plain', JSON.stringify({ docId, status })); } catch(err) {}
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
};
window.onKanbanDragEnd = function(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.kanban-col-body.drag-over').forEach(el => el.classList.remove('drag-over'));
};
window.onKanbanDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
};
window.onKanbanDragLeave = function(e) {
  if (e.currentTarget === e.target) e.currentTarget.classList.remove('drag-over');
};
window.onKanbanDrop = function(e, paraStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  let dados;
  try { dados = JSON.parse(e.dataTransfer.getData('text/plain')); } catch(err) { return; }
  if (!dados || !dados.docId || dados.status === paraStatus) return;
  const transicao = dados.status + '→' + paraStatus;
  if (transicao === 'pendente→em_separacao') window.marcarEmSeparacao(dados.docId);
  else if (transicao === 'em_separacao→separado') window.marcarSeparado(dados.docId);
  else if (transicao === 'separado→retirado') window.confirmarRetirada(dados.docId);
  else toast('Mova um passo de cada vez: Pendente → Em Separação → Separado → Retirado.', 'red');
};

/* ─── Firebase listeners ───────────────────────── */
async function init() {
  let tecnicosRestorado = false;
  onSnapshot(query(collection(db,'tecnicos'), orderBy('criadoEm','asc')), snap => {
    tecnicos = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderTecSelect();
    renderTecChips();

    // Restaura login do técnico salvo no celular (só na primeira carga)
    if (!tecnicosRestorado) {
      tecnicosRestorado = true;
      try {
        const salvo = localStorage.getItem('tecnico_nome');
        if (salvo && tecnicos.find(t => t.codigo === salvo) && !tecnicoLogado) {
          tecSelecionado = salvo;
          tecnicoLogado = salvo;
          document.getElementById('tecnico-nome').value = salvo;
          document.getElementById('tecnico-login-overlay').style.display = 'none';
          const bar = document.getElementById('tecnico-logged-bar');
          bar.style.display = 'flex';
          document.getElementById('tecnico-logged-nome').textContent = salvo;
          document.getElementById('card-tecnico-nome').style.display = 'block';
          document.getElementById('tab-meus-pedidos').style.display = '';
          verificarBannerNotif('tec');
        }
      } catch(e) {}
    }
  });

  onSnapshot(query(collection(db,'catalogo'), orderBy('criadoEm','asc')), snap => {
    catalogo = snap.docs.map(d=>({id:d.id,...d.data()}));
    catalogoCarregado = true;
    // Persiste catálogo no localStorage para não perder no F5
    try { localStorage.setItem('catalogo_cache', JSON.stringify(catalogo)); } catch(e){}
    renderCatalogChips();
    if (document.getElementById('sec-catalogo').classList.contains('active')) renderCatalogo();
  });

  onSnapshot(query(collection(db,'pedidos'), orderBy('criadoEm','desc')), snap => {
    pedidos = snap.docs.map(d=>({_docId:d.id,...d.data()}));
    pedidosCarregados = true;
    // ── Detecta novos pedidos e mudanças de status ──
    verificarEventosNotif(pedidos);
    if (document.getElementById('sec-pedidos').classList.contains('active')) { renderStats(); renderPedidos(); }
    if (document.getElementById('sec-estoque').classList.contains('active')) { renderKanban(); if(auth.currentUser) renderDashboard(); }
    if (document.getElementById('sec-dashboard').classList.contains('active')) renderDashboard();
    if (document.getElementById('sec-meus-pedidos').classList.contains('active')) renderMeusPedidos();
    // Atualiza notificação do técnico logado
    if (tecnicoLogado) checkPedidosProntos(tecnicoLogado);
  });

  document.getElementById('loading-overlay').style.display='none';

  const snap = await getDocs(collection(db,'catalogo'));
  if (snap.empty) {
    const defaults = [
      {nome:'Cabo UTP Cat6',categoria:'Cabos'},{nome:'Conector RJ45',categoria:'Cabos'},
      {nome:'Switch 8 portas',categoria:'Equipamentos'},{nome:'Patch panel 24p',categoria:'Equipamentos'},
      {nome:'Roteador WiFi',categoria:'Equipamentos'},{nome:'Organizador de cabos',categoria:'Acessórios'},
      {nome:'Abraçadeiras',categoria:'Acessórios'},{nome:'Fita isolante',categoria:'Acessórios'},
    ];
    for (const m of defaults) await addDoc(collection(db,'catalogo'),{...m,criadoEm:serverTimestamp()});
  }
}

init().catch(e => {
  document.getElementById('loading-overlay').innerHTML =
    `<div style="text-align:center;padding:2rem;color:var(--red-text)">
      <i class="ti ti-wifi-off" style="font-size:40px;display:block;margin-bottom:12px;opacity:.5"></i>
      <strong>Erro ao conectar ao Firebase</strong><br>
      <span style="font-size:13px;color:var(--text-muted)">${e.message}</span>
    </div>`;
});

/* ─── Dashboard ─────────────────────────────────── */
let dashPeriod = 7;
let chartLinha = null;
let chartPizza = null;

window.setDashPeriod = function(dias, btn) {
  dashPeriod = parseInt(dias);
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDashboard();
};

function filterByPeriod(lista) {
  if (!dashPeriod) return lista;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dashPeriod);
  return lista.filter(p => {
    const d = parseDataPedido(p);
    return d ? d >= cutoff : true;
  });
}

function parseDataPedido(p) {
  if (p.criadoEm && p.criadoEm.toDate) return p.criadoEm.toDate();
  if (p.data) {
    const [dt, hr] = p.data.split(' ');
    const [d,m,y] = dt.split('/');
    return new Date(`${y}-${m}-${d}T${hr||'00:00'}:00`);
  }
  return null;
}

function renderDashboard() {
  const lista = filterByPeriod(pedidos);
  const total = lista.length;
  const pendentes = lista.filter(p=>p.status==='pendente').length;
  const emSep = lista.filter(p=>p.status==='em_separacao').length;
  const separados = lista.filter(p=>p.status==='separado').length;
  const retirados = lista.filter(p=>p.status==='retirado').length;
  const cancelados = lista.filter(p=>p.status==='cancelado').length;

  // KPIs
  const kpiData = [
    { icon:'ti-clipboard-list', cor:'#E6F1FB', iconCor:'#185FA5', val:total, lbl:'Total de pedidos' },
    { icon:'ti-clock', cor:'#FAEEDA', iconCor:'#633806', val:pendentes, lbl:'Pendentes' },
    { icon:'ti-loader', cor:'#F3E8FF', iconCor:'#5B21B6', val:emSep, lbl:'Em Separação' },
    { icon:'ti-check', cor:'#E6F1FB', iconCor:'#0C447C', val:separados, lbl:'Separados' },
    { icon:'ti-package-export', cor:'#EAF3DE', iconCor:'#27500A', val:retirados, lbl:'Retirados' },
  ];
  document.getElementById('dash-kpis').innerHTML = kpiData.map(k => `
    <div class="dash-kpi">
      <div class="dash-kpi-icon" style="background:${k.cor};color:${k.iconCor}"><i class="ti ${k.icon}"></i></div>
      <div>
        <div class="dash-kpi-val">${k.val}</div>
        <div class="dash-kpi-lbl">${k.lbl}</div>
      </div>
    </div>`).join('');

  // Gráfico linha — pedidos por dia
  const numDias = dashPeriod || 30;
  const diasMap = {};
  const hoje = new Date();
  for (let i = numDias - 1; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(d.getDate() - i);
    diasMap[d.toLocaleDateString('pt-BR')] = 0;
  }
  lista.forEach(p => {
    const d = parseDataPedido(p); if(!d) return;
    const key = d.toLocaleDateString('pt-BR');
    if (key in diasMap) diasMap[key]++;
  });
  if (chartLinha) {
    chartLinha.data.labels = Object.keys(diasMap);
    chartLinha.data.datasets[0].data = Object.values(diasMap);
    chartLinha.update('none');
  } else {
    chartLinha = new Chart(document.getElementById('chart-linha').getContext('2d'), {
      type: 'line',
      data: {
        labels: Object.keys(diasMap),
        datasets: [{ label:'Pedidos', data:Object.values(diasMap), borderColor:'#185FA5', backgroundColor:'rgba(24,95,165,0.10)', tension:0.4, fill:true, pointBackgroundColor:'#185FA5', pointRadius:4 }]
      },
      options: { responsive:true, plugins:{legend:{display:false}}, scales:{ x:{ticks:{font:{size:11},maxRotation:45,color:'#5a7fa8'},grid:{color:'rgba(24,95,165,0.07)'}}, y:{beginAtZero:true,ticks:{stepSize:1,color:'#5a7fa8',font:{size:11}},grid:{color:'rgba(24,95,165,0.07)'}} } }
    });
  }

  // Gráfico pizza
  const pizzaLabels = ['Pendente','Em Separação','Separado','Retirado','Cancelado'];
  const pizzaData = [pendentes, emSep, separados, retirados, cancelados];
  const pizzaCores = ['#F5C06A','#A78BFA','#5FA8E5','#7BC64E','#E57373'];
  if (chartPizza) {
    chartPizza.data.datasets[0].data = pizzaData;
    chartPizza.update('none');
  } else {
    chartPizza = new Chart(document.getElementById('chart-pizza').getContext('2d'), {
      type: 'doughnut',
      data: { labels:pizzaLabels, datasets:[{data:pizzaData, backgroundColor:pizzaCores, borderWidth:2, borderColor:'#fff'}] },
      options: { responsive:true, cutout:'65%', plugins:{legend:{display:false}} }
    });
  }
  document.getElementById('dash-legend').innerHTML = pizzaLabels.map((l,i) =>
    `<div class="dash-legend-row"><div class="dash-legend-dot" style="background:${pizzaCores[i]}"></div><span>${l}</span><span style="margin-left:auto;font-weight:600;color:var(--brand-dark)">${pizzaData[i]}</span></div>`
  ).join('');

  // Top materiais
  const matCount = {};
  lista.forEach(p => (p.itens||[]).forEach(it => { matCount[it.nome] = (matCount[it.nome]||0) + it.qty; }));
  const topMats = Object.entries(matCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxMat = topMats[0]?.[1] || 1;
  document.getElementById('dash-top-mats').innerHTML = topMats.length
    ? topMats.map(([nome,qty]) => `<div class="dash-bar-row"><div class="dash-bar-label" title="${nome}">${nome}</div><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round(qty/maxMat*100)}%"></div></div><div class="dash-bar-count">${qty}</div></div>`).join('')
    : '<div class="empty" style="padding:1.5rem 0"><i class="ti ti-package" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3"></i>Sem dados</div>';

  // Top técnicos
  const tecCount = {};
  lista.forEach(p => { if(p.tecnico) tecCount[p.tecnico]=(tecCount[p.tecnico]||0)+1; });
  const topTecs = Object.entries(tecCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxTec = topTecs[0]?.[1] || 1;
  document.getElementById('dash-top-tecs').innerHTML = topTecs.length
    ? topTecs.map(([nome,qty]) => `<div class="dash-bar-row"><div class="dash-bar-label" title="${nome}">${nome}</div><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round(qty/maxTec*100)}%;background:#639922"></div></div><div class="dash-bar-count">${qty}</div></div>`).join('')
    : '<div class="empty" style="padding:1.5rem 0"><i class="ti ti-users" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3"></i>Sem dados</div>';

  // Tempo médio
  function fmtMs(ms) { const m=Math.round(ms/60000); if(m<60) return m+'min'; const h=Math.floor(m/60),rm=m%60; return h+'h'+(rm?rm+'min':''); }
  const temposS = lista.filter(p=>p.separadoEm).map(p=>{ const c=parseDataPedido(p); const s=p.separadoEm?.toDate?.(); return c&&s?s-c:null; }).filter(Boolean);
  const temposR = lista.filter(p=>p.retiradoEm).map(p=>{ const c=parseDataPedido(p); const r=p.retiradoEm?.toDate?.(); return c&&r?r-c:null; }).filter(Boolean);
  const mediaS = temposS.length ? temposS.reduce((a,b)=>a+b,0)/temposS.length : null;
  const mediaR = temposR.length ? temposR.reduce((a,b)=>a+b,0)/temposR.length : null;
  document.getElementById('dash-tempos').innerHTML = `
    <div class="dash-tempo-card"><div class="dash-tempo-val">${mediaS?fmtMs(mediaS):'—'}</div><div class="dash-tempo-lbl">Pedido → Separação</div></div>
    <div class="dash-tempo-card"><div class="dash-tempo-val">${mediaR?fmtMs(mediaR):'—'}</div><div class="dash-tempo-lbl">Pedido → Retirada</div></div>
    <div class="dash-tempo-card"><div class="dash-tempo-val">${total?Math.round(retirados/total*100)+'%':'—'}</div><div class="dash-tempo-lbl">Taxa de conclusão</div></div>
    <div class="dash-tempo-card"><div class="dash-tempo-val">${total?Math.round(cancelados/total*100)+'%':'—'}</div><div class="dash-tempo-lbl">Taxa de cancelamento</div></div>
  `;
}

/* ═══════════════════════════════════════════════
   SISTEMA DE NOTIFICAÇÕES
   ═══════════════════════════════════════════════ */

let notifPermissao = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
let pedidosAnteriores = null; // null = primeira carga (não dispara notif)
let statusAnteriores = {};    // { docId: status } — detecta troca para 'separado'

// ── In-app balloon (canto inferior direito) ─────
function mostrarInAppNotif(tipo, titulo, msg) {
  const container = document.getElementById('inapp-notif-overlay');
  if (!container) return;
  const id = 'notif-' + Date.now();
  const agora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const icon = tipo === 'novo' ? 'ti-clipboard-list' : 'ti-bell-ringing';
  const div = document.createElement('div');
  div.id = id;
  div.className = `inapp-notif tipo-${tipo}`;
  div.innerHTML = `
    <div class="inapp-notif-icon"><i class="ti ${icon}"></i></div>
    <div class="inapp-notif-body">
      <div class="inapp-notif-title">${titulo}</div>
      <div class="inapp-notif-msg">${msg}</div>
      <div class="inapp-notif-time">${agora}</div>
    </div>
    <button class="inapp-notif-close" onclick="fecharInAppNotif('${id}')"><i class="ti ti-x"></i></button>
    <div class="inapp-notif-progress"></div>`;
  container.appendChild(div);
  // Som sutil
  if (somAtivado()) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(tipo==='novo' ? 880 : 660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(tipo==='novo' ? 1100 : 880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } catch(e) {}
  }
  setTimeout(() => fecharInAppNotif(id), 6000);
}
window.fecharInAppNotif = function(id) {
  const el = document.getElementById(id); if (!el) return;
  el.style.animation = 'notif-slide-out .25s ease forwards';
  setTimeout(() => el.remove(), 260);
};

// ── Push do sistema operacional ─────────────────
function dispararPushNotif(titulo, corpo) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(titulo, {
      body: corpo,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%23185FA5"/><text x="32" y="44" text-anchor="middle" font-size="32">📦</text></svg>',
      tag: titulo, renotify: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 9000);
  } catch(e) {}
}

// ── Solicitar permissão ─────────────────────────
window.solicitarPermissaoNotif = async function(quem) {
  if (typeof Notification === 'undefined') { toast('Navegador não suporta notificações.','red'); return; }
  const perm = await Notification.requestPermission();
  notifPermissao = perm;
  if (perm === 'granted') {
    try { localStorage.setItem('notif_perm_'+quem,'granted'); } catch(e) {}
    dispensarBannerNotif(quem);
    toast('Notificações ativadas! ✅','green');
    dispararPushNotif('✅ Notificações ativadas!','Você receberá avisos em tempo real.');
  } else {
    toast('Permissão negada. Ative nas configurações do navegador.','red');
  }
};
window.dispensarBannerNotif = function(quem) {
  const bar = document.getElementById('notif-permission-bar-'+quem);
  if (bar) bar.classList.remove('show');
  try { localStorage.setItem('notif_dismissed_'+quem,'1'); } catch(e) {}
};

// ── Mostra banner se ainda não pediu permissão ──
function verificarBannerNotif(quem) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
  try { if (localStorage.getItem('notif_dismissed_'+quem)) return; } catch(e) {}
  const bar = document.getElementById('notif-permission-bar-'+quem);
  if (bar) bar.classList.add('show');
}

// ── Motor de detecção de eventos ────────────────
function verificarEventosNotif(novosPedidos) {
  if (pedidosAnteriores === null) {
    // Primeira carga — só registra, não notifica
    pedidosAnteriores = new Set(novosPedidos.map(p => p._docId));
    novosPedidos.forEach(p => { statusAnteriores[p._docId] = p.status; });
    return;
  }

  novosPedidos.forEach(p => {
    const jaExistia = pedidosAnteriores.has(p._docId);

    if (!jaExistia) {
      // ── NOVO PEDIDO — avisa o estoque ──────────
      pedidosAnteriores.add(p._docId);
      statusAnteriores[p._docId] = p.status;
      const user = auth.currentUser;
      if (user && user.email.endsWith('@viuinternet.com.br')) {
        const itensStr = (p.itens||[]).slice(0,3).map(it=>`${it.nome} ×${it.qty}`).join(', ');
        mostrarInAppNotif('novo',
          `📦 Novo pedido de ${p.tecnico}`,
          itensStr || 'Pedido sem itens'
        );
        dispararPushNotif(
          `📦 Novo pedido — ${p.tecnico}`,
          itensStr || 'Pedido sem itens'
        );
      }
    } else {
      const statusAnterior = statusAnteriores[p._docId];
      // ── STATUS MUDOU PARA SEPARADO — avisa o técnico ──
      if (statusAnterior && statusAnterior !== 'separado' && p.status === 'separado') {
        if (tecnicoLogado && p.tecnico === tecnicoLogado) {
          const itensStr = (p.itens||[]).slice(0,3).map(it=>`${it.nome} ×${it.qty}`).join(', ');
          mostrarInAppNotif('separado',
            `✅ Pedido ${p.id} separado!`,
            `Dirija-se ao estoque para retirar. ${itensStr}`
          );
          dispararPushNotif(
            `✅ Pedido ${p.id} pronto para retirada!`,
            `Dirija-se ao estoque. Itens: ${itensStr}`
          );
        }
      }
      statusAnteriores[p._docId] = p.status;
    }
  });
}

renderItems();
