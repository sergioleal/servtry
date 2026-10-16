import { before, after } from 'node:test';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

// Sobe a API num banco em memória e devolve um cliente HTTP simples.
export function setupApi() {
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

  let seq = 0;
  const api = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };

  const novoExemplar = async () => {
    const n = ++seq;
    const autor = (await api('POST', '/autores', { nome: `Autor ${n}` })).body;
    const livro = (await api('POST', '/livros', { titulo: `Livro ${n}`, autor_id: autor.id })).body;
    return (await api('POST', '/exemplares', { livro_id: livro.id, codigo: `EX-${n}`, situacao: 'disponivel' })).body;
  };

  const novoLeitor = async (extra = {}) =>
    (await api('POST', '/leitores', { nome: `Leitor ${++seq}`, ...extra })).body;

  return { api, novoExemplar, novoLeitor };
}

// Data local no formato AAAA-MM-DD, deslocada em `dias`.
export function dia(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
