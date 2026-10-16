import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { entities } from './entities.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Mantém só os campos conhecidos e troca string vazia por null.
function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body?.[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

function insert(db, table, data) {
  const cols = Object.keys(data);
  if (cols.length === 0) throw new HttpError(400, 'Nenhum campo informado');
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  const { lastInsertRowid } = db.prepare(sql).run(...Object.values(data));
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(lastInsertRowid);
}

function update(db, table, id, data) {
  const cols = Object.keys(data);
  if (cols.length > 0) {
    const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...Object.values(data), id);
  }
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// `validate(data, atual)` roda antes de gravar; `atual` só existe no PUT.
function crudRouter(db, table, fields, { validate } = {}) {
  const router = express.Router();
  const find = (id) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row) throw new HttpError(404, 'Registro não encontrado');
    return row;
  };

  router.get('/', (req, res) => {
    res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
  });
  router.get('/:id', (req, res) => res.json(find(req.params.id)));
  router.post('/', (req, res) => {
    const data = pick(req.body, fields);
    validate?.(data);
    res.status(201).json(insert(db, table, data));
  });
  router.put('/:id', (req, res) => {
    const data = pick(req.body, fields);
    validate?.(data, find(req.params.id));
    res.json(update(db, table, req.params.id, data));
  });
  router.delete('/:id', (req, res) => {
    find(req.params.id);
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  });
  return router;
}

// A situação 'emprestado' é controlada só pelas rotas de empréstimo e devolução.
function validarExemplar(db) {
  return (data, atual) => {
    if (data.situacao === undefined || data.situacao === atual?.situacao) return;
    if (data.situacao === 'emprestado') {
      throw new HttpError(409, "A situação 'emprestado' só é definida ao registrar um empréstimo");
    }
    const aberto = atual && db
      .prepare('SELECT id FROM emprestimos WHERE exemplar_id = ? AND data_devolucao IS NULL')
      .get(atual.id);
    if (aberto) {
      throw new HttpError(409, `Exemplar ${atual.codigo} está no empréstimo #${aberto.id}; registre a devolução antes de mudar a situação`);
    }
  };
}

// Aceita true/false além de 0/1 (o SQLite não grava booleanos).
function validarLeitor(data) {
  if (typeof data.ativo === 'boolean') data.ativo = Number(data.ativo);
}

const LIMITE_EMPRESTIMOS = 3;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function validarPrazo(dataEmprestimo, dataPrevista) {
  if (!dataPrevista) throw new HttpError(400, 'Informe o prazo (data_prevista)');
  if (!DATA.test(dataPrevista)) throw new HttpError(400, 'Prazo inválido; use AAAA-MM-DD');
  if (dataPrevista < dataEmprestimo) {
    throw new HttpError(400, `O prazo (${dataPrevista}) não pode ser anterior ao empréstimo (${dataEmprestimo})`);
  }
}

// Empréstimos têm regras próprias: só empresta exemplar disponível
// e a devolução libera o exemplar de novo.
function emprestimosRouter(db) {
  const router = express.Router();
  const fields = entities.emprestimos.filter((f) => f !== 'data_devolucao');

  router.post('/', (req, res) => {
    const data = pick(req.body, fields);
    data.data_emprestimo ??= db.prepare("SELECT date('now', 'localtime') AS hoje").get().hoje;
    if (!DATA.test(data.data_emprestimo)) throw new HttpError(400, 'Data do empréstimo inválida; use AAAA-MM-DD');
    validarPrazo(data.data_emprestimo, data.data_prevista);
    const emprestimo = transaction(db, () => {
      const leitor = db.prepare('SELECT * FROM leitores WHERE id = ?').get(data.leitor_id);
      if (!leitor) throw new HttpError(400, 'Leitor não encontrado');
      if (!leitor.ativo) throw new HttpError(409, `Leitor ${leitor.nome} está inativo e não pode pegar empréstimos`);
      const { abertos } = db
        .prepare('SELECT count(*) AS abertos FROM emprestimos WHERE leitor_id = ? AND data_devolucao IS NULL')
        .get(leitor.id);
      if (abertos >= LIMITE_EMPRESTIMOS) {
        throw new HttpError(409, `Leitor ${leitor.nome} já tem ${abertos} empréstimos abertos (limite: ${LIMITE_EMPRESTIMOS})`);
      }
      const exemplar = db.prepare('SELECT * FROM exemplares WHERE id = ?').get(data.exemplar_id);
      if (!exemplar) throw new HttpError(400, 'Exemplar não encontrado');
      if (exemplar.situacao !== 'disponivel') {
        throw new HttpError(409, `Exemplar ${exemplar.codigo} não está disponível (${exemplar.situacao})`);
      }
      const row = insert(db, 'emprestimos', data);
      db.prepare("UPDATE exemplares SET situacao = 'emprestado' WHERE id = ?").run(exemplar.id);
      return row;
    });
    res.status(201).json(emprestimo);
  });

  router.post('/:id/devolucao', (req, res) => {
    const emprestimo = transaction(db, () => {
      const row = db.prepare('SELECT * FROM emprestimos WHERE id = ?').get(req.params.id);
      if (!row) throw new HttpError(404, 'Registro não encontrado');
      if (row.data_devolucao) throw new HttpError(409, 'Empréstimo já devolvido');
      db.prepare("UPDATE emprestimos SET data_devolucao = date('now') WHERE id = ?").run(row.id);
      db.prepare("UPDATE exemplares SET situacao = 'disponivel' WHERE id = ?").run(row.exemplar_id);
      return db.prepare('SELECT * FROM emprestimos WHERE id = ?').get(row.id);
    });
    res.json(emprestimo);
  });

  router.delete('/:id', (req, res) => {
    transaction(db, () => {
      const row = db.prepare('SELECT * FROM emprestimos WHERE id = ?').get(req.params.id);
      if (!row) throw new HttpError(404, 'Registro não encontrado');
      if (!row.data_devolucao) {
        db.prepare("UPDATE exemplares SET situacao = 'disponivel' WHERE id = ?").run(row.exemplar_id);
      }
      db.prepare('DELETE FROM emprestimos WHERE id = ?').run(row.id);
    });
    res.status(204).end();
  });

  // Depois de criado, só o prazo pode ser editado; o resto passa pelas rotas acima.
  router.use(crudRouter(db, 'emprestimos', ['data_prevista'], {
    validate: (data, atual) => {
      if (data.data_prevista !== undefined) validarPrazo(atual.data_emprestimo, data.data_prevista);
    },
  }));
  return router;
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// HTTP Basic Auth simples para quando o app fica exposto fora do localhost.
function basicAuth({ user, pass }) {
  return (req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString();
      const sep = decoded.indexOf(':');
      if (sep >= 0 && safeEqual(decoded.slice(0, sep), user) && safeEqual(decoded.slice(sep + 1), pass)) {
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="Biblioteca", charset="UTF-8"');
    res.status(401).send('Autenticação necessária');
  };
}

export function createApp(db, { staticDir, auth } = {}) {
  const app = express();
  if (auth) app.use(basicAuth(auth));
  app.use(cors());
  app.use(express.json());

  for (const [table, fields] of Object.entries(entities)) {
    const router =
      table === 'emprestimos' ? emprestimosRouter(db)
      : table === 'exemplares' ? crudRouter(db, table, fields, { validate: validarExemplar(db) })
      : table === 'leitores' ? crudRouter(db, table, fields, { validate: validarLeitor })
      : crudRouter(db, table, fields);
    app.use(`/api/${table}`, router);
  }

  // Em produção a própria API serve o build do React (client/dist).
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.resolve(staticDir, 'index.html')));
  }

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.code === 'ERR_SQLITE_ERROR' && /constraint/i.test(err.message)) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  });
  return app;
}
