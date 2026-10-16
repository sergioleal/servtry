import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db.js';
import { setupApi, dia } from './helpers.js';

const { api, novoExemplar, novoLeitor } = setupApi();
const emprestar = async (data_emprestimo, data_prevista) =>
  (await api('POST', '/emprestimos', {
    exemplar_id: (await novoExemplar()).id,
    leitor_id: (await novoLeitor()).id,
    data_emprestimo,
    data_prevista,
  })).body;
const renovar = (emp) => api('POST', `/emprestimos/${emp.id}/renovacao`);

test('migração adiciona emprestimos.renovacoes sem perder dados', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'biblioteca-'));
  const file = path.join(dir, 'antigo.db');
  try {
    const antigo = new DatabaseSync(file);
    antigo.exec(`CREATE TABLE emprestimos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, exemplar_id INTEGER NOT NULL, leitor_id INTEGER NOT NULL,
      data_emprestimo TEXT NOT NULL DEFAULT (date('now')), data_prevista TEXT NOT NULL, data_devolucao TEXT);
      INSERT INTO emprestimos (exemplar_id, leitor_id, data_prevista) VALUES (1, 1, '2026-01-01');`);
    antigo.close();

    const db = openDb(file);
    const row = { ...db.prepare('SELECT exemplar_id, data_prevista, renovacoes FROM emprestimos').get() };
    assert.deepEqual(row, { exemplar_id: 1, data_prevista: '2026-01-01', renovacoes: 0 });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('renovação estende o prazo em 14 dias a partir de hoje, no máximo 2 vezes', async () => {
  const emp = await emprestar(dia(-5), dia(2));
  assert.equal(emp.renovacoes, 0);

  const r1 = await renovar(emp);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.data_prevista, dia(14));
  assert.equal(r1.body.renovacoes, 1);

  const r2 = await renovar(emp);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.renovacoes, 2);

  const r3 = await renovar(emp);
  assert.equal(r3.status, 409);
  assert.match(r3.body.error, /limite: 2/);
  assert.equal((await api('GET', `/emprestimos/${emp.id}`)).body.renovacoes, 2);
});

test('renovação não encurta um prazo maior que 14 dias', async () => {
  const emp = await emprestar(dia(0), dia(30));
  assert.equal((await renovar(emp)).body.data_prevista, dia(30));
});

test('não renova empréstimo atrasado', async () => {
  const emp = await emprestar(dia(-20), dia(-1));
  const res = await renovar(emp);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /atrasado/);
  assert.equal((await api('GET', `/emprestimos/${emp.id}`)).body.data_prevista, dia(-1));
});

test('não renova empréstimo devolvido nem inexistente', async () => {
  const emp = await emprestar(dia(0), dia(7));
  await api('POST', `/emprestimos/${emp.id}/devolucao`);
  const res = await renovar(emp);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /devolvido/);
  assert.equal((await renovar({ id: 9999 })).status, 404);
});
