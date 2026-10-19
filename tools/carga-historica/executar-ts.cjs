// Executa um arquivo TypeScript com o transpilador SWC, respeitando os aliases do tsconfig.base.json.
// Uso: node tools/carga-historica/executar-ts.cjs <arquivo.ts> [argumentos...]
const { resolve } = require('node:path');

const alvo = process.argv[2];
if (!alvo) {
  console.error('Informe o arquivo .ts a executar.');
  process.exit(1);
}
process.env.SWC_NODE_PROJECT = resolve(__dirname, 'tsconfig.json');
process.env.TS_NODE_PROJECT = process.env.SWC_NODE_PROJECT;
require('@swc-node/register');
process.argv.splice(1, 2, resolve(alvo));
require(resolve(alvo));
