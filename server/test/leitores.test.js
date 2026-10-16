import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db.js';
import { setupApi, dia } from './helpers.js';

const { api, novoExemplar, novoLeitor } = setupApi();
const emprestar = async (leitor, extra = {}) =>
  api('POST', '/emprestimos', { exemplar_id: (await novoExemplar()).id, leitor_id: leitor.id, data_prevista: dia(7), ...extra });

test('migração adiciona leitores.ativo sem perder dados', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'biblioteca-'));
  const file = path.join(dir, 'antigo.db');
  try {
    const antigo = new DatabaseSync(file);
    antigo.exec(`CREATE TABLE leitores (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT UNIQUE,
      telefone TEXT, data_cadastro TEXT NOT NULL DEFAULT (date('now')));
      INSERT INTO leitores (nome, email) VALUES ('Antigo', 'antigo@exemplo.com');`);
    antigo.close();

    const db = openDb(file);
    assert.deepEqual(db.prepare('SELECT nome, email, ativo FROM leitores').all().map((r) => ({ ...r })), [
      { nome: 'Antigo', email: 'antigo@exemplo.com', ativo: 1 },
    ]);
    db.close();
    openDb(file).close(); // reabrir não tenta adicionar de novo
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('leitor novo é ativo por padrão e aceita booleano', async () => {
  const leitor = await novoLeitor();
  assert.equal(leitor.ativo, 1);
  const res = await api('PUT', `/leitores/${leitor.id}`, { ativo: false });
  assert.equal(res.status, 200);
  assert.equal(res.body.ativo, 0);
});

test('leitor inativo não pega empréstimo', async () => {
  const leitor = await novoLeitor({ ativo: 0 });
  const res = await emprestar(leitor);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /inativo/);
});

test('leitor tem no máximo 3 empréstimos abertos', async () => {
  const leitor = await novoLeitor();
  const abertos = [];
  for (let i = 0; i < 3; i++) {
    const res = await emprestar(leitor);
    assert.equal(res.status, 201);
    abertos.push(res.body);
  }
  const quarto = await emprestar(leitor);
  assert.equal(quarto.status, 409);
  assert.match(quarto.body.error, /limite: 3/);

  // Devolver um libera uma vaga.
  await api('POST', `/emprestimos/${abertos[0].id}/devolucao`);
  assert.equal((await emprestar(leitor)).status, 201);
});

test('empréstimo recusado não marca o exemplar como emprestado', async () => {
  const leitor = await novoLeitor({ ativo: 0 });
  const ex = await novoExemplar();
  await api('POST', '/emprestimos', { exemplar_id: ex.id, leitor_id: leitor.id, data_prevista: dia(7) });
  assert.equal((await api('GET', `/exemplares/${ex.id}`)).body.situacao, 'disponivel');
});

test('prazo não pode ser anterior à data do empréstimo', async () => {
  const leitor = await novoLeitor();
  const antes = await emprestar(leitor, { data_emprestimo: '2026-05-10', data_prevista: '2026-05-09' });
  assert.equal(antes.status, 400);
  assert.match(antes.body.error, /anterior/);

  // Sem data_emprestimo, vale hoje.
  assert.equal((await emprestar(leitor, { data_prevista: dia(-1) })).status, 400);
  assert.equal((await emprestar(leitor, { data_prevista: undefined })).status, 400);

  const ok = await emprestar(leitor, { data_emprestimo: '2026-05-10', data_prevista: '2026-05-10' });
  assert.equal(ok.status, 201);
  const put = await api('PUT', `/emprestimos/${ok.body.id}`, { data_prevista: '2026-05-01' });
  assert.equal(put.status, 400);
  assert.equal((await api('PUT', `/emprestimos/${ok.body.id}`, { data_prevista: '2026-05-20' })).status, 200);
});
