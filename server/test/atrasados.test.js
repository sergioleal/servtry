import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, dia } from './helpers.js';

const { api, novoExemplar, novoLeitor } = setupApi();
const emprestar = async (data_emprestimo, data_prevista) =>
  (await api('POST', '/emprestimos', {
    exemplar_id: (await novoExemplar()).id,
    leitor_id: (await novoLeitor()).id,
    data_emprestimo,
    data_prevista,
  })).body;

test('atrasado é calculado pelo prazo de empréstimos abertos', async () => {
  const atrasado = await emprestar(dia(-20), dia(-1));
  const venceHoje = await emprestar(dia(-10), dia(0));
  const noPrazo = await emprestar(dia(0), dia(7));
  const devolvido = await emprestar(dia(-20), dia(-5));
  await api('POST', `/emprestimos/${devolvido.id}/devolucao`);

  assert.equal(atrasado.atrasado, true);
  assert.equal(venceHoje.atrasado, false);
  assert.equal(noPrazo.atrasado, false);
  assert.equal((await api('GET', `/emprestimos/${devolvido.id}`)).body.atrasado, false);
  assert.equal((await api('GET', `/emprestimos/${atrasado.id}`)).body.atrasado, true);

  const ids = async (status) =>
    (await api('GET', `/emprestimos${status ? `?status=${status}` : ''}`)).body.map((e) => e.id);
  assert.deepEqual(await ids(), [atrasado.id, venceHoje.id, noPrazo.id, devolvido.id]);
  assert.deepEqual(await ids('abertos'), [atrasado.id, venceHoje.id, noPrazo.id]);
  assert.deepEqual(await ids('atrasados'), [atrasado.id]);
  assert.deepEqual(await ids('devolvidos'), [devolvido.id]);

  // Estender o prazo tira o atraso; a resposta do PUT já vem recalculada.
  const put = await api('PUT', `/emprestimos/${atrasado.id}`, { data_prevista: dia(3) });
  assert.equal(put.body.atrasado, false);
});

test('status desconhecido responde 400', async () => {
  const res = await api('GET', '/emprestimos?status=perdidos');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /abertos, atrasados, devolvidos/);
});
