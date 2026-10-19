// Gera tools/fixtures/megasena-3070.json a partir de megasena.db (legado Python).
// Uso: node tools/fixtures/gerar.mjs
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const caminhoBanco = resolve(raiz, 'megasena.db');
const caminhoSaida = resolve(raiz, 'tools', 'fixtures', 'megasena-3070.json');

const centavos = (valor) => Math.round((valor ?? 0) * 100);

const banco = new DatabaseSync(caminhoBanco, { readOnly: true });

const concursos = banco.prepare('SELECT * FROM concursos ORDER BY concurso').all();
const dezenas = banco.prepare('SELECT concurso, dezena FROM dezenas ORDER BY concurso, dezena').all();
const locais = banco.prepare('SELECT concurso, cidade, uf, descricao FROM ganhadores_sena_local ORDER BY concurso, id').all();

const dezenasPorConcurso = new Map();
for (const { concurso, dezena } of dezenas) {
  if (!dezenasPorConcurso.has(concurso)) dezenasPorConcurso.set(concurso, []);
  dezenasPorConcurso.get(concurso).push(dezena);
}

// O legado guarda 1 linha por ganhador; agrupa por descricao preservando a ordem de aparição.
const locaisPorConcurso = new Map();
for (const { concurso, cidade, uf, descricao } of locais) {
  if (!locaisPorConcurso.has(concurso)) locaisPorConcurso.set(concurso, new Map());
  const grupos = locaisPorConcurso.get(concurso);
  const chave = `${cidade ?? ''}|${uf ?? ''}|${descricao}`;
  const atual = grupos.get(chave);
  if (atual) atual.quantidade += 1;
  else grupos.set(chave, { cidade: cidade ?? null, uf: uf ?? null, descricao, quantidade: 1 });
}

const saida = {
  loteria: 'megasena',
  geradoEm: new Date().toISOString(),
  concursos: concursos.map((c) => ({
    numero: c.concurso,
    data: c.data_sorteio,
    dezenas: dezenasPorConcurso.get(c.concurso) ?? [],
    acumulou: c.acumulou === 1,
    premiacoes: [
      { faixa: 1, descricao: 'Sena', ganhadores: c.ganhadores_sena, rateioCentavos: centavos(c.rateio_sena) },
      { faixa: 2, descricao: 'Quina', ganhadores: c.ganhadores_quina, rateioCentavos: centavos(c.rateio_quina) },
      { faixa: 3, descricao: 'Quadra', ganhadores: c.ganhadores_quadra, rateioCentavos: centavos(c.rateio_quadra) },
    ],
    valorAcumuladoCentavos: centavos(c.valor_acumulado_sena),
    estimativaProximoCentavos: centavos(c.estimativa_premio),
    arrecadacaoCentavos: centavos(c.arrecadacao_total),
    acumuladoEspecialCentavos: centavos(c.acumulado_mega_virada),
    observacao: c.observacao ?? null,
    locaisGanhadores: [...(locaisPorConcurso.get(c.concurso)?.values() ?? [])],
  })),
};

const texto = JSON.stringify(saida);
writeFileSync(caminhoSaida, texto + '\n', 'utf8');
banco.close();

const totalDezenas = saida.concursos.reduce((s, c) => s + c.dezenas.length, 0);
const totalLocais = saida.concursos.reduce((s, c) => s + c.locaisGanhadores.reduce((x, l) => x + l.quantidade, 0), 0);
const totalGrupos = saida.concursos.reduce((s, c) => s + c.locaisGanhadores.length, 0);
console.log(`concursos=${saida.concursos.length} dezenas=${totalDezenas} locais(linhas legado)=${totalLocais} locais(agrupados)=${totalGrupos}`);
console.log(`sha256 do arquivo=${createHash('sha256').update(texto + '\n').digest('hex')} (varia com geradoEm)`);
console.log(`sha256 dos concursos=${createHash('sha256').update(JSON.stringify(saida.concursos)).digest('hex')} (estavel)`);
