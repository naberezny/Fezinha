# Deploy do Fezinha (docker compose)

Quatro containers, todos nesta pasta (`docker-compose.yml`):

| Serviço | Imagem | Papel |
|---|---|---|
| `postgres` | `postgres:17-alpine` | Banco, volume `fezinha_dados`. Sem porta publicada. |
| `migrar` | `fezinha-ferramentas` | Aplica as migrations do Prisma e sai. Também roda a carga histórica. |
| `api` | `fezinha-api` | NestJS na porta 3000 (só na rede interna). Busca sozinha os concursos novos na Caixa quando o app é lido. |
| `web` | `fezinha-web` | nginx com o app Angular; repassa `/loterias` e `/saude` para a API. Publica `${ENDERECO_WEB}:${PORTA_WEB}` (padrão `127.0.0.1:8095`; `0.0.0.0` abre pelo IP, sem HTTPS). |

O HTTPS e o domínio ficam com o nginx do servidor. No aaPanel: **Website → Add site** com o domínio, depois
**Reverse proxy** para `http://127.0.0.1:8095` e **SSL → Let's Encrypt**.

## Servidor atual

- VPS Contabo `37.60.236.219`, Ubuntu 24.04, aaPanel (nginx em 80/443). Acesso: `ssh fezinha-vps` (chave
  `~/.ssh/id_ed25519_fezinha`).
- Código em `/opt/fezinha/src` (enviado com `git archive`, sem chave do GitHub no servidor); segredos em
  `/opt/fezinha/src/deploy/.env` (nunca no git).

## Primeira instalação

```bash
# Na sua máquina, na raiz do repositório: envia o código da main
git archive --format=tar HEAD | ssh fezinha-vps "mkdir -p /opt/fezinha/src && tar -x -C /opt/fezinha/src"

# No servidor
cd /opt/fezinha/src/deploy
cp .env.exemplo .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/; s/^CHAVE_ADMIN=.*/CHAVE_ADMIN=$(openssl rand -hex 24)/" .env
chmod 600 .env
docker compose up -d --build

# Carga histórica (idempotente; lê tools/fixtures). Depois disso a API completa o resto com a Caixa.
for l in megasena lotomania lotofacil; do
  docker compose run --rm migrar node tools/carga-historica/executar-ts.cjs tools/carga-historica/src/main.ts --loteria $l
done
```

## Atualizar

```bash
# Na sua máquina
git archive --format=tar HEAD | ssh fezinha-vps "tar -x -C /opt/fezinha/src"
ssh fezinha-vps "cd /opt/fezinha/src/deploy && docker compose up -d --build && docker image prune -f"
```

O `.env` do servidor não é tocado (não está no git). Arquivos apagados no repositório continuam na pasta do
servidor; numa limpeza, apague `/opt/fezinha/src` **exceto** `deploy/.env` antes de enviar.

## Operação

```bash
docker compose ps                      # estado
docker compose logs -f api             # logs da API
curl -s http://127.0.0.1:8095/saude    # saúde, pelo nginx do container
# Backup do banco
docker compose exec -T postgres pg_dump -U sorteios -Fc sorteios > /opt/fezinha/backup-$(date +%F).dump
```
