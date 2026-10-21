# Pedidos de material – Almoxarifado IEMA

> **Endereço do site:** `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
> Esta página é o código. O site fica no endereço acima, depois de ativar o GitHub Pages (Parte 1).

## Os 7 arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | Página inicial: fazer pedido, acompanhar pedido, área do gestor |
| `solicitante.html` | Catálogo, pedido (dados obrigatórios), planilha Excel e acompanhamento. Sem login |
| `gestor.html` | Área do gestor: até 3 logins, pedidos, painel, catálogo, relatórios, histórico |
| `imagens.js` | Fotos dos materiais do Catálogo GOV ES |
| `config.js` | Configuração. É o único arquivo a editar (`API_URL`) |
| `Code.gs` | Servidor: colar no Google Apps Script |
| `README.md` | Este guia |

Não há pastas. Envie os 7 arquivos lado a lado na raiz do repositório.

## O que o sistema faz

**Solicitante (`solicitante.html`)**
- A página segue o modelo do Relatório de Itens em Estoque: materiais agrupados por natureza de despesa, com totais.
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
  - trocar a imagem: enviar foto do computador, usar a foto do catálogo ou deixar sem foto.
- **Relatórios:**
  - tipos: pedidos (resumo), pedidos por material, consumo por material, consumo por setor, posição do estoque, histórico e auditoria, pedidos excluídos;
  - filtros de período, setor, situação e natureza;
  - visualização na tela, **Excel**, **PDF** e impressão.
- **Histórico:** tudo o que aconteceu, com filtros por tipo e por responsável.
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

### Catálogo

O catálogo tem **254 materiais**:
- 136 do Relatório de Itens em Estoque de 17/10/2026;
- **118 do Catálogo GOV ES** (BrSupply), com a foto de cada item.

Do Catálogo GOV ES, foram trazidos apenas **descrição, unidade, natureza de despesa e foto**. Não foram trazidos código do item do fornecedor, NCM nem preço. Os 118 novos materiais receberam códigos internos `CAT-001` a `CAT-118`, que o gestor pode trocar em **Editar**.

- **Os novos materiais começam com quantidade 0**, porque o PDF não informa estoque. Por isso aparecem como INDISPONÍVEL até o gestor informar a quantidade em *Catálogo e estoque* (digite as quantidades, escreva o motivo e clique em **Salvar quantidades**). Também podem ser ocultados com **Visível**.
- **30 itens do PDF já existiam na lista** (açúcar, adoçante, copos, apontador, clipes, lápis, lapiseiras, grafites, envelopes, pilhas, entre outros). Eles não foram duplicados: a foto do catálogo foi vinculada ao material existente.

---

## Parte 1 – Colocar o site no ar (5 minutos)

1. Descompacte o `.zip`.
2. No GitHub, crie um repositório:
   - clique em **New**, dê um nome (ex.: `almoxarifado`), marque **Public** e clique em **Create repository**;
   - clique em **uploading an existing file**, selecione **os 7 arquivos**, arraste para a página e clique em **Commit changes**.
3. Em **Settings › Pages**, escolha *Branch* `main` e a pasta `/ (root)`, e clique em **Save**.
4. Aguarde 1 a 2 minutos. O endereço do site aparece em **Settings › Pages**, no botão **Visit site**.

O site já abre em **modo demonstração**, mas nesse modo cada computador tem uma cópia própria dos dados. **Para uso simultâneo em qualquer máquina, a Parte 2 é obrigatória.**

> **Aparece só texto?** Ou você está no endereço do repositório (`github.com/...`) em vez do site (`...github.io/...`), ou os arquivos ficaram dentro de uma pasta.
> **A página abre sem formatação?** Apague arquivos de versões antigas e suba os 7 desta versão. Depois aperte Ctrl+F5.

## Parte 2 – Ligar o banco de dados (10 minutos, uma vez só)

1. No Google Drive da conta do almoxarifado, crie uma **Planilha Google** em branco.
2. Na planilha, clique em **Extensões › Apps Script**.
3. Apague o que houver no editor, cole **todo** o conteúdo do `Code.gs` e clique em **Salvar**.
4. Volte para a planilha, recarregue a página (F5) e use **Almoxarifado › Configurar sistema (primeira vez)**:
   - autorize o acesso: *Continuar › sua conta › Avançado › Acessar (não seguro) › Permitir*;
   - cadastre o **gestor principal** (nome, usuário e senha);
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
3. No GitHub, substitua os arquivos pelos 7 desta versão. Mantenha a sua linha `API_URL` no `config.js`.

Os dados da planilha são mantidos. No primeiro acesso depois da atualização:
- os 118 materiais novos e as fotos são incluídos sozinhos;
- **a senha única antiga vira o usuário `gestor`**, com a mesma senha. Entre com ele e cadastre os demais logins.

---

## Gestores e senhas

- **Até 3 logins.** O primeiro é o **gestor principal**: cadastra e remove logins e redefine senhas. Todos atendem pedidos, alteram o catálogo e geram relatórios, inclusive ao mesmo tempo.
- **Senhas seguras:** ficam no servidor (Google) como código cifrado. Nunca aparecem no HTML nem no GitHub.
- **Manter conectado:** ao entrar, marque **Manter conectado neste computador** para não precisar digitar a senha por 30 dias. Sem essa opção, a sessão dura 10 horas.
- **Login removido:** quem teve o login removido perde o acesso na hora, em todos os computadores.
- **Esqueceu a senha?**
  - O gestor principal redefine pela aba *Gestores e contato*.
  - Se for o próprio principal, use **Almoxarifado › Redefinir a senha de um gestor**, na planilha.
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

No início do `Code.gs`, `MAX_GESTORES` define o número de logins (3).

## Planilha Google (banco de dados)

| Aba | Conteúdo |
|---|---|
| *Catálogo* | Materiais, quantidades, limite, indisponível, oculto, imagem |
| *Pedidos* | Pedidos e andamento |
| *Histórico* | Todas as ações, com a coluna **Responsável** |
| *Imagens enviadas* | Fotos enviadas pelos gestores |
| *Configuração* | Contato do almoxarifado |

Faça as alterações pelo painel do gestor, para que fiquem registradas no histórico.
