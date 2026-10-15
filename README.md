# Biblioteca

Controle de biblioteca com API em Node (Express + SQLite nativo do Node) e frontend em React (Vite).

## Entidades

Autores, Editoras, Categorias, Livros, Exemplares, Leitores e Empréstimos.
Um empréstimo só é aceito se o exemplar estiver `disponivel`; ao emprestar ele passa a `emprestado`
e volta a `disponivel` na devolução (`POST /api/emprestimos/:id/devolucao`).

## Rodando

Requer Node 22.13+ (usa `node:sqlite`).

```bash
cd server && npm install && npm run dev   # API em http://localhost:3000/api
cd client && npm install && npm run dev   # UI em http://localhost:5173 (proxy de /api)
```

Testes da API: `cd server && npm test`.

## Expondo publicamente

A API pode servir o build do React e exigir usuário/senha (HTTP Basic Auth):

```bash
cd client && npm run build
cd server && HOST=0.0.0.0 PORT=8080 STATIC_DIR=../client/dist \
  BASIC_AUTH_USER=admin BASIC_AUTH_PASS='<senha>' npm start
```

Sem `BASIC_AUTH_USER` o app fica aberto; o servidor avisa no log quando `HOST` não é `localhost`.
