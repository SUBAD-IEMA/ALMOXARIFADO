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
 * ATUALIZAÇÃO: cole a versão nova por cima e publique em
 *  Implantar > Gerenciar implantações > lápis > Versão: Nova versão. Os dados da planilha são mantidos.
 * Este mesmo arquivo também é usado pelo "modo demonstração" das páginas.
 */

/* ======================= Opções ======================= */
const ENVIAR_EMAIL = true;        // avisa o solicitante quando o pedido é recebido e quando muda de situação
const ORGAO = 'IEMA - Instituto Estadual de Meio Ambiente';
const NOME_REMETENTE = 'IEMA - Almoxarifado (não responda)';
const MAX_GESTORES = 5;           // número máximo de logins de gestor (incluindo o gestor principal/master)
const INATIVIDADE_MIN = 15;       // regra de segurança: sessão do gestor encerra após 15 minutos sem atividade
/* Pedidos só são aceitos com e-mail institucional deste domínio (qualquer nome antes do @). */
const DOMINIO_EMAIL = 'iema.es.gov.br';
/* Backup mensal automático (todo dia 1º, às 6h): PDF, Excel e JSON com solicitações, histórico e estoque.
   Os e-mails já estão definidos; o backup se ativa sozinho no primeiro acesso de um gestor (não precisa do menu da planilha). */
const BACKUP_EMAILS = ['almoxarifado@iema.es.gov.br', 'subad@iema.es.gov.br'];
const HORAS_SESSAO = 10;          // duração máxima de uma sessão, mesmo com atividade

/* ======================= Estrutura ======================= */
/* Fluxo do pedido: Pendente → (Atendimento total ou parcial) → Aguardando retirada → (Entrega realizada) → Entrega realizada.
   Pendente também pode ser Recusado. "Aprovado", "Atendido" e "Parcialmente atendido" ficam só para pedidos antigos. */
const SITUACOES = ['Pendente', 'Aguardando retirada', 'Entrega realizada', 'Recusado', 'Aprovado', 'Parcialmente atendido', 'Atendido'];
const ABERTAS = ['Pendente', 'Aprovado'];                 // quantidades reservadas, aguardando o atendimento
const RETIRADA = 'Aguardando retirada';                   // materiais separados, aguardando o solicitante retirar
const FINAIS = ['Entrega realizada', 'Recusado', 'Parcialmente atendido', 'Atendido'];
const ABAS = {
  catalogo: ['Catálogo', ['id', 'Código', 'Descrição', 'Unidade', 'Natureza (código)', 'Natureza (nome)', 'Conta contábil', 'Qtd. disponível', 'Limite por pedido', 'Indisponível', 'Imagem', 'Termo de busca', 'Qtd. no relatório', 'Ativo', 'Atualizado em', 'Versão da imagem', 'Oculto', 'Só visualização'], 'A:B'],
  imagens:  ['Imagens enviadas', ['id', 'Imagem (parte 1)', 'Atualizado em', 'Parte 2', 'Parte 3', 'Parte 4', 'Parte 5', 'Parte 6'], 'A:A'],
  pedidos:  ['Pedidos', ['Pedido', 'Data', 'Nome completo', 'Setor', 'Telefone', 'E-mail', 'Observação', 'Itens (dados)', 'Qtd. de itens', 'Unidades solicitadas', 'Unidades atendidas', 'Situação', 'Atualizado em', 'Resposta do gestor', 'Andamento (dados)', 'Rascunho do atendimento (dados)'], 'A:A,E:E'],
  historico:['Histórico', ['Data', 'Tipo', 'Pedido', 'id', 'Código', 'Descrição', 'Antes', 'Depois', 'Variação', 'Detalhes', 'Responsável'], 'C:E'],
  config:   ['Configuração', ['Chave', 'Valor'], 'A:B']
};
const NCOL = 18;
const COL = { id: 0, codigo: 1, descricao: 2, unidade: 3, natureza: 4, naturezaNome: 5, conta: 6, qtd: 7, limite: 8, indisponivel: 9, imagem: 10, busca: 11, qtdRelatorio: 12, ativo: 13, atualizado: 14, imagemVersao: 15, oculto: 16, soVisualizar: 17 };

/* ======================= Perfis de acesso dos gestores ======================= */
/* Todo gestor sempre pode VISUALIZAR o painel, os pedidos, o catálogo e o estoque em tempo real.
   As permissões abaixo liberam as ações; o gestor principal (master) tem todas. */
const PERMISSOES = ['pedidos_atender', 'pedidos_excluir', 'estoque_ajustar', 'catalogo_editar', 'relatorios', 'auditoria', 'backup', 'backup_importar', 'configuracoes', 'usuarios'];
const PERMISSOES_ESCRITA = ['pedidos_atender', 'pedidos_excluir', 'estoque_ajustar', 'catalogo_editar', 'backup_importar', 'configuracoes', 'usuarios'];
const PERFIS = {
  admin:        { nome: 'Administrador do Sistema', p: PERMISSOES },
  operacional:  { nome: 'Gestor operacional', p: ['pedidos_atender', 'pedidos_excluir', 'estoque_ajustar', 'catalogo_editar', 'relatorios', 'auditoria', 'backup', 'configuracoes'] },
  estoque:      { nome: 'Almoxarife (estoque e catálogo)', p: ['pedidos_atender', 'estoque_ajustar', 'catalogo_editar', 'relatorios'] },
  pedidos:      { nome: 'Atendimento de pedidos', p: ['pedidos_atender', 'relatorios'] },
  auditor:      { nome: 'Auditor', p: ['relatorios', 'auditoria', 'backup'] },
  leitura:      { nome: 'Visualizador (leitura)', p: ['auditoria'] },
  personalizado:{ nome: 'Personalizado', p: [] }
};
/* Ação do sistema -> permissão exigida (conferida no servidor, não só na tela). */
const PERMISSAO_ACAO = { atender: 'pedidos_atender', excluirPedido: 'pedidos_excluir', ajustarEstoque: 'estoque_ajustar',
  salvarItem: 'catalogo_editar', indisponivel: 'catalogo_editar', visibilidade: 'catalogo_editar', soVisualizar: 'catalogo_editar', removerItem: 'catalogo_editar',
  salvarContato: 'configuracoes', salvarRegras: 'configuracoes', ativarBackup: 'configuracoes',
  salvarRascunho: 'pedidos_atender', linkPainel: 'relatorios', backupDados: 'backup', backupEmailAgora: 'backup', backupEnviarArquivos: 'backup', importarBackup: 'backup_importar',
  adicionarGestor: 'usuarios', removerGestor: 'usuarios', redefinirSenha: 'usuarios', editarGestor: 'usuarios' };
function permissoesDe(g) {
  const o = {};
  // Gestores de versões anteriores (sem perfil) mantêm o que podiam fazer: perfil "Gestor operacional".
  const lista = g.principal ? PERMISSOES : (Array.isArray(g.permissoes) ? g.permissoes : PERFIS.operacional.p);
  PERMISSOES.forEach(k => o[k] = lista.indexOf(k) >= 0);
  return o;
}
function perfilDe(g) {
  if (g.principal) return { id: 'master', nome: 'Gestor principal (master)' };
  const id = PERFIS[g.perfil] ? g.perfil : (Array.isArray(g.permissoes) ? 'personalizado' : 'operacional');
  return { id: id, nome: PERFIS[id].nome };
}
function pode(p) { return !!GESTOR && (GESTOR.principal || permissoesDe(GESTOR)[p]); }
const NOMES_PERMISSAO = { pedidos_atender: 'atender pedidos', pedidos_excluir: 'excluir pedidos', estoque_ajustar: 'ajustar quantidades do estoque',
  catalogo_editar: 'editar o catálogo', relatorios: 'gerar relatórios', auditoria: 'ver o histórico', backup: 'gerar ou enviar backup',
  backup_importar: 'importar backup', configuracoes: 'alterar configurações', usuarios: 'gerenciar usuários e perfis' };
function exigirPermissao(p) {
  if (!pode(p)) throw amigavel('Seu perfil (' + perfilDe(GESTOR).nome + ') não tem permissão para ' + (NOMES_PERMISSAO[p] || p) + '. Fale com o gestor principal.');
}
function normalizarPerfil(perfil, permissoes) {
  let lista = Array.isArray(permissoes) ? permissoes : ((PERFIS[perfil] || PERFIS.personalizado).p);
  lista = PERMISSOES.filter(k => lista.indexOf(k) >= 0);
  let id = PERFIS[perfil] ? perfil : 'personalizado';
  if (id !== 'personalizado' && PERFIS[id].p.join() !== lista.join()) id = 'personalizado';
  if (id === 'personalizado') Object.keys(PERFIS).forEach(k => { if (k !== 'personalizado' && id === 'personalizado' && PERFIS[k].p.join() === lista.join()) id = k; });
  return { perfil: id, permissoes: lista };
}

let QUEM = 'Sistema';     // quem está fazendo a operação (vai para a coluna "Responsável" do histórico)
let GESTOR = null;        // gestor conectado (ações do gestor)

/* ======================= Entrada ======================= */
function doGet() {
  return saida({ ok: true, servico: 'Almoxarifado IEMA', versao: versaoAtual(), mensagem: 'Servidor no ar. Cole este endereço em config.js (API_URL).' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return saida({ ok: false, erro: 'Requisição inválida.' }); }
  QUEM = 'Sistema'; GESTOR = null;
  const publicas = { versao: acaoVersao, catalogo: acaoCatalogo, imagens: acaoImagens, solicitar: acaoSolicitar, consultar: acaoConsultar,
    login: acaoLogin, situacaoAcesso: acaoSituacaoAcesso, criarPrimeiroGestor: acaoCriarPrimeiroGestor,
    esqueciSenha: acaoEsqueciSenha, redefinirComCodigo: acaoRedefinirComCodigo, painelPublico: acaoPainelPublico };
  const doGestor = { sair: acaoSair, painel: acaoPainel, atender: acaoAtender, excluirPedido: acaoExcluirPedido,
    salvarItem: acaoSalvarItem, ajustarEstoque: acaoAjustarEstoque, indisponivel: acaoIndisponivel, visibilidade: acaoVisibilidade, soVisualizar: acaoSoVisualizar,
    removerItem: acaoRemoverItem, salvarContato: acaoSalvarContato, gestores: acaoGestores, adicionarGestor: acaoAdicionarGestor,
    removerGestor: acaoRemoverGestor, redefinirSenha: acaoRedefinirSenha, trocarSenha: acaoTrocarSenha,
    alterarEmailGestor: acaoAlterarEmailGestor, editarGestor: acaoEditarGestor, linkPainel: acaoLinkPainel, salvarRascunho: acaoSalvarRascunho, salvarRegras: acaoSalvarRegras, manterConectado: acaoManterConectado, backupDados: acaoBackupDados, backupEmailAgora: acaoBackupEmailAgora,
    backupEnviarArquivos: acaoBackupEnviarArquivos, ativarBackup: acaoAtivarBackup, importarBackup: acaoImportarBackup };
  try {
    let f = publicas[req.acao];
    if (!f && doGestor[req.acao]) { exigirSessao(req.token, !!req.auto); if (PERMISSAO_ACAO[req.acao]) exigirPermissao(PERMISSAO_ACAO[req.acao]); f = doGestor[req.acao]; }
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
const ABAS_OK = {};
function aba(chave) {
  const [nome, cab, texto] = ABAS[chave];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    if (texto) texto.split(',').forEach(a1 => sh.getRange(a1).setNumberFormat('@'));
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#E2EDE8');
    sh.setFrozenRows(1);
  } else if (!ABAS_OK[chave]) {
    // Atualização de versões anteriores: acrescenta colunas novas no cabeçalho.
    const atual = sh.getRange(1, 1, 1, cab.length).getValues()[0];
    if (atual[cab.length - 1] === '') sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#E2EDE8');
  }
  ABAS_OK[chave] = true;
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
/* Texto digitado pelos usuários nunca vira fórmula na planilha (ex.: "=IMPORTXML(...)"). */
function seguro(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }
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
function dadosContato() {
  const c = lerConfig();
  return { nome: c.gestor_nome || '', setor: c.gestor_setor || '', telefone: String(c.gestor_telefone || ''), email: c.gestor_email || '' };
}
function dataBR(d) { return Utilities.formatDate(d || new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'); }
function registrar(rows) { anexar('historico', rows.map(r => (r.length >= 11 ? r : r.concat(new Array(10 - r.length).fill(''), [QUEM])).map(seguro))); }

/* ---------- Catálogo ---------- */
function simNao(v) { return v === true || String(v).toUpperCase() === 'SIM'; }
function lerCatalogo() {
  const sh = aba('catalogo');
  const itens = linhas(sh).map((r, i) => ({
    linha: i + 2, id: String(r[COL.id]), codigo: String(r[COL.codigo]), descricao: String(r[COL.descricao]), unidade: String(r[COL.unidade]),
    natureza: String(r[COL.natureza]), naturezaNome: String(r[COL.naturezaNome]), conta: String(r[COL.conta] || ''),
    qtd: Number(r[COL.qtd]) || 0, limite: Number(r[COL.limite]) || 0, indisponivel: simNao(r[COL.indisponivel]),
    imagem: String(r[COL.imagem] || ''), busca: String(r[COL.busca] || ''), qtdRelatorio: Number(r[COL.qtdRelatorio]) || 0,
    ativo: r[COL.ativo] === '' || r[COL.ativo] === undefined ? true : simNao(r[COL.ativo]), atualizado: iso(r[COL.atualizado]),
    imagemVersao: Number(r[COL.imagemVersao]) || 0, oculto: simNao(r[COL.oculto]), soVisualizar: simNao(r[COL.soVisualizar])
  })).filter(it => it.id);
  const mapa = {}; itens.forEach(it => mapa[it.id] = it);
  return { sh, itens, mapa };
}
function linhaItem(it) {
  return [it.id, seguro(it.codigo), seguro(it.descricao), seguro(it.unidade), seguro(it.natureza), seguro(it.naturezaNome), seguro(it.conta || ''), it.qtd, it.limite || 0,
    it.indisponivel ? 'SIM' : 'NÃO', it.imagem || '', it.busca || '', it.qtdRelatorio || 0, it.ativo === false ? 'NÃO' : 'SIM', new Date(), it.imagemVersao || 0, it.oculto ? 'SIM' : 'NÃO', it.soVisualizar ? 'SIM' : 'NÃO'];
}
function gravarItem(sh, it) {
  if (it.linha) sh.getRange(it.linha, 1, 1, NCOL).setValues([linhaItem(it)]);
  else { sh.getRange(sh.getLastRow() + 1, 1, 1, NCOL).setValues([linhaItem(it)]); it.linha = sh.getLastRow(); }
}
function publico(it) {
  return { id: it.id, codigo: it.codigo, descricao: it.descricao, unidade: it.unidade, natureza: it.natureza, naturezaNome: it.naturezaNome, conta: it.conta,
    qtd: it.qtd, limite: it.limite, indisponivel: it.indisponivel, oculto: it.oculto, soVisualizar: !!it.soVisualizar, imagem: it.imagem, imagemVersao: it.imagemVersao, busca: it.busca, qtdRelatorio: it.qtdRelatorio };
}

/* Carrega sozinho o catálogo inicial e os materiais acrescentados (Catálogo GOV ES), sem depender do gestor. */
function garantirCatalogo() {
  const vazio = aba('catalogo').getLastRow() < 2;
  if (!vazio && props().getProperty('CAT_ADICIONAL_V1') && props().getProperty('IMG_V6') && props().getProperty('HIST_ZERADO_V5')) return;
  const lock = bloquear();
  try { carregarCatalogoInicial(); aplicarCatalogoAdicional(); limparImagensV5(); zerarHistoricoUmaVez(); } finally { lock.releaseLock(); }
}
/* Versão 6: só os materiais do Catálogo GOV ES têm foto. As imagens aproximadas colocadas na versão 5
   nos demais materiais são retiradas (os quadrinhos ficam em branco para o gestor inserir a imagem).
   Imagens que o gestor já tenha trocado são mantidas. */
function limparImagensV5() {
  if (props().getProperty('IMG_V6')) return 0;
  let n = 0;
  if (props().getProperty('IMG_V5')) {
    const cat = lerCatalogo();
    Object.keys(IMAGENS_APROXIMADAS_V5).forEach(id => { const it = cat.mapa[id]; if (it && it.imagem === IMAGENS_APROXIMADAS_V5[id]) { it.imagem = ''; gravarItem(cat.sh, it); n++; } });
  }
  props().setProperty('IMG_V6', '1'); novaVersao();
  return n;
}
/* Versão 5: o histórico começa zerado (uma única vez). Depois, só o gestor principal pode zerar de novo. */
function zerarHistoricoUmaVez() {
  if (props().getProperty('HIST_ZERADO_V5')) return;
  limparHistorico();
  props().setProperty('HIST_ZERADO_V5', '1'); novaVersao();
}
function limparHistorico() {
  const sh = aba('historico'), n = sh.getLastRow();
  if (n > 1) sh.deleteRows(2, n - 1);
}
function carregarCatalogoInicial() {
  const sh = aba('catalogo');
  if (sh.getLastRow() > 1) return 0;
  const agora = new Date();
  const rows = CATALOGO_INICIAL.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], 0, 'NÃO', '', r[8], r[7], 'SIM', agora, 0, 'NÃO', 'NÃO']);
  sh.getRange(2, 1, rows.length, NCOL).setValues(rows);
  registrar([[agora, 'Catálogo carregado', '', '', '', 'Relatório de Itens em Estoque de 17/10/2026 (' + rows.length + ' materiais)']]);
  novaVersao();
  return rows.length;
}
function aplicarCatalogoAdicional() {
  if (props().getProperty('CAT_ADICIONAL_V1')) return 0;
  const cat = lerCatalogo(), agora = new Date();
  const rows = CATALOGO_ADICIONAL.filter(r => !cat.mapa[r[0]])
    .map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], 0, 'NÃO', r[9], r[8], 0, 'SIM', agora, 0, 'NÃO', 'NÃO']);
  if (rows.length) cat.sh.getRange(cat.sh.getLastRow() + 1, 1, rows.length, NCOL).setValues(rows);
  let vinculadas = 0;
  Object.keys(VINCULOS_IMAGEM).forEach(id => { const it = cat.mapa[id]; if (it && !it.imagem) { it.imagem = VINCULOS_IMAGEM[id]; gravarItem(cat.sh, it); vinculadas++; } });
  registrar([[agora, 'Catálogo ampliado', '', '', '', 'Catálogo GOV ES: ' + rows.length + ' materiais incluídos e ' + vinculadas + ' imagens vinculadas a materiais existentes']]);
  props().setProperty('CAT_ADICIONAL_V1', '1');
  novaVersao();
  return rows.length;
}

/* ---------- Pedidos ---------- */
function lerPedidos() {
  const sh = aba('pedidos');
  const pedidos = linhas(sh).map((r, i) => {
    let itens = [], andamento = [];
    try { itens = JSON.parse(r[7] || '[]'); } catch (e) {}
    try { andamento = JSON.parse(r[14] || '[]'); } catch (e) {}
    let rascunho = null; try { rascunho = r[15] ? JSON.parse(r[15]) : null; } catch (e) {}
    return {
      linha: i + 2, numero: String(r[0]), dataISO: iso(r[1]),
      solicitante: { nome: String(r[2]), setor: String(r[3]), telefone: String(r[4]), email: String(r[5]) },
      obs: String(r[6] || ''), itens, totalItens: Number(r[8]) || 0, totalUnidades: Number(r[9]) || 0, totalAtendido: r[10] === '' ? null : Number(r[10]),
      status: String(r[11] || 'Pendente'), atualizadoISO: iso(r[12]), resposta: String(r[13] || ''), andamento, rascunho
    };
  }).filter(p => p.numero);
  return { sh, pedidos };
}
function linhaPedido(p) {
  return [p.numero, new Date(p.dataISO), seguro(p.solicitante.nome), seguro(p.solicitante.setor), seguro(p.solicitante.telefone), seguro(p.solicitante.email), seguro(p.obs),
    JSON.stringify(p.itens), p.itens.length, p.totalUnidades, p.totalAtendido == null ? '' : p.totalAtendido, p.status, new Date(), seguro(p.resposta || ''), JSON.stringify(p.andamento),
    p.rascunho ? JSON.stringify(p.rascunho) : ''];
}
function semLinha(p) { const c = Object.assign({}, p); delete c.linha; return c; }

/* ======================= Gestores (até 3 logins) ======================= */
function hashSenha(salt, senha) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + senha, Utilities.Charset.UTF_8);
  return b.map(x => ('0' + ((x + 256) % 256).toString(16)).slice(-2)).join('');
}
function validarSenha(s) { s = String(s || ''); if (s.length < 8) throw amigavel('A senha precisa ter pelo menos 8 caracteres.'); return s; }
function validarEmailGestor(e) {
  e = String(e || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw amigavel('Informe um e-mail válido para o gestor (usado para recuperar a senha).');
  return e;
}
function novoGestor(usuario, nome, senha, principal, email) {
  usuario = String(usuario || '').trim().toLowerCase();
  nome = String(nome || '').trim().slice(0, 80);
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw amigavel('O usuário deve ter de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.');
  if (nome.length < 3) throw amigavel('Informe o nome do gestor.');
  const salt = Utilities.getUuid();
  return { usuario, nome, email: email === undefined ? '' : validarEmailGestor(email), principal: !!principal, salt, hash: hashSenha(salt, validarSenha(senha)), criadoEm: new Date().toISOString() };
}
function lerGestores() {
  let g = [];
  try { g = JSON.parse(props().getProperty('GESTORES') || '[]'); } catch (e) {}
  if (!g.length && props().getProperty('SENHA_GESTOR')) {
    // Versão anterior tinha uma senha única: vira o usuário "gestor" (principal) com a mesma senha.
    try { g = [novoGestor('gestor', dadosContato().nome || 'Gestor principal', props().getProperty('SENHA_GESTOR'), true)]; gravarGestores(g); } catch (e) { g = []; }
  }
  return g;
}
function gravarGestores(g) { props().setProperty('GESTORES', JSON.stringify(g)); }
const gestorPublico = g => { const p = permissoesDe(g); return { usuario: g.usuario, nome: g.nome, email: g.email || '', principal: !!g.principal, criadoEm: g.criadoEm,
  perfil: perfilDe(g), permissoes: p, somenteLeitura: !PERMISSOES_ESCRITA.some(k => p[k]) }; };

/* Cada sessão fica numa propriedade própria (SESS_<token>): vários gestores ao mesmo tempo não sobrescrevem a sessão um do outro.
   e = fim absoluto da sessão; a = último uso feito pelo gestor (as atualizações automáticas da tela não contam). */
const LIMITE_INATIVO_MS = INATIVIDADE_MIN * 60000 + 90000;   // 15 min + 1,5 min de tolerância de rede
function lerSessao(token) { try { return JSON.parse(props().getProperty('SESS_' + token) || 'null'); } catch (e) { return null; } }
function chavesSessao() { return props().getKeys().filter(k => k.indexOf('SESS_') === 0); }
function limparSessoesVencidas() {
  const agora = Date.now();
  chavesSessao().forEach(k => { let s = null; try { s = JSON.parse(props().getProperty(k) || 'null'); } catch (e) {} if (!s || s.e < agora || agora - s.a > LIMITE_INATIVO_MS) props().deleteProperty(k); });
}
function encerrarSessoesDe(usuario, exceto) {
  chavesSessao().forEach(k => { if (k === 'SESS_' + exceto) return; let s = null; try { s = JSON.parse(props().getProperty(k) || 'null'); } catch (e) {} if (!s || s.u === usuario) props().deleteProperty(k); });
}
function abrirSessao(g) {
  limparSessoesVencidas();
  const token = Utilities.getUuid() + Utilities.getUuid(), agora = Date.now();
  props().setProperty('SESS_' + token, JSON.stringify({ u: g.usuario, e: agora + HORAS_SESSAO * 36e5, a: agora }));
  return { token, gestor: gestorPublico(g), inatividadeMin: INATIVIDADE_MIN };
}
function exigirSessao(token, automatico) {
  const s = token ? lerSessao(token) : null, agora = Date.now();
  let motivo = 'Sua sessão expirou ou o acesso foi removido. Entre novamente.';
  if (s && agora - s.a > LIMITE_INATIVO_MS) motivo = 'Sessão encerrada por segurança após ' + INATIVIDADE_MIN + ' minutos sem atividade. Entre novamente.';
  const g = s && s.e > agora && agora - s.a <= LIMITE_INATIVO_MS ? lerGestores().find(x => x.usuario === s.u) : null;
  if (!g) { if (token) props().deleteProperty('SESS_' + token); const e = amigavel(motivo); e.sessao = true; throw e; }
  if (!automatico && agora - s.a > 20000) { s.a = agora; props().setProperty('SESS_' + token, JSON.stringify(s)); }
  GESTOR = g; QUEM = g.nome + ' (' + g.usuario + ')';
}
function acaoManterConectado() { return { inatividadeMin: INATIVIDADE_MIN }; }

function acaoSituacaoAcesso() { return { temGestores: lerGestores().length > 0, maxGestores: MAX_GESTORES }; }
function acaoCriarPrimeiroGestor(req) {
  garantirCatalogo();   // catálogo pronto e histórico zerado antes do primeiro registro
  const lock = bloquear();
  try {
    if (lerGestores().length) throw amigavel('O primeiro gestor já foi cadastrado. Entre com usuário e senha.');
    const g = novoGestor(req.usuario, req.nome, req.senha, true, req.email || '');
    gravarGestores([g]); GESTOR = g; QUEM = g.nome + ' (' + g.usuario + ')';
    registrar([[new Date(), 'Gestor cadastrado', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Gestor principal (primeiro acesso)']]);
    return abrirSessao(g);
  } finally { lock.releaseLock(); }
}
function acaoLogin(req) {
  const usuario = String(req.usuario || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache(), chave = 'falhas_' + usuario;
  const falhas = Number(cache.get(chave) || 0);
  if (falhas >= 8) throw amigavel('Muitas tentativas com senha errada para este usuário. Aguarde 10 minutos.');
  const g = lerGestores().find(x => x.usuario === usuario);
  if (!g || hashSenha(g.salt, String(req.senha || '')) !== g.hash) {
    cache.put(chave, String(falhas + 1), 600);
    Utilities.sleep(600);
    throw amigavel('Usuário ou senha incorretos.');
  }
  cache.remove(chave);
  return abrirSessao(g);
}
function acaoSair(req) { if (req.token) props().deleteProperty('SESS_' + req.token); return {}; }

/* ---------- Esqueci minha senha: código enviado ao e-mail cadastrado ---------- */
function mascararEmail(e) { const p = String(e).split('@'); return p[0].slice(0, 2) + '•••••@' + (p[1] || ''); }
function acaoEsqueciSenha(req) {
  const chave = String(req.usuario || '').trim().toLowerCase();
  const g = lerGestores().find(x => x.usuario === chave || (x.email && x.email === chave));
  if (!g) throw amigavel('Não encontramos um gestor com esse usuário ou e-mail.');
  if (!g.email) throw amigavel('Este gestor não tem e-mail cadastrado. Peça ao gestor principal para cadastrar uma nova senha presencialmente.');
  const cache = CacheService.getScriptCache();
  if (cache.get('recup_espera_' + g.usuario)) throw amigavel('Um código acabou de ser enviado. Aguarde 1 minuto para pedir outro.');
  const codigo = String(100000 + Math.floor(Math.random() * 900000));
  const salt = Utilities.getUuid();
  props().setProperty('RECUP_' + g.usuario, JSON.stringify({ s: salt, h: hashSenha(salt, codigo), e: Date.now() + 15 * 60000, t: 0 }));
  cache.put('recup_espera_' + g.usuario, '1', 60);
  QUEM = g.nome + ' (' + g.usuario + ')';
  registrar([[new Date(), 'Recuperação de senha', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Código enviado para ' + mascararEmail(g.email)]]);
  if (typeof MailApp === 'undefined') return { usuario: g.usuario, email: mascararEmail(g.email), codigoDemo: codigo };   // modo demonstração (sem e-mail)
  const html = '<div style="font-family:Arial,sans-serif;color:#17201D"><p style="font-size:12px;color:#5B6964">' + ORGAO + ' · Almoxarifado</p>' +
    '<p>Olá, ' + esc(g.nome.split(' ')[0]) + '.</p><p>Use o código abaixo para criar uma nova senha na área do gestor. Ele vale por 15 minutos.</p>' +
    '<p style="font-size:30px;font-weight:bold;letter-spacing:6px;background:#E2EDE8;padding:12px 18px;display:inline-block">' + codigo + '</p>' +
    '<p>Se você não pediu a recuperação, ignore este e-mail: a sua senha atual continua valendo.</p>' +
    '<p style="color:#5B6964;font-size:12px">E-mail automático. Não responda.</p></div>';
  enviarEmail({ to: g.email, subject: 'Código para nova senha – ' + ORGAO + ' (não responda)', htmlBody: html, name: NOME_REMETENTE });
  return { usuario: g.usuario, email: mascararEmail(g.email) };
}
function acaoRedefinirComCodigo(req) {
  const usuario = String(req.usuario || '').trim().toLowerCase();
  const lista = lerGestores(), g = lista.find(x => x.usuario === usuario);
  let r = null; try { r = JSON.parse(props().getProperty('RECUP_' + usuario) || 'null'); } catch (e) {}
  if (!g || !r || r.e < Date.now()) throw amigavel('Código vencido ou inexistente. Peça um novo código.');
  if (r.t >= 5) throw amigavel('Muitas tentativas com código errado. Peça um novo código.');
  if (hashSenha(r.s, String(req.codigo || '').trim()) !== r.h) { r.t++; props().setProperty('RECUP_' + usuario, JSON.stringify(r)); throw amigavel('Código incorreto.'); }
  g.salt = Utilities.getUuid(); g.hash = hashSenha(g.salt, validarSenha(req.nova));
  gravarGestores(lista); props().setProperty('RECUP_' + usuario, ''); encerrarSessoesDe(usuario);
  QUEM = g.nome + ' (' + g.usuario + ')';
  registrar([[new Date(), 'Senha recuperada', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Nova senha criada com o código enviado por e-mail']]);
  return abrirSessao(g);
}
function acaoAlterarEmailGestor(req) {
  const alvo = String(req.usuario || GESTOR.usuario);
  if (alvo !== GESTOR.usuario) { exigirPermissao('usuarios'); if ((lerGestores().find(x => x.usuario === alvo) || {}).principal) throw amigavel('Somente o próprio gestor principal pode alterar o e-mail dele.'); }
  const lista = lerGestores(), g = lista.find(x => x.usuario === alvo);
  if (!g) throw amigavel('Gestor não encontrado.');
  g.email = validarEmailGestor(req.email); gravarGestores(lista);
  registrar([[new Date(), 'E-mail de gestor alterado', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Novo e-mail de recuperação: ' + mascararEmail(g.email)]]);
  novaVersao();
  return acaoGestores();
}
function acaoGestores() { return { gestores: lerGestores().map(gestorPublico), max: MAX_GESTORES, perfis: PERFIS }; }
function acaoAdicionarGestor(req) {
  const lock = bloquear();
  try {
    const lista = lerGestores();
    if (lista.length >= MAX_GESTORES) throw amigavel('Limite de ' + MAX_GESTORES + ' gestores atingido. Remova um login antes de cadastrar outro.');
    const g = novoGestor(req.usuario, req.nome, req.senha, false, req.email || '');
    if (lista.some(x => x.usuario === g.usuario)) throw amigavel('Já existe um gestor com o usuário "' + g.usuario + '".');
    const pf = normalizarPerfil(req.perfil || 'leitura', req.permissoes);
    g.perfil = pf.perfil; g.permissoes = pf.permissoes;
    lista.push(g); gravarGestores(lista);
    registrar([[new Date(), 'Gestor cadastrado', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Perfil: ' + perfilDe(g).nome + ' – permissões: ' + (pf.permissoes.join(', ') || 'somente visualização')]]);
    novaVersao();
  } finally { lock.releaseLock(); }
  return acaoGestores();
}
function acaoRemoverGestor(req) {
  const usuario = String(req.usuario || '');
  if (usuario === GESTOR.usuario) throw amigavel('Você não pode remover o seu próprio login.');
  const lock = bloquear();
  try {
    const lista = lerGestores(), g = lista.find(x => x.usuario === usuario);
    if (!g) throw amigavel('Gestor não encontrado.');
    if (g.principal) throw amigavel('O gestor principal (master) não pode ser removido.');
    gravarGestores(lista.filter(x => x.usuario !== usuario));
    encerrarSessoesDe(usuario);
    registrar([[new Date(), 'Gestor removido', '', '', '', g.nome + ' (' + g.usuario + ')']]);
    novaVersao();
  } finally { lock.releaseLock(); }
  return acaoGestores();
}
function acaoRedefinirSenha(req) {
  const lista = lerGestores(), g = lista.find(x => x.usuario === String(req.usuario || ''));
  if (!g) throw amigavel('Gestor não encontrado.');
  if (g.principal && !GESTOR.principal) throw amigavel('Somente o próprio gestor principal pode trocar a senha dele.');
  g.salt = Utilities.getUuid(); g.hash = hashSenha(g.salt, validarSenha(req.nova));
  gravarGestores(lista); encerrarSessoesDe(g.usuario, req.token);
  registrar([[new Date(), 'Senha redefinida', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Nova senha cadastrada presencialmente por ' + GESTOR.nome + '; sessões abertas desse gestor foram encerradas']]);
  return {};
}
/* Muda o tipo de perfil e as permissões de um gestor (o gestor principal não pode ser alterado). */
function acaoEditarGestor(req) {
  const lock = bloquear();
  try {
    const lista = lerGestores(), g = lista.find(x => x.usuario === String(req.usuario || ''));
    if (!g) throw amigavel('Gestor não encontrado.');
    if (g.principal) throw amigavel('O perfil do gestor principal (master) não pode ser alterado: ele tem todas as permissões.');
    if (g.usuario === GESTOR.usuario) throw amigavel('Você não pode alterar o seu próprio perfil. Peça a outro gestor com permissão ou ao gestor principal.');
    const antes = perfilDe(g).nome + ' (' + (permissoesDe(g) && PERMISSOES.filter(k => permissoesDe(g)[k]).join(', ') || 'somente visualização') + ')';
    const pf = normalizarPerfil(req.perfil, req.permissoes);
    g.perfil = pf.perfil; g.permissoes = pf.permissoes;
    if (req.nome && String(req.nome).trim().length >= 3) g.nome = String(req.nome).trim().slice(0, 80);
    gravarGestores(lista);
    registrar([[new Date(), 'Perfil de gestor alterado', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Antes: ' + antes + ' → agora: ' + perfilDe(g).nome + ' (' + (pf.permissoes.join(', ') || 'somente visualização') + ')']]);
    novaVersao();
  } finally { lock.releaseLock(); }
  return acaoGestores();
}
function acaoTrocarSenha(req) {
  const lista = lerGestores(), g = lista.find(x => x.usuario === GESTOR.usuario);
  if (hashSenha(g.salt, String(req.atual || '')) !== g.hash) throw amigavel('A senha atual não confere.');
  g.salt = Utilities.getUuid(); g.hash = hashSenha(g.salt, validarSenha(req.nova));
  gravarGestores(lista); encerrarSessoesDe(g.usuario);
  registrar([[new Date(), 'Senha alterada', '', '', '', g.nome + ' (' + g.usuario + ')', '', '', '', 'Os outros computadores desse gestor foram desconectados']]);
  return abrirSessao(g);
}

/* ======================= Ações públicas ======================= */
function acaoVersao() { return { versao: versaoAtual() }; }

function acaoCatalogo() {
  garantirCatalogo();
  const { itens } = lerCatalogo();
  return { versao: versaoAtual(), inicializado: itens.length > 0, itens: itens.filter(i => i.ativo && !i.oculto).map(publico), gestor: dadosContato(), regras: dadosRegras() };
}

function acaoImagens(req) {
  const ids = (req.ids || []).map(String);
  const out = {};
  linhas(aba('imagens')).forEach(r => { if (ids.indexOf(String(r[0])) >= 0) out[r[0]] = [r[1]].concat(r.slice(3)).map(x => String(x || '')).join(''); });
  return { imagens: out };
}

function emailInstitucional(e) {
  const dom = DOMINIO_EMAIL.replace(/\./g, '\\.');
  return new RegExp('^[^\\s@]+@' + dom + '$', 'i').test(String(e || '').trim());
}
function validarSolicitante(s) {
  s = s || {};
  const r = { nome: String(s.nome || '').trim().slice(0, 120), setor: String(s.setor || '').trim().slice(0, 120), telefone: String(s.telefone || '').trim().slice(0, 30), email: String(s.email || '').trim().toLowerCase().slice(0, 120) };
  if (r.nome.split(/\s+/).length < 2) throw amigavel('Informe o nome completo do solicitante.');
  if (!r.setor) throw amigavel('Informe o setor do solicitante.');
  if (r.telefone.replace(/\D/g, '').length < 10) throw amigavel('Informe um telefone para contato com DDD.');
  if (!emailInstitucional(r.email)) throw amigavel('Use o seu e-mail institucional terminado em @' + DOMINIO_EMAIL + '.');
  return r;
}

function acaoSolicitar(req) {
  const sol = validarSolicitante(req.solicitante);
  QUEM = sol.nome + ' (solicitante, ' + sol.setor + ')';
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
      if (!e || !e.ativo || e.oculto) throw amigavel('Um dos materiais não está mais disponível no catálogo. Atualize a página.');
      if (vistos[i.id]) throw amigavel('Material repetido no pedido: ' + e.descricao);
      vistos[i.id] = true;
      if (e.indisponivel) throw amigavel(e.codigo + ' – ' + e.descricao + ' está INDISPONÍVEL.');
      if (e.soVisualizar) throw amigavel(e.codigo + ' – ' + e.descricao + ' está disponível somente para consulta e não pode ser pedido pela página.');
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
  return { pedido, gestor: dadosContato(), emailEnviado };
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
  const pub = semLinha(p); delete pub.rascunho;   // o rascunho do atendimento é interno do almoxarifado
  return { pedido: pub, gestor: dadosContato() };
}

/* ======================= Ações do gestor ======================= */
function acaoPainel() {
  garantirCatalogo();
  ativarBackupAutomatico();
  const cat = lerCatalogo();
  const hist = linhas(aba('historico')).slice(-3000).map(r => ({
    dataISO: iso(r[0]), tipo: String(r[1]), pedido: String(r[2] || ''), id: String(r[3] || ''), codigo: String(r[4] || ''), descricao: String(r[5] || ''),
    antes: r[6] === '' ? null : Number(r[6]), depois: r[7] === '' ? null : Number(r[7]), delta: r[8] === '' ? null : Number(r[8]), detalhes: String(r[9] || ''), quem: String(r[10] || '')
  }));
  return { versao: versaoAtual(), inicializado: cat.itens.length > 0, itens: cat.itens.filter(i => i.ativo).map(publico), pedidos: lerPedidos().pedidos.map(semLinha),
    historico: pode('auditoria') ? hist : [], gestor: dadosContato(), eu: gestorPublico(GESTOR),
    gestores: pode('usuarios') ? lerGestores().map(gestorPublico) : [gestorPublico(GESTOR)], totalGestores: lerGestores().length, maxGestores: MAX_GESTORES,
    perfis: PERFIS, permissoesLista: PERMISSOES, regras: dadosRegras(), inatividadeMin: INATIVIDADE_MIN,
    backup: situacaoBackup() };
}

function acaoAtender(req) {
  const tipo = String(req.tipo || '');
  const resposta = String(req.resposta || '').trim().slice(0, 1000);
  const lock = bloquear();
  let pedido;
  try {
    const { sh: shP, pedidos } = lerPedidos();
    const p = pedidos.find(x => x.numero === String(req.numero));
    if (!p) throw amigavel('Pedido não encontrado (pode ter sido excluído por outro gestor).');
    if (FINAIS.indexOf(p.status) >= 0) throw amigavel('O pedido ' + p.numero + ' já foi finalizado como "' + p.status + '".');
    const agora = new Date();
    const cat = lerCatalogo();
    const devolver = (l, q) => {
      if (q <= 0) return;
      const e = cat.mapa[l.id];
      if (e) { e.qtd += q; gravarItem(cat.sh, e); }
      registrar([[agora, 'Devolução ao estoque', p.numero, l.id, l.codigo, l.descricao, e ? e.qtd - q : '', e ? e.qtd : '', q, 'Quantidade não entregue do pedido']]);
    };
    let novo, texto;
    const exigeAberto = () => { if (ABERTAS.indexOf(p.status) < 0) throw amigavel('O pedido ' + p.numero + ' está "' + p.status + '" e não pode mais receber esta ação.'); };
    if (tipo === 'aprovar') {
      if (p.status !== 'Pendente') throw amigavel('Só pedidos pendentes podem ser aprovados.');
      novo = 'Aprovado'; texto = 'Pedido pré-aprovado pelo almoxarifado. Aguarde a separação e a entrega.';
    } else if (tipo === 'recusar') {
      exigeAberto();
      if (!resposta) throw amigavel('Informe o motivo da recusa.');
      p.itens.forEach(l => { devolver(l, l.qtd); l.atendida = 0; });
      novo = 'Recusado'; texto = 'Pedido recusado.';
    } else if (tipo === 'atender') {
      exigeAberto();
      p.itens.forEach(l => l.atendida = l.qtd);
      novo = RETIRADA; texto = 'Atendimento total: os materiais foram separados e estão aguardando retirada no almoxarifado.';
    } else if (tipo === 'parcial') {
      exigeAberto();
      const at = req.atendidas || {};
      p.itens.forEach(l => {
        const q = Number(at[l.id]);
        if (!Number.isInteger(q) || q < 0 || q > l.qtd) throw amigavel('Quantidade atendida inválida para ' + l.descricao + ' (de 0 a ' + l.qtd + ').');
      });
      const total = p.itens.reduce((a, l) => a + Number(at[l.id]), 0);
      if (total === 0 && !resposta) throw amigavel('Nenhum item foi atendido: informe o motivo (o pedido será recusado).');
      p.itens.forEach(l => { const q = Number(at[l.id]); devolver(l, l.qtd - q); l.atendida = q; });
      if (total === 0) { novo = 'Recusado'; texto = 'Pedido recusado.'; }
      else if (p.itens.every(l => l.atendida === l.qtd)) { novo = RETIRADA; texto = 'Atendimento total: os materiais foram separados e estão aguardando retirada no almoxarifado.'; }
      else { novo = RETIRADA; texto = 'Atendimento parcial: ' + total + ' de ' + p.totalUnidades + ' unidades foram separadas e estão aguardando retirada no almoxarifado. O restante voltou ao estoque.'; }
    } else if (tipo === 'entregar') {
      if (p.status !== RETIRADA) throw amigavel('Só pedidos "Aguardando retirada" podem ter a entrega registrada.');
      novo = 'Entrega realizada'; texto = 'Entrega realizada: os materiais foram retirados. Pedido concluído.';
    } else throw amigavel('Ação inválida.');
    if (tipo !== 'entregar') p.rascunho = null;
    p.status = novo;
    p.totalAtendido = FINAIS.indexOf(novo) >= 0 || novo === RETIRADA ? p.itens.reduce((a, l) => a + (l.atendida || 0), 0) : null;
    if (resposta) p.resposta = resposta;
    p.andamento.push({ dataISO: agora.toISOString(), status: novo, texto: texto + (resposta ? ' Mensagem do almoxarifado: ' + resposta : '') });
    shP.getRange(p.linha, 1, 1, 16).setValues([linhaPedido(p)]);
    registrar([[agora, 'Pedido ' + novo.toLowerCase(), p.numero, '', '', p.solicitante.nome + ' (' + p.solicitante.setor + ')', '', '', '', (p.totalAtendido != null ? p.totalAtendido + ' de ' + p.totalUnidades + ' unidades atendidas. ' : '') + resposta]]);
    novaVersao();
    pedido = semLinha(p);
  } finally { lock.releaseLock(); }
  avisar(pedido, false);
  return { pedido };
}

/* Atendimento parcial: o gestor pode ir salvando as quantidades e voltar depois para continuar (não mexe no estoque). */
function acaoSalvarRascunho(req) {
  const lock = bloquear();
  try {
    const { sh, pedidos } = lerPedidos();
    const p = pedidos.find(x => x.numero === String(req.numero));
    if (!p) throw amigavel('Pedido não encontrado (pode ter sido excluído por outro gestor).');
    if (ABERTAS.indexOf(p.status) < 0) throw amigavel('O pedido ' + p.numero + ' está "' + p.status + '" e não aceita mais rascunho.');
    const at = req.atendidas || {}, limpo = {};
    p.itens.forEach(l => { const q = Number(at[l.id]); if (!Number.isInteger(q) || q < 0 || q > l.qtd) throw amigavel('Quantidade inválida para ' + l.descricao + ' (de 0 a ' + l.qtd + ').'); limpo[l.id] = q; });
    p.rascunho = { atendidas: limpo, resposta: String(req.resposta || '').trim().slice(0, 1000), por: GESTOR.nome, emISO: new Date().toISOString() };
    sh.getRange(p.linha, 1, 1, 16).setValues([linhaPedido(p)]);
    registrar([[new Date(), 'Rascunho de atendimento salvo', p.numero, '', '', p.solicitante.nome + ' (' + p.solicitante.setor + ')', '', '', '',
      'Atendimento parcial em edição: ' + p.itens.map(l => l.codigo + ' ' + limpo[l.id] + '/' + l.qtd).join('; ')]]);
    novaVersao();
    return { pedido: semLinha(p) };
  } finally { lock.releaseLock(); }
}
function acaoExcluirPedido(req) {
  // A exclusão é confirmada com a senha do próprio gestor (no máximo 5 tentativas a cada 10 minutos).
  const cache = CacheService.getScriptCache(), chaveT = 'excl_' + GESTOR.usuario, tent = Number(cache.get(chaveT) || 0);
  if (tent >= 5) throw amigavel('Muitas tentativas com senha incorreta. Aguarde 10 minutos para excluir pedidos.');
  if (hashSenha(GESTOR.salt, String(req.senha || '')) !== GESTOR.hash) { cache.put(chaveT, String(tent + 1), 600); throw amigavel('Senha incorreta. A exclusão não foi feita.'); }
  cache.remove(chaveT);
  const motivo = String(req.motivo || '').trim().slice(0, 500);
  if (!motivo) throw amigavel('Informe o motivo da exclusão.');
  const lock = bloquear();
  let numero;
  try {
    const { sh, pedidos } = lerPedidos();
    const p = pedidos.find(x => x.numero === String(req.numero));
    if (!p) throw amigavel('Pedido não encontrado (pode já ter sido excluído por outro gestor).');
    numero = p.numero;
    const agora = new Date();
    let devolvidas = 0;
    if (ABERTAS.indexOf(p.status) >= 0 || p.status === RETIRADA) {
      // Pedido em aberto devolve o reservado; pedido aguardando retirada devolve o que foi separado.
      const cat = lerCatalogo(), rows = [];
      p.itens.forEach(l => {
        const e = cat.mapa[l.id], q = p.status === RETIRADA ? (Number(l.atendida) || 0) : l.qtd; if (!e || !q) return;
        e.qtd += q; gravarItem(cat.sh, e); devolvidas += q;
        rows.push([agora, 'Devolução ao estoque', p.numero, l.id, l.codigo, l.descricao, e.qtd - q, e.qtd, q, 'Pedido excluído']);
      });
      registrar(rows);
    }
    sh.deleteRow(p.linha);
    const resumo = p.itens.map(l => l.codigo + ' × ' + l.qtd).join('; ');
    registrar([[agora, 'Pedido excluído', p.numero, '', '', p.solicitante.nome + ' (' + p.solicitante.setor + ')', '', '', '',
      ('Excluído por ' + GESTOR.nome + ' (' + GESTOR.usuario + ') em ' + dataBR(agora) + '. Situação: ' + p.status + '. Pedido de ' + dataBR(new Date(p.dataISO)) +
       ', ' + p.totalItens + ' materiais, ' + p.totalUnidades + ' unidades' + (devolvidas ? ' (devolvidas ao estoque)' : '') + '. Motivo: ' + motivo + '. Itens: ' + resumo).slice(0, 2000)]]);
    novaVersao();
  } finally { lock.releaseLock(); }
  return { numero };
}

function textoImagem(v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^cat:img\d{3}$/.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v.slice(0, 2000);
  throw amigavel('Endereço de imagem inválido.');
}

function acaoSalvarItem(req) {
  const d = req.item || {};
  const motivo = String(req.motivo || '').trim().slice(0, 300);
  const campos = {
    codigo: String(d.codigo || '').trim().slice(0, 40), descricao: String(d.descricao || '').trim().slice(0, 400), unidade: String(d.unidade || '').trim().slice(0, 60),
    natureza: String(d.natureza || '').trim().slice(0, 30), naturezaNome: String(d.naturezaNome || '').trim().slice(0, 120), conta: String(d.conta || '').trim().slice(0, 160),
    limite: Math.max(0, Math.floor(Number(d.limite) || 0)), indisponivel: !!d.indisponivel, oculto: !!d.oculto, soVisualizar: !!d.soVisualizar, busca: String(d.busca || '').trim().slice(0, 200)
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
    if (novo) it = Object.assign({ id: 'N' + agora.getTime().toString(36), qtd: qtd, qtdRelatorio: 0, imagem: '', imagemVersao: 0, ativo: true }, campos);
    else { it = cat.mapa[d.id]; if (!it || !it.ativo) throw amigavel('Material não encontrado.'); }
    let imagemMudou = false;
    if (d.imagemDados) {
      const dados = String(d.imagemDados);
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(dados)) throw amigavel('Formato de imagem não aceito.');
      if (dados.length > 6 * 49000) throw amigavel('Imagem grande demais. Tente outra foto.');
      const partes = []; for (let p = 0; p < dados.length; p += 49000) partes.push(dados.slice(p, p + 49000));
      while (partes.length < 6) partes.push('');
      const linhaI = [it.id, partes[0], agora].concat(partes.slice(1));
      const shI = aba('imagens'), lin = linhas(shI);
      const i = lin.findIndex(r => String(r[0]) === it.id);
      if (i >= 0) shI.getRange(i + 2, 1, 1, 8).setValues([linhaI]);
      else shI.getRange(shI.getLastRow() + 1, 1, 1, 8).setValues([linhaI]);
      it.imagem = 'upload'; it.imagemVersao = (it.imagemVersao || 0) + 1; imagemMudou = true;
    } else if (d.imagem !== undefined && d.imagem !== 'upload' && String(d.imagem) !== it.imagem) {
      it.imagem = textoImagem(d.imagem); imagemMudou = true;
    }
    const mudancas = [];
    if (!novo) {
      const rot = { codigo: 'código', descricao: 'descrição', unidade: 'unidade', natureza: 'natureza', naturezaNome: 'nome da natureza', conta: 'conta contábil', limite: 'limite por pedido', indisponivel: 'indisponível', oculto: 'oculto', soVisualizar: 'só visualização', busca: 'termo de busca' };
      const fmtv = (k, v) => (k === 'indisponivel' || k === 'oculto' || k === 'soVisualizar') ? (v ? 'sim' : 'não') : v;
      Object.keys(campos).forEach(k => { if (String(it[k]) !== String(campos[k])) { mudancas.push(rot[k] + ': "' + fmtv(k, it[k]) + '" → "' + fmtv(k, campos[k]) + '"'); it[k] = campos[k]; } });
      if (imagemMudou) mudancas.push('imagem alterada');
    }
    const antes = novo ? 0 : it.qtd;
    if (antes !== qtd) exigirPermissao('estoque_ajustar');
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

function alternar(req, campo, tipoSim, tipoNao) {
  const lock = bloquear(); let it;
  try {
    const cat = lerCatalogo(); it = cat.mapa[req.id];
    if (!it) throw amigavel('Material não encontrado.');
    it[campo] = !!req.valor; gravarItem(cat.sh, it);
    registrar([[new Date(), it[campo] ? tipoSim : tipoNao, '', it.id, it.codigo, it.descricao, '', '', '', String(req.motivo || '').slice(0, 300)]]);
    novaVersao();
  } finally { lock.releaseLock(); }
  return { item: publico(it) };
}
function acaoIndisponivel(req) { return alternar(req, 'indisponivel', 'Material indisponível', 'Material disponível'); }
function acaoVisibilidade(req) { return alternar(req, 'oculto', 'Material ocultado', 'Material visível'); }
function acaoSoVisualizar(req) { return alternar(req, 'soVisualizar', 'Material só para visualização', 'Material liberado para pedido'); }

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

function dadosRegras() { const c = lerConfig(), m = Number(c.estoque_minimo); return { estoqueMinimo: c.estoque_minimo === undefined || c.estoque_minimo === '' || isNaN(m) ? null : m }; }
function acaoSalvarRegras(req) {
  const m = Math.floor(Number(req.estoqueMinimo));
  if (!(m >= 0) || m > 100000) throw amigavel('Informe um estoque mínimo entre 0 e 100.000.');
  const antes = dadosRegras().estoqueMinimo;
  gravarConfig({ estoque_minimo: m });
  registrar([[new Date(), 'Regra alterada', '', '', '', 'Alerta de estoque mínimo', antes == null ? '' : antes, m, antes == null ? '' : m - antes, 'Materiais com ' + m + ' unidades ou menos aparecem como estoque baixo']]);
  novaVersao();
  return { regras: dadosRegras() };
}
function acaoSalvarContato(req) {
  const g = req.gestor || {};
  gravarConfig({ gestor_nome: seguro(String(g.nome || '').trim()), gestor_setor: seguro(String(g.setor || '').trim()), gestor_telefone: seguro(String(g.telefone || '').trim()), gestor_email: seguro(String(g.email || '').trim()) });
  registrar([[new Date(), 'Contato do almoxarifado', '', '', '', String(g.nome || '')]]);
  novaVersao();
  return { gestor: dadosContato() };
}

/* ======================= Painel de gráficos para o Google Looker Studio ======================= */
/* O link (painel.html?t=CHAVE) mostra somente gráficos. O servidor entrega apenas números agregados por pedido
   (data, situação, setor e itens) e o estoque – nunca nomes, e-mails, telefones ou observações. */
function acaoLinkPainel(req) {
  const op = String(req.op || 'obter');
  if (op === 'obter') return { chave: props().getProperty('PAINEL_CHAVE') || '' };
  exigirPermissao('configuracoes');
  if (op === 'novo') {
    const chave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props().setProperty('PAINEL_CHAVE', chave);
    registrar([[new Date(), 'Link do painel criado', '', '', '', 'Painel de gráficos (Looker Studio)', '', '', '', 'Novo link gerado; o link anterior, se havia, deixou de funcionar']]);
    return { chave };
  }
  if (op === 'desativar') {
    props().deleteProperty('PAINEL_CHAVE');
    registrar([[new Date(), 'Link do painel desativado', '', '', '', 'Painel de gráficos (Looker Studio)', '', '', '', 'O painel deixou de aparecer onde o link era usado']]);
    return { chave: '' };
  }
  throw amigavel('Operação inválida.');
}
function acaoPainelPublico(req) {
  const chave = props().getProperty('PAINEL_CHAVE') || '';
  if (!chave || String(req.t || '') !== chave) throw amigavel('Link do painel inválido ou desativado. Gere um novo link na área do gestor (Relatórios › Dashboard › Link para o Looker Studio).');
  garantirCatalogo();
  const pedidos = lerPedidos().pedidos, res = {};
  pedidos.forEach(p => { if (ABERTAS.indexOf(p.status) >= 0) p.itens.forEach(l => { res[l.id] = (res[l.id] || 0) + (Number(l.qtd) || 0); });
    else if (p.status === RETIRADA) p.itens.forEach(l => { res[l.id] = (res[l.id] || 0) + (Number(l.atendida) || 0); }); });
  const regra = dadosRegras().estoqueMinimo;
  return {
    versao: versaoAtual(), geradoEm: new Date().toISOString(), baixo: regra == null ? null : regra,
    pedidos: pedidos.map(p => ({ dataISO: p.dataISO, status: p.status, setor: (p.solicitante || {}).setor || '',
      itens: p.itens.map(l => ({ id: l.id, codigo: l.codigo, descricao: l.descricao, qtd: Number(l.qtd) || 0, atendida: l.atendida == null ? null : Number(l.atendida) })) })),
    itens: lerCatalogo().itens.filter(i => i.ativo).map(i => ({ id: i.id, codigo: i.codigo, descricao: i.descricao, natureza: i.natureza, naturezaNome: i.naturezaNome,
      qtd: i.qtd, reservado: res[i.id] || 0, oculto: !!i.oculto, indisponivel: !!i.indisponivel }))
  };
}

/* ======================= Backup (PDF, Excel e JSON) ======================= */
function lerHistoricoCompleto() {
  return linhas(aba('historico')).map(r => ({
    dataISO: iso(r[0]), tipo: String(r[1]), pedido: String(r[2] || ''), id: String(r[3] || ''), codigo: String(r[4] || ''), descricao: String(r[5] || ''),
    antes: r[6] === '' ? null : Number(r[6]), depois: r[7] === '' ? null : Number(r[7]), delta: r[8] === '' ? null : Number(r[8]), detalhes: String(r[9] || ''), quem: String(r[10] || '')
  }));
}
function montarDadosBackup() {
  const cat = lerCatalogo();
  return { sistema: 'Pedidos de material – Almoxarifado – ' + ORGAO, formato: 'backup-almoxarifado-iema/1', geradoEm: new Date().toISOString(),
    contato: dadosContato(), pedidos: lerPedidos().pedidos.map(semLinha), historico: lerHistoricoCompleto(),
    estoque: cat.itens.filter(i => i.ativo).map(i => { const p = publico(i); delete p.imagemVersao; return p; }) };
}
/* Backup baixado pelo gestor (o navegador monta o PDF, o Excel e o JSON). */
function acaoBackupDados(req) {
  const d = montarDadosBackup();
  if (req && req.paraEmail) return { dados: d };   // o envio por e-mail é registrado no histórico pelo próprio envio
  registrar([[new Date(), 'Backup gerado', '', '', '', d.pedidos.length + ' pedidos, ' + d.historico.length + ' registros de histórico', '', '', '', 'Arquivos PDF, Excel e JSON baixados pelo gestor']]);
  return { dados: d };
}
function dataArq(d) { return Utilities.formatDate(d || new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd'); }
function tabelasBackup(d) {
  const dt = s => s ? new Date(s) : '';
  return {
    'Pedidos': [['Pedido', 'Data', 'Nome completo', 'Setor', 'Telefone', 'E-mail', 'Materiais', 'Solicitado', 'Atendido', 'Situação', 'Observação', 'Resposta do almoxarifado']]
      .concat(d.pedidos.map(p => [p.numero, dt(p.dataISO), p.solicitante.nome, p.solicitante.setor, p.solicitante.telefone, p.solicitante.email, p.itens.length, p.totalUnidades, p.totalAtendido == null ? '' : p.totalAtendido, p.status, p.obs || '', p.resposta || ''])),
    'Itens dos pedidos': [['Pedido', 'Data', 'Solicitante', 'Setor', 'Código', 'Material', 'Unidade', 'Solicitado', 'Atendido', 'Situação']]
      .concat([].concat.apply([], d.pedidos.map(p => p.itens.map(l => [p.numero, dt(p.dataISO), p.solicitante.nome, p.solicitante.setor, l.codigo, l.descricao, l.unidade, l.qtd, l.atendida == null ? '' : l.atendida, p.status])))),
    'Histórico': [['Data', 'Tipo', 'Pedido', 'Código', 'Descrição', 'Antes', 'Depois', 'Variação', 'Detalhes', 'Responsável']]
      .concat(d.historico.map(h => [dt(h.dataISO), h.tipo, h.pedido, h.codigo, h.descricao, h.antes == null ? '' : h.antes, h.depois == null ? '' : h.depois, h.delta == null ? '' : h.delta, h.detalhes, h.quem])),
    'Estoque': [['Natureza', 'Nome da natureza', 'Código', 'Descrição', 'Unidade', 'Disponível', 'Limite por pedido', 'Indisponível', 'Visível', 'Só visualização']]
      .concat(d.estoque.map(i => [i.natureza, i.naturezaNome, i.codigo, i.descricao, i.unidade, i.qtd, i.limite || '', i.indisponivel ? 'Sim' : 'Não', i.oculto ? 'Não' : 'Sim', i.soVisualizar ? 'Sim' : 'Não']))
  };
}
/* Gera os 3 arquivos no servidor (planilha temporária exportada pelo Google em Excel e PDF) e envia por e-mail. */
function gerarArquivosBackup() {
  const d = montarDadosBackup(), t = tabelasBackup(d), base = 'Backup_Almoxarifado_IEMA_' + dataArq();
  const tmp = SpreadsheetApp.create(base);
  Object.keys(t).forEach((nome, i) => {
    const sh = i === 0 ? tmp.getSheets()[0].setName(nome) : tmp.insertSheet(nome), rows = t[nome].map(r => r.map(seguro));
    sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#E2EDE8'); sh.setFrozenRows(1);
  });
  SpreadsheetApp.flush();
  const id = tmp.getId(), auth = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  const url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=';
  const xlsx = UrlFetchApp.fetch(url + 'xlsx', auth).getBlob().setName(base + '.xlsx');
  const pdf = UrlFetchApp.fetch(url + 'pdf&size=A4&portrait=false&fitw=true&gridlines=false&sheetnames=true&printtitle=true', auth).getBlob().setName(base + '.pdf');
  const json = Utilities.newBlob(JSON.stringify(d, null, 1), 'application/json', base + '.json');
  DriveApp.getFileById(id).setTrashed(true);
  return { d: d, arquivos: [pdf, xlsx, json] };
}
const mesSP = d => Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM');
function jaEnviadoEsteMes() { const u = props().getProperty('ULTIMO_BACKUP'); return !!u && mesSP(new Date(u)) === mesSP(new Date()); }
function situacaoBackup() {
  const agora = new Date(), dia = Number(Utilities.formatDate(agora, 'America/Sao_Paulo', 'd')), hora = Number(Utilities.formatDate(agora, 'America/Sao_Paulo', 'H'));
  const temDados = aba('pedidos').getLastRow() > 1 || aba('historico').getLastRow() > 1;
  return { emails: BACKUP_EMAILS, ativo: props().getProperty('BACKUP_ATIVO') === '1', ultimo: props().getProperty('ULTIMO_BACKUP') || '',
    erro: props().getProperty('BACKUP_ERRO') || '', pendente: temDados && !jaEnviadoEsteMes() && (dia > 1 || hora >= 8),
    google: typeof MailApp !== 'undefined' };
}
/* Ativa sozinho o envio do dia 1º (no máximo uma tentativa a cada 6 horas), sem precisar do menu da planilha. */
function ativarBackupAutomatico() {
  if (typeof ScriptApp === 'undefined' || props().getProperty('BACKUP_ATIVO') === '1') return;
  const ult = Number(props().getProperty('BACKUP_TENTATIVA') || 0);
  if (Date.now() - ult < 6 * 36e5) return;
  props().setProperty('BACKUP_TENTATIVA', String(Date.now()));
  try { instalarBackupMensal(); props().setProperty('BACKUP_ERRO', ''); try { protegerAbas(); } catch (e) {} }
  catch (e) { props().setProperty('BACKUP_ERRO', String(e.message || e).slice(0, 300)); }
}
function acaoAtivarBackup() {
  if (typeof ScriptApp === 'undefined') throw amigavel('O backup automático funciona depois de ligar a Planilha Google (modo demonstração).');
  try { instalarBackupMensal(); props().setProperty('BACKUP_ERRO', ''); try { protegerAbas(); } catch (e) {} }
  catch (e) { props().setProperty('BACKUP_ERRO', String(e.message || e).slice(0, 300)); throw amigavel('Não foi possível ativar o envio do dia 1º: ' + e.message + '. Publique a nova versão no Apps Script e clique em “Autorizar acesso” quando o Google pedir. Mesmo assim, o sistema envia o backup do mês pelo primeiro acesso de um gestor.'); }
  registrar([[new Date(), 'Backup mensal ativado', '', '', '', BACKUP_EMAILS.join(', '), '', '', '', 'Envio automático todo dia 1º às 6h']]);
  return { backup: situacaoBackup() };
}
/* Chamada pelo acionador do dia 1º. */
function backupMensal() { return enviarBackupMensal(true); }
function enviarBackupMensal(automatico) {
  if (automatico && jaEnviadoEsteMes()) return null;
  QUEM = QUEM === 'Sistema' ? 'Sistema (backup automático)' : QUEM;
  const r = gerarArquivosBackup(), agora = new Date();
  const html = '<div style="font-family:Arial,sans-serif;color:#17201D"><p style="font-size:12px;color:#5B6964">' + ORGAO + ' · Almoxarifado</p>' +
    '<p>Segue o backup do sistema de pedidos de material, gerado em ' + dataBR(agora) + ':</p><ul>' +
    '<li><b>PDF</b> – para leitura e impressão;</li><li><b>Excel</b> – abas Pedidos, Itens dos pedidos, Histórico e Estoque;</li><li><b>JSON</b> – cópia completa dos dados, para restauração.</li></ul>' +
    '<p>Conteúdo: ' + r.d.pedidos.length + ' pedidos, ' + r.d.historico.length + ' registros de histórico e ' + r.d.estoque.length + ' materiais.</p>' +
    '<p>Sugestão: salve os anexos no Porta-arquivos do Comunica ES, numa pasta de acesso restrito. Os arquivos contêm dados pessoais (LGPD).</p>' +
    '<p style="color:#5B6964;font-size:12px">E-mail automático. Não responda.</p></div>';
  enviarEmail({ to: BACKUP_EMAILS.join(','), subject: 'Backup mensal do almoxarifado – ' + dataArq(agora) + ' – ' + ORGAO + ' (não responda)', htmlBody: html, name: NOME_REMETENTE, attachments: r.arquivos });
  props().setProperty('ULTIMO_BACKUP', agora.toISOString());
  registrar([[agora, 'Backup enviado por e-mail', '', '', '', BACKUP_EMAILS.join(', '), '', '', '', 'PDF, Excel e JSON: ' + r.d.pedidos.length + ' pedidos, ' + r.d.historico.length + ' registros de histórico']]);
  return r.d;
}
function htmlEmailBackup(qtd, agora) {
  return '<div style="font-family:Arial,sans-serif;color:#17201D"><p style="font-size:12px;color:#5B6964">' + ORGAO + ' · Almoxarifado</p>' +
    '<p>Segue o backup do sistema de pedidos de material, gerado em ' + dataBR(agora) + ':</p><ul>' +
    '<li><b>PDF</b> – para leitura e impressão;</li><li><b>Excel</b> – abas Resumo, Pedidos, Itens dos pedidos, Histórico e Estoque;</li><li><b>JSON</b> – cópia completa dos dados, para restauração (botão “Importar backup” na área do gestor).</li></ul>' +
    (qtd ? '<p>Conteúdo: ' + qtd + '.</p>' : '') +
    '<p>Sugestão: salve os anexos no Porta-arquivos do Comunica ES, numa pasta de acesso restrito. Os arquivos contêm dados pessoais (LGPD).</p>' +
    '<p style="color:#5B6964;font-size:12px">E-mail automático. Não responda.</p></div>';
}
/* Botão "Enviar backup por e-mail agora" (e envio do mês pelo primeiro acesso de um gestor). */
function acaoBackupEmailAgora(req) {
  if (typeof MailApp === 'undefined') throw amigavel('O envio por e-mail funciona depois de ligar a Planilha Google (modo demonstração).');
  if (typeof UrlFetchApp === 'undefined' || typeof ScriptApp === 'undefined') throw amigavel('GERAR_NO_NAVEGADOR');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) throw amigavel('Já há um backup sendo enviado. Aguarde um instante.');
  let d;
  try { d = enviarBackupMensal(!!req.automatico); }
  catch (e) { throw amigavel('GERAR_NO_NAVEGADOR'); }
  finally { lock.releaseLock(); }
  if (!d) return { jaEnviado: true, enviadoPara: BACKUP_EMAILS };
  return { enviadoPara: BACKUP_EMAILS, pedidos: d.pedidos.length, historico: d.historico.length };
}
/* Plano B: os 3 arquivos são gerados no navegador do gestor e o servidor só envia o e-mail (usa apenas a permissão de e-mail). */
function acaoBackupEnviarArquivos(req) {
  if (typeof MailApp === 'undefined') throw amigavel('O envio por e-mail funciona depois de ligar a Planilha Google (modo demonstração).');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) throw amigavel('Já há um backup sendo enviado. Aguarde um instante.');
  try {
    if (req.automatico && jaEnviadoEsteMes()) return { jaEnviado: true, enviadoPara: BACKUP_EMAILS };
    const tipos = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json' };
    const anexos = (req.arquivos || []).slice(0, 3).map(a => {
      const ext = String(a.nome || '').split('.').pop().toLowerCase();
      if (!tipos[ext] || !/^Backup_Almoxarifado_IEMA_[\w-]+\.(pdf|xlsx|json)$/.test(a.nome)) throw amigavel('Arquivo de backup inválido.');
      return Utilities.newBlob(Utilities.base64Decode(String(a.base64 || '')), tipos[ext], a.nome);
    });
    if (anexos.length !== 3) throw amigavel('O backup precisa ter os 3 arquivos (PDF, Excel e JSON).');
    const agora = new Date();
    enviarEmail({ to: BACKUP_EMAILS.join(','), subject: 'Backup ' + (req.automatico ? 'mensal ' : '') + 'do almoxarifado – ' + dataArq(agora) + ' – ' + ORGAO + ' (não responda)', htmlBody: htmlEmailBackup(String(req.resumo || '').slice(0, 200), agora), name: NOME_REMETENTE, attachments: anexos });
    props().setProperty('ULTIMO_BACKUP', agora.toISOString());
    registrar([[agora, 'Backup enviado por e-mail', '', '', '', BACKUP_EMAILS.join(', '), '', '', '', 'PDF, Excel e JSON gerados na área do gestor' + (req.automatico ? ' (envio do mês)' : '') + (req.resumo ? ': ' + String(req.resumo).slice(0, 200) : '')]]);
    return { enviadoPara: BACKUP_EMAILS };
  } finally { lock.releaseLock(); }
}

/* ======================= Importar backup (arquivo JSON) ======================= */
/* Nada é apagado: pedidos e registros de histórico que já existem são mantidos e só entram os que faltam.
   Os materiais do backup atualizam os dados e as quantidades dos materiais atuais (cada mudança de quantidade vai para o histórico). */
function acaoImportarBackup(req) {
  const d = req.dados || {}, op = req.opcoes || { pedidos: true, historico: true, estoque: true }, simular = !!req.simular;
  if (d.formato !== 'backup-almoxarifado-iema/1' || !Array.isArray(d.pedidos) || !Array.isArray(d.historico) || !Array.isArray(d.estoque))
    throw amigavel('Arquivo inválido. Use o arquivo .json gerado pelo botão “Gerar backup” ou recebido no e-mail de backup.');
  const res = { geradoEm: d.geradoEm || '', pedidos: 0, historico: 0, materiaisNovos: 0, materiaisAtualizados: 0, ajustesQtd: 0 };
  const lock = bloquear();
  try {
    const agora = new Date(), origem = 'Importação do backup de ' + (d.geradoEm ? dataBR(new Date(d.geradoEm)) : 'data desconhecida');
    const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 400);
    // Estoque e catálogo
    if (op.estoque) {
      const cat = lerCatalogo(), rows = [];
      d.estoque.forEach(b => {
        if (!b || !b.id) return;
        const campos = { codigo: txt(b.codigo, 40), descricao: txt(b.descricao), unidade: txt(b.unidade, 60), natureza: txt(b.natureza, 30), naturezaNome: txt(b.naturezaNome, 120),
          conta: txt(b.conta, 160), qtd: Math.max(0, Number(b.qtd) || 0), limite: Math.max(0, Math.floor(Number(b.limite) || 0)), indisponivel: !!b.indisponivel, oculto: !!b.oculto, soVisualizar: !!b.soVisualizar };
        const img = /^cat:img\d{3}$/.test(b.imagem || '') || /^https?:\/\//i.test(b.imagem || '') ? String(b.imagem) : null;
        let it = cat.mapa[String(b.id)];
        if (!it) {
          res.materiaisNovos++;
          if (!simular) { it = Object.assign({ id: String(b.id), qtdRelatorio: Number(b.qtdRelatorio) || 0, imagem: img || '', imagemVersao: 0, ativo: true, busca: txt(b.busca, 200) }, campos); gravarItem(cat.sh, it);
            rows.push([agora, 'Material restaurado', '', it.id, it.codigo, it.descricao, '', it.qtd, it.qtd, origem]); }
          return;
        }
        const antes = it.qtd; let mudou = !it.ativo;
        Object.keys(campos).forEach(k => { if (String(it[k]) !== String(campos[k])) mudou = true; });
        if (img && img !== it.imagem) mudou = true;
        if (!mudou) return;
        res.materiaisAtualizados++; if (antes !== campos.qtd) res.ajustesQtd++;
        if (simular) return;
        Object.assign(it, campos); it.ativo = true; if (img) it.imagem = img;
        gravarItem(cat.sh, it);
        if (antes !== it.qtd) rows.push([agora, 'Ajuste de estoque', '', it.id, it.codigo, it.descricao, antes, it.qtd, it.qtd - antes, origem]);
      });
      if (!simular) registrar(rows);
    }
    // Pedidos que faltam
    if (op.pedidos) {
      const existentes = new Set(lerPedidos().pedidos.map(p => p.numero));
      const novos = d.pedidos.filter(p => p && p.numero && !existentes.has(String(p.numero))).map(p => ({
        numero: String(p.numero), dataISO: p.dataISO || agora.toISOString(),
        solicitante: { nome: txt((p.solicitante || {}).nome, 120), setor: txt((p.solicitante || {}).setor, 120), telefone: txt((p.solicitante || {}).telefone, 30), email: txt((p.solicitante || {}).email, 120) },
        obs: txt(p.obs, 1000), itens: (p.itens || []).map(l => ({ id: String(l.id), codigo: txt(l.codigo, 40), descricao: txt(l.descricao), unidade: txt(l.unidade, 60), qtd: Number(l.qtd) || 0, atendida: l.atendida == null ? null : Number(l.atendida) })),
        totalUnidades: Number(p.totalUnidades) || 0, totalAtendido: p.totalAtendido == null ? null : Number(p.totalAtendido),
        status: SITUACOES.indexOf(p.status) >= 0 ? p.status : 'Pendente', resposta: txt(p.resposta, 1000), andamento: Array.isArray(p.andamento) ? p.andamento : [] }));
      res.pedidos = novos.length;
      if (!simular && novos.length) {
        anexar('pedidos', novos.map(linhaPedido));
        novos.forEach(p => { const m = p.numero.match(/^(\d{4})-(\d+)$/); if (m && Number(props().getProperty('SEQ_' + m[1]) || 0) < Number(m[2])) props().setProperty('SEQ_' + m[1], String(Number(m[2]))); });
      }
    }
    // Histórico: junta os registros que faltam, em ordem de data
    if (op.historico) {
      const sh = aba('historico'), atuais = linhas(sh).map(r => r.slice(0, 11));
      const chave = r => [iso(r[0] instanceof Date ? r[0] : new Date(r[0])), r[1], r[2], r[3], r[9]].join('|');
      const vistos = new Set(atuais.map(chave));
      const novos = d.historico.filter(h => h && h.dataISO && h.tipo).map(h => [new Date(h.dataISO), txt(h.tipo, 80), txt(h.pedido, 20), txt(h.id, 40), txt(h.codigo, 40), txt(h.descricao),
        h.antes == null ? '' : Number(h.antes), h.depois == null ? '' : Number(h.depois), h.delta == null ? '' : Number(h.delta), txt(h.detalhes, 2000), txt(h.quem, 120)]).filter(r => !vistos.has(chave(r)));
      res.historico = novos.length;
      if (!simular && novos.length) {
        const todas = atuais.map(r => { const c = r.slice(); while (c.length < 11) c.push(''); return c; }).concat(novos)
          .sort((a, b) => new Date(a[0]) - new Date(b[0])).map(r => r.map(seguro));
        if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
        sh.getRange(2, 1, todas.length, 11).setValues(todas);
      }
    }
    if (!simular) {
      registrar([[agora, 'Backup importado', '', '', '', origem, '', '', '', res.pedidos + ' pedidos, ' + res.historico + ' registros de histórico, ' + res.materiaisNovos + ' materiais restaurados e ' + res.materiaisAtualizados + ' atualizados']]);
      novaVersao();
    }
  } finally { lock.releaseLock(); }
  return { resultado: res, simulacao: simular };
}
function instalarBackupMensal() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'backupMensal') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupMensal').timeBased().onMonthDay(1).atHour(6).inTimezone('America/Sao_Paulo').create();
  DriveApp.getRootFolder(); UrlFetchApp.getRequest('https://docs.google.com');   // pede as autorizações necessárias
  props().setProperty('BACKUP_ATIVO', '1');
}
/* Registros só podem ser editados à mão pelo dono da planilha (o sistema continua gravando normalmente). */
function protegerAbas() {
  ['historico', 'pedidos'].forEach(k => {
    const sh = aba(k), pr = sh.protect().setDescription('Registros do sistema – somente o dono da planilha edita');
    pr.removeEditors(pr.getEditors()); if (pr.canDomainEdit()) pr.setDomainEdit(false);
  });
}

/* ======================= E-mails (somente consulta – não responder) ======================= */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function enviarEmail(o) {
  o.noReply = true;
  try { MailApp.sendEmail(o); }
  catch (e1) {
    // Contas Gmail comuns não aceitam o remetente "no-reply": a resposta é desviada para um endereço inexistente.
    delete o.noReply; o.replyTo = 'nao-responda@nao-responda.invalid';
    MailApp.sendEmail(o);
  }
}
function avisar(p, novo) {
  if (!ENVIAR_EMAIL || typeof MailApp === 'undefined') return false;
  try {
    const g = dadosContato(), site = props().getProperty('SITE_URL') || '';
    const link = site ? site + 'solicitante.html?pedido=' + encodeURIComponent(p.numero) : '';
    const tabela = '<table border="1" cellpadding="5" style="border-collapse:collapse;font-size:13px" bordercolor="#D9E1DE"><tr style="background:#1E5240;color:#fff"><th>Código</th><th>Material</th><th>Unidade</th><th>Solicitado</th>' + (novo ? '' : '<th>Atendido</th>') + '</tr>' +
      p.itens.map(l => '<tr><td>' + esc(l.codigo) + '</td><td>' + esc(l.descricao) + '</td><td>' + esc(l.unidade) + '</td><td align="right">' + l.qtd + '</td>' + (novo ? '' : '<td align="right">' + (l.atendida == null ? '—' : l.atendida) + '</td>') + '</tr>').join('') + '</table>';
    const ultimo = p.andamento[p.andamento.length - 1];
    const html = '<div style="font-family:Arial,sans-serif;color:#17201D">' +
      '<p style="font-size:12px;color:#5B6964;margin:0 0 8px">' + ORGAO + ' · Almoxarifado</p>' +
      '<p style="background:#FBF0DC;border:1px solid #E6C68F;padding:8px 12px;font-size:13px"><b>E-mail automático somente para consulta. Não responda esta mensagem</b>: as respostas não são recebidas. Para acompanhar o pedido, use o link abaixo.</p>' +
      '<p>Olá, ' + esc(p.solicitante.nome.split(' ')[0]) + '.</p>' +
      (novo ? '<p>Recebemos o seu pedido <b>' + esc(p.numero) + '</b>. Guarde este número para acompanhar o andamento.</p>'
            : '<p>O pedido <b>' + esc(p.numero) + '</b> mudou para a situação <b>' + esc(p.status) + '</b>.</p><p>' + esc(ultimo ? ultimo.texto : '') + '</p>') +
      tabela +
      (link ? '<p><a href="' + link + '">Acompanhar o pedido</a> (informe o e-mail usado no pedido).</p>' : '') +
      (g.telefone ? '<p>Em caso de dúvida, ligue para o almoxarifado: ' + esc(g.telefone) + '.</p>' : '') +
      '<p style="color:#5B6964;font-size:12px">Mensagem automática do sistema de pedidos do Almoxarifado – ' + ORGAO + '. Não responda.</p></div>';
    const o = { to: p.solicitante.email, subject: (novo ? 'Pedido ' + p.numero + ' recebido' : 'Pedido ' + p.numero + ': ' + p.status) + ' – ' + ORGAO + ' (não responda)', htmlBody: html, name: NOME_REMETENTE };
    if (novo && g.email) o.bcc = g.email;   // cópia oculta ao almoxarifado: o solicitante não vê nem responde para ela
    enviarEmail(o);
    return true;
  } catch (err) { console.error('Falha no e-mail: ' + err); return false; }
}

/* ======================= Menu na planilha ======================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Almoxarifado')
    .addItem('Configurar sistema (primeira vez)', 'configurarSistema')
    .addItem('Ativar backup mensal por e-mail (dia 1º)', 'menuBackup')
    .addItem('Enviar backup por e-mail agora', 'menuBackupAgora')
    .addItem('Redefinir a senha de um gestor', 'menuRedefinirSenha')
    .addItem('Desconectar todos os gestores', 'menuDesconectar')
    .addToUi();
}
function configurarSistema() {
  const ui = SpreadsheetApp.getUi();
  Object.keys(ABAS).forEach(aba);
  carregarCatalogoInicial(); const n = aplicarCatalogoAdicional(); limparImagensV5(); zerarHistoricoUmaVez();
  if (ENVIAR_EMAIL) MailApp.getRemainingDailyQuota();   // pede a autorização de e-mail
  try { instalarBackupMensal(); protegerAbas(); } catch (e) {}
  let msg = 'Catálogo pronto (' + lerCatalogo().itens.length + ' materiais' + (n ? ', incluindo ' + n + ' do Catálogo GOV ES' : '') + ').\n\n';
  if (!lerGestores().length) {
    const nome = ui.prompt('Gestor principal (1 de 3)', 'Nome do gestor principal:', ui.ButtonSet.OK_CANCEL);
    if (nome.getSelectedButton() === ui.Button.OK) {
      const usu = ui.prompt('Gestor principal', 'Usuário para entrar (ex.: cleilson):', ui.ButtonSet.OK_CANCEL);
      const sen = usu.getSelectedButton() === ui.Button.OK ? ui.prompt('Gestor principal', 'Senha (mínimo 8 caracteres):', ui.ButtonSet.OK_CANCEL) : null;
      if (sen && sen.getSelectedButton() === ui.Button.OK) {
        const em = ui.prompt('Gestor principal', 'E-mail do gestor (para recuperar a senha):', ui.ButtonSet.OK_CANCEL);
        try { gravarGestores([novoGestor(usu.getResponseText(), nome.getResponseText(), sen.getResponseText(), true, em.getResponseText())]); msg += 'Gestor principal cadastrado. Os outros 2 logins podem ser criados na área do gestor.\n\n'; }
        catch (e) { msg += 'Gestor não cadastrado: ' + e.message + ' Ele pode ser criado no primeiro acesso à área do gestor.\n\n'; }
      }
    }
  }
  ui.alert(ORGAO + ' – sistema configurado', msg + 'Backup mensal ativado (dia 1º, para ' + BACKUP_EMAILS.join(' e ') + ').\n\nPróximo passo: no Apps Script, clique em Implantar > Nova implantação > App da Web (Executar como: Eu; Quem pode acessar: Qualquer pessoa) e copie a URL para o arquivo config.js no GitHub.', ui.ButtonSet.OK);
}
function menuRedefinirSenha() {
  const ui = SpreadsheetApp.getUi(), lista = lerGestores();
  if (!lista.length) { ui.alert('Ainda não há gestores. Use "Configurar sistema".'); return; }
  const u = ui.prompt('Redefinir senha', 'Gestores: ' + lista.map(g => g.usuario + ' (' + g.nome + ')').join(', ') + '\n\nUsuário:', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  const g = lista.find(x => x.usuario === u.getResponseText().trim().toLowerCase());
  if (!g) { ui.alert('Usuário não encontrado.'); return; }
  const s = ui.prompt('Redefinir senha', 'Nova senha para ' + g.usuario + ' (mínimo 8 caracteres):', ui.ButtonSet.OK_CANCEL);
  if (s.getSelectedButton() !== ui.Button.OK) return;
  try { g.salt = Utilities.getUuid(); g.hash = hashSenha(g.salt, validarSenha(s.getResponseText())); gravarGestores(lista); encerrarSessoesDe(g.usuario); QUEM = 'Planilha (dono)'; registrar([[new Date(), 'Senha redefinida', '', '', '', g.nome + ' (' + g.usuario + ')']]); ui.alert('Senha redefinida.'); }
  catch (e) { ui.alert(e.message); }
}
function menuBackup() {
  const ui = SpreadsheetApp.getUi();
  try { instalarBackupMensal(); protegerAbas(); ui.alert('Backup mensal ativado', 'Todo dia 1º, às 6h, o PDF, o Excel e o JSON serão enviados para:\n' + BACKUP_EMAILS.join('\n') + '\n\nAs abas Histórico e Pedidos foram protegidas contra edição manual.', ui.ButtonSet.OK); }
  catch (e) { ui.alert('Não foi possível ativar: ' + e.message); }
}
function menuBackupAgora() {
  const ui = SpreadsheetApp.getUi();
  try { const d = backupMensal(); ui.alert('Backup enviado para ' + BACKUP_EMAILS.join(', ') + ' (' + d.pedidos.length + ' pedidos, ' + d.historico.length + ' registros de histórico).'); }
  catch (e) { ui.alert('Não foi possível enviar: ' + e.message); }
}
function menuDesconectar() { chavesSessao().forEach(k => props().deleteProperty(k)); SpreadsheetApp.getUi().alert('Todos os gestores foram desconectados.'); }

/* ======================= Catálogos de materiais ======================= */
/* Relatório de Itens em Estoque – 17/10/2026. Colunas: id, código, descrição, unidade, natureza, nome da natureza, conta contábil, quantidade, termo de busca. */
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

/* Catálogo GOV ES (BrSupply) – materiais ainda não existentes na lista. Sem código do fornecedor, NCM ou preço.
   Colunas: id, código interno, descrição, unidade, natureza, nome da natureza, conta, quantidade inicial, termo de busca, imagem (arquivo imagens.js). */
const CATALOGO_ADICIONAL = [
  ["CAT_001", "CAT-001", "SACO PARA LIXO ALTA RESIST UP BAG ABNT PRETO 30L 50UN", "PACOTE 50 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Saco para Lixo Alta Resist Up Bag ABNT Preto 30L 50UN", "cat:img001"],
  ["CAT_002", "CAT-002", "SACO PARA LIXO ALTA RESIST UP BAG ABNT PRETO 50L 50UN", "PACOTE 50 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Saco para Lixo Alta Resist Up Bag ABNT Preto 50L 50UN", "cat:img002"],
  ["CAT_003", "CAT-003", "GUARDANAPO FOLHA SIMPLES KITCHEN 22,7X22,8CM 50UN", "PACOTE 50 UNIDADES", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Guardanapo Folha Simples Kitchen 22,7x22,8cm 50UN", "cat:img005"],
  ["CAT_004", "CAT-004", "SACO PARA LIXO FORTE UP BAG PRETO 110L 50UN", "PACOTE 50 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Saco para Lixo Forte Up Bag Preto 110L 50UN", "cat:img006"],
  ["CAT_005", "CAT-005", "JARRA GRADUADA SANREMO TRANSPARENTE 1L", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Jarra Graduada Sanremo Transparente 1L", "cat:img007"],
  ["CAT_006", "CAT-006", "GARRAFA TÉRMICA THERM/WELLPRO INQUEBRÁVEL INOX 1,9L", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Garrafa Térmica Therm/WellPro Inquebrável Inox 1,9L", "cat:img008"],
  ["CAT_007", "CAT-007", "PAPEL TOALHA KITCHEN MULTIUSO 2UN", "PACOTE 2 UNIDADES", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Papel Toalha Kitchen Multiuso 2UN", "cat:img009"],
  ["CAT_008", "CAT-008", "COPO CAIRO LONG DRINK 350ML LUVA C/6UN", "CAIXA 6 UNIDADES", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Copo Cairo Long Drink 350ml Luva c/6UN", "cat:img010"],
  ["CAT_009", "CAT-009", "XÍCARA DE CAPPUCCINO 200ML COM PIRES 16CM BRANCO CX 12UN", "CAIXA 12 UNIDADES", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Xícara de Cappuccino 200ml com Pires 16cm Branco CX 12UN", "cat:img011"],
  ["CAT_010", "CAT-010", "XÍCARA DE CAFÉ ESPRESSO 80ML COM PIRES BRANCO CX 12UN", "CAIXA 12 UNIDADES", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Xícara de Café Espresso 80ml com Pires Branco CX 12UN", "cat:img012"],
  ["CAT_011", "CAT-011", "GARRAFA TÉRMICA RUBI PRETA 1L", "UNIDADE", "333903021", "MATERIAL DE COPA E COZINHA", "", 0, "Garrafa Térmica Rubi Preta 1L", "cat:img013"],
  ["CAT_012", "CAT-012", "SACO PARA LIXO ALTA RESISTENCIA UP BAG PRETO 60L 100UN", "PACOTE 100 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Saco para Lixo Alta Resistencia Up Bag Preto 60L 100UN", "cat:img014"],
  ["CAT_013", "CAT-013", "LUVA LÁTEX MEDIX DESCARTÁVEL COM PÓ GG CX 100UN", "CAIXA 100 UNIDADES", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 0, "Luva Látex Medix Descartável com Pó GG CX 100UN", "cat:img015"],
  ["CAT_014", "CAT-014", "LUVA LÁTEX MEDIX DESCARTÁVEL COM PÓ M CX 100UN", "CAIXA 100 UNIDADES", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 0, "Luva Látex Medix Descartável com Pó M CX 100UN", "cat:img016"],
  ["CAT_015", "CAT-015", "LUVA LÁTEX MEDIX DESCARTÁVEL COM PÓ G CX 100UN", "CAIXA 100 UNIDADES", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 0, "Luva Látex Medix Descartável com Pó G CX 100UN", "cat:img017"],
  ["CAT_016", "CAT-016", "LUVA LÁTEX MEDIX DESCARTÁVEL COM PÓ P CX 100UN", "CAIXA 100 UNIDADES", "333903028", "MATERIAL DE PROTEÇÃO E SEGURANÇA", "", 0, "Luva Látex Medix Descartável com Pó P CX 100UN", "cat:img018"],
  ["CAT_017", "CAT-017", "FITA CORRETIVA BRANCA CFT1002 5MM X 6M", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Fita Corretiva Branca CFT1002 5mm x 6M", "cat:img019"],
  ["CAT_018", "CAT-018", "CADERNO ESPIRAL CAPA DURA GO OFFICE 200X275MM 96FLS", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caderno Espiral Capa Dura Go Office 200x275mm 96fls", "cat:img020"],
  ["CAT_019", "CAT-019", "CANETA MARCA TEXTO GO OFFICE AMARELA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caneta Marca Texto Go Office Amarela", "cat:img022"],
  ["CAT_020", "CAT-020", "CANETA MARCA TEXTO GO OFFICE VERDE", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caneta Marca Texto Go Office Verde", "cat:img023"],
  ["CAT_021", "CAT-021", "CANETA MARCA TEXTO GO OFFICE ROSA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caneta Marca Texto Go Office Rosa", "cat:img024"],
  ["CAT_022", "CAT-022", "MARCADOR PARA QUADRO BRANCO GO OFFICE AZUL RECARREGÁVEL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Marcador para Quadro Branco Go Office Azul Recarregável", "cat:img026"],
  ["CAT_023", "CAT-023", "MARCADOR PARA QUADRO BRANCO GO OFFICE PRETO RECARREGÁVEL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Marcador para Quadro Branco Go Office Preto Recarregável", "cat:img027"],
  ["CAT_024", "CAT-024", "MARCADOR PARA QUADRO BRANCO GO OFFICE VERMELHO RECARREGÁVEL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Marcador para Quadro Branco Go Office Vermelho Recarregável", "cat:img028"],
  ["CAT_025", "CAT-025", "MARCADOR PARA QUADRO BRANCO GO OFFICE VERDE RECARREGÁVEL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Marcador para Quadro Branco Go Office Verde Recarregável", "cat:img029"],
  ["CAT_026", "CAT-026", "GRAMPO GO OFFICE 26/6 GALVANIZADO CX 5.000UN", "CAIXA 5.000 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Grampo Go Office 26/6 Galvanizado CX 5.000UN", "cat:img032"],
  ["CAT_027", "CAT-027", "PERCEVEJOS LATONADOS GO OFFICE 10MM CX 100UN", "CAIXA 100 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Percevejos Latonados Go Office 10mm CX 100UN", "cat:img033"],
  ["CAT_028", "CAT-028", "PRENDEDOR DE PAPEL GO OFFICE PRETO 25MM CX 12UN", "CAIXA 12 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Prendedor de Papel Go Office Preto 25mm CX 12UN", "cat:img034"],
  ["CAT_029", "CAT-029", "PRENDEDOR DE PAPEL GO OFFICE PRETO 51MM CX 12UN", "CAIXA 12 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Prendedor de Papel Go Office Preto 51mm CX 12UN", "cat:img035"],
  ["CAT_030", "CAT-030", "FITA CREPE SOOPER (GO OFFICE) 18MMX50M PCT 6UN", "PACOTE 6 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Fita Crepe Sooper (Go Office) 18mmx50m PCT 6UN", "cat:img036"],
  ["CAT_031", "CAT-031", "CADERNO 1/4 COSTURADO CAPA DURA CREDEAL AZUL 140X202MM 96FLS", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caderno 1/4 Costurado Capa Dura Credeal Azul 140X202mm 96fls", "cat:img038"],
  ["CAT_032", "CAT-032", "TESOURA GO OFFICE 21CM USO GERAL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Tesoura Go Office 21cm Uso Geral", "cat:img040"],
  ["CAT_033", "CAT-033", "BORRACHA BRANCA COM CINTA PLÁSTICA GO OFFICE", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Borracha Branca com Cinta Plástica Go Office", "cat:img042"],
  ["CAT_034", "CAT-034", "COLA LÍQUIDA BRANCA 90G GO OFFICE", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Cola Líquida Branca 90g Go Office", "cat:img043"],
  ["CAT_035", "CAT-035", "BLOCO ADESIVO GO OFFICE 38X50MM AMARELO 4UN", "PACOTE 4 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Bloco Adesivo Go Office 38x50mm Amarelo 4UN", "cat:img048"],
  ["CAT_036", "CAT-036", "BLOCO ADESIVO GO OFFICE 38X50MM NEON 4UN", "PACOTE 4 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Bloco Adesivo Go Office 38x50mm Neon 4UN", "cat:img049"],
  ["CAT_037", "CAT-037", "FITA ADESIVA SOOPER (GO OFFICE) TRANSPARENTE 12MMX50M 6UN", "PACOTE 6 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Fita Adesiva Sooper (Go Office) Transparente 12mmx50m 6UN", "cat:img051"],
  ["CAT_038", "CAT-038", "FITA ADESIVA SOOPER/GO OFFICE TRANSPARENTE 48MMX50M 4UN", "PACOTE 4 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Fita Adesiva Sooper/Go Office Transparente 48mmx50m 4UN", "cat:img052"],
  ["CAT_039", "CAT-039", "CLIPS GALVANIZADO GO OFFICE 2/0 FIO 1,00MM TRAD. CX 100UN", "CAIXA 100 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Clips Galvanizado Go Office 2/0 Fio 1,00mm Trad. CX 100UN", "cat:img053"],
  ["CAT_040", "CAT-040", "ESTILETE PLÁSTICO GO OFFICE 18MM LÂMINA LARGA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Estilete Plástico Go Office 18mm Lâmina Larga", "cat:img054"],
  ["CAT_041", "CAT-041", "BLOCO ADESIVO GO OFFICE 75X100MM AMARELO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Bloco Adesivo Go Office 75x100mm Amarelo", "cat:img055"],
  ["CAT_042", "CAT-042", "GRAMPEADOR METÁLICO GO OFFICE MÉDIO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Grampeador Metálico Go Office Médio", "cat:img056"],
  ["CAT_043", "CAT-043", "CALCULADORA DE MESA GO OFFICE 12 DÍGITOS", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Calculadora de Mesa Go Office 12 dígitos", "cat:img057"],
  ["CAT_044", "CAT-044", "CLIPS GALVANIZADO GO OFFICE 4/0 FIO 1,00MM LEVE CX 50UN", "CAIXA 50 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Clips Galvanizado Go Office 4/0 Fio 1,00mm Leve CX 50UN", "cat:img058"],
  ["CAT_045", "CAT-045", "ARQUIVO MORTO GO OFFICE 392X185X300MM BRANCO 10UN", "PACOTE 10 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Arquivo Morto Go Office 392x185x300mm Branco 10UN", "cat:img059"],
  ["CAT_046", "CAT-046", "QUADRO BRANCO GO OFFICE SUPERFÍCIE U.V 120X90CM ALUMÍNIO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Quadro Branco Go Office Superfície U.V 120x90cm Alumínio", "cat:img060"],
  ["CAT_047", "CAT-047", "QUADRO BRANCO GO OFFICE SUPERFÍCIE U.V 90X60CM ALUMÍNIO", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Quadro Branco Go Office Superfície U.V 90x60cm Alumínio", "cat:img061"],
  ["CAT_048", "CAT-048", "ARQUIVO MORTO GO OFFICE 360X130X250MM BRANCO 10UN", "PACOTE 10 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Arquivo Morto Go Office 360x130x250mm Branco 10UN", "cat:img063"],
  ["CAT_049", "CAT-049", "PASTA ABA E ELÁSTICO GO OFFICE OFÍCIO 20MM CRISTAL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Pasta Aba e Elástico Go Office Ofício 20mm Cristal", "cat:img064"],
  ["CAT_050", "CAT-050", "PASTA ABA E ELÁSTICO GO OFFICE OFÍCIO SEM LOMBO CRISTAL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Pasta Aba e Elástico Go Office Ofício sem Lombo Cristal", "cat:img065"],
  ["CAT_051", "CAT-051", "PASTA AZ CHIES LE OFÍCIO CLASSIC PRETA REF 1062 C/1UN", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Pasta AZ Chies LE Ofício Classic Preta Ref 1062 c/1UN", "cat:img068"],
  ["CAT_052", "CAT-052", "PORTA CANETA TRIPLO CRISTAL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Porta Caneta Triplo Cristal", "cat:img069"],
  ["CAT_053", "CAT-053", "CLIPS GALVANIZADO GO OFFICE 4/0 FIO 1,10MM CX 50UN", "CAIXA 50 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Clips Galvanizado Go Office 4/0 Fio 1,10mm CX 50UN", "cat:img070"],
  ["CAT_054", "CAT-054", "CANETA ESFEROGRÁFICA COMPACTOR ECONOMIC 1.0MM AZUL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caneta Esferográfica Compactor Economic 1.0mm Azul", "cat:img071"],
  ["CAT_055", "CAT-055", "CANETA ESFEROGRÁFICA COMPACTOR ECONOMIC 1.0MM PRETA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caneta Esferográfica Compactor Economic 1.0mm Preta", "cat:img072"],
  ["CAT_056", "CAT-056", "CANETA ESFEROGRÁFICA COMPACTOR ECONOMIC 1.0MM VERMELHA", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Caneta Esferográfica Compactor Economic 1.0mm Vermelha", "cat:img073"],
  ["CAT_057", "CAT-057", "PASTA CATÁLOGO OFÍCIO ACP PRETA 0,06M COM VISOR 100 ENV.", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Pasta Catálogo Ofício ACP Preta 0,06m com Visor 100 Env.", "cat:img075"],
  ["CAT_058", "CAT-058", "ELÁSTICO DE BORRACHA PREMIER NO 18 PCT 120UN", "PACOTE 120 UNIDADES", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Elástico de Borracha Premier No 18 PCT 120UN", "cat:img077"],
  ["CAT_059", "CAT-059", "LIVRO ATA SD ANIMATIVA 196X295MM 100FLS", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Livro Ata SD Animativa 196x295mm 100fls", "cat:img079"],
  ["CAT_060", "CAT-060", "PERFURADOR GO OFFICE GO5867 30FLS", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Perfurador Go Office GO5867 30fls", "cat:img080"],
  ["CAT_061", "CAT-061", "BLOCO ADESIVO GO OFFICE 75X100MM LARANJA FLUOR", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Bloco Adesivo Go Office 75x100mm Laranja Fluor", "cat:img081"],
  ["CAT_062", "CAT-062", "BLOCO ADESIVO GO OFFICE 75X100MM ROSA PASTEL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Bloco Adesivo Go Office 75x100mm Rosa Pastel", "cat:img082"],
  ["CAT_063", "CAT-063", "BLOCO ADESIVO GO OFFICE 75X100MM AZUL PASTEL", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Bloco Adesivo Go Office 75x100mm Azul Pastel", "cat:img083"],
  ["CAT_064", "CAT-064", "PASTA AZ CHIES LE OFÍCIO LINHA ECONOMIC", "UNIDADE", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Pasta AZ Chies LE Ofício Linha Economic", "cat:img088"],
  ["CAT_065", "CAT-065", "PAPEL VERGÊ OFF PAPER A4 180G BRANCO PCT 50FLS", "PACOTE 50 FOLHAS", "333903016", "MATERIAL DE EXPEDIENTE", "", 0, "Papel Vergê Off Paper A4 180g Branco PCT 50fls", "cat:img090"],
  ["CAT_066", "CAT-066", "BATERIA ALCALINA GO TECH 9V 6LR61", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 0, "Bateria Alcalina Go Tech 9V 6LR61", "cat:img091"],
  ["CAT_067", "CAT-067", "BATERIA DE LÍTIO GO TECH CR2032 3V MOEDA 5UN", "PACOTE 5 UNIDADES", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 0, "Bateria de Lítio Go Tech CR2032 3V Moeda 5UN", "cat:img094"],
  ["CAT_068", "CAT-068", "CARREGADOR DE PILHAS AA/AAA/9V FLEX FX-C16-4P BIVOLT C/4PAA", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 0, "Carregador de Pilhas AA/AAA/9V Flex FX-C16-4P Bivolt C/4PAA", "cat:img095"],
  ["CAT_069", "CAT-069", "PILHA RECARREGÁVEL AA 2900MAH FLEX FX-AA29B2 2UN", "PACOTE 2 UNIDADES", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 0, "Pilha Recarregável AA 2900Mah Flex FX-AA29B2 2UN", "cat:img096"],
  ["CAT_070", "CAT-070", "CAFÉ EM PÓ PACAEMBU SUPERIOR VÁCUO 500G", "UNIDADE", "333903007", "GÊNEROS DE ALIMENTAÇÃO", "", 0, "Café em Pó Pacaembu Superior Vácuo 500g", "cat:img098"],
  ["CAT_071", "CAT-071", "FIBRA PERFECT PRO LIMPEZA PESADA VERDE PCT 10UN", "PACOTE 10 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Fibra Perfect Pro Limpeza Pesada Verde PCT 10UN", "cat:img100"],
  ["CAT_072", "CAT-072", "LIXEIRA PLÁSTICA BRANCA COM PEDAL WITE 15 LITROS", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Lixeira Plástica Branca com pedal Wite 15 litros", "cat:img101"],
  ["CAT_073", "CAT-073", "ESPANADOR DE PÓ SINTÉTICO BETTANIN", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Espanador de Pó Sintético Bettanin", "cat:img102"],
  ["CAT_074", "CAT-074", "BALDE PLÁSTICO SHANGRILA PRETO 15L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Balde Plástico Shangrila Preto 15L", "cat:img103"],
  ["CAT_075", "CAT-075", "BARBANTE DE ALGODÃO CRU N°6", "UNIDADE", "333903019", "MATERIAL DE ACONDICIONAMENTO E EMBALAGEM", "", 0, "Barbante de Algodão Cru N°6", "cat:img104"],
  ["CAT_076", "CAT-076", "PÁ DE LIXO COM CABO 80CM SANCHES", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Pá de Lixo com Cabo 80cm Sanches", "cat:img105"],
  ["CAT_077", "CAT-077", "RODO ALUMÍNIO SANCHES 100CM COM CABO 1,30M", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Rodo Alumínio Sanches 100cm com Cabo 1,30m", "cat:img106"],
  ["CAT_078", "CAT-078", "FLANELA EVERCLEAN (PROFI) 0,28X0,38M BRANCA PCT 6UN", "PACOTE 6 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Flanela Everclean (Profi) 0,28x0,38m Branca PCT 6UN", "cat:img107"],
  ["CAT_079", "CAT-079", "DISCO POLIDOR BETTANIN AMARELO 410MM", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Disco Polidor Bettanin Amarelo 410mm", "cat:img108"],
  ["CAT_080", "CAT-080", "DISCO POLIDOR BETTANIN AMARELO 510MM", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Disco Polidor Bettanin Amarelo 510mm", "cat:img109"],
  ["CAT_081", "CAT-081", "ESCOVA USO GERAL BETTANIN", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Escova Uso Geral Bettanin", "cat:img110"],
  ["CAT_082", "CAT-082", "LIXEIRA PLÁSTICA PRETO 15L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Lixeira Plástica Preto 15L", "cat:img111"],
  ["CAT_083", "CAT-083", "ESCOVA SANTA MARIA OVAL", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Escova Santa Maria Oval", "cat:img112"],
  ["CAT_084", "CAT-084", "ESCOVA SANTA MARIA VASO SANITÁRIO COM SUPORTE", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Escova Santa Maria Vaso Sanitário com Suporte", "cat:img113"],
  ["CAT_085", "CAT-085", "DESENTUPIDOR DE PIA SANTA MARIA", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Desentupidor de Pia Santa Maria", "cat:img114"],
  ["CAT_086", "CAT-086", "DESENTUPIDOR DE VASO SANITÁRIO SANTA MARIA", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Desentupidor de Vaso Sanitário Santa Maria", "cat:img115"],
  ["CAT_087", "CAT-087", "RODO PLÁSTICO SANTA MARIA 0,40M SEM CABO", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Rodo Plástico Santa Maria 0,40m sem Cabo", "cat:img116"],
  ["CAT_088", "CAT-088", "RODO PLÁSTICO SANTA MARIA 0,60M SEM CABO", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Rodo Plástico Santa Maria 0,60m sem Cabo", "cat:img117"],
  ["CAT_089", "CAT-089", "LÃ DE AÇO ASSOLAN PCT 8UN", "PACOTE 8 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Lã de Aço Assolan PCT 8UN", "cat:img119"],
  ["CAT_090", "CAT-090", "RODO LIMPA VIDROS PROFI 39 CM", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Rodo Limpa Vidros Profi 39 cm", "cat:img120"],
  ["CAT_091", "CAT-091", "FITA ISOLANTE SCOTCH 3M 19MM X 10M PRETA", "UNIDADE", "333903026", "MATERIAL ELÉTRICO E ELETRÔNICO", "", 0, "Fita Isolante Scotch 3M 19mm x 10m Preta", "cat:img121"],
  ["CAT_092", "CAT-092", "PANO DE CHÃO EVERCLEAN (PROFI) BR 140G 0,50X0,70M PCT 3UN", "PACOTE 3 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Pano de Chão Everclean (Profi) BR 140g 0,50x0,70m PCT 3UN", "cat:img122"],
  ["CAT_093", "CAT-093", "PAPEL TOALHA INTERF SOFTPAPER BASIC FS 24G CX 2.000UN", "CAIXA 2.000 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Papel Toalha Interf Softpaper Basic FS 24g CX 2.000UN", "cat:img123"],
  ["CAT_094", "CAT-094", "PAPEL HIGIÊNICO ROLO 250M SOFTPAPER VIP FD 28G CX 8UN", "CAIXA 8 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Papel Higiênico Rolo 250m Softpaper Vip FD 28g CX 8UN", "cat:img124"],
  ["CAT_095", "CAT-095", "DISPENSER SOFTPAPER TOALHA BOBINA ALAVANCA", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Dispenser Softpaper Toalha Bobina Alavanca", "cat:img125"],
  ["CAT_096", "CAT-096", "DISPENSER SABONETE LÍQUIDO 800ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Dispenser Sabonete Líquido 800ml", "cat:img126"],
  ["CAT_097", "CAT-097", "PAPEL TOALHA BOBINA 200M SOFTPAPER VIP FS 30G FD 6UN", "FARDO 6 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Papel Toalha Bobina 200m Softpaper Vip FS 30g FD 6UN", "cat:img127"],
  ["CAT_098", "CAT-098", "PAPEL HIGIÊNICO ELITE FOLHA DUPLA FD 4UN", "FARDO 4 UNIDADES", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Papel Higiênico Elite Folha Dupla FD 4UN", "cat:img128"],
  ["CAT_099", "CAT-099", "SABÃO EM PÓ TIXAN YPÊ PRIMAVERA 4KG", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Sabão em Pó Tixan Ypê Primavera 4Kg", "cat:img129"],
  ["CAT_100", "CAT-100", "SABÃO EM PÓ YPÊ PRIMAVERA 800G", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Sabão em Pó Ypê Primavera 800g", "cat:img130"],
  ["CAT_101", "CAT-101", "DETERGENTE LAVA LOUÇAS ESFRELUX NEUTRO 500ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Detergente Lava Louças Esfrelux Neutro 500ml", "cat:img131"],
  ["CAT_102", "CAT-102", "ÁLCOOL ISOPROPÍLICO 99,8% IMPLASTEC 1L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Álcool Isopropílico 99,8% Implastec 1L", "cat:img132"],
  ["CAT_103", "CAT-103", "SABONETE LIQUIDO AUDAX KLYNE ERVA DOCE VERDE 5L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Sabonete Liquido Audax Klyne Erva Doce Verde 5L", "cat:img133"],
  ["CAT_104", "CAT-104", "SABÃO EM BARRA YPÊ CÔCO 160G", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Sabão em Barra Ypê Côco 160g", "cat:img134"],
  ["CAT_105", "CAT-105", "SABÃO EM BARRA YPÊ NEUTRO 160G", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Sabão em Barra Ypê Neutro 160g", "cat:img135"],
  ["CAT_106", "CAT-106", "LIMPA VIDROS FACILITA 500ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Limpa Vidros Facilita 500ml", "cat:img136"],
  ["CAT_107", "CAT-107", "LIMPADOR MULTIUSO AUDAX FACILITA TRADICIONAL 500ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Limpador Multiuso Audax Facilita Tradicional 500ml", "cat:img137"],
  ["CAT_108", "CAT-108", "LUSTRA MÓVEIS AZULIM LAVANDA 200ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Lustra Móveis Azulim Lavanda 200ml", "cat:img138"],
  ["CAT_109", "CAT-109", "ALCOOL GEL 70O PUMP ALL CLEAN 1L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Alcool Gel 70o Pump All Clean 1L", "cat:img139"],
  ["CAT_110", "CAT-110", "HIPOCLORITO DE SÓDIO 5% 108 POWER BBN 5L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Hipoclorito de Sódio 5% 108 Power BBN 5L", "cat:img140"],
  ["CAT_111", "CAT-111", "DESINFETANTE AUDAX FACILITA PINHO FRESH 2L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Desinfetante Audax Facilita Pinho Fresh 2L", "cat:img141"],
  ["CAT_112", "CAT-112", "DESODORIZADOR BOM AR CAMPOS DE LAVANDA 360ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Desodorizador Bom Ar Campos de Lavanda 360ml", "cat:img142"],
  ["CAT_113", "CAT-113", "CERA ACRÍLICA AUDAX BUTTERFLY 2EM1 5L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Cera Acrílica Audax Butterfly 2em1 5L", "cat:img143"],
  ["CAT_114", "CAT-114", "ÁGUA SANITÁRIA YPÊ 1L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Água Sanitária Ypê 1L", "cat:img144"],
  ["CAT_115", "CAT-115", "DESINFETANTE YPÊ EUCALIPTO 500ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Desinfetante Ypê Eucalipto 500ml", "cat:img145"],
  ["CAT_116", "CAT-116", "POLIDOR DE METAIS SPARTAN BRASS POLISH 1L", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Polidor de Metais Spartan Brass Polish 1L", "cat:img146"],
  ["CAT_117", "CAT-117", "DESINFETANTE USO GERAL CREO LINHAL 900ML", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Desinfetante Uso Geral Creo Linhal 900ML", "cat:img147"],
  ["CAT_118", "CAT-118", "VASSOURA PIAÇAVA COM CABO PLASTIFICADO 130CM", "UNIDADE", "333903022", "MATERIAL DE LIMPEZA E PRODUÇÃO DE HIGIENIZAÇÃO", "", 0, "Vassoura Piaçava com Cabo Plastificado 130cm", "cat:img148"]
];

/* Materiais já existentes que são os mesmos itens do Catálogo GOV ES: recebem a imagem do catálogo. */
const VINCULOS_IMAGEM = {"333903021_5": "cat:img003", "333903021_4": "cat:img004", "333903016_74": "cat:img021", "333903016_8": "cat:img025", "333903016_15": "cat:img030", "333903016_37": "cat:img031", "333903016_40": "cat:img037", "333903016_43": "cat:img039", "333903016_42": "cat:img041", "333903016_19": "cat:img044", "333903016_1": "cat:img045", "333903016_53": "cat:img046", "333903016_54": "cat:img047", "333903016_64": "cat:img050", "333903016_0": "cat:img062", "333903016_71": "cat:img066", "333903016_69": "cat:img067", "333903016_50": "cat:img074", "333903016_26": "cat:img076", "333903016_56": "cat:img078", "333903016_49": "cat:img084", "333903016_29": "cat:img085", "333903016_30": "cat:img086", "333903016_52": "cat:img087", "333903016_67": "cat:img089", "333903026_7": "cat:img092", "333903026_8": "cat:img092", "333903026_9": "cat:img093", "333903026_10": "cat:img093", "333903007_1": "cat:img097", "333903007_0": "cat:img099", "333903022_2": "cat:img118"};

/* Imagens aproximadas colocadas pela versão 5 (usadas só para retirá-las nas instalações já atualizadas). */
const IMAGENS_APROXIMADAS_V5 = {"333903009_0": "cat:ilu001", "333903011_0": "cat:ilu002", "333903016_2": "cat:ilu003", "333903016_3": "cat:ilu004", "333903016_4": "cat:img077", "333903016_5": "cat:ilu005", "333903016_6": "cat:img022", "333903016_7": "cat:ilu006", "333903016_9": "cat:ilu007", "333903016_10": "cat:ilu008", "333903016_11": "cat:ilu009", "333903016_12": "cat:ilu010", "333903016_13": "cat:ilu011", "333903016_14": "cat:ilu012", "333903016_16": "cat:img030", "333903016_17": "cat:img053", "333903016_18": "cat:img030", "333903016_20": "cat:ilu013", "333903016_21": "cat:ilu014", "333903016_22": "cat:ilu014", "333903016_23": "cat:ilu014", "333903016_24": "cat:ilu014", "333903016_25": "cat:ilu014", "333903016_27": "cat:ilu015", "333903016_28": "cat:img086", "333903016_31": "cat:img054", "333903016_32": "cat:ilu016", "333903016_33": "cat:ilu016", "333903016_34": "cat:ilu016", "333903016_35": "cat:ilu017", "333903016_36": "cat:ilu016", "333903016_38": "cat:ilu018", "333903016_39": "cat:ilu018", "333903016_41": "cat:img051", "333903016_44": "cat:img039", "333903016_45": "cat:img032", "333903016_46": "cat:img032", "333903016_47": "cat:img032", "333903016_48": "cat:img032", "333903016_51": "cat:ilu019", "333903016_55": "cat:img046", "333903016_57": "cat:img025", "333903016_58": "cat:img026", "333903016_59": "cat:img050", "333903016_60": "cat:ilu020", "333903016_61": "cat:img090", "333903016_62": "cat:ilu021", "333903016_63": "cat:img050", "333903016_65": "cat:img088", "333903016_66": "cat:img088", "333903016_68": "cat:ilu008", "333903016_70": "cat:img064", "333903016_72": "cat:img064", "333903016_73": "cat:ilu022", "333903016_75": "cat:img021", "333903016_76": "cat:ilu023", "333903016_77": "cat:img066", "333903016_78": "cat:ilu024", "333903019_0": "cat:ilu025", "333903019_1": "cat:ilu026", "333903019_2": "cat:ilu019", "333903019_3": "cat:ilu027", "333903021_0": "cat:ilu028", "333903021_1": "cat:ilu029", "333903021_2": "cat:ilu030", "333903021_3": "cat:ilu031", "333903021_6": "cat:ilu032", "333903021_7": "cat:ilu033", "333903021_8": "cat:img007", "333903021_9": "cat:img111", "333903021_10": "cat:ilu034", "333903021_11": "cat:img107", "333903021_12": "cat:img012", "333903021_13": "cat:img011", "333903022_0": "cat:img132", "333903022_1": "cat:img126", "333903023_0": "cat:ilu035", "333903024_0": "cat:ilu036", "333903024_1": "cat:ilu037", "333903024_2": "cat:ilu038", "333903024_3": "cat:ilu039", "333903026_0": "cat:ilu040", "333903026_1": "cat:ilu040", "333903026_2": "cat:ilu040", "333903026_3": "cat:ilu040", "333903026_4": "cat:ilu041", "333903026_5": "cat:ilu042", "333903026_6": "cat:ilu042", "333903026_11": "cat:img096", "333903026_12": "cat:ilu043", "333903026_13": "cat:ilu043", "333903026_14": "cat:ilu044", "333903026_15": "cat:ilu044", "333903026_16": "cat:ilu044", "333903028_0": "cat:ilu045", "333903028_1": "cat:ilu046", "333903028_2": "cat:ilu047", "333903028_3": "cat:ilu048", "333903028_4": "cat:ilu049", "333903028_5": "cat:ilu050", "333903028_6": "cat:ilu047", "333903028_7": "cat:ilu051", "333903048_0": "cat:ilu052", "333903048_1": "cat:ilu053"};
