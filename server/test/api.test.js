import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

let server;
let base;

before(async () => {
  const app = createApp(openDb(':memory:'));
  await new Promise((resolve) => {
    server = app.listen(0, 'localhost', resolve);
  });
  base = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

test('CRUD de autores', async () => {
  const created = await api('POST', '/autores', { nome: 'Machado de Assis', nacionalidade: 'Brasileira' });
  assert.equal(created.status, 201);
  const updated = await api('PUT', `/autores/${created.body.id}`, { nacionalidade: 'Brasil' });
  assert.equal(updated.body.nacionalidade, 'Brasil');
  assert.equal((await api('GET', '/autores')).body.length, 1);
  assert.equal((await api('DELETE', `/autores/${created.body.id}`)).status, 204);
  assert.equal((await api('GET', `/autores/${created.body.id}`)).status, 404);
});

test('livro exige autor existente', async () => {
  const res = await api('POST', '/livros', { titulo: 'Sem autor', autor_id: 999 });
  assert.equal(res.status, 409);
});

test('empréstimo e devolução atualizam o exemplar', async () => {
  const autor = (await api('POST', '/autores', { nome: 'Clarice Lispector' })).body;
  const livro = (await api('POST', '/livros', { titulo: 'A Hora da Estrela', autor_id: autor.id })).body;
  const exemplar = (await api('POST', '/exemplares', { livro_id: livro.id, codigo: 'EX-001' })).body;
  const leitor = (await api('POST', '/leitores', { nome: 'Ana', email: 'ana@exemplo.com' })).body;

  const emp = await api('POST', '/emprestimos', {
    exemplar_id: exemplar.id,
    leitor_id: leitor.id,
    data_prevista: '2026-11-01',
  });
  assert.equal(emp.status, 201);
  assert.equal((await api('GET', `/exemplares/${exemplar.id}`)).body.situacao, 'emprestado');

  const dup = await api('POST', '/emprestimos', {
    exemplar_id: exemplar.id,
    leitor_id: leitor.id,
    data_prevista: '2026-11-01',
  });
  assert.equal(dup.status, 409);

  const dev = await api('POST', `/emprestimos/${emp.body.id}/devolucao`);
  assert.ok(dev.body.data_devolucao);
  assert.equal((await api('GET', `/exemplares/${exemplar.id}`)).body.situacao, 'disponivel');
  assert.equal((await api('POST', `/emprestimos/${emp.body.id}/devolucao`)).status, 409);
});
