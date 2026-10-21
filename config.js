/* =====================================================================
   CONFIGURAÇÃO – ALMOXARIFADO IEMA
   Único arquivo que precisa ser editado no GitHub.
   ===================================================================== */
window.CONFIG = {

  /* Cole entre as aspas a URL do "App da Web" do Google Apps Script (termina em /exec).
     Enquanto estiver vazio, o sistema funciona em MODO DEMONSTRAÇÃO (dados só neste navegador). */
  API_URL: "https://script.google.com/macros/s/AKfycbzO5WicE9EZIt6EuZspvjUWMT-ftNWgDDQ4Fhblw_AZWTaujuEwEvuHWkUNermAWoA6XQ/exec",

  /* Itens com esta quantidade ou menos aparecem como "estoque baixo" para o gestor. */
  ESTOQUE_BAIXO: 10,

  /* De quantos em quantos segundos as páginas dos gestores verificam se houve pedido novo ou alteração (tempo real). */
  ATUALIZAR_A_CADA: 6,

  /* Textos do cabeçalho e das planilhas. */
  GOVERNO: "Governo do Estado do Espírito Santo",
  ORGAO: "IEMA – Instituto Estadual de Meio Ambiente e Recursos Hídricos",
  ALMOXARIFADO: "Almoxarifado IEMA",

  /* Lista suspensa de setores (siglas da planilha "Siglas dos Setores").
     Para incluir ou retirar um setor, edite esta lista. */
  SETORES: [
    "APACB", "APAGO", "APAGUA", "APAPE", "APAPM", "APAS", "ARIEMV", "ASSCOM",
    "ASSJUR", "CONADM", "DIAF", "DILCAM", "DISPN", "GEA", "GEAD", "GECAM",
    "GEDOC", "GEFIN", "GEIC", "GEOCIP", "GEPREVINES", "GEPRO", "GEREF", "GESIM",
    "GFAU", "GFI", "GGEP", "GGUC", "GP", "GQA", "GTI", "MONACP",
    "MONAFF", "MONAST", "PECF", "PEFG", "PEI", "PEMF", "PEPAZ", "PEPCV",
    "RDSCO", "REBIODB", "SUAP", "SUBAD", "SUBCON", "SUBEC", "SUBED", "SUBEI",
    "SUBEUC", "SUBFAU", "SUBIO", "SUBMIN", "SUBOC", "SUBOR", "SUBPOI", "SUBSAN",
    "SUBSID", "SUCOP", "SUFAM", "SUGEO", "SUPAT"
  ]
};
