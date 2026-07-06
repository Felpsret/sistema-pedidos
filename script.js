/* ============ CONFIG / STORAGE KEYS ============ */
const CHAVE_USUARIO = 'estoqueviu_usuario';
const CHAVE_CADASTROS = 'estoqueviu_cadastros'; // array de {usuario, dataISO, tipo, quantidade}

const CORES_AVATAR = ['#00e0ff', '#8b6bff', '#35e0a1', '#ff9f5b', '#ff6b7a', '#5bd0ff'];

/* ============ HELPERS DE ARMAZENAMENTO ============ */
function getUsuario() {
  return localStorage.getItem(CHAVE_USUARIO) || '';
}

function setUsuario(nome) {
  localStorage.setItem(CHAVE_USUARIO, nome);
}

function getCadastros() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CADASTROS)) || [];
  } catch (e) {
    return [];
  }
}

function salvarCadastros(lista) {
  localStorage.setItem(CHAVE_CADASTROS, JSON.stringify(lista));
}

function gerarId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function registrarCadastro(tipo, quantidade, itens = []) {
  if (quantidade <= 0) return;
  const lista = getCadastros();
  lista.push({
    id: gerarId(),
    usuario: getUsuario(),
    dataISO: new Date().toISOString(),
    tipo,
    quantidade,
    itens
  });
  salvarCadastros(lista);
  atualizarPainelStats();
}

function escapeHtml(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============ LOGIN ============ */
function corParaNome(nome) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}

function iniciaisParaNome(nome) {
  const partes = nome.trim().split(/\s+/);
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0].slice(0, 2);
  return letras.toUpperCase();
}

function aplicarUsuarioNaTela() {
  const nome = getUsuario();
  document.getElementById('userNome').textContent = nome || '—';
  const avatar = document.getElementById('userAvatar');
  if (nome) {
    avatar.textContent = iniciaisParaNome(nome);
    avatar.style.background = corParaNome(nome);
  }
}

function mostrarLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginNome').focus();
}

function esconderLogin() {
  document.getElementById('loginOverlay').classList.add('hidden');
}

function confirmarLogin() {
  const campo = document.getElementById('loginNome');
  const nome = campo.value.trim();
  if (!nome) {
    campo.focus();
    return;
  }
  setUsuario(nome);
  aplicarUsuarioNaTela();
  esconderLogin();
  atualizarPainelStats();
}

function trocarUsuario() {
  esconderLogin();
  document.getElementById('loginNome').value = '';
  mostrarLogin();
}

/* ============ FORMATAÇÃO ============ */
function formatar() {
  const tipo = document.getElementById('tipoScript').value;
  const entrada = document.getElementById('entrada').value.trim();
  const linhas = entrada.split(/\r?\n/).filter(l => l.trim() !== '');
  let resultado = '';

  if (tipo === 'CADASTRO DE ZTE' || tipo === 'CADASTRO DE ONT') {
    if (linhas.length % 3 !== 0) {
      alert('Erro: a entrada deve conter múltiplos de 3 linhas (MAC, Serial, Fabricante). Verifique os dados.');
      document.getElementById('resultado').textContent = 'Entrada incompleta detectada. Corrija e tente novamente.';
      return;
    }

    let quantidade = 0;
    const itens = [];
    for (let i = 0; i < linhas.length; i += 3) {
      const mac = linhas[i].trim();
      const serial = linhas[i + 1].trim();
      const fabricante = linhas[i + 2].trim();
      const linhaFormatada = `${mac};${serial};${fabricante}`;
      resultado += linhaFormatada + '\n';
      itens.push(linhaFormatada);
      quantidade++;
    }

    registrarCadastro(tipo, quantidade, itens);
  }

  document.getElementById('resultado').textContent = resultado.trim() || 'Nenhum dado válido.';
}

function copiarTexto() {
  const texto = document.getElementById('resultado').innerText;
  navigator.clipboard.writeText(texto)
    .then(() => alert('Texto copiado com sucesso!'))
    .catch(err => console.error('Erro ao copiar: ', err));
}

function baixarTXT() {
  const texto = document.getElementById('resultado').innerText;
  let nome = document.getElementById('nomeArquivo').value.trim();
  if (!nome) nome = 'resultado';
  if (!nome.endsWith('.txt')) nome += '.txt';

  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function limparCampos() {
  document.getElementById('entrada').value = '';
  document.getElementById('resultado').textContent = 'Esse é o resultado que será salvo no bloco de notas.';
  document.getElementById('nomeArquivo').value = '';
}

/* ============ PAINEL DE STATS (usuário atual) ============ */
function mesAnoDeISO(iso) {
  return iso.slice(0, 7); // YYYY-MM
}

function ehHoje(iso) {
  const hoje = new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10) === hoje;
}

function atualizarPainelStats() {
  const usuario = getUsuario();
  const lista = getCadastros();
  const mesAtual = new Date().toISOString().slice(0, 7);

  let hoje = 0, mes = 0, totalEquipeMes = 0;

  lista.forEach(c => {
    const doMesAtual = mesAnoDeISO(c.dataISO) === mesAtual;
    if (doMesAtual) totalEquipeMes += c.quantidade;
    if (c.usuario === usuario) {
      if (ehHoje(c.dataISO)) hoje += c.quantidade;
      if (doMesAtual) mes += c.quantidade;
    }
  });

  document.getElementById('statHoje').textContent = hoje;
  document.getElementById('statMes').textContent = mes;
  document.getElementById('statTotal').textContent = totalEquipeMes;
}

/* ============ HISTÓRICO / EDIÇÃO DOS PRÓPRIOS LANÇAMENTOS ============ */
let idEmEdicao = null;

function popularFiltroMesHistorico() {
  const select = document.getElementById('filtroMesHistorico');
  const usuario = getUsuario();
  const lista = getCadastros().filter(c => c.usuario === usuario);
  const mesAtual = new Date().toISOString().slice(0, 7);
  const meses = new Set([mesAtual]);
  lista.forEach(c => meses.add(chaveMes(c.dataISO)));

  const mesesOrdenados = Array.from(meses).sort().reverse();
  select.innerHTML = mesesOrdenados
    .map(m => `<option value="${m}">${rotuloMes(m)}</option>`)
    .join('');
  select.value = mesAtual;
}

function renderizarHistorico() {
  const usuario = getUsuario();
  const mesSelecionado = document.getElementById('filtroMesHistorico').value;
  const lista = getCadastros()
    .filter(c => c.usuario === usuario && chaveMes(c.dataISO) === mesSelecionado)
    .sort((a, b) => b.dataISO.localeCompare(a.dataISO));

  const corpo = document.getElementById('tabelaHistoricoBody');

  if (lista.length === 0) {
    corpo.innerHTML = '<tr><td colspan="4" style="color: var(--text-faint);">Nenhum lançamento neste período.</td></tr>';
    return;
  }

  corpo.innerHTML = lista.map((c, idx) => {
    const dataFmt = new Date(c.dataISO).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const tipoResumo = c.tipo === 'CADASTRO DE ZTE' ? 'ZTE' : 'ONT';

    if (c.id === idEmEdicao) {
      return `
        <tr>
          <td data-label="Data">${dataFmt}</td>
          <td data-label="Tipo">${tipoResumo}</td>
          <td data-label="Qtd"><input type="number" min="0" id="inputEdicaoQtd" value="${c.quantidade}" /></td>
          <td data-label="Ações" class="col-acoes">
            <div class="acoes-linha">
              <button class="btn-icone" onclick="salvarEdicaoLancamento('${c.id}')">Salvar</button>
              <button class="btn-icone btn-secundario" onclick="cancelarEdicaoLancamento()">Cancelar</button>
            </div>
          </td>
        </tr>`;
    }

    const idDetalhe = `hist-detalhe-${idx}`;
    const itensTexto = Array.isArray(c.itens) && c.itens.length
      ? c.itens.join('\n')
      : 'Sem detalhes salvos para este lançamento.';

    return `
      <tr>
        <td data-label="Data">${dataFmt}</td>
        <td data-label="Tipo">${tipoResumo}</td>
        <td data-label="Qtd">${c.quantidade}</td>
        <td data-label="Ações" class="col-acoes">
          <div class="acoes-linha">
            <button class="btn-icone" onclick="toggleDetalheHistorico('${idDetalhe}')">Itens</button>
            <button class="btn-icone" onclick="iniciarEdicaoLancamento('${c.id}')">Editar</button>
            <button class="btn-icone btn-secundario" onclick="excluirLancamento('${c.id}')">Excluir</button>
          </div>
        </td>
      </tr>
      <tr class="linha-detalhe hidden" id="${idDetalhe}">
        <td colspan="4"><div class="detalhe-itens">${escapeHtml(itensTexto)}</div></td>
      </tr>`;
  }).join('');
}

function toggleDetalheHistorico(id) {
  document.getElementById(id).classList.toggle('hidden');
}

function iniciarEdicaoLancamento(id) {
  idEmEdicao = id;
  renderizarHistorico();
  const input = document.getElementById('inputEdicaoQtd');
  if (input) {
    input.focus();
    input.select();
  }
}

function cancelarEdicaoLancamento() {
  idEmEdicao = null;
  renderizarHistorico();
}

function salvarEdicaoLancamento(id) {
  const input = document.getElementById('inputEdicaoQtd');
  const novaQtd = parseInt(input.value, 10);

  if (isNaN(novaQtd) || novaQtd < 0) {
    alert('Digite uma quantidade válida.');
    return;
  }

  const lista = getCadastros();
  const item = lista.find(c => c.id === id);
  if (item) item.quantidade = novaQtd;
  salvarCadastros(lista);

  idEmEdicao = null;
  renderizarHistorico();
  atualizarPainelStats();
}

function excluirLancamento(id) {
  if (!confirm('Excluir este lançamento? Essa ação não pode ser desfeita.')) return;
  const lista = getCadastros().filter(c => c.id !== id);
  salvarCadastros(lista);
  renderizarHistorico();
  atualizarPainelStats();
}

function abrirHistorico() {
  idEmEdicao = null;
  popularFiltroMesHistorico();
  renderizarHistorico();
  document.getElementById('historicoOverlay').classList.remove('hidden');
}

function fecharHistorico() {
  document.getElementById('historicoOverlay').classList.add('hidden');
}

/* ============ RELATÓRIO MENSAL ============ */
function chaveMes(iso) {
  return iso.slice(0, 7);
}

function rotuloMes(chave) {
  const [ano, mes] = chave.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[parseInt(mes, 10) - 1]}/${ano}`;
}

function popularFiltroMes() {
  const select = document.getElementById('filtroMes');
  const lista = getCadastros();
  const mesAtual = new Date().toISOString().slice(0, 7);
  const meses = new Set([mesAtual]);
  lista.forEach(c => meses.add(chaveMes(c.dataISO)));

  const mesesOrdenados = Array.from(meses).sort().reverse();
  select.innerHTML = mesesOrdenados
    .map(m => `<option value="${m}">${rotuloMes(m)}</option>`)
    .join('');
  select.value = mesAtual;
}

function renderizarRelatorio() {
  const mesSelecionado = document.getElementById('filtroMes').value;
  const lista = getCadastros().filter(c => chaveMes(c.dataISO) === mesSelecionado);

  const porUsuario = {};
  lista.forEach(c => {
    if (!porUsuario[c.usuario]) porUsuario[c.usuario] = { qtd: 0, itens: [] };
    porUsuario[c.usuario].qtd += c.quantidade;
    if (Array.isArray(c.itens) && c.itens.length) {
      porUsuario[c.usuario].itens.push(...c.itens);
    }
  });

  const linhas = Object.entries(porUsuario).sort((a, b) => b[1].qtd - a[1].qtd);
  const total = linhas.reduce((soma, [, d]) => soma + d.qtd, 0);
  const maior = linhas.length ? linhas[0][1].qtd : 1;

  document.getElementById('relatorioTotal').textContent = `Total: ${total}`;

  const corpo = document.getElementById('tabelaRelatorioBody');
  if (linhas.length === 0) {
    corpo.innerHTML = '<tr><td colspan="3" style="color: var(--text-faint);">Nenhum cadastro neste período.</td></tr>';
    return;
  }

  corpo.innerHTML = linhas.map(([usuario, dados], idx) => {
    const idDetalhe = `rel-detalhe-${idx}`;
    const itensTexto = dados.itens.length
      ? dados.itens.join('\n')
      : 'Sem MAC/Serial detalhados para este período.';

    return `
    <tr class="linha-clicavel" onclick="toggleDetalheRelatorio('${idDetalhe}')" title="Clique para ver MAC e Serial">
      <td data-label="Usuário">${usuario || '(sem nome)'}</td>
      <td data-label="Cadastros">${dados.qtd}</td>
      <td class="col-bar"><div class="rank-bar" style="width: ${(dados.qtd / maior) * 100}%;"></div></td>
    </tr>
    <tr class="linha-detalhe hidden" id="${idDetalhe}">
      <td colspan="3"><div class="detalhe-itens">${escapeHtml(itensTexto)}</div></td>
    </tr>`;
  }).join('');
}

function toggleDetalheRelatorio(id) {
  document.getElementById(id).classList.toggle('hidden');
}

function abrirRelatorio() {
  popularFiltroMes();
  renderizarRelatorio();
  document.getElementById('relatorioOverlay').classList.remove('hidden');
}

function fecharRelatorio() {
  document.getElementById('relatorioOverlay').classList.add('hidden');
}

function exportarRelatorioCSV() {
  const mesSelecionado = document.getElementById('filtroMes').value;
  const lista = getCadastros().filter(c => chaveMes(c.dataISO) === mesSelecionado);

  let csv = 'Usuario;MAC;Serial;Fabricante\n';
  lista.forEach(c => {
    if (Array.isArray(c.itens) && c.itens.length) {
      c.itens.forEach(item => {
        csv += `${c.usuario};${item}\n`;
      });
    } else {
      csv += `${c.usuario};SEM DETALHE (qtd: ${c.quantidade});;\n`;
    }
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio_${mesSelecionado}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function migrarCadastrosSemId() {
  const lista = getCadastros();
  let alterou = false;
  lista.forEach(c => {
    if (!c.id) {
      c.id = gerarId();
      alterou = true;
    }
  });
  if (alterou) salvarCadastros(lista);
}

/* ============ INICIALIZAÇÃO ============ */
document.addEventListener('DOMContentLoaded', () => {
  migrarCadastrosSemId();
  const usuario = getUsuario();
  if (usuario) {
    aplicarUsuarioNaTela();
    esconderLogin();
    atualizarPainelStats();
  } else {
    mostrarLogin();
  }

  document.getElementById('loginEntrar').addEventListener('click', confirmarLogin);
  document.getElementById('loginNome').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmarLogin();
  });

  document.getElementById('btnTrocar').addEventListener('click', trocarUsuario);

  const navRight = document.getElementById('navRight');
  document.getElementById('btnMenuMobile').addEventListener('click', () => {
    navRight.classList.toggle('aberto');
  });
  navRight.addEventListener('click', e => {
    if (e.target.closest('a, button')) {
      navRight.classList.remove('aberto');
    }
  });
  document.getElementById('btnProcessar').addEventListener('click', formatar);
  document.getElementById('btnSalvar').addEventListener('click', baixarTXT);
  document.getElementById('btnCopiar').addEventListener('click', copiarTexto);
  document.getElementById('btnLimpar').addEventListener('click', limparCampos);

  document.getElementById('btnHistorico').addEventListener('click', abrirHistorico);
  document.getElementById('fecharHistorico').addEventListener('click', fecharHistorico);
  document.getElementById('filtroMesHistorico').addEventListener('change', () => {
    idEmEdicao = null;
    renderizarHistorico();
  });

  document.getElementById('btnRelatorio').addEventListener('click', abrirRelatorio);
  document.getElementById('fecharRelatorio').addEventListener('click', fecharRelatorio);
  document.getElementById('filtroMes').addEventListener('change', renderizarRelatorio);
  document.getElementById('exportarRelatorio').addEventListener('click', exportarRelatorioCSV);
});
