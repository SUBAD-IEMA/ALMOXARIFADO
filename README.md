# Pedidos de material – Almoxarifado IEMA

> **Endereço do site:** `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
> Esta página que você está lendo é o código. O site fica no endereço acima, depois de ativar o GitHub Pages (Parte 1).

## Páginas

| Arquivo | Quem usa | Para quê |
|---|---|---|
| `index.html` | Todos | Página inicial com três atalhos: fazer pedido, acompanhar pedido e área do gestor. |
| `solicitante.html` | Servidores, sem login | Ver o catálogo, fazer o pedido, baixar a planilha Excel e acompanhar o andamento. |
| `gestor.html` | Gestor, com senha | Receber e atender pedidos, controlar o estoque, cadastrar materiais e ver o histórico. |

**Na página do solicitante:**
- O catálogo mostra cada material com foto, descrição, quantidade disponível e limite por pedido. Os materiais indisponíveis aparecem como **INDISPONÍVEL** e não podem ser pedidos.
- O servidor informa os seus dados, marca os materiais e digita as quantidades. O sistema não aceita mais do que o disponível nem mais do que o limite por pedido.
- Ao clicar em **Enviar pedido**:
  - o pedido recebe um número único (ex.: `2026-00001`);
  - aparece na hora para o gestor;
  - a planilha Excel do pedido é baixada, com as fotos dos materiais.
- Em **Acompanhar pedido**, o servidor informa o número e o e-mail usado no pedido para ver a situação e o andamento.

**Na área do gestor:**
- A senha fica guardada no servidor (Google), nunca no código do site. Ela vale em qualquer computador.
- Pedidos novos aparecem automaticamente, em até 10 segundos.
- Ao passar o mouse sobre um pedido aparecem os dados do solicitante, os materiais com fotos e as quantidades.
- Cada pedido pode ser **aprovado**, **atendido por completo**, **atendido em parte** ou **recusado**.
- Na aba **Catálogo e estoque**:
  - alterar quantidades, informando o motivo;
  - marcar materiais como **INDISPONÍVEL**;
  - cadastrar materiais novos;
  - editar descrição, unidade, natureza, limite por pedido e imagem (enviar foto do computador, colar um endereço ou escolher uma foto na busca);
  - as mudanças aparecem na página do solicitante em segundos.
- A aba **Histórico** registra tudo: pedidos, aprovações, atendimentos, recusas, ajustes de estoque, cadastros e alterações. Pode ser exportada para Excel.

### Situações do pedido

| Situação | Significado | Estoque |
|---|---|---|
| Pendente | Pedido recebido, aguardando o gestor | As quantidades ficam **reservadas** (saem do disponível) |
| Aprovado | O gestor aprovou, aguardando a entrega | Continua reservado |
| Atendido | Tudo foi entregue | Baixa definitiva |
| Parcialmente atendido | Parte foi entregue | O que não foi entregue **volta** ao estoque |
| Recusado | O gestor recusou e informou o motivo | Tudo **volta** ao estoque |

---

## Parte 1 – Colocar o site no ar (5 minutos)

1. Descompacte o arquivo `.zip` no seu computador.
2. No GitHub, crie um repositório novo: botão **New**, dê um nome (ex.: `almoxarifado`), marque **Public** e clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Abra a pasta descompactada, selecione **os 6 arquivos** (`index.html`, `solicitante.html`, `gestor.html`, `config.js`, `Code.gs` e `README.md`) e arraste para o GitHub. Também pode usar *choose your files* e selecionar os 6. Não há pastas: cada página já leva o próprio visual e o próprio código.
5. Clique em **Commit changes**.
6. Vá em **Settings › Pages**. Em *Branch*, escolha `main` e a pasta `/ (root)`, e clique em **Save**.
7. Aguarde 1 a 2 minutos e recarregue a página de **Settings › Pages**. O endereço do site aparece no topo, com o botão **Visit site**.

> **Aparece só texto, como se fosse o README?**
> - Ou você está no endereço do **repositório** (`github.com/...`) em vez do **site** (`...github.io/...`).
> - Ou os arquivos ficaram dentro de uma pasta. Na lista principal do repositório, os 6 arquivos precisam aparecer lado a lado.
>
> **A página abre sem formatação?** Você provavelmente está usando arquivos de uma versão antiga, que dependia da pasta `assets`. Apague os arquivos antigos do repositório e suba os 6 arquivos desta versão. Depois force a atualização no navegador com Ctrl+F5.

O site já funciona em **modo demonstração**. Para testar:
1. Abra `gestor.html` e crie uma senha.
2. Clique em **Carregar catálogo**.
3. Faça um pedido em `solicitante.html`.

Nesse modo, os dados ficam **só no navegador** em que foram criados.

## Parte 2 – Ligar o banco de dados (10 minutos, uma vez só)

Essa parte é o que permite usar o sistema **em vários computadores ao mesmo tempo**. Os dados ficam numa Planilha Google da sua conta.

1. Abra o Google Drive com a conta do almoxarifado e crie uma **Planilha Google** em branco. Dê um nome, por exemplo `Banco – Almoxarifado IEMA`.
2. Na planilha, clique em **Extensões › Apps Script**.
3. Apague o que estiver no editor e cole **todo** o conteúdo do arquivo `Code.gs` deste repositório. Clique no ícone de **Salvar**.
4. Volte para a aba da planilha e recarregue a página (F5). Aparece o menu **Almoxarifado**.
5. Clique em **Almoxarifado › Configurar sistema (primeira vez)**:
   - O Google pede autorização. Clique em *Continuar*, escolha a sua conta, depois *Avançado › Acessar … (não seguro)* e por fim *Permitir*. O aviso aparece porque o script é seu e ainda não foi verificado pelo Google.
   - Defina a **senha do gestor**, com pelo menos 8 caracteres.
   - O catálogo com os 136 materiais é carregado automaticamente.
6. Volte ao Apps Script e clique em **Implantar › Nova implantação**:
   - na engrenagem de *Selecionar tipo*, escolha **App da Web**;
   - *Executar como*: **Eu**;
   - *Quem pode acessar*: **Qualquer pessoa**;
   - clique em **Implantar** e **copie a URL**, que termina em `/exec`.
7. Ligue o site à planilha. O jeito mais fácil:
   - abra a área do gestor do seu site (`gestor.html`), ainda em modo demonstração;
   - cole a URL no quadro **Ligar ao banco de dados** e clique em **Testar**;
   - clique em **Abrir config.js no GitHub para editar**;
   - troque a linha `API_URL: "",` pela linha mostrada e clique em **Commit changes**.

   Se preferir fazer à mão: no GitHub, abra `config.js`, clique no lápis e cole a URL entre as aspas:
   ```js
   API_URL: "https://script.google.com/macros/s/AKfy.../exec",
   ```
8. Aguarde 1 a 2 minutos. Abra `gestor.html`, entre com a senha definida no passo 5 e preencha **Meus dados**. Pronto.

Para os servidores, compartilhe o endereço do site ou direto `.../solicitante.html`.

> **Alterou o `Code.gs` depois?** No Apps Script, vá em **Implantar › Gerenciar implantações**, clique no lápis, escolha **Versão: Nova versão** e clique em **Implantar**. A URL continua a mesma, então não é preciso mudar o `config.js`.

---

## Senha do gestor

- A senha fica nas propriedades do Apps Script, **no servidor**. Ela não está no HTML nem no GitHub.
- Vale em qualquer navegador e computador. Ao entrar, marque **Manter conectado neste computador** para não precisar digitar de novo por 30 dias. Sem essa opção, a sessão dura 10 horas.
- Para trocar a senha, use a aba **Meus dados e senha** do painel ou o menu **Almoxarifado › Definir ou trocar a senha do gestor** na planilha. Ao trocar, todos os computadores conectados são desconectados.
- Esqueceu a senha? Defina outra pelo menu da planilha. Só quem tem acesso à planilha consegue fazer isso.
- Depois de 8 tentativas erradas, o acesso fica bloqueado por 10 minutos.

## E-mails automáticos

Com o banco ligado, o solicitante recebe um e-mail quando o pedido é registrado (com cópia para o gestor) e outro quando a situação muda. O e-mail traz o link para acompanhar o pedido.

- Para desligar, mude `ENVIAR_EMAIL` para `false` no início do `Code.gs` e publique uma nova versão.
- Limite do Google: cerca de 100 e-mails por dia em contas Gmail e 1.500 em contas Google Workspace.

## Configurações (`config.js`)

| Opção | Para que serve |
|---|---|
| `API_URL` | Endereço do App da Web. Vazio = modo demonstração. |
| `ESTOQUE_BAIXO` | A partir de quantas unidades o material aparece como "estoque baixo" no painel. |
| `ATUALIZAR_A_CADA` | De quantos em quantos segundos o painel verifica se há pedidos novos. |
| `SETORES` | Setores sugeridos no formulário. |
| `GOVERNO`, `ORGAO`, `ALMOXARIFADO` | Textos do cabeçalho e das planilhas. |

## Imagens dos materiais

A imagem de cada material segue esta ordem de preferência:

1. foto enviada pelo gestor;
2. endereço de imagem informado pelo gestor;
3. foto automática do **Wikimedia Commons** (acervo aberto), buscada com os "termos para a foto automática" do material;
4. desenho genérico.

As imagens são ilustrativas. Na planilha Excel do pedido, cada material aparece com a sua imagem. Se alguma imagem externa não puder ser copiada, a célula mostra "(sem imagem)".

## Estrutura

```
index.html        página inicial
solicitante.html  catálogo, pedido e acompanhamento
gestor.html       área do gestor
config.js         configuração (API_URL) – o único arquivo a editar
Code.gs           servidor: colar no Google Apps Script
README.md         este guia
```

Cada página HTML já contém o visual e todas as bibliotecas usadas: ExcelJS 4.4.0, jsPDF 2.5.1, jsPDF-AutoTable 3.8.2 e Chart.js 4.4.1. Por isso as páginas são maiores (até cerca de 1,7 MB), mas não dependem de pastas nem de outros sites para funcionar. A exceção são as fotos automáticas e a fonte, que vêm da internet.

Na Planilha Google, as abas *Catálogo*, *Pedidos*, *Histórico*, *Imagens enviadas* e *Configuração* podem ser consultadas e filtradas. Faça as alterações pelo painel do gestor, para que tudo fique registrado no histórico.
