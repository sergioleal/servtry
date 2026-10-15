import { openDb } from './db.js';
import { createApp } from './app.js';

const host = process.env.HOST ?? 'localhost';
const port = Number(process.env.PORT ?? 3000);

const app = createApp(openDb(), {
  staticDir: process.env.STATIC_DIR,
  auth: process.env.BASIC_AUTH_USER && {
    user: process.env.BASIC_AUTH_USER,
    pass: process.env.BASIC_AUTH_PASS ?? '',
  },
});

if (host !== 'localhost' && !process.env.BASIC_AUTH_USER) {
  console.warn('Atenção: servidor exposto sem BASIC_AUTH_USER/BASIC_AUTH_PASS.');
}

app.listen(port, host, () => {
  console.log(`Biblioteca em http://${host}:${port}`);
});
