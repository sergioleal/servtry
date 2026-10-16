// Descrição das 7 entidades para a tela genérica de cadastro.
// `ref` aponta para outra entidade; `label` diz como mostrar um registro dela.
// `options` aceita valores simples ou pares [valor, texto].
export const entities = {
  livros: {
    title: 'Livros',
    label: (r) => r.titulo,
    fields: [
      { name: 'titulo', label: 'Título', required: true },
      { name: 'isbn', label: 'ISBN' },
      { name: 'ano_publicacao', label: 'Ano', type: 'number' },
      { name: 'autor_id', label: 'Autor', ref: 'autores', required: true },
      { name: 'editora_id', label: 'Editora', ref: 'editoras' },
      { name: 'categoria_id', label: 'Categoria', ref: 'categorias' },
    ],
  },
  exemplares: {
    title: 'Exemplares',
    label: (r) => r.codigo,
    fields: [
      { name: 'livro_id', label: 'Livro', ref: 'livros', required: true },
      { name: 'codigo', label: 'Código', required: true },
      { name: 'localizacao', label: 'Localização' },
      {
        name: 'situacao',
        label: 'Situação',
        options: ['disponivel', 'emprestado', 'manutencao', 'perdido'],
        // 'emprestado' só muda pelas telas de empréstimo/devolução.
        lockedOptions: ['emprestado'],
        default: 'disponivel',
      },
    ],
  },
  emprestimos: {
    title: 'Empréstimos',
    label: (r) => `#${r.id}`,
    fields: [
      { name: 'exemplar_id', label: 'Exemplar', ref: 'exemplares', required: true, createOnly: true },
      { name: 'leitor_id', label: 'Leitor', ref: 'leitores', required: true, createOnly: true },
      { name: 'data_emprestimo', label: 'Empréstimo', type: 'date', createOnly: true },
      { name: 'data_prevista', label: 'Prazo', type: 'date', required: true },
      { name: 'data_devolucao', label: 'Devolução', type: 'date', readOnly: true },
    ],
  },
  leitores: {
    title: 'Leitores',
    label: (r) => r.nome,
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'telefone', label: 'Telefone' },
      { name: 'data_cadastro', label: 'Cadastro', type: 'date' },
      { name: 'ativo', label: 'Ativo', options: [[1, 'Sim'], [0, 'Não']], default: 1 },
    ],
  },
  autores: {
    title: 'Autores',
    label: (r) => r.nome,
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'nacionalidade', label: 'Nacionalidade' },
      { name: 'data_nascimento', label: 'Nascimento', type: 'date' },
    ],
  },
  editoras: {
    title: 'Editoras',
    label: (r) => r.nome,
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'cidade', label: 'Cidade' },
      { name: 'site', label: 'Site' },
    ],
  },
  categorias: {
    title: 'Categorias',
    label: (r) => r.nome,
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'descricao', label: 'Descrição' },
    ],
  },
}
