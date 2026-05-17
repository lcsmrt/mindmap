import './env.js';
import { env } from './env.js';
import { buildApp } from './app.js';

const app = buildApp();

app.listen({ port: env.PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Listening on http://localhost:${env.PORT}`);
});
