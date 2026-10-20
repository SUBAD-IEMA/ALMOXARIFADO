/**
 * SISTEMA DE PEDIDOS – ALMOXARIFADO IEMA  (servidor)
 * Roda no Google Apps Script, ligado a uma Planilha Google que funciona como banco de dados.
 *
 * INSTALAÇÃO (detalhes no README.md):
 *  1. Planilha Google nova > Extensões > Apps Script > apague tudo e cole este arquivo > Salvar.
 *  2. Volte à planilha, recarregue (F5) e use o menu  Almoxarifado > Configurar sistema.
 *  3. Apps Script > Implantar > Nova implantação > App da Web
 *     (Executar como: Eu · Quem pode acessar: Qualquer pessoa) > copie a URL que termina em /exec.
 *  4. No GitHub, cole a URL em config.js (API_URL).
 *
 * Depois de alterar este código: Implantar > Gerenciar implantações > lápis > Versão: Nova versão.
 * Este mesmo arquivo também é usado pelo "modo demonstração" das páginas, para que o comportamento seja idêntico.
 */

/* ======================= Opções ======================= */
const ENVIAR_EMAIL = true;        // avisa o solicitante (com cópia ao gestor) quando o pedido é recebido e quando muda de situação
const NOME_REMETENTE = 'Almoxarifado IEMA';
const HORAS_SESSAO = 10;          // sessão comum do gestor
const DIAS_LEMBRAR = 30;          // sessão com "manter conectado neste computador"

/* ======================= Estrutura ======================= */
const SITUACOES = ['Pendente', 'Aprovado', 'Parcialmente atendido', 'Atendido', 'Recusado'];
const FINAIS = ['Parcialmente atendido', 'Atendido', 'Recusado'];
const ABAS = {
  catalogo: ['Catálogo', ['id', 'Código', 'Descrição', 'Unidade', 'Natureza (código)', 'Natureza (nome)', 'Conta contábil', 'Qtd. disponível', 'Limite por pedido', 'Indisponível', 'Imagem', 'Termos da foto automática', 'Qtd. no relatório', 'Ativo', 'Atualizado em', 'Versão da imagem'], 'A:B'],
  imagens:  ['Imagens enviadas', ['id', 'Imagem (dados)', 'Atualizado em'], 'A:A'],
  pedidos:  ['Pedidos', ['Pedido', 'Data', 'Nome completo', 'Setor', 'Telefone', 'E-mail', 'Observação', 'Itens (dados)', 'Qtd. de itens', 'Unidades solicitadas', 'Unidades atendidas', 'Situação', 'Atualizado em', 'Resposta do gestor', 'Andamento (dados)'], 'A:A,E:E'],
  historico:['Histórico', ['Data', 'Tipo', 'Pedido', 'id', 'Código', 'Descrição', 'Antes', 'Depois', 'Variação', 'Detalhes'], 'C:E'],
  config:   ['Configuração', ['Chave', 'Valor'], 'A:B']
};
const COL = { id: 0, codigo: 1, descricao: 2, unidade: 3, natureza: 4, naturezaNome: 5, conta: 6, qtd: 7, limite: 8, indisponivel: 9, imagem: 10, busca: 11, qtdRelatorio: 12, ativo: 13, atualizado: 14, imagemVersao: 15 };

/* ======================= Entrada ======================= */
function doGet() {
  return saida({ ok: true, servico: 'Almoxarifado IEMA', versao: versaoAtual(), mensagem: 'Servidor no ar. Cole este endereço em config.js (API_URL).' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return saida({ ok: false, erro: 'Requisição inválida.' }); }
  const publicas = { versao: acaoVersao, catalogo: acaoCatalogo, imagens: acaoImagens, solicitar: acaoSolicitar, consultar: acaoConsultar, login: acaoLogin, situacaoSenha: acaoSituacaoSenha, criarSenha: acaoCriarSenha };
  const gestor = { sair: acaoSair, painel: acaoPainel, atender: acaoAtender, salvarItem: acaoSalvarItem, ajustarEstoque: acaoAjustarEstoque, indisponivel: acaoIndisponivel, removerItem: acaoRemoverItem, salvarGestor: acaoSalvarGestor, inicializar: acaoInicializar, trocarSenha: acaoTrocarSenha };
  try {
    let f = publicas[req.acao];
    if (!f && gestor[req.acao]) { exigirSessao(req.token); f = gestor[req.acao]; }
    if (!f) throw amigavel('Ação desconhecida: ' + req.acao);
    if (req.site && /^https?:\/\//.test(req.site)) lembrarSite(req.site);
    return saida(Object.assign({ ok: true }, f(req) || {}));
  } catch (err) {
    return saida({ ok: false, erro: err.amigavel ? err.message : 'Erro no servidor: ' + err.message, sessaoExpirada: !!err.sessao });
  }
}

function saida(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function amigavel(msg) { const e = new Error(msg); e.amigavel = true; return e; }

/* ======================= Planilha ======================= */
function aba(chave) {
  const [nome, cab, texto] = ABAS[chave];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    if (texto) texto.split(',').forEach(a1 => sh.getRange(a1).setNumberFormat('@'));
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#E2EDE8');
    sh.setFrozenRows(1);
  }
  return sh;
}
function linhas(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
}
function anexar(chave, rows) {
  if (!rows.length) return;
  const sh = aba(chave);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}
function iso(v) { if (!v) return ''; if (v instanceof Date) return v.toISOString(); return String(v); }
const props = () => PropertiesService.getScriptProperties();
function versaoAtual() { return Number(props().getProperty('VERSAO') || 1); }
function novaVersao() { props().setProperty('VERSAO', String(versaoAtual() + 1)); }
function bloquear() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw amigavel('O sistema está ocupado com outra operação. Tente de novo em alguns segundos.');
  return lock;
}
function lerConfig() { const c = {}; linhas(aba('config')).forEach(r => c[r[0]] = r[1]); return c; }
function gravarConfig(pares) {
  const sh = aba('config'), dados = linhas(sh);
  Object.keys(pares).forEach(k => {
    const i = dados.findIndex(r => r[0] === k);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(pares[k]);
    else { sh.appendRow([k, pares[k]]); dados.push([k, pares[k]]); }
  });
}
function lembrarSite(site) {
  const base = site.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  if (props().getProperty('SITE_URL') !== base) props().setProperty('SITE_URL', base);
}
function dadosGestor() {
  const c = lerConfig();
  return { nome: c.gestor_nome || '', setor: c.gestor_setor || '', telefone: String(c.gestor_telefone || ''), email: c.gestor_email || '' };
}

/* ---------- Catálogo ---------- */
function simNao(v) { return v === true || String(v).toUpperCase() === 'SIM'; }
function lerCatalogo() {
  const sh = aba('catalogo');
  const itens = linhas(sh).map((r, i) => ({
    linha: i + 2, id: String(r[COL.id]), codigo: String(r[COL.codigo]), descricao: String(r[COL.descricao]), unidade: String(r[COL.unidade]),
    natureza: String(r[COL.natureza]), naturezaNome: String(r[COL.naturezaNome]), conta: String(r[COL.conta] || ''),
    qtd: Number(r[COL.qtd]) || 0, limite: Number(r[COL.limite]) || 0, indisponivel: simNao(r[COL.indisponivel]),
    imagem: String(r[COL.imagem] || ''), busca: String(r[COL.busca] || ''), qtdRelatorio: Number(r[COL.qtdRelatorio]) || 0,
    ativo: r[COL.ativo] === '' ? true : simNao(r[COL.ativo]), atualizado: iso(r[COL.atualizado]), imagemVersao: Number(r[COL.imagemVersao]) || 0
  })).filter(it => it.id);
  const mapa = {}; itens.forEach(it => mapa[it.id] = it);
  return { sh, itens, mapa };
}
function linhaItem(it) {
  return [it.id, it.codigo, it.descricao, it.unidade, it.natureza, it.naturezaNome, it.conta || '', it.qtd, it.limite || 0,
    it.indisponivel ? 'SIM' : 'NÃO', it.imagem || '', it.busca || '', it.qtdRelatorio || 0, it.ativo === false ? 'NÃO' : 'SIM', new Date(), it.imagemVersao || 0];
}
function gravarItem(sh, it) {
  if (it.linha) sh.getRange(it.linha, 1, 1, 16).setValues([linhaItem(it)]);
  else { sh.getRange(sh.getLastRow() + 1, 1, 1, 16).setValues([linhaItem(it)]); it.linha = sh.getLastRow(); }
}
function publico(it) {
  return { id: it.id, codigo: it.codigo, descricao: it.descricao, unidade: it.unidade, natureza: it.natureza, naturezaNome: it.naturezaNome, conta: it.conta,
    qtd: it.qtd, limite: it.limite, indisponivel: it.indisponivel, imagem: it.imagem, imagemVersao: it.imagemVersao, busca: it.busca, qtdRelatorio: it.qtdRelatorio };
}

/* ---------- Pedidos ---------- */
function lerPedidos() {
  const sh = aba('pedidos');
  const pedidos = linhas(sh).map((r, i) => {
    let itens = [], andamento = [];
    try { itens = JSON.parse(r[7] || '[]'); } catch (e) {}
    try { andamento = JSON.parse(r[14] || '[]'); } catch (e) {}
    return {
      linha: i + 2, numero: String(r[0]), dataISO: iso(r[1]),
      solicitante: { nome: String(r[2]), setor: String(r[3]), telefone: String(r[4]), email: String(r[5]) },
      obs: String(r[6] || ''), itens, totalItens: Number(r[8]) || 0, totalUnidades: Number(r[9]) || 0, totalAtendido: r[10] === '' ? null : Number(r[10]),
      status: String(r[11] || 'Pendente'), atualizadoISO: iso(r[12]), resposta: String(r[13] || ''), andamento
    };
  }).filter(p => p.numero);
  return { sh, pedidos };
}
function linhaPedido(p) {
  return [p.numero, new Date(p.dataISO), p.solicitante.nome, p.solicitante.setor, p.solicitante.telefone, p.solicitante.email, p.obs,
    JSON.stringify(p.itens), p.itens.length, p.totalUnidades, p.totalAtendido == null ? '' : p.totalAtendido, p.status, new Date(), p.resposta || '', JSON.stringify(p.andamento)];
}
function semLinha(p) { const c = Object.assign({}, p); delete c.linha; return c; }

/* ======================= Sessão do gestor ======================= */
function sessoes() { try { return JSON.parse(props().getProperty('SESSOES') || '{}'); } catch (e) { return {}; } }
function gravarSessoes(s) {
  const agora = Date.now();
  Object.keys(s).forEach(k => { if (s[k] < agora) delete s[k]; });
  const chaves = Object.keys(s).sort((a, b) => s[b] - s[a]);
  chaves.slice(40).forEach(k => delete s[k]);   // no máximo 40 computadores conectados ao mesmo tempo
  props().setProperty('SESSOES', JSON.stringify(s));
}
function exigirSessao(token) {
  const s = sessoes();
  if (!token || !s[token] || s[token] < Date.now()) { const e = amigavel('Sua sessão expirou. Entre novamente.'); e.sessao = true; throw e; }
}
function acaoSituacaoSenha() { return { senhaDefinida: !!props().getProperty('SENHA_GESTOR') }; }
function acaoCriarSenha(req) {
  // Só funciona enquanto nenhuma senha foi definida (primeiro acesso).
  if (props().getProperty('SENHA_GESTOR')) throw amigavel('A senha do gestor já foi definida.');
  definirSenha(req.senha);
  return acaoLogin({ senha: req.senha, lembrar: req.lembrar });
}
function definirSenha(s) {
  s = String(s || '');
  if (s.length < 8) throw amigavel('A senha precisa ter pelo menos 8 caracteres.');
  props().setProperty('SENHA_GESTOR', s);
  props().setProperty('SESSOES', '{}');   // desconecta todos os computadores
}
function acaoLogin(req) {
  const senha = props().getProperty('SENHA_GESTOR');
  if (!senha) throw amigavel('A senha do gestor ainda não foi definida.');
  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get('falhas_login') || 0);
  if (falhas >= 8) throw amigavel('Muitas tentativas com senha errada. Aguarde 10 minutos e tente de novo.');
  if (String(req.senha || '') !== senha) {
    cache.put('falhas_login', String(falhas + 1), 600);
    Utilities.sleep(700);
    throw amigavel('Senha incorreta.');
  }
  cache.remove('falhas_login');
  const token = Utilities.getUuid() + Utilities.getUuid();
  const s = sessoes();
  s[token] = Date.now() + (req.lembrar ? DIAS_LEMBRAR * 864e5 : HORAS_SESSAO * 36e5);
  gravarSessoes(s);
  return { token, expira: new Date(s[token]).toISOString() };
}
function acaoSair(req) { const s = sessoes(); delete s[req.token]; gravarSessoes(s); return {}; }
function acaoTrocarSenha(req) {
  if (String(req.atual || '') !== props().getProperty('SENHA_GESTOR')) throw amigavel('A senha atual não confere.');
  definirSenha(req.nova);
  registrar([[new Date(), 'Senha alterada', '', '', '', '', '', '', '', 'Todos os computadores foram desconectados']]);
  return acaoLogin({ senha: req.nova, lembrar: req.lembrar });
}
function registrar(rows) { anexar('historico', rows); }

/* ======================= Ações públicas ======================= */
function acaoVersao() { return { versao: versaoAtual() }; }

function acaoCatalogo() {
  const { itens } = lerCatalogo();
  return { versao: versaoAtual(), inicializado: itens.length > 0, itens: itens.filter(i => i.ativo).map(publico), gestor: dadosGestor() };
}

function acaoImagens(req) {
  const ids = (req.ids || []).map(String);
  const out = {};
  linhas(aba('imagens')).forEach(r => { if (ids.indexOf(String(r[0])) >= 0) out[r[0]] = String(r[1]); });
  return { imagens: out };
}

function validarSolicitante(s) {
  s = s || {};
  const r = { nome: String(s.nome || '').trim().slice(0, 120), setor: String(s.setor || '').trim().slice(0, 120), telefone: String(s.telefone || '').trim().slice(0, 30), email: String(s.email || '').trim().toLowerCase().slice(0, 120) };
  if (r.nome.split(/\s+/).length < 2) throw amigavel('Informe o nome completo do solicitante.');
  if (!r.setor) throw amigavel('Informe o setor do solicitante.');
  if (r.telefone.replace(/\D/g, '').length < 10) throw amigavel('Informe um telefone para contato com DDD.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw amigavel('Informe um e-mail válido.');
  return r;
}

function acaoSolicitar(req) {
  const sol = validarSolicitante(req.solicitante);
  const obs = String(req.obs || '').trim().slice(0, 1000);
  const pedidos = (req.itens || []).filter(i => Number(i.qtd) > 0);
  if (!pedidos.length) throw amigavel('Selecione pelo menos um item e informe a quantidade.');
  if (pedidos.length > 200) throw amigavel('Pedido grande demais.');
  const lock = bloquear();
  let pedido;
  try {
    const { sh, mapa } = lerCatalogo();
    const vistos = {};
    const itens = pedidos.map(i => {
      const q = Number(i.qtd), e = mapa[i.id];
      if (!e || !e.ativo) throw amigavel('Um dos materiais não está mais no catálogo. Atualize a página.');
      if (vistos[i.id]) throw amigavel('Material repetido no pedido: ' + e.descricao);
      vistos[i.id] = true;
      if (e.indisponivel) throw amigavel(e.codigo + ' – ' + e.descricao + ' está INDISPONÍVEL.');
      if (!Number.isInteger(q) || q <= 0) throw amigavel('Quantidade inválida para ' + e.descricao + '.');
      if (q > e.qtd) throw amigavel('Estoque insuficiente para ' + e.codigo + ' – ' + e.descricao + ': disponível ' + e.qtd + ', solicitado ' + q + '.');
      if (e.limite > 0 && q > e.limite) throw amigavel('O limite por pedido de ' + e.codigo + ' – ' + e.descricao + ' é ' + e.limite + '.');
      return { id: e.id, codigo: e.codigo, descricao: e.descricao, unidade: e.unidade, qtd: q, atendida: null };
    });
    const agora = new Date(), ano = agora.getFullYear();
    const seq = Number(props().getProperty('SEQ_' + ano) || 0) + 1;
    props().setProperty('SEQ_' + ano, String(seq));
    const numero = ano + '-' + ('0000' + seq).slice(-5);
    itens.forEach(l => { const e = mapa[l.id]; e.qtd -= l.qtd; gravarItem(sh, e); });
    pedido = { numero, dataISO: agora.toISOString(), solicitante: sol, obs, itens, totalItens: itens.length, totalUnidades: itens.reduce((a, b) => a + b.qtd, 0),
      totalAtendido: null, status: 'Pendente', resposta: '', andamento: [{ dataISO: agora.toISOString(), status: 'Pendente', texto: 'Pedido recebido pelo almoxarifado' }] };
    anexar('pedidos', [linhaPedido(pedido)]);
    registrar(itens.map(l => [agora, 'Pedido recebido', numero, l.id, l.codigo, l.descricao, mapa[l.id].qtd + l.qtd, mapa[l.id].qtd, -l.qtd, sol.nome + ' (' + sol.setor + ')']));
    novaVersao();
  } finally { lock.releaseLock(); }
  const emailEnviado = avisar(pedido, true);
  return { pedido, gestor: dadosGestor(), emailEnviado };
}

function acaoConsultar(req) {
  const cache = CacheService.getScriptCache();
  const tent = Number(cache.get('consultas') || 0);
  if (tent > 40) throw amigavel('Muitas consultas seguidas. Aguarde alguns minutos.');
  const numero = String(req.numero || '').trim(), email = String(req.email || '').trim().toLowerCase();
  const p = lerPedidos().pedidos.find(x => x.numero === numero);
  if (!p || p.solicitante.email.toLowerCase() !== email) {
    cache.put('consultas', String(tent + 1), 300);
    throw amigavel('Pedido não encontrado ou o e-mail não confere com o informado no pedido.');
  }
  return { pedido: semLinha(p), gestor: dadosGestor() };
}

/* ======================= Ações do gestor ======================= */
function acaoPainel() {
  const cat = lerCatalogo();
  const hist = linhas(aba('historico')).slice(-1500).map(r => ({
    dataISO: iso(r[0]), tipo: String(r[1]), pedido: String(r[2] || ''), id: String(r[3] || ''), codigo: String(r[4] || ''), descricao: String(r[5] || ''),
    antes: r[6] === '' ? null : Number(r[6]), depois: r[7] === '' ? null : Number(r[7]), delta: r[8] === '' ? null : Number(r[8]), detalhes: String(r[9] || '')
  }));
  return { versao: versaoAtual(), inicializado: cat.itens.length > 0, itens: cat.itens.filter(i => i.ativo).map(publico), pedidos: lerPedidos().pedidos.map(semLinha), historico: hist, gestor: dadosGestor() };
}

function acaoAtender(req) {
  const tipo = String(req.tipo || '');
  const resposta = String(req.resposta || '').trim().slice(0, 1000);
  const lock = bloquear();
  let pedido;
  try {
    const { sh: shP, pedidos } = lerPedidos();
    const p = pedidos.find(x => x.numero === String(req.numero));
    if (!p) throw amigavel('Pedido não encontrado.');
    if (FINAIS.indexOf(p.status) >= 0) throw amigavel('O pedido ' + p.numero + ' já foi finalizado como "' + p.status + '".');
    const agora = new Date();
    const cat = lerCatalogo();
    const devolver = (l, q) => {
      if (q <= 0) return;
      const e = cat.mapa[l.id];
      if (e) { e.qtd += q; gravarItem(cat.sh, e); }
      registrar([[agora, 'Devolução ao estoque', p.numero, l.id, l.codigo, l.descricao, e ? e.qtd - q : '', e ? e.qtd : '', q, 'Diferença não entregue do pedido']]);
    };
    let novo, texto;
    if (tipo === 'aprovar') {
      if (p.status !== 'Pendente') throw amigavel('Só pedidos pendentes podem ser aprovados.');
      novo = 'Aprovado'; texto = 'Pedido aprovado. Aguarde a separação e a entrega.';
    } else if (tipo === 'recusar') {
      if (!resposta) throw amigavel('Informe o motivo da recusa.');
      p.itens.forEach(l => { devolver(l, l.qtd); l.atendida = 0; });
      novo = 'Recusado'; texto = 'Pedido recusado.';
    } else if (tipo === 'atender') {
      p.itens.forEach(l => l.atendida = l.qtd);
      novo = 'Atendido'; texto = 'Pedido atendido integralmente.';
    } else if (tipo === 'parcial') {
      const at = req.atendidas || {};
      p.itens.forEach(l => {
        const q = Number(at[l.id]);
        if (!Number.isInteger(q) || q < 0 || q > l.qtd) throw amigavel('Quantidade atendida inválida para ' + l.descricao + ' (de 0 a ' + l.qtd + ').');
        devolver(l, l.qtd - q); l.atendida = q;
      });
      const total = p.itens.reduce((a, l) => a + l.atendida, 0);
      if (total === 0) { if (!resposta) throw amigavel('Nenhum item foi atendido: informe o motivo (o pedido será recusado).'); novo = 'Recusado'; texto = 'Pedido recusado.'; }
      else if (p.itens.every(l => l.atendida === l.qtd)) { novo = 'Atendido'; texto = 'Pedido atendido integralmente.'; }
      else { novo = 'Parcialmente atendido'; texto = 'Pedido atendido parcialmente: ' + total + ' de ' + p.totalUnidades + ' unidades.'; }
    } else throw amigavel('Ação inválida.');
    p.status = novo;
    p.totalAtendido = FINAIS.indexOf(novo) >= 0 ? p.itens.reduce((a, l) => a + (l.atendida || 0), 0) : null;
    if (resposta) p.resposta = resposta;
    p.andamento.push({ dataISO: agora.toISOString(), status: novo, texto: texto + (resposta ? ' Mensagem do almoxarifado: ' + resposta : '') });
    shP.getRange(p.linha, 1, 1, 15).setValues([linhaPedido(p)]);
    registrar([[agora, 'Pedido ' + novo.toLowerCase(), p.numero, '', '', '', '', '', '', (p.totalAtendido != null ? p.totalAtendido + ' de ' + p.totalUnidades + ' unidades atendidas. ' : '') + resposta]]);
    novaVersao();
    pedido = semLinha(p);
  } finally { lock.releaseLock(); }
  avisar(pedido, false);
  return { pedido };
}

function textoImagem(v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.slice(0, 2000);
  throw amigavel('Endereço de imagem inválido.');
}

function acaoSalvarItem(req) {
  const d = req.item || {};
  const motivo = String(req.motivo || '').trim().slice(0, 300);
  const campos = {
    codigo: String(d.codigo || '').trim().slice(0, 40), descricao: String(d.descricao || '').trim().slice(0, 400), unidade: String(d.unidade || '').trim().slice(0, 60),
    natureza: String(d.natureza || '').trim().slice(0, 30), naturezaNome: String(d.naturezaNome || '').trim().slice(0, 120), conta: String(d.conta || '').trim().slice(0, 160),
    limite: Math.max(0, Math.floor(Number(d.limite) || 0)), indisponivel: !!d.indisponivel, busca: String(d.busca || '').trim().slice(0, 200)
  };
  if (!campos.codigo || !campos.descricao || !campos.unidade) throw amigavel('Preencha código, descrição e unidade.');
  if (!campos.natureza || !campos.naturezaNome) throw amigavel('Informe a natureza de despesa (código e nome).');
  const qtd = Number(d.qtd);
  if (!(qtd >= 0)) throw amigavel('Informe uma quantidade disponível válida (0 ou mais).');
  const lock = bloquear();
  let it;
  try {
    const cat = lerCatalogo();
    const agora = new Date();
    const novo = !d.id;
    if (novo) {
      it = Object.assign({ id: 'N' + agora.getTime().toString(36), qtd: qtd, qtdRelatorio: 0, imagem: '', imagemVersao: 0, ativo: true }, campos);
    } else {
      it = cat.mapa[d.id];
      if (!it || !it.ativo) throw amigavel('Material não encontrado.');
    }
    // Imagem
    if (d.imagemDados) {
      const dados = String(d.imagemDados);
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(dados)) throw amigavel('Formato de imagem não aceito.');
      if (dados.length > 49000) throw amigavel('Imagem grande demais. Tente outra foto.');
      const shI = aba('imagens'), lin = linhas(shI);
      const i = lin.findIndex(r => String(r[0]) === it.id);
      if (i >= 0) shI.getRange(i + 2, 1, 1, 3).setValues([[it.id, dados, agora]]);
      else shI.appendRow([it.id, dados, agora]);
      it.imagem = 'upload'; it.imagemVersao = (it.imagemVersao || 0) + 1;
    } else if (d.imagem !== undefined && d.imagem !== 'upload') {
      it.imagem = textoImagem(d.imagem);
    }
    const mudancas = [];
    if (!novo) {
      const rot = { codigo: 'código', descricao: 'descrição', unidade: 'unidade', natureza: 'natureza', naturezaNome: 'nome da natureza', conta: 'conta contábil', limite: 'limite por pedido', indisponivel: 'indisponível', busca: 'termos da foto' };
      Object.keys(campos).forEach(k => { if (String(it[k]) !== String(campos[k])) { mudancas.push(rot[k] + ': "' + (k === 'indisponivel' ? (it[k] ? 'sim' : 'não') : it[k]) + '" → "' + (k === 'indisponivel' ? (campos[k] ? 'sim' : 'não') : campos[k]) + '"'); it[k] = campos[k]; } });
      if (d.imagemDados || (d.imagem !== undefined && d.imagem !== 'upload')) mudancas.push('imagem alterada');
    }
    const antes = novo ? 0 : it.qtd;
    it.qtd = qtd;
    gravarItem(cat.sh, it);
    if (novo) registrar([[agora, 'Material cadastrado', '', it.id, it.codigo, it.descricao, '', qtd, qtd, motivo || 'Cadastro de novo material']]);
    else {
      if (mudancas.length) registrar([[agora, 'Material alterado', '', it.id, it.codigo, it.descricao, '', '', '', mudancas.join('; ')]]);
      if (antes !== qtd) registrar([[agora, 'Ajuste de estoque', '', it.id, it.codigo, it.descricao, antes, qtd, qtd - antes, motivo || 'Ajuste na edição do material']]);
    }
    novaVersao();
  } finally { lock.releaseLock(); }
  return { item: publico(it) };
}

function acaoAjustarEstoque(req) {
  const motivo = String(req.motivo || '').trim().slice(0, 300);
  if (!motivo) throw amigavel('Informe o motivo do ajuste.');
  const lock = bloquear(); let n = 0;
  try {
    const cat = lerCatalogo(), agora = new Date(), rows = [];
    (req.ajustes || []).forEach(a => {
      const e = cat.mapa[a.id], q = Number(a.qtd);
      if (!e) throw amigavel('Material não encontrado: ' + a.id);
      if (!(q >= 0)) throw amigavel('Quantidade inválida para ' + e.descricao + '.');
      if (q === e.qtd) return;
      rows.push([agora, 'Ajuste de estoque', '', e.id, e.codigo, e.descricao, e.qtd, q, q - e.qtd, motivo]);
      e.qtd = q; gravarItem(cat.sh, e); n++;
    });
    registrar(rows);
    if (n) novaVersao();
  } finally { lock.releaseLock(); }
  return { alterados: n };
}

function acaoIndisponivel(req) {
  const lock = bloquear(); let it;
  try {
    const cat = lerCatalogo(); it = cat.mapa[req.id];
    if (!it) throw amigavel('Material não encontrado.');
    it.indisponivel = !!req.valor; gravarItem(cat.sh, it);
    registrar([[new Date(), it.indisponivel ? 'Material indisponível' : 'Material disponível', '', it.id, it.codigo, it.descricao, '', '', '', String(req.motivo || '').slice(0, 300)]]);
    novaVersao();
  } finally { lock.releaseLock(); }
  return { item: publico(it) };
}

function acaoRemoverItem(req) {
  const lock = bloquear();
  try {
    const cat = lerCatalogo(), it = cat.mapa[req.id];
    if (!it) throw amigavel('Material não encontrado.');
    it.ativo = false; gravarItem(cat.sh, it);
    registrar([[new Date(), 'Material removido', '', it.id, it.codigo, it.descricao, it.qtd, '', '', String(req.motivo || 'Removido do catálogo').slice(0, 300)]]);
    novaVersao();
  } finally { lock.releaseLock(); }
  return {};
}

function acaoSalvarGestor(req) {
  const g = req.gestor || {};
  gravarConfig({ gestor_nome: String(g.nome || '').trim(), gestor_setor: String(g.setor || '').trim(), gestor_telefone: String(g.telefone || '').trim(), gestor_email: String(g.email || '').trim() });
  registrar([[new Date(), 'Dados do gestor', '', '', '', '', '', '', '', String(g.nome || '')]]);
  novaVersao();
  return { gestor: dadosGestor() };
}

function acaoInicializar() {
  const lock = bloquear(); let n = 0;
  try { n = carregarCatalogoInicial(); } finally { lock.releaseLock(); }
  if (!n) throw amigavel('O catálogo já está carregado.');
  return { itens: n };
}
function carregarCatalogoInicial() {
  const sh = aba('catalogo');
  if (sh.getLastRow() > 1) return 0;
  const agora = new Date();
  const rows = CATALOGO_INICIAL.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], 0, 'NÃO', '', r[8], r[7], 'SIM', agora, 0]);
  sh.getRange(2, 1, rows.length, 16).setValues(rows);
  registrar([[agora, 'Catálogo carregado', '', '', '', 'Relatório de Itens em Estoque de 17/10/2026 (' + rows.length + ' materiais)', '', '', '', '']]);
  novaVersao();
  return rows.length;
}

/* ======================= E-mails ======================= */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function avisar(p, novo) {
  if (!ENVIAR_EMAIL || typeof MailApp === 'undefined') return false;
  try {
    const g = dadosGestor(), site = props().getProperty('SITE_URL') || '';
    const link = site ? site + 'solicitante.html?pedido=' + encodeURIComponent(p.numero) : '';
    const tabela = '<table border="1" cellpadding="5" style="border-collapse:collapse;font-size:13px" bordercolor="#D9E1DE"><tr style="background:#1E5240;color:#fff"><th>Código</th><th>Material</th><th>Unidade</th><th>Solicitado</th>' + (novo ? '' : '<th>Atendido</th>') + '</tr>' +
      p.itens.map(l => '<tr><td>' + esc(l.codigo) + '</td><td>' + esc(l.descricao) + '</td><td>' + esc(l.unidade) + '</td><td align="right">' + l.qtd + '</td>' + (novo ? '' : '<td align="right">' + (l.atendida == null ? '—' : l.atendida) + '</td>') + '</tr>').join('') + '</table>';
    const ultimo = p.andamento[p.andamento.length - 1];
    const html = '<div style="font-family:Arial,sans-serif;color:#17201D">' +
      '<p>Olá, ' + esc(p.solicitante.nome.split(' ')[0]) + '.</p>' +
      (novo ? '<p>Recebemos o seu pedido <b>' + esc(p.numero) + '</b>. Guarde este número para acompanhar o andamento.</p>'
            : '<p>O pedido <b>' + esc(p.numero) + '</b> mudou para a situação <b>' + esc(p.status) + '</b>.</p><p>' + esc(ultimo ? ultimo.texto : '') + '</p>') +
      tabela +
      (link ? '<p><a href="' + link + '">Acompanhar o pedido</a> (informe o e-mail usado no pedido).</p>' : '') +
      (g.nome ? '<p>Dúvidas: ' + esc(g.nome) + (g.telefone ? ' · ' + esc(g.telefone) : '') + (g.email ? ' · ' + esc(g.email) : '') + '</p>' : '') +
      '<p style="color:#5B6964;font-size:12px">Mensagem automática do sistema de pedidos do Almoxarifado IEMA.</p></div>';
    const o = { to: p.solicitante.email, subject: (novo ? 'Pedido ' + p.numero + ' recebido' : 'Pedido ' + p.numero + ': ' + p.status) + ' – Almoxarifado IEMA', htmlBody: html, name: NOME_REMETENTE };
    if (g.email) { o.replyTo = g.email; if (novo) o.cc = g.email; }
    MailApp.sendEmail(o);
    return true;
  } catch (err) { console.error('Falha no e-mail: ' + err); return false; }
}

/* ======================= Menu na planilha ======================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Almoxarifado')
    .addItem('Configurar sistema (primeira vez)', 'configurarSistema')
    .addItem('Definir ou trocar a senha do gestor', 'menuSenha')
    .addItem('Desconectar o gestor de todos os computadores', 'menuDesconectar')
    .addToUi();
}
function configurarSistema() {
  const ui = SpreadsheetApp.getUi();
  Object.keys(ABAS).forEach(aba);
  const n = carregarCatalogoInicial();
  if (ENVIAR_EMAIL) MailApp.getRemainingDailyQuota();   // pede a autorização de e-mail
  if (!props().getProperty('SENHA_GESTOR')) menuSenha();
  ui.alert('Sistema configurado', (n ? n + ' materiais carregados no catálogo.\n\n' : 'O catálogo já estava carregado.\n\n') +
    'Próximo passo: no Apps Script, clique em Implantar > Nova implantação > App da Web (Executar como: Eu; Quem pode acessar: Qualquer pessoa) e copie a URL para o arquivo config.js no GitHub.', ui.ButtonSet.OK);
}
function menuSenha() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Senha do gestor', 'Digite a senha do gestor (mínimo 8 caracteres). Ela vale em qualquer computador:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  try { definirSenha(r.getResponseText().trim()); ui.alert('Senha do gestor definida. Todos os computadores conectados foram desconectados.'); }
  catch (e) { ui.alert(e.message); }
}
function menuDesconectar() { props().setProperty('SESSOES', '{}'); SpreadsheetApp.getUi().alert('O gestor foi desconectado de todos os computadores.'); }

/* ======================= Catálogo inicial ======================= */
/* Relatório de Itens em Estoque – 17/10/2026. Colunas: id, código, descrição, unidade, natureza, nome da natureza, conta contábil, quantidade, termos da foto. */
const CATALOGO_INICIAL = [
  ["333903007_0", "48288-1", "AÇUCAR CRISTAL BRANCO 5 KG", "SACO 5 QUILOGRAMAS", "333903007", "GÊNEROS DE ALIMENTAÇÃO", "", 350, "granulated sugar bag; sugar"],
  ["333903007_1", "168133-1", "ADOÇANTE DIETÉTICO LIQUIDO", "UNIDADE", "333903007", "GÊNEROS DE ALIMENTAÇÃO", "", 134, "liquid sweetener bottle; sweetener"],
  ["333903009_0", "39100-1", "BOLSA TÉRMICA 2 LITROS", "UNIDADE", "333903009", "MATERIAL FARMACOLÓGICO", "", 3, "hot water bottle; ice pack"],
  ["333903011_0", "106466-1", "REPELENTE DE INSETOS", "UNIDADE", "333903011", "MATERIAL QUÍMICO", "", 176, "insect repellent spray; insect repellent"],
  ["333903016_0", "10305-1", "APAGADOR P/ QUADRO BRANCO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 30, "whiteboard eraser; board eraser"],
  ["333903016_1", "10304-1", "APONTADOR DE LÁPIS", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 115, "pencil sharpener"],
  ["333903016_2", "45249-1", "BLOCO DE AUTO DE INTIMAÇÃO - COM 02 PÁGINAS, EM 4 (QUATRO) VIAS NUMERADAS; PAPEL AP RECICLADO; SENDO: - 1ª VIA NA COR BRANCA; -2ª VIA NA COR ROSA E PAPEL AUTO COPIATIVO; - 3ª VIA NA COR AZUL PAPEL A", "BLOCO", "333903016", "MATERIAL DE EXPEDIENTE", "", 16, "carbonless copy paper; receipt book"],
  ["333903016_3", "1620-1", "BOBINA DE SENHA; COM: 2.000 SENHAS POR ROLO", "ROLO", "333903016", "MATERIAL DE EXPEDIENTE", "", 72, "queue ticket roll; ticket roll"],
  ["333903016_4", "32680-2", "BORRACHA PARA DINHEIRO PACOTE 50 UNIDADES", "PACOTE 50 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 53, "rubber bands"],
  ["333903016_5", "173911-1", "CAIXA PARA CORRESPONDENCIA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 9, "letter tray; desk tray"],
  ["333903016_6", "58701-1", "CANETA MARCA TEXTO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 1287, "highlighter pens; highlighter"],
  ["333903016_7", "35195-1", "CANETA PARA RETROPROJETOR, COR AZUL.", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 50, "blue permanent marker; permanent marker"],
  ["333903016_8", "35196-1", "CANETA PARA RETROPROJETOR NA COR PRETA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 55, "black permanent marker; permanent marker"],
  ["333903016_9", "35197-1", "CANETA PARA RETROPROJETOR NA COR VERMELHA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 174, "red permanent marker; permanent marker"],
  ["333903016_10", "10391-1", "CAPA DE PROCESSO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 154, "manila folder; file folder"],
  ["333903016_11", "36963-1", "CAPA PROCESSO SIMPLES BRANCA", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 427, "white paper folder; file folder"],
  ["333903016_12", "24168-1", "CARTOLINA AZUL 240GRS - 55X73", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 71, "blue construction paper; blue paper"],
  ["333903016_13", "24132-2", "CARTOLINA BRANCA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 2, "white cardboard paper; white paper sheet"],
  ["333903016_14", "24134-1", "CARTOLINA VERDE; 240GRS - 55X73", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 65, "green construction paper; green paper"],
  ["333903016_15", "11644-1", "CLIPE NUMERO: 8/0 CAIXA 25 UNIDADES", "CAIXA", "333903016", "MATERIAL DE EXPEDIENTE", "", 44, "large paper clips; paper clips"],
  ["333903016_16", "308151-1", "CLIPE, TRATAMENTO SUPERFICIAL:NIQUELADO, TAMANHO:6, MATERIAL:AÇO CARBONO, FORMATO:PARALELO", "CAIXA 50 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 53, "paper clips box; paper clips"],
  ["333903016_17", "259804-1", "CLIPS; Nº 2; GALVANIZADO; CAIXA: 50 UNIDADES", "CAIXA 50 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 2, "small paper clips; paper clips"],
  ["333903016_18", "260183-1", "CLIPS; Nº 8; GALVANIZADO; CAIXA: 25 UNIDADES", "CAIXA 25 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 39, "paper clips pile; paper clips"],
  ["333903016_19", "15319-1", "COLA BRANCA EM BASTAO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 189, "glue stick"],
  ["333903016_20", "47320-1", "COLA TERMOPLÁSTICA TRANSPARENTE 11,3 MM DIÂMETRO, BASTÃO COM 30CM APROXIMADAMENTE, GROSSO. (COLA QUENTE)", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 41, "hot glue sticks; hot glue"],
  ["333903016_21", "11652-1", "COLCHETE Nº 12", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 26, "brass paper fastener; split pin"],
  ["333903016_22", "10321-1", "COLCHETE Nº 15", "CAIXA", "333903016", "MATERIAL DE EXPEDIENTE", "", 2, "brass paper fasteners; split pin"],
  ["333903016_23", "49501-1", "COLCHETE NUMERO: 3", "CAIXA", "333903016", "MATERIAL DE EXPEDIENTE", "", 18, "brass paper fasteners; split pin"],
  ["333903016_24", "11649-1", "COLCHETE P/PASTA; MATERIAL: ACO; ACABAMENTO: LATONADO; NUMERO: 3; UNIDADE DE FORNECIMENTO: CAIXA 72 UNIDADES", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 7, "brass paper fasteners; split pin"],
  ["333903016_25", "11650-1", "COLCHETE P/PASTA N° 7 LANTONADO; CAIXA 72 UNID", "CAIXA", "333903016", "MATERIAL DE EXPEDIENTE", "", 12, "brass paper fastener; split pin"],
  ["333903016_26", "11656-1", "CORRETIVO LIQUIDO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 415, "correction fluid"],
  ["333903016_27", "10394-1", "ENVELOPE BRANCO P/ CORRESPONDENCIA 9 X 14", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 3531, "white envelope; envelope"],
  ["333903016_28", "76249-1", "ENVELOPE PAPEL KRAFT NATURAL 185MMX248MM", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 69218, "kraft envelope; brown envelope"],
  ["333903016_29", "49692-1", "ENVELOPE PAPEL KRAFT NATURAL 310MMX410MM", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 4941, "large brown envelope; kraft envelope"],
  ["333903016_30", "77990-1", "ENVELOPE PAPEL; MATERIAL: PAPEL KRAFT: 240 MM; ALTURA: 340 MM", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 2017, "brown paper envelope; kraft envelope"],
  ["333903016_31", "15348-1", "ESTILETE MEDIO", "1 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 16, "utility knife; box cutter"],
  ["333903016_32", "62620-1", "ETIQUETA AUTO ADESIVA, COR: BRANCA; ALTURA: 99,1 MM; LARGURA: 34 MM; APRESENTAÇÃO:FOLHA SOLTA; QUANTIDADE: 16 ETIQUETAS POR FOLHA; FORMATO DA FOLHA: A4; MARCA: SIMILAR PIMACO A 4362 (PARA SMO); UNIDA", "ENVELOPE", "333903016", "MATERIAL DE EXPEDIENTE", "", 20, "address labels sheet; label sheet"],
  ["333903016_33", "34476-1", "ETIQUETA AUTO ADESIVA PARA INK-JET/LASER; COR ETIQUETA: BRANCA ; ALTURA: 25,4 MM ; LARGURA: 101,6 MM ; APRESENTACAO: FOLHA SOLTA ; QUANTIDADE: 20 ETIQUETAS POR FOLHA ; FORMATO DA FOLHA: CARTA; MARCA:", "ENVELOPE", "333903016", "MATERIAL DE EXPEDIENTE", "", 6, "address labels sheet; label sheet"],
  ["333903016_34", "34473-1", "ETIQUETA AUTO ADESIVA PARA INK-JET/LASER; COR ETIQUETA: BRANCA ; ALTURA: 50,8 MM ; LARGURA: 101,6 MM ; APRESENTACAO: FOLHA SOLTA ; QUANTIDADE: 10 ETIQUETAS POR FOLHA ; FORMATO DA FOLHA: CARTA; MARCA:", "ENVELOPE", "333903016", "MATERIAL DE EXPEDIENTE", "", 19, "shipping labels sheet; label sheet"],
  ["333903016_35", "10381-1", "ETIQUETA AUTO ADESIVA URGENTE", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 99, "urgent sticker; urgent stamp"],
  ["333903016_36", "76982-2", "ETIQUETA PARA CAPA DE PROCESSO PCT C/ 100 FLS COM 2 (DUAS) ETIQUETAS CADA", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 20, "file folder labels; adhesive labels"],
  ["333903016_37", "78006-1", "EXTRATOR DE GRAMPO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 304, "staple remover"],
  ["333903016_38", "10293-1", "FICHA PALITROADA 4 X 6", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 10, "index cards"],
  ["333903016_39", "10295-1", "FICHA PALITROADA 5 X 8 C/ 100", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 10, "index cards; index card"],
  ["333903016_40", "104568-1", "FITA ADESIVA DUPLA FACE; MATERIAL DO ADESIVO: ADESIVO ACRILICO; COR: BRANCA; LARGURA: 18 MM; COMPRIMENTO: 30 M; UNIDADE DE FORNECIMENTO: PACOTE 6 UNIDADES.", "ROLO", "333903016", "MATERIAL DE EXPEDIENTE", "", 317, "double-sided tape; adhesive tape roll"],
  ["333903016_41", "11677-1", "FITA ADESIVA PLASTICA FACE SIMPLES INCOLOR; 19 MM X 50 M", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 936, "transparent adhesive tape; sellotape"],
  ["333903016_42", "10342-1", "GRAFITE 05MM", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 344, "mechanical pencil leads; pencil lead"],
  ["333903016_43", "10296-1", "GRAFITE 0,7MM", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 79, "mechanical pencil leads; pencil lead"],
  ["333903016_44", "10341-1", "GRAFITE 09MM", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 11, "mechanical pencil leads; pencil lead"],
  ["333903016_45", "35208-2", "GRAMPO PARA GRAMPEADOR DE ARAME COBREADO, MEDINDO 9/14MM - (1.000 UNIDADES)", "1000 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 2, "box of staples; staples"],
  ["333903016_46", "15393-1", "GRAMPO PARA GRAMPEADOR DE MESA, COBREADO, 26/6, CAIXA COM 1000 UNIDADES.", "CAIXA 1000 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 63, "staples 26/6; box of staples"],
  ["333903016_47", "11760-1", "GRAMPO P/GRAMPEADOR; MATERIAL: ACO CARBONO; ACABAMENTO: GALVANIZADO; TAMANHO: 23/8; UNIDADE DE FORNECIMENTO: CAIXA 1000 UNIDADES", "CAIXA", "333903016", "MATERIAL DE EXPEDIENTE", "", 1, "heavy duty staples; box of staples"],
  ["333903016_48", "10297-1", "GRAMPO P/GRAMPEADOR 26/6", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 38, "stapler staples; box of staples"],
  ["333903016_49", "121865-1", "GRAMPO TRILHO PLASTICO ESTENDIDO", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 69, "plastic prong fastener; paper fastener"],
  ["333903016_50", "121866-1", "GRAMPO TRILHO PLASTICO PEQUENO", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 142, "plastic prong fastener; paper fastener"],
  ["333903016_51", "54404-1", "LACRE DE SEGURANCA AZUL; APLICACAO: MALOTE; MATERIAL: POLIPROPILENO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 500, "plastic security seal; security seal"],
  ["333903016_52", "10343-1", "LÁPIS PRETO Nº 02", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 921, "graphite pencil; pencil"],
  ["333903016_53", "15406-1", "LAPISEIRA 0,5MM", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 48, "mechanical pencil"],
  ["333903016_54", "241894-1", "LAPISEIRA 0,7 MM", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 12, "mechanical pencil"],
  ["333903016_55", "258579-1", "LAPISEIRA 0,9 MM", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 48, "mechanical pencil"],
  ["333903016_56", "49878-1", "LIVRO PROTOCOLO PARA CORRESPONDENCIA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 169, "ledger book; register book"],
  ["333903016_57", "16481-1", "MARCADOR PERMANENTE PARA CD", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 3, "CD marker pen; permanent marker"],
  ["333903016_58", "234287-1", "MARCADOR/PINCEL ATOMICO PERMANENTE AZUL", "01 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 158, "blue marker pen; marker pen"],
  ["333903016_59", "45228-1", "PAPEL A3 PCT C/500 FLS CHAMEX", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 1, "ream of paper; paper ream"],
  ["333903016_60", "77985-1", "PAPEL CONTACT TRANSPARENTE - FOLHA 50 CM", "01 FOLHA", "333903016", "MATERIAL DE EXPEDIENTE", "", 22, "self-adhesive film roll; plastic film roll"],
  ["333903016_61", "11765-2", "PAPEL COUCHE", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 4061, "glossy paper; coated paper"],
  ["333903016_62", "11713-1", "PAPEL DE SEDA ; GRAMATURA: 18 G/M²; TINTA: ATOXICA, BASE AGUA ; LARGURA: 480 MM ; COMPRIMENTO: 600 MM ; UNIDADE DE FORNECIMENTO: PACOTE 200 FL;", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 8, "tissue paper; colored tissue paper"],
  ["333903016_63", "10347-1", "PAPEL OFÍCIO II", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 2, "ream of paper; paper ream"],
  ["333903016_64", "11709-1", "PAPEL SULFITE; MATERIAL: ALCALINO; COR: BRANCO; GRAMATURA: 75 G/M²; FORMATO: A4; LARGURA: 210 MM; ALTURA: 297 MM; APLICACAO: MULTIUSO; APRESENTACAO: PACOTE 500 FL; UNIDADE DE FORNECIMENTO: PACOTE", "PACOTE", "333903016", "MATERIAL DE EXPEDIENTE", "", 657, "A4 paper ream; ream of paper"],
  ["333903016_65", "254145-1", "PASTA AZ LOMBO ESTREITO", "1 UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 139, "lever arch file; ring binder"],
  ["333903016_66", "10365-1", "PASTA AZ LOMBO ESTREITO MEMORANDO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 38, "lever arch file; ring binder"],
  ["333903016_67", "1637-1", "PASTA AZ; USUAL CARTÃO; LOMBO LARGO (LL); DIMENSÃO 35X28X8 CM; ESPESSURA 1,7MM; MECANISMO NIQUELADO TIPO EXPORTAÇÃO; OLHAL E COMPRESSOR PLÁSTICO; FORRADO COM PAPEL MONOLÚCIDO 75 GR PLASTIFICADO; AVUL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 28, "lever arch file; ring binder"],
  ["333903016_68", "15438-2", "PASTA CLASSIFICADORA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 37, "document folder; file folder"],
  ["333903016_69", "10373-1", "PASTA COM TRILHO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 287, "plastic report cover; plastic folder"],
  ["333903016_70", "11717-1", "PASTA DE PAPEL CARTÃO C/ ELÁSTICO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 2854, "folder with elastic band; document folder"],
  ["333903016_71", "11721-1", "PASTA L ; MATERIAL: CLORETO DE POLIVINILA (PVC) ; GRAMATURA/ESPESSURA: 0,25 MM ; COR: CRISTAL TRANSPARENTE ; LARGURA: 225 MM ; COMPRIMENTO: 340 MM ; UNIDADE DE FORNECIMENTO: PACOTE 10 UN;", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 238, "clear plastic folder; plastic sleeve"],
  ["333903016_72", "76242-1", "PASTA POLIONDA COM ELASTICO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 533, "plastic folder elastic; plastic folder"],
  ["333903016_73", "11722-1", "PASTA SUSPENSA ; MATERIAL: CARTAO TRIPLEX ; GRAMATURA/ESPESSURA: 350 G/M² ; ACABAMENTO: MARMORIZADA E PLASTIFICADA ; COR: CASTANHO CLARO ; HASTE: METALICO ; PONTEIRA: METALICA ; LARGURA: 240 MM ; COM", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 45, "hanging file folders; hanging folder"],
  ["333903016_74", "50830-1", "REGUA PLASTICA 30 CM CRISTAL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 18, "transparent ruler; ruler"],
  ["333903016_75", "10377-1", "REGUA TRANSPARENTE 50CM", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 6, "plastic ruler; ruler"],
  ["333903016_76", "10323-1", "REQUISIÇÃO DE MATERIAL PERMANENTE", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 196, "paper form pad; paper forms"],
  ["333903016_77", "1211-1", "SACO PLÁSTICO, TRANSPARENTE, CRISTAL, INCOLOR, EXTRA GROSSO, COM 4 FUROS, TAMANHO A4", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 402, "sheet protector; plastic sleeve"],
  ["333903016_78", "10430-1", "TERMO DE ENTREGA VOLUNIDADETÁRIA DE ANIMAIS", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 12, "paper forms; paper form pad"],
  ["333903019_0", "10489-1", "FILME PVC TRANSPARENTE", "UNIDADE", "333903019", "MATERIAL DE ACONDICIONAMENTO E EMBALAGEM", "", 7, "plastic wrap; cling film"],
  ["333903019_1", "10487-1", "FITILHO DE NYLON", "ROLO", "333903019", "MATERIAL DE ACONDICIONAMENTO E EMBALAGEM", "", 1, "polypropylene twine; twine"],
  ["333903019_2", "154062-1", "LACRE MOD.009 CABO AÇO 1 MTR, AZUL, GRAVADO E NUMERADO PCTE 100 UND", "PACOTE", "333903019", "MATERIAL DE ACONDICIONAMENTO E EMBALAGEM", "", 92, "cable seal; security seal"],
  ["333903019_3", "10488-1", "PAPEL ALUMINIO", "UNIDADE", "333903019", "MATERIAL DE ACONDICIONAMENTO E EMBALAGEM", "", 52, "aluminium foil roll; aluminium foil"],
  ["333903021_0", "43278-1", "BANDEJA REDONDA INOX 40 CM", "01 UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 13, "round stainless steel tray; serving tray"],
  ["333903021_1", "2558-1", "BANDEJA RETANGULAR; MATERIAL: AÇO INOX", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 16, "stainless steel tray; serving tray"],
  ["333903021_2", "34507-1", "CANECAO ALUMINIO FORTE COM ALÇA MADEIRA CAPACIDADE 3,5 LITROS", "01 UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 6, "aluminium saucepan; saucepan"],
  ["333903021_3", "45576-1", "COADOR DE CAFE ALGODÃO MEDIO", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 12, "cloth coffee filter; coffee filter"],
  ["333903021_4", "73862-1", "COPO DESCARTÁVEL DE 200 ML", "PACOTE 100 UNIDADES", "333903021", "MATERIAL DE COPA E COZINHA", "", 1685, "disposable plastic cups; plastic cup"],
  ["333903021_5", "275930-1", "COPO DESCARTAVEL 50ML", "PACOTE 100 UNIDADES", "333903021", "MATERIAL DE COPA E COZINHA", "", 576, "small plastic cups; plastic cup"],
  ["333903021_6", "175090-1", "FILTRO REFIL PARA PURIFICADOR DE AGUA", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 51, "water filter cartridge; water filter"],
  ["333903021_7", "250483-1", "FUNIL INOX COM ALÇA 13 CM", "01 UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 1, "stainless steel funnel; funnel"],
  ["333903021_8", "6377-1", "JARRA; DE VIDRO; CAPACIDADE DE: 1,5 LITROS", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 23, "glass pitcher; glass jug"],
  ["333903021_9", "75656-1", "LIXEIRA REDONDA SEM TAMPA 14 LITROS", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 9, "plastic waste basket; waste basket"],
  ["333903021_10", "16369-2", "MEXEDOR PARA CAFÉ DE PLÁSTICO;PACOTE COM 500 UNIDADES", "PACOTE", "333903021", "MATERIAL DE COPA E COZINHA", "", 42, "coffee stirrer; stirrer"],
  ["333903021_11", "78103-1", "PANO DE PRATO", "01 UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 90, "tea towel; dish towel"],
  ["333903021_12", "36590-1", "XÍCARA DE CAFÉ EM PORCELANA 75 ML COM PIRES", "01 UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 36, "espresso cup and saucer; coffee cup"],
  ["333903021_13", "106220-1", "XICARA DE CHA COM PIRES - PORCELANA", "01 UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 20, "white tea cup and saucer; teacup"],
  ["333903022_0", "246258-1", "ALCOOL ETILICO HIDRATADO 70% INPM, USO HOSPITALAR, FRASCO PLASTICO RESISTENTE, EMBALAGEM CONTENDO 1L", "LITRO", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 8, "rubbing alcohol bottle; ethanol bottle"],
  ["333903022_1", "246259-1", "DISPENSER PARA ALCOOL GEL", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 2, "hand sanitizer dispenser; soap dispenser"],
  ["333903022_2", "15629-1", "ESPONJA DUPLA FACE", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 156, "kitchen sponge; sponge"],
  ["333903023_0", "221443-1", "CAMISA MANGA LONGA MASCULINA", "UNIDADE", "333903023", "UNIFORMES, TECIDOS E AVIAMENTOS", "", 1, "men's dress shirt; dress shirt"],
  ["333903024_0", "68991-1", "DUCHA HIGIENICA", "UNIDADE", "333903024", "MATERIAL PARA MANUTENÇÃO DE BENS IMÓVEIS", "", 8, "bidet shower; bidet sprayer"],
  ["333903024_1", "244833-1", "KIT: REPARO COMPLETO PARA CAIXA ACOPLADA DE VASOS SANITARIOS", "UNIDADE", "333903024", "MATERIAL PARA MANUTENÇÃO DE BENS IMÓVEIS", "", 40, "toilet fill valve; toilet cistern"],
  ["333903024_2", "69702-1", "OBTURADOR COMPATIVEL COM CAIXA ACOPLADA ICASA.", "UNIDADE", "333903024", "MATERIAL PARA MANUTENÇÃO DE BENS IMÓVEIS", "", 122, "toilet flapper; toilet cistern"],
  ["333903024_3", "252317-1", "SIFAO SANFONADO UNIVERSAL EM PVC", "01 UNIDADE", "333903024", "MATERIAL PARA MANUTENÇÃO DE BENS IMÓVEIS", "", 30, "flexible sink trap; sink trap"],
  ["333903026_0", "231524-1", "CHUVEIRO ELETRICO TIPO DUCHA, 127V, 5500W, 3 TEMPERATURAS, COR BRANCA.", "01 UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 4, "electric shower; shower head"],
  ["333903026_1", "231524-1", "CHUVEIRO ELETRICO TIPO DUCHA, 127V, 5500W, 3 TEMPERATURAS, COR BRANCA.", "01 UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "115610100 - MATERIAL DE CONSUMO (ALMOXARIFADO CENTRAL)", 16, "electric shower; shower head"],
  ["333903026_2", "251211-1", "CHUVEIRO ELETRICO 220V", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 13, "electric shower; shower head"],
  ["333903026_3", "251211-1", "CHUVEIRO ELETRICO 220V", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "115610100 - MATERIAL DE CONSUMO (ALMOXARIFADO CENTRAL)", 16, "electric shower; shower head"],
  ["333903026_4", "132585-1", "LÂMPADA A-60 LED 12 W BIVOLT BRANCA FRIA", "01 UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 1861, "LED light bulb; LED lamp"],
  ["333903026_5", "132583-1", "LAMPADA; MODELO: TUBULAR T8; TIPO: LED; POTENCIA: 20W", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 1402, "LED tube light; T8 LED tube"],
  ["333903026_6", "152294-2", "LAMPADA TUBULAR LED, 10W, TENSAO BIVOLT, TEMPERATURA DE COR 6.400K,FLUXO LUMINISO 4.000LM, EQUIVALENTE A FLUORESCENTE DE 20W", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 945, "LED tube; LED tube light"],
  ["333903026_7", "11728-1", "PILHA ; TIPO: ALCALINA ; TAMANHO: PEQUENA (AA) ; VOLTAGEM: 1,5 V", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 15, "AA battery; alkaline battery"],
  ["333903026_8", "11728-1", "PILHA ; TIPO: ALCALINA ; TAMANHO: PEQUENA (AA) ; VOLTAGEM: 1,5 V", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "115610100 - MATERIAL DE CONSUMO (ALMOXARIFADO CENTRAL)", 100, "AA battery; alkaline battery"],
  ["333903026_9", "1200-1", "PILHA ALCALINA, TAMANHO PALITO (AAA), 1,5 VOLTS, EMBALAGEM COM 02 UNIDADES", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 48, "AAA battery; alkaline battery"],
  ["333903026_10", "1200-1", "PILHA ALCALINA, TAMANHO PALITO (AAA), 1,5 VOLTS, EMBALAGEM COM 02 UNIDADES", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "115610100 - MATERIAL DE CONSUMO (ALMOXARIFADO CENTRAL)", 200, "AAA battery; alkaline battery"],
  ["333903026_11", "1691-1", "PILHA RECARREGÁVEL AA DE 2.050 MAH A 2500 MAH, 1,2 VOLTS, GARANTIA 1000 RECARGAS, 02 UNIDADES", "PACOTE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 110, "rechargeable AA batteries; NiMH battery"],
  ["333903026_12", "237967-1", "PLUG FEMEA; 10 AMPERES; 2 PINOS EM PLASTICO POLIAMIDA ANTI-CHAMA; PINO MACICO EM LIGA DE COBRE; FABRICADO DE ACORDO COM A NBR 14136 DA ABNT.", "01 UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 5, "NBR 14136 plug; electrical plug"],
  ["333903026_13", "152314-1", "PLUG MACHO DE 10A 2P+T.", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 40, "NBR 14136 plug; electrical plug"],
  ["333903026_14", "36377-1", "RESISTÊNCIA P/ CHUVEIRO CAPACIDADE 4000W, 110V,COMPATÍVEL P/ LORENZETTI", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 40, "electric shower heating element; heating element"],
  ["333903026_15", "216441-1", "RESISTENCIA PARA CHUVEIRO", "01 UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 40, "electric shower heating element; heating element"],
  ["333903026_16", "266034-1", "RESISTENCIA PARA CHUVEIRO 220V", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 39, "electric shower heating element; heating element"],
  ["333903028_0", "194601-1", "BONE AMERICANO EM BRIM AZUL ROYAL", "UNIDADE", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 1, "blue baseball cap; baseball cap"],
  ["333903028_1", "100770-2", "BOTA TATICA; MATERIAL DO CABEDAL: COURO BOVINO HIDROFUGADO; COR: PRETA; COMPRIMENTO DO CANO: 21 CM; TAMANHO: DO 37 AO 44; SOLADO: ANTIDERRAPANTE, MA", "PAR", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 46, "black combat boots; combat boots"],
  ["333903028_2", "266773-1", "ECA COMPONENTE: CADEADO COMUM; MATERIAL CORPO: LATAO MACICO", "UNIDADE", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 4, "brass padlock; padlock"],
  ["333903028_3", "245494-1", "MASCARA (MODELO 3D) DE USO INDIVIDUAL, LAVAVEL COM TRIPLA CAMADA DE TECIDO, NA COR PRETA, COM ELASTICO PARA PRENDER NO ROSTO E LOGOMARCA DO ORGAO EM SILKSCREEN.", "01 UNIDADE", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 12, "black cloth face mask; cloth face mask"],
  ["333903028_4", "167269-1", "MASCARA TIPO RESPIRADOR PFF2, MASCARA N95", "UNIDADE", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 259, "N95 mask; N95 respirator"],
  ["333903028_5", "11743-1", "MASCARA-RESPIRADOR/PURIFICADOR DE AR SEMI FACIAL", "UNIDADE", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 79, "half face respirator; respirator mask"],
  ["333903028_6", "266774-1", "PECA COMPONENTE: CADEADO TETRA; MATERIAL CORPO: LATAO MACICO; LARGURA: ENTRE 50 E 53 MM", "UNIDADE", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 1, "brass padlock; padlock"],
  ["333903028_7", "274332-1", "PROTETOR/BLOQUEADOR SOLAR; PROTECAO: RAIOS UVA/UVB; FATOR DE PROTECAO SOLAR 60; APRESENTACAO: LOCAO CREMOSA; VALIDADE: 12 MESES, ACONDICIONAMENTO: FRA", "UNIDADE", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 458, "sunscreen bottle; sunscreen"],
  ["333903048_0", "0289346-1", "TELEFONE SEM FIO - ALCANCE: 300 M; FREQÜÊNCIA: MÍNIMO 1,90 GHZ; FUNÇÃO: IDENTIFICADOR DE CHAMADAS.", "UNIDADE", "333903048", "BENS MÓVEIS NÃO ATIVÁVEIS", "", 35, "cordless phone; cordless telephone"],
  ["333903048_1", "243067-1", "TERMOMETRO CLINICO INFRAVERMELHO SEM CONTATO", "UNIDADE", "333903048", "BENS MÓVEIS NÃO ATIVÁVEIS", "", 1, "infrared thermometer; forehead thermometer"]
];
