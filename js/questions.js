// Pares pergunta/resposta baseados no slide "Banco Orientado a Documentos - MongoDB".
// Cada par tem o mesmo "pair" nos dois lados — é isso que o jogo valida ao ligar os fios.
export const QUESTIONS = [
  { pair: 1, question: "O que é um Banco de Documentos?", answer: "Banco NoSQL que guarda dados em documentos JSON/BSON" },
  { pair: 2, question: "Tabela, no mundo SQL", answer: "Coleção (Collection) no MongoDB" },
  { pair: 3, question: "Linha / Registro, no mundo SQL", answer: "Documento (Document) no MongoDB" },
  { pair: 4, question: "Coluna, no mundo SQL", answer: "Campo (Field) no MongoDB" },
  { pair: 5, question: "O que significa JSON?", answer: "JavaScript Object Notation" },
  { pair: 6, question: "Vantagem: Esquema Flexível", answer: "Documentos da mesma coleção podem ter campos diferentes" },
  { pair: 7, question: "Desvantagem: Duplicação de Dados", answer: "Agrupar dados pode gerar redundância" },
  { pair: 8, question: "Melhor uso do MongoDB", answer: "Dados variáveis e grande escala web" },
  { pair: 9, question: "Melhor uso do banco relacional (SQL)", answer: "Transações complexas e ACID rigoroso" },
  { pair: 10, question: "Sharding", answer: "Escalabilidade horizontal nativa do MongoDB" },
];
