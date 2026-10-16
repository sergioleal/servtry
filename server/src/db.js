import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS autores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  nacionalidade TEXT,
  data_nascimento TEXT
);
CREATE TABLE IF NOT EXISTS editoras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cidade TEXT,
  site TEXT
);
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT
);
CREATE TABLE IF NOT EXISTS livros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  isbn TEXT UNIQUE,
  ano_publicacao INTEGER,
  autor_id INTEGER NOT NULL REFERENCES autores(id),
  editora_id INTEGER REFERENCES editoras(id),
  categoria_id INTEGER REFERENCES categorias(id)
);
CREATE TABLE IF NOT EXISTS exemplares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  livro_id INTEGER NOT NULL REFERENCES livros(id),
  codigo TEXT NOT NULL UNIQUE,
  localizacao TEXT,
  situacao TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (situacao IN ('disponivel', 'emprestado', 'manutencao', 'perdido'))
);
CREATE TABLE IF NOT EXISTS leitores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE,
  telefone TEXT,
  data_cadastro TEXT NOT NULL DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS emprestimos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exemplar_id INTEGER NOT NULL REFERENCES exemplares(id),
  leitor_id INTEGER NOT NULL REFERENCES leitores(id),
  data_emprestimo TEXT NOT NULL DEFAULT (date('now')),
  data_prevista TEXT NOT NULL,
  data_devolucao TEXT
);
`;

// Colunas criadas depois da primeira versão. Bancos antigos recebem
// ALTER TABLE ADD COLUMN, preservando os dados; bancos novos também.
const NEW_COLUMNS = [
  ['leitores', 'ativo', 'INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))'],
  ['emprestimos', 'renovacoes', 'INTEGER NOT NULL DEFAULT 0'],
];

function migrate(db) {
  for (const [table, column, definition] of NEW_COLUMNS) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function openDb(file = process.env.DB_FILE ?? 'biblioteca.db') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
