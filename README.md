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
