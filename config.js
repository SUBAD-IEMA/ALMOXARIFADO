/* =====================================================================
   CONFIGURAÇÃO – ALMOXARIFADO IEMA
   Único arquivo que precisa ser editado no GitHub.
   ===================================================================== */
window.CONFIG = {

  /* Cole entre as aspas a URL do "App da Web" do Google Apps Script (termina em /exec).
     Enquanto estiver vazio, o sistema funciona em MODO DEMONSTRAÇÃO (dados só neste navegador). */
  API_URL: "",

  /* Itens com esta quantidade ou menos aparecem como "estoque baixo" para o gestor. */
  ESTOQUE_BAIXO: 10,

  /* De quantos em quantos segundos o painel do gestor verifica se chegaram pedidos novos. */
  ATUALIZAR_A_CADA: 10,

  /* Textos do cabeçalho e das planilhas. */
  GOVERNO: "Governo do Estado do Espírito Santo",
  ORGAO: "IEMA – Instituto Estadual de Meio Ambiente e Recursos Hídricos",
  ALMOXARIFADO: "Almoxarifado IEMA",

  /* Sugestões de setor no formulário (o solicitante pode digitar outro). */
  SETORES: [
    "Gabinete", "Diretoria Técnica", "Diretoria Administrativa e Financeira",
    "Gerência de Recursos Humanos", "Gerência de Licenciamento", "Gerência de Fiscalização",
    "Gerência de Recursos Hídricos", "Gerência de Educação Ambiental",
    "Gerência de Tecnologia da Informação", "Protocolo", "Almoxarifado e Patrimônio"
  ]
};
