# Pedidos de material – IEMA - Instituto Estadual de Meio Ambiente

> **Endereço do site:** `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
> Esta página é o código. O site fica no endereço acima, depois de ativar o GitHub Pages (Parte 1).

## Os 9 arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | Página inicial: fazer pedido, acompanhar pedido, área do gestor |
| `solicitante.html` | Catálogo, pedido (dados obrigatórios), planilha Excel e acompanhamento. Sem login |
| `painel.html` | Painel só com gráficos, para incorporar no **Google Looker Studio** (link gerado na área do gestor) |
| `gestor.html` | Área do gestor: até 5 logins com perfis de acesso, pedidos, painel, catálogo, relatórios, histórico |
| `imagens.js` | Miniaturas das fotos do Catálogo GOV ES (carregam com a página) |
| `imagens-hd.js` | Imagens em alta resolução (400×400), carregadas em segundo plano para o painel lateral e a ampliação |
| `config.js` | Configuração. É o único arquivo a editar (`API_URL`) |
| `Code.gs` | Servidor: colar no Google Apps Script |
| `README.md` | Este guia |

Não há pastas. Envie os 9 arquivos lado a lado na raiz do repositório.

Todas as páginas têm o nome do órgão, **IEMA - Instituto Estadual de Meio Ambiente**, e o logotipo oficial (Governo do Estado do Espírito Santo, Secretaria do Meio Ambiente e Recursos Hídricos e IEMA). O nome também aparece no título das abas do navegador, nas planilhas Excel, nos PDFs e nos e-mails.

## Catálogo para consulta e pré-aprovação (SIADES)

A página inicial, a página de pedidos, a confirmação, o pedido enviado, o acompanhamento, o PDF e a planilha do pedido e os e-mails trazem, em tom formal, o aviso institucional:

> *Prezado(a) servidor(a), informamos que este catálogo destina-se à consulta da disponibilidade de materiais e à pré-aprovação dos pedidos pelo Almoxarifado. Esse procedimento não exclui a obrigatoriedade de solicitação formal dos itens no SIADES, que permanece indispensável para a efetivação do atendimento. Agradecemos a compreensão e a colaboração.*

**Pedidos aprovados:** quando o gestor aprova um pedido, o andamento informa que se trata de uma **pré-aprovação** e lembra o solicitante de formalizar a solicitação no SIADES.

**Mudar a redação:**
- **Páginas e documentos:** altere `AVISO_SIADES_TITULO`, `AVISO_SIADES` e `AVISO_SIADES_CURTO` no `config.js`.
- **E-mails:** altere `AVISO_SIADES` no início do `Code.gs`.

## Mini imagens dos materiais em pedidos e relatórios

As tabelas passam a ter uma coluna com a mini imagem de cada material. Os materiais sem foto aparecem com um quadrinho em branco.

| Onde | Na tela | Excel | PDF e impressão |
|---|---|---|---|
| Pedido (confirmação, pedido enviado, acompanhamento, detalhe do gestor) | ✓ | ✓ | ✓ |
| Lista de pedidos do gestor (até 4 imagens por pedido) | ✓ | ✓ | – |
| Exportação do catálogo | – | ✓ | – |
| Relatórios por pedido, por material, consumo, estoque e histórico | ✓ | ✓ | ✓ |
| Dashboard: materiais com estoque baixo | ✓ | – | ✓ |

A impressão usa o próprio PDF, então sai igual a ele, com as imagens. Nos relatórios, a opção **Incluir imagens dos materiais** pode ser desmarcada para gerar arquivos mais leves.

## Gráficos e dashboard (aba Relatórios)

A aba **Relatórios** tem dois modos, com os mesmos filtros.

**Filtros:**
- período rápido: 7, 30 e 90 dias, este mês, este ano, 12 meses ou todo o período;
- datas De e Até;
- setor;
- situação;
- natureza de despesa;
- material, digitando o código ou o nome;
- botão **Limpar filtros**.

**Relatórios em tabela:** os 7 relatórios de antes. Com **Incluir gráfico** marcado, cada relatório mostra um gráfico próprio, que vai junto para o PDF (na primeira página) e para o Excel (aba "Gráfico"):

| Relatório | Gráfico |
|---|---|
| Resumo | Situação dos pedidos |
| Por material e consumo | 15 materiais mais pedidos |
| Setores | Solicitado e atendido por setor |
| Estoque | Disponível e reservado por natureza |
| Histórico e excluídos | Registros por tipo e por responsável |

**Dashboard com gráficos:** somente gráficos, sem tabelas nem quadros de números.
- **Os 10 gráficos:**
  - evolução por dia ou mês;
  - situação dos pedidos;
  - materiais mais solicitados;
  - consumo por setor;
  - consumo por natureza;
  - estoque por natureza (disponível e reservado);
  - materiais com estoque baixo por natureza (sem estoque e abaixo do alerta);
  - taxa de atendimento por setor;
  - pedidos por dia da semana;
  - pedidos por horário.
- **Atualização:** muda na hora ao trocar um filtro e se atualiza sozinho quando chegam pedidos.
- **Exportação:** **Baixar PDF do dashboard** e **Imprimir dashboard** geram um relatório em paisagem só com os gráficos.

### Dashboard no Google Looker Studio

O botão **Link para o Looker Studio**, em *Relatórios › Dashboard com gráficos*, gera o link do painel de gráficos (`painel.html`). Colado no Looker Studio, o painel mostra os gráficos e **se atualiza sozinho**.

**Como gerar o link:**
1. Abra **Relatórios › Dashboard com gráficos** e escolha os filtros que o painel deve usar (por exemplo, período rápido "Últimos 30 dias" e setor).
2. Clique em **Link para o Looker Studio**. Na primeira vez, clique em **Criar link** (é preciso a permissão "Configurações e regras").
3. Escolha **Todos os gráficos** ou **Só: (um gráfico)**, e se quer mostrar o título do painel.
4. Clique em **Copiar link**. Para conferir antes, use **Abrir o painel (pré-visualizar)**.

**Como colar no Looker Studio:**
1. Abra o relatório no Looker Studio e clique em **Editar**.
2. No menu, escolha **Inserir › Incorporar URL** (*Embed URL*).
3. Desenhe o quadro na página e cole o link em **URL do conteúdo incorporado**.
4. Ajuste o tamanho do quadro.

Para montar o relatório gráfico por gráfico, gere um link "Só: …" para cada gráfico e coloque cada um num quadro.

**Atualização automática:** o painel confere as novidades a cada minuto e se redesenha sozinho quando chegam pedidos ou o estoque muda. Com um período rápido ("Últimos 30 dias", "Este mês" etc.), o período avança sozinho com os dias. Datas fixas (De/Até) ficam fixas.

**Segurança:**
- **Código secreto:** o link tem um código que só funciona enquanto estiver ativo.
- **Dados entregues:** o servidor envia ao painel apenas números agregados dos pedidos (data, situação, setor e materiais) e do estoque, **nunca** nomes, e-mails, telefones ou observações.
- **Cortar o acesso:** **Gerar novo link** ou **Desativar link** derruba na hora todos os links já distribuídos, inclusive os colados no Looker Studio.
- **Registro:** criar e desativar o link fica no histórico.
- **Requisito:** o link só funciona com a Planilha Google ligada (fora do modo demonstração).

## Perfis de acesso dos gestores

Na aba **Gestores e contato**, quem tem a permissão **Usuários e perfis** (o gestor principal sempre tem) cadastra até 5 gestores. Para cada um, escolhe o **tipo de perfil** e pode ajustar as permissões marcando as caixinhas. Se as caixinhas marcadas não corresponderem a nenhum perfil pronto, o perfil vira **Personalizado**. Se corresponderem, recebe o nome do perfil.

**Todos os perfis sempre podem visualizar**, em tempo real, o painel, os pedidos, o catálogo, o saldo e a disponibilidade dos materiais.

| Permissão | O que libera |
|---|---|
| Atender pedidos | Aprovar, atender, atender em parte e recusar |
| Excluir pedidos | Excluir com motivo (devolve o estoque reservado) |
| Ajustar estoque | Alterar as quantidades disponíveis |
| Editar catálogo | Cadastrar, editar e remover materiais; imagens; Visível, Só visualizar e Indisponível |
| Relatórios e exportações | Gerar relatórios e baixar Excel e PDF |
| Histórico e auditoria | Ver o histórico completo, com responsável |
| Backup | Gerar e enviar o backup |
| Importar backup | Restaurar dados de um arquivo de backup |
| Configurações e regras | Contato do almoxarifado, alerta de estoque mínimo, backup mensal |
| Usuários e perfis | Cadastrar, editar e remover gestores; perfis; senhas |

| Perfil pronto | Permissões |
|---|---|
| **Administrador do Sistema** | Todas: controle total do estoque, catálogo, pedidos, relatórios, auditoria, backup, regras de negócio e gestão de usuários e perfis |
| **Gestor operacional** | Tudo do dia a dia, sem gerenciar usuários nem importar backup (é o perfil dado aos gestores cadastrados antes desta versão) |
| **Almoxarife (estoque e catálogo)** | Atender pedidos, ajustar estoque, editar catálogo, relatórios |
| **Atendimento de pedidos** | Atender pedidos e relatórios; não mexe no estoque nem no catálogo |
| **Auditor** | Histórico, relatórios e backup; não altera nada |
| **Visualizador (leitura)** | Só consulta: painel, pedidos, estoque e histórico em tempo real. **Bloqueado para qualquer alteração, inserção ou exclusão** |
| **Personalizado** | As caixinhas que você marcar |

**Segurança das permissões:**
- **Conferência no servidor:** além de esconder os botões, o servidor confere a permissão em **cada ação**. Quem não tem permissão recebe a mensagem "Seu perfil não tem permissão para…".
- **Dados restritos:** sem a permissão de auditoria, o histórico nem é enviado ao navegador. Sem a permissão de usuários, o gestor vê só o próprio cadastro.
- **Limites para todos:** ninguém altera o próprio perfil, e ninguém altera, remove ou troca a senha do gestor principal.
- **Registro:** cada cadastro e cada mudança de perfil ficam no histórico, com o antes e o depois.

**Regra de negócio, alerta de estoque mínimo:** em *Gestores e contato › Regras do estoque*, quem tem **Configurações e regras** define a partir de quantas unidades um material aparece como estoque baixo no painel e no catálogo.

## Celular, tablet e computador

As três páginas se ajustam sozinhas ao tamanho da tela, sem rolagem para os lados. Funcionam em celular (a partir de 320 px), tablet em pé ou deitado e computador.

| Tela | Como fica |
|---|---|
| **Computador** (acima de 1100 px) | Layout completo, com tabelas e o painel lateral de imagem do solicitante |
| **Tablet** (600 a 900 px) | Materiais e catálogo em **cartões, duas colunas**; pedidos, histórico e relatórios em cartões |
| **Celular** (até 760 px) | Cartões em uma coluna; barra fixa **"Enviar pedido"** no rodapé, com o total de itens e unidades; filtros e botões na largura toda; diálogos em tela cheia; detalhe do pedido do gestor como uma folha que sobe do rodapé; áreas de toque maiores |

Os dados e as funções são os mesmos em qualquer tela. No celular, tocar na imagem de um material abre a imagem ampliada, e tocar num pedido (gestor) abre o detalhe com todos os botões.

## O que o sistema faz

**Solicitante (`solicitante.html`)**
- A página segue o modelo do Relatório de Itens em Estoque: materiais agrupados por natureza de despesa, com totais. No cabeçalho aparece só a data e hora de acesso.
- Os materiais do catálogo do fornecedor mostram a foto do produto; os demais ficam em branco até o almoxarifado inserir a imagem. Ao passar o mouse sobre o quadrinho, o painel lateral mostra a imagem em alta resolução e os detalhes do material.
- Nome completo, setor (lista suspensa de siglas), telefone e e-mail são obrigatórios.
- **Só e-mail institucional:** o pedido só é aceito com e-mail terminado em **@iema.es.gov.br**. O nome antes do @ pode ser qualquer um (ex.: `maria.souza@iema.es.gov.br`). Outros domínios são recusados, inclusive variações como `@iema.es.gov.br.com` ou `@sub.iema.es.gov.br`. A regra vale na página e também no servidor (`DOMINIO_EMAIL` no `Code.gs` e no `config.js`).
- Materiais marcados pelo gestor como **só visualização** aparecem com a quantidade e a marca SOMENTE CONSULTA, mas não podem ser pedidos.
- Não aceita materiais indisponíveis nem quantidade acima do disponível ou do limite por pedido.
- Os materiais ocultados pelo gestor não aparecem.
- Ao clicar em **Enviar pedido**:
  - o pedido recebe um número único;
  - aparece na hora para os gestores;
  - a planilha Excel do pedido é baixada, com as imagens.
- **Acompanhar pedido:** informe o número e o e-mail usado no pedido.
- **E-mails automáticos** a cada pedido e a cada mudança de situação. São somente para consulta e não podem ser respondidos (veja "E-mails").
- **Aviso de privacidade (LGPD)** na página. Explica quais dados são coletados, para quê, quem tem acesso, por quanto tempo ficam guardados e como falar com o encarregado.
- **"Não lembrar meus dados neste computador"**: em computador compartilhado, apaga do navegador os dados do solicitante e a lista "Meus pedidos", e não guarda mais nada.

**Gestor (`gestor.html`)**
- **Até 5 logins** (usuário e senha), que podem usar o sistema **ao mesmo tempo**. Cada um tem um **perfil de acesso** (veja "Perfis de acesso"). As telas se atualizam sozinhas a cada 6 segundos.
- Cada ação fica no histórico com o nome de quem fez.
- **Pedidos:**
  - aprovar, atender tudo, atender em parte ou recusar;
  - baixar Excel ou PDF e imprimir;
  - **excluir pedido**, com motivo obrigatório. A exclusão fica no histórico com o nome do gestor, a data e o horário. Pedidos pendentes ou aprovados devolvem as quantidades ao estoque.
- **Visão geral:** indicadores e gráficos com **filtros** de período (incluindo datas escolhidas), setor, situação e natureza de despesa.
- **Catálogo e estoque:**
  - **Visível**: desligado, o material some da página de pedidos;
  - **Só visualizar**: ligado, o material aparece na página com a quantidade, mas **não pode ser pedido**. A caixinha e a quantidade ficam travadas e aparece a marca SOMENTE CONSULTA;
  - **Indisponível**: ligado, o material aparece marcado como INDISPONÍVEL;
  - alterar quantidades (com motivo);
  - cadastrar, editar ou remover materiais;
  - **inserir, trocar ou retirar a imagem** de cada material: clique na imagem do material na lista. Dá para escolher o arquivo, arrastar a foto ou colar com Ctrl+V. O sistema recorta as bordas e ajusta qualquer foto ao quadrinho padrão de 600×600, com fundo branco. Também há o botão **Usar a imagem padrão do catálogo**.
- **Relatórios:**
  - tipos: pedidos (resumo), pedidos por material, consumo por material, consumo por setor, posição do estoque, histórico e auditoria, pedidos excluídos;
  - filtros de período, setor, situação e natureza;
  - visualização na tela, **Excel**, **PDF** e impressão.
- **Histórico:** tudo o que aconteceu, com filtros por tipo e por responsável. **O histórico não pode ser apagado pelo sistema**: não existe botão para zerar. As abas *Histórico* e *Pedidos* da planilha também ficam protegidas contra edição manual (veja "Backup").
- **Backup:** o botão **Gerar backup** (em *Relatórios* e em *Histórico*) baixa três arquivos com as solicitações, o histórico e o estoque: **PDF**, **Excel** e **JSON**. Além disso, **todo dia 1º do mês** o sistema envia esses arquivos por e-mail (veja "Backup").
- **Gestores e contato:**
  - o gestor principal cadastra até 2 outros logins, remove logins e redefine senhas;
  - cada gestor troca a própria senha;
  - contato do almoxarifado.

### Situações do pedido

| Situação | Estoque |
|---|---|
| Pendente / Aprovado | Quantidades **reservadas** (saem do disponível) |
| Atendido | Baixa definitiva |
| Parcialmente atendido | O que não foi entregue **volta** ao estoque |
| Recusado | Tudo **volta** ao estoque |
| Excluído (pelo gestor) | Sai da lista. Se estava pendente ou aprovado, tudo **volta** ao estoque. A exclusão fica no histórico |

### Catálogo e imagens

O catálogo tem **254 materiais**:
- 136 do Relatório de Itens em Estoque de 17/10/2026;
- 118 do Catálogo GOV ES (BrSupply).

Do Catálogo GOV ES não foram trazidos código do fornecedor, NCM nem preço. Os 118 materiais novos receberam os códigos internos `CAT-001` a `CAT-118`, que podem ser trocados em **Editar**. Eles começam com quantidade 0 e aparecem como INDISPONÍVEL até o gestor informar a quantidade.

**Imagens:**
- **150 materiais têm a foto do Catálogo GOV ES**, extraída do PDF na resolução original. São os 118 materiais novos e os materiais da lista original que são os mesmos itens do catálogo, como açúcar, adoçante, copos, apontador, clipes, lápis, lapiseiras, grafites, envelopes e pilhas.
- **Os demais materiais ficam com o quadrinho em branco**, prontos para o almoxarifado inserir a imagem.
- **Para inserir uma imagem**, vá em *Catálogo e estoque*, use o filtro **Sem imagem (para inserir)** e clique no quadrinho em branco ("+ imagem"). Você pode escolher o arquivo, arrastar a foto ou colar com Ctrl+V. O sistema ajusta a foto sozinho ao quadrinho padrão.

---

## Parte 1 – Colocar o site no ar (5 minutos)

1. Descompacte o `.zip`.
2. No GitHub, crie um repositório:
   - clique em **New**, dê um nome (ex.: `almoxarifado`), marque **Public** e clique em **Create repository**;
   - clique em **uploading an existing file**, selecione **os 9 arquivos**, arraste para a página e clique em **Commit changes**.
3. Em **Settings › Pages**, escolha *Branch* `main` e a pasta `/ (root)`, e clique em **Save**.
4. Aguarde 1 a 2 minutos. O endereço do site aparece em **Settings › Pages**, no botão **Visit site**.

O site já abre em **modo demonstração**, mas nesse modo cada computador tem uma cópia própria dos dados. **Para uso simultâneo em qualquer máquina, a Parte 2 é obrigatória.**

> **Aparece só texto?** Ou você está no endereço do repositório (`github.com/...`) em vez do site (`...github.io/...`), ou os arquivos ficaram dentro de uma pasta.
> **A página abre sem formatação?** Apague arquivos de versões antigas e suba os 9 desta versão. Depois aperte Ctrl+F5.

## Parte 2 – Ligar o banco de dados (10 minutos, uma vez só)

1. No Google Drive da conta do almoxarifado, crie uma **Planilha Google** em branco.
2. Na planilha, clique em **Extensões › Apps Script**.
3. Apague o que houver no editor, cole **todo** o conteúdo do `Code.gs` e clique em **Salvar**.
4. Volte para a planilha, recarregue a página (F5) e use **Almoxarifado › Configurar sistema (primeira vez)**:
   - autorize o acesso: *Continuar › sua conta › Avançado › Acessar (não seguro) › Permitir*;
   - cadastre o **gestor principal**: nome, usuário, senha e **e-mail** (usado para recuperar a senha);
   - o catálogo de 254 materiais é carregado automaticamente.
   - o backup mensal por e-mail (dia 1º, para subad@ e almoxarifado@) é ativado, e as abas de registros são protegidas.
5. No Apps Script, clique em **Implantar › Nova implantação**:
   - escolha **App da Web**;
   - em *Executar como*, escolha **Eu**;
   - em *Quem pode acessar*, escolha **Qualquer pessoa**;
   - clique em **Implantar** e copie a URL, que termina em `/exec`.
6. Abra `gestor.html`, cole a URL no quadro **Ligar ao banco de dados**, clique em **Testar** e depois em **Abrir config.js no GitHub**. Troque a linha `API_URL: "",` e clique em **Commit changes**.
7. Aguarde 1 a 2 minutos. Entre na área do gestor com o usuário e a senha do gestor principal.
8. Na aba **Gestores e contato**, cadastre os outros gestores (até 4, cada um com o seu perfil), preencha o contato do almoxarifado e, se quiser, o alerta de estoque mínimo.

Quando o aviso amarelo de "Modo demonstração" sumir das páginas, o sistema está compartilhado por todas as máquinas.

### Atualizar uma instalação que já existe

1. No Apps Script, apague o código antigo, cole o `Code.gs` novo e salve.
2. Publique a versão nova: **Implantar › Gerenciar implantações › lápis › Versão: Nova versão › Implantar**. A URL não muda.
   - **Se o Google pedir autorização**, clique em **Autorizar acesso**, escolha a conta, depois **Avançado › Acessar (não seguro)** e por fim **Permitir**. O pedido aparece porque o backup usa novas permissões (gerar o PDF e o Excel e agendar o envio do dia 1º).
   - Depois disso, abra a área do gestor: o backup mensal se ativa sozinho.
3. No GitHub, substitua os arquivos pelos 9 desta versão. Mantenha a sua linha `API_URL` no `config.js`.

Os dados da planilha são mantidos. No primeiro acesso depois da atualização:
- os 118 materiais novos e as fotos são incluídos sozinhos;
- **a senha única antiga vira o usuário `gestor`**, com a mesma senha. Entre com ele e cadastre os demais logins.
- **gestores já cadastrados** (além do principal) recebem o perfil **Gestor operacional**, com as mesmas permissões que tinham antes. O gestor principal pode mudar o perfil de cada um em *Gestores e contato › Editar perfil*.
- **todos os gestores precisam entrar de novo** uma vez, porque as sessões passam a seguir a regra de 15 minutos de inatividade. A opção "Manter conectado por 30 dias" deixou de existir.
- as imagens aproximadas colocadas pela versão anterior nos materiais fora do Catálogo GOV ES são retiradas, e esses quadrinhos ficam em branco. As imagens que o gestor já tinha inserido ou trocado são mantidas.
- **o histórico é zerado uma única vez**;
- gestores cadastrados antes desta versão não têm e-mail. Cada um deve cadastrar o seu em *Gestores e contato › Meu e-mail de recuperação*, ou o gestor principal pode usar **Alterar e-mail**.

---

## Gestores e senhas

- **Até 5 logins.** O primeiro é o **gestor principal (master)**: tem todas as permissões e não pode ser alterado nem removido por ninguém.
- **Encerramento por inatividade (regra de segurança):** depois de **15 minutos** sem mexer na página (mouse, teclado, toque ou rolagem), a sessão do gestor é encerrada.
  - **Aviso:** no último minuto aparece o aviso com contagem regressiva e o botão **Manter conectado**. Nesse minuto, só o botão renova o tempo, para confirmar que há alguém de fato na frente da tela.
  - **No servidor:** a regra também vale lá. As atualizações automáticas da tela não contam como uso, então uma sessão esquecida aberta expira mesmo que o computador continue ligado.
  - **Duração máxima:** mesmo com uso, a sessão termina após 10 horas.
  - **Página do solicitante:** a mesma regra vale lá. Após 15 minutos sem uso, a página é reiniciada e os dados digitados e os itens escolhidos são apagados da tela.
- **Login removido:** quem teve o login removido perde o acesso na hora, em todos os computadores.
- **Esqueci minha senha**, na tela de entrada:
  1. Informe o usuário ou o e-mail do gestor.
  2. O sistema envia um **código de 6 números** para o e-mail cadastrado. O código vale por 15 minutos, pode ser usado uma única vez e aceita no máximo 5 tentativas.
  3. Digite o código e a nova senha. Você já entra conectado.
  4. A troca fica registrada no histórico.
- **E-mail obrigatório:** todo gestor precisa ter e-mail. Cada um altera o seu em *Gestores e contato*, e o gestor principal pode alterar o de qualquer gestor.
- **Senha cadastrada presencialmente:** o gestor principal tem o botão **Cadastrar senha (presencial)** ao lado de cada gestor. O próprio gestor digita a nova senha no computador do principal, e as sessões abertas dele são encerradas.
- **O próprio gestor principal esqueceu a senha e não tem acesso ao e-mail?** Use **Almoxarifado › Redefinir a senha de um gestor**, na planilha.
- **Bloqueio por tentativas:** depois de 8 senhas erradas, aquele usuário fica bloqueado por 10 minutos.

## Backup

**Backup manual:** na área do gestor, aba *Relatórios* ou *Histórico*, clique em **Gerar backup (PDF, Excel e JSON)**. São baixados três arquivos com data e hora no nome:

| Arquivo | Conteúdo |
|---|---|
| `Backup_Almoxarifado_IEMA_AAAA-MM-DD_HHMM.pdf` | Relatório para leitura e impressão: pedidos, itens dos pedidos, histórico e estoque |
| `….xlsx` | Abas Resumo, Pedidos, Itens dos pedidos, Histórico e Estoque |
| `….json` | Cópia completa dos dados, para restauração ou migração |

Se o navegador perguntar, permita baixar vários arquivos. Cada backup baixado fica registrado no histórico.

**Backup automático mensal:**
- **Quando e para quem:** todo **dia 1º, às 6h**, o sistema gera o PDF, o Excel e o JSON e envia por e-mail para **almoxarifado@iema.es.gov.br** e **subad@iema.es.gov.br**. Os dois endereços já estão no código (`BACKUP_EMAILS`, no início do `Code.gs`).
- **Ativação automática:** não é preciso usar o menu da planilha. O envio do dia 1º se ativa sozinho no primeiro acesso de um gestor depois da atualização. Se ainda aparecer "não ativado", clique em **Ativar backup mensal** na aba *Relatórios*.
- **Garantia de envio:** se o envio do dia 1º não acontecer por algum motivo, o primeiro gestor que entrar a partir do dia 1º envia o backup do mês automaticamente. O sistema nunca envia duas vezes no mesmo mês.
- **Envio manual:** o botão **Enviar backup por e-mail agora** envia na hora, a qualquer momento.
- **Plano B automático:** se o Google ainda não tiver permissão para gerar os arquivos, o navegador do gestor gera o PDF, o Excel e o JSON, e o servidor só envia o e-mail.
- **Acompanhar:** a aba *Relatórios* mostra se o backup mensal está ativo e quando foi o último envio.

**Importar backup:** botão **Importar backup (JSON)**, na aba *Relatórios*, disponível só para o gestor principal.
1. Escolha o arquivo `.json` do backup, gerado pelo botão ou recebido no e-mail.
2. O sistema mostra antes o que vai entrar: pedidos que faltam, registros de histórico que faltam e materiais com diferença no estoque.
3. **Nada é apagado.** Pedidos e registros de histórico que já existem continuam como estão; entram só os que faltam. O histórico fica em ordem de data.
4. Os materiais do backup atualizam os dados e as quantidades do estoque. Cada mudança de quantidade vai para o histórico.
5. Por padrão, o sistema baixa antes um backup do estado atual, por segurança.
6. A importação fica registrada no histórico. Importar o mesmo arquivo de novo não duplica nada.

O PDF e o Excel servem para leitura. A restauração usa o arquivo **JSON**.

**Proteção dos registros:** quando o backup mensal é ativado, as abas *Histórico* e *Pedidos* da planilha ficam protegidas. Só o dono da planilha consegue editá-las à mão; o sistema continua gravando normalmente.

**Onde guardar:** os arquivos contêm dados pessoais. Guarde-os em local de acesso restrito, como uma pasta do Porta-arquivos do Comunica ES. **Nunca** coloque backups no repositório do GitHub, que é público.

## LGPD

- **Aviso de privacidade:** fica na página de pedidos, logo abaixo dos dados do solicitante, e também abre pelo link no rodapé.
- **Contato do encarregado:** preencha `ENCARREGADO_NOME` e `ENCARREGADO_EMAIL` no `config.js` com o contato do Encarregado pelo Tratamento de Dados Pessoais (DPO) do IEMA. Enquanto estiverem vazios, o aviso orienta a procurar o canal do encarregado no site oficial do IEMA.
- **Prazo de guarda:** `PRAZO_GUARDA` define o texto sobre por quanto tempo os dados ficam guardados. O padrão remete à Tabela de Temporalidade de Documentos.
- **Dados no navegador:** o solicitante pode marcar "Não lembrar meus dados neste computador".
- **Revisão:** valide o texto do aviso com o encarregado ou a assessoria jurídica do IEMA.
- **Proteção contra fórmulas:** textos digitados nos formulários (nome, observação etc.) são sempre gravados na planilha como texto e nunca viram fórmulas.

## E-mails (somente consulta)

- **Quando são enviados:** o solicitante recebe um e-mail quando o pedido é registrado e a cada mudança de situação.
- **Aviso no e-mail:** a mensagem informa, em destaque, que é **automática e não deve ser respondida**, e traz o link para acompanhar o pedido.
- **Cópia ao almoxarifado:** o e-mail do contato do almoxarifado recebe **cópia oculta** de cada pedido novo. O solicitante não vê esse endereço.
- **Contas Google Workspace (institucionais):** o e-mail sai de um endereço **no-reply** do domínio, que não aceita resposta.
- **Contas Gmail comuns:** o Google não oferece o remetente no-reply. A resposta é desviada para um endereço inexistente, então ninguém a recebe.
- **Desligar os e-mails:** mude `ENVIAR_EMAIL` para `false` no início do `Code.gs` e publique uma nova versão.
- **Limite diário do Google:** cerca de 100 e-mails por dia em contas Gmail e 1.500 em contas Workspace.

## Problemas comuns

**O catálogo não aparece em outra máquina, ou os pedidos não chegam ao gestor**
- **Aviso amarelo de "Modo demonstração" na página:** o `API_URL` está vazio. Faça a Parte 2.
- **Mensagem de erro no lugar do catálogo:** confira três coisas:
  - a URL termina em `/exec`;
  - o tipo da implantação é **App da Web**;
  - "Quem pode acessar" está como **Qualquer pessoa**.
- **Trocou o `Code.gs`?** Publique uma **nova versão** da implantação.

**Depois de atualizar, a área do gestor mostra erro de autorização**
Isso acontece quando o Google não pediu a autorização das novas permissões ao publicar a versão. Para resolver:
1. No Apps Script, escolha a função **instalarBackupMensal** na lista ao lado de **Executar** e clique em **Executar**.
2. Autorize o acesso.

Isso é feito uma única vez.

**As fotos não aparecem**
Confira se o arquivo `imagens.js` foi enviado ao repositório, na raiz, junto com os outros.

## Configurações (`config.js`)

| Opção | Para que serve |
|---|---|
| `API_URL` | Endereço do App da Web. Vazio = modo demonstração |
| `ESTOQUE_BAIXO` | A partir de quantas unidades o material aparece como estoque baixo |
| `ATUALIZAR_A_CADA` | Intervalo (segundos) da atualização em tempo real (padrão 6) |
| `SETORES` | Lista suspensa de setores (siglas) |
| `DOMINIO_EMAIL` | Domínio de e-mail aceito nos pedidos (`iema.es.gov.br`) |
| `ENCARREGADO_NOME`, `ENCARREGADO_EMAIL` | Contato do Encarregado de Dados (DPO) do IEMA, mostrado no Aviso de privacidade |
| `PRAZO_GUARDA` | Texto sobre o prazo de guarda dos dados no Aviso de privacidade |
| `GOVERNO`, `ORGAO`, `ALMOXARIFADO` | Textos do cabeçalho, planilhas e relatórios |

No início do `Code.gs`: `MAX_GESTORES` define o número de logins (3), `BACKUP_EMAILS` os destinatários do backup mensal e `ORGAO` o nome do órgão nos e-mails.

## Planilha Google (banco de dados)

| Aba | Conteúdo |
|---|---|
| *Catálogo* | Materiais, quantidades, limite, indisponível, oculto, imagem |
| *Pedidos* | Pedidos e andamento |
| *Histórico* | Todas as ações, com a coluna **Responsável** |
| *Imagens enviadas* | Fotos enviadas pelos gestores |
| *Configuração* | Contato do almoxarifado |

Faça as alterações pelo painel do gestor, para que fiquem registradas no histórico.
