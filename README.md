# Pedidos de material – IEMA - Instituto Estadual de Meio Ambiente

> **Endereço do site:** `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
> Esta página é o código. O site fica no endereço acima, depois de ativar o GitHub Pages (Parte 1).

## Os 8 arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | Página inicial: fazer pedido, acompanhar pedido, área do gestor |
| `solicitante.html` | Catálogo, pedido (dados obrigatórios), planilha Excel e acompanhamento. Sem login |
| `gestor.html` | Área do gestor: até 3 logins, pedidos, painel, catálogo, relatórios, histórico |
| `imagens.js` | Miniaturas das fotos do Catálogo GOV ES (carregam com a página) |
| `imagens-hd.js` | Imagens em alta resolução (400×400), carregadas em segundo plano para o painel lateral e a ampliação |
| `config.js` | Configuração. É o único arquivo a editar (`API_URL`) |
| `Code.gs` | Servidor: colar no Google Apps Script |
| `README.md` | Este guia |

Não há pastas. Envie os 8 arquivos lado a lado na raiz do repositório.

Todas as páginas têm o nome do órgão, **IEMA - Instituto Estadual de Meio Ambiente**, e o logotipo oficial (Governo do Estado do Espírito Santo, Secretaria do Meio Ambiente e Recursos Hídricos e IEMA). O nome também aparece no título das abas do navegador, nas planilhas Excel, nos PDFs e nos e-mails.

## O que o sistema faz

**Solicitante (`solicitante.html`)**
- A página segue o modelo do Relatório de Itens em Estoque: materiais agrupados por natureza de despesa, com totais. No cabeçalho aparece só a data e hora de acesso.
- Os materiais do catálogo do fornecedor mostram a foto do produto; os demais ficam em branco até o almoxarifado inserir a imagem. Ao passar o mouse sobre o quadrinho, o painel lateral mostra a imagem em alta resolução e os detalhes do material.
- Nome completo, setor (lista suspensa de siglas), telefone e e-mail são obrigatórios.
- Não aceita materiais indisponíveis nem quantidade acima do disponível ou do limite por pedido.
- Os materiais ocultados pelo gestor não aparecem.
- Ao clicar em **Enviar pedido**:
  - o pedido recebe um número único;
  - aparece na hora para os gestores;
  - a planilha Excel do pedido é baixada, com as imagens.
- **Acompanhar pedido:** informe o número e o e-mail usado no pedido.
- **E-mails automáticos** a cada pedido e a cada mudança de situação. São somente para consulta e não podem ser respondidos (veja "E-mails").

**Gestor (`gestor.html`)**
- **Até 3 logins** (usuário e senha), que podem usar o sistema **ao mesmo tempo** em computadores diferentes. As telas se atualizam sozinhas a cada 6 segundos.
- Cada ação fica no histórico com o nome de quem fez.
- **Pedidos:**
  - aprovar, atender tudo, atender em parte ou recusar;
  - baixar Excel ou PDF e imprimir;
  - **excluir pedido**, com motivo obrigatório. A exclusão fica no histórico com o nome do gestor, a data e o horário. Pedidos pendentes ou aprovados devolvem as quantidades ao estoque.
- **Visão geral:** indicadores e gráficos com **filtros** de período (incluindo datas escolhidas), setor, situação e natureza de despesa.
- **Catálogo e estoque:**
  - **Visível**: desligado, o material some da página de pedidos;
  - **Indisponível**: ligado, o material aparece marcado como INDISPONÍVEL;
  - alterar quantidades (com motivo);
  - cadastrar, editar ou remover materiais;
  - **inserir, trocar ou retirar a imagem** de cada material: clique na imagem do material na lista. Dá para escolher o arquivo, arrastar a foto ou colar com Ctrl+V. O sistema recorta as bordas e ajusta qualquer foto ao quadrinho padrão de 600×600, com fundo branco. Também há o botão **Usar a imagem padrão do catálogo**.
- **Relatórios:**
  - tipos: pedidos (resumo), pedidos por material, consumo por material, consumo por setor, posição do estoque, histórico e auditoria, pedidos excluídos;
  - filtros de período, setor, situação e natureza;
  - visualização na tela, **Excel**, **PDF** e impressão.
- **Histórico:** tudo o que aconteceu, com filtros por tipo e por responsável. Nesta versão o histórico começa **zerado**. Depois disso, só o gestor principal pode zerar de novo, pelo botão **Zerar histórico**. Fica um registro com o nome de quem zerou e quando.
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
   - clique em **uploading an existing file**, selecione **os 8 arquivos**, arraste para a página e clique em **Commit changes**.
3. Em **Settings › Pages**, escolha *Branch* `main` e a pasta `/ (root)`, e clique em **Save**.
4. Aguarde 1 a 2 minutos. O endereço do site aparece em **Settings › Pages**, no botão **Visit site**.

O site já abre em **modo demonstração**, mas nesse modo cada computador tem uma cópia própria dos dados. **Para uso simultâneo em qualquer máquina, a Parte 2 é obrigatória.**

> **Aparece só texto?** Ou você está no endereço do repositório (`github.com/...`) em vez do site (`...github.io/...`), ou os arquivos ficaram dentro de uma pasta.
> **A página abre sem formatação?** Apague arquivos de versões antigas e suba os 8 desta versão. Depois aperte Ctrl+F5.

## Parte 2 – Ligar o banco de dados (10 minutos, uma vez só)

1. No Google Drive da conta do almoxarifado, crie uma **Planilha Google** em branco.
2. Na planilha, clique em **Extensões › Apps Script**.
3. Apague o que houver no editor, cole **todo** o conteúdo do `Code.gs` e clique em **Salvar**.
4. Volte para a planilha, recarregue a página (F5) e use **Almoxarifado › Configurar sistema (primeira vez)**:
   - autorize o acesso: *Continuar › sua conta › Avançado › Acessar (não seguro) › Permitir*;
   - cadastre o **gestor principal**: nome, usuário, senha e **e-mail** (usado para recuperar a senha);
   - o catálogo de 254 materiais é carregado automaticamente.
5. No Apps Script, clique em **Implantar › Nova implantação**:
   - escolha **App da Web**;
   - em *Executar como*, escolha **Eu**;
   - em *Quem pode acessar*, escolha **Qualquer pessoa**;
   - clique em **Implantar** e copie a URL, que termina em `/exec`.
6. Abra `gestor.html`, cole a URL no quadro **Ligar ao banco de dados**, clique em **Testar** e depois em **Abrir config.js no GitHub**. Troque a linha `API_URL: "",` e clique em **Commit changes**.
7. Aguarde 1 a 2 minutos. Entre na área do gestor com o usuário e a senha do gestor principal.
8. Na aba **Gestores e contato**, cadastre os outros 2 gestores, se houver, e preencha o contato do almoxarifado.

Quando o aviso amarelo de "Modo demonstração" sumir das páginas, o sistema está compartilhado por todas as máquinas.

### Atualizar uma instalação que já existe

1. No Apps Script, apague o código antigo, cole o `Code.gs` novo e salve.
2. Publique a versão nova: **Implantar › Gerenciar implantações › lápis › Versão: Nova versão › Implantar**. A URL não muda.
3. No GitHub, substitua os arquivos pelos 8 desta versão. Mantenha a sua linha `API_URL` no `config.js`.

Os dados da planilha são mantidos. No primeiro acesso depois da atualização:
- os 118 materiais novos e as fotos são incluídos sozinhos;
- **a senha única antiga vira o usuário `gestor`**, com a mesma senha. Entre com ele e cadastre os demais logins.
- as imagens aproximadas colocadas pela versão anterior nos materiais fora do Catálogo GOV ES são retiradas, e esses quadrinhos ficam em branco. As imagens que o gestor já tinha inserido ou trocado são mantidas.
- **o histórico é zerado uma única vez**;
- gestores cadastrados antes desta versão não têm e-mail. Cada um deve cadastrar o seu em *Gestores e contato › Meu e-mail de recuperação*, ou o gestor principal pode usar **Alterar e-mail**.

---

## Gestores e senhas

- **Até 3 logins.** O primeiro é o **gestor principal**: cadastra e remove logins e redefine senhas. Todos atendem pedidos, alteram o catálogo e geram relatórios, inclusive ao mesmo tempo.
- **Senhas seguras:** ficam no servidor (Google) como código cifrado. Nunca aparecem no HTML nem no GitHub.
- **Manter conectado:** ao entrar, marque **Manter conectado neste computador** para não precisar digitar a senha por 30 dias. Sem essa opção, a sessão dura 10 horas.
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

**As fotos não aparecem**
Confira se o arquivo `imagens.js` foi enviado ao repositório, na raiz, junto com os outros.

## Configurações (`config.js`)

| Opção | Para que serve |
|---|---|
| `API_URL` | Endereço do App da Web. Vazio = modo demonstração |
| `ESTOQUE_BAIXO` | A partir de quantas unidades o material aparece como estoque baixo |
| `ATUALIZAR_A_CADA` | Intervalo (segundos) da atualização em tempo real (padrão 6) |
| `SETORES` | Lista suspensa de setores (siglas) |
| `GOVERNO`, `ORGAO`, `ALMOXARIFADO` | Textos do cabeçalho, planilhas e relatórios |

No início do `Code.gs`, `MAX_GESTORES` define o número de logins (3) e `ORGAO` o nome do órgão nos e-mails.

## Planilha Google (banco de dados)

| Aba | Conteúdo |
|---|---|
| *Catálogo* | Materiais, quantidades, limite, indisponível, oculto, imagem |
| *Pedidos* | Pedidos e andamento |
| *Histórico* | Todas as ações, com a coluna **Responsável** |
| *Imagens enviadas* | Fotos enviadas pelos gestores |
| *Configuração* | Contato do almoxarifado |

Faça as alterações pelo painel do gestor, para que fiquem registradas no histórico.
