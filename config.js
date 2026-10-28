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

  /* De quantos em quantos segundos as páginas dos gestores verificam se houve pedido novo ou alteração (tempo real). */
  ATUALIZAR_A_CADA: 6,

  /* Textos do cabeçalho e das planilhas. */
  GOVERNO: "Governo do Estado do Espírito Santo",
  ORGAO: "IEMA - Instituto Estadual de Meio Ambiente",
  ALMOXARIFADO: "Almoxarifado IEMA",

  /* Aviso institucional exibido na página inicial e no topo da página de pedidos. */
  AVISO_SIADES_TITULO: "Catálogo para consulta e pré-aprovação",
  AVISO_SIADES: "Prezado(a) servidor(a), informamos que este catálogo destina-se à consulta da disponibilidade de materiais e à pré-aprovação dos pedidos pelo Almoxarifado.",

  /* Pedidos só com e-mail institucional deste domínio (qualquer nome antes do @).
     A mesma regra está no Code.gs (DOMINIO_EMAIL), que é quem realmente bloqueia. */
  DOMINIO_EMAIL: "iema.es.gov.br",

  /* LGPD – Aviso de privacidade da página de pedidos.
     Preencha com o contato do Encarregado pelo Tratamento de Dados Pessoais (DPO) do IEMA. */
  ENCARREGADO_NOME: "",
  ENCARREGADO_EMAIL: "",
  /* Por quanto tempo os pedidos ficam guardados (texto mostrado no aviso). */
  PRAZO_GUARDA: "pelo prazo previsto na Tabela de Temporalidade de Documentos aplicável ao IEMA",

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
