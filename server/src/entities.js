// Campos editáveis de cada entidade (a coluna `id` é sempre gerada pelo banco).
export const entities = {
  autores: ['nome', 'nacionalidade', 'data_nascimento'],
  editoras: ['nome', 'cidade', 'site'],
  categorias: ['nome', 'descricao'],
  livros: ['titulo', 'isbn', 'ano_publicacao', 'autor_id', 'editora_id', 'categoria_id'],
  exemplares: ['livro_id', 'codigo', 'localizacao', 'situacao'],
  leitores: ['nome', 'email', 'telefone', 'data_cadastro', 'ativo'],
  emprestimos: ['exemplar_id', 'leitor_id', 'data_emprestimo', 'data_prevista', 'data_devolucao'],
};
