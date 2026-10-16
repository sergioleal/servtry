import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, dia } from './helpers.js';

const { api, novoExemplar, novoLeitor } = setupApi();

test("PUT não pode marcar exemplar como 'emprestado'", async () => {
  const ex = await novoExemplar();
  const res = await api('PUT', `/exemplares/${ex.id}`, { situacao: 'emprestado' });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /emprestado/);
  assert.equal((await api('GET', `/exemplares/${ex.id}`)).body.situacao, 'disponivel');
});

test("POST não pode criar exemplar já 'emprestado'", async () => {
  const ex = await novoExemplar();
  const res = await api('POST', '/exemplares', { livro_id: ex.livro_id, codigo: 'EX-NOVO', situacao: 'emprestado' });
  assert.equal(res.status, 409);
});

test('PUT não muda a situação de exemplar com empréstimo aberto', async () => {
  const ex = await novoExemplar();
  const leitor = await novoLeitor();
  const emp = (await api('POST', '/emprestimos', { exemplar_id: ex.id, leitor_id: leitor.id, data_prevista: dia(7) })).body;

  for (const situacao of ['disponivel', 'manutencao', 'perdido']) {
    const res = await api('PUT', `/exemplares/${ex.id}`, { situacao });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /devolução/);
  }
  assert.equal((await api('GET', `/exemplares/${ex.id}`)).body.situacao, 'emprestado');

  // Editar outros campos (mantendo a situação) continua permitido.
  const ok = await api('PUT', `/exemplares/${ex.id}`, { localizacao: 'Estante B', situacao: 'emprestado' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.localizacao, 'Estante B');

  await api('POST', `/emprestimos/${emp.id}/devolucao`);
  const depois = await api('PUT', `/exemplares/${ex.id}`, { situacao: 'manutencao' });
  assert.equal(depois.status, 200);
  assert.equal(depois.body.situacao, 'manutencao');
});
