/**
 * A Caixa bloqueia IPs de fora do Brasil (403 do WAF). Em servidor no exterior, as chamadas saem por um proxy no
 * Brasil: o Node 24 usa HTTPS_PROXY no fetch quando NODE_USE_ENV_PROXY=1 (deploy/docker-compose.yml liga os dois a
 * partir de CAIXA_PROXY). Descreve a saída para o log de inicialização, sem expor usuário e senha do proxy.
 */
export function descreverSaidaExterna(env: NodeJS.ProcessEnv): string {
  const proxy = env['HTTPS_PROXY'] || env['https_proxy'];
  if (!proxy || env['NODE_USE_ENV_PROXY'] !== '1')
    return 'Chamadas à Caixa: conexão direta';
  try {
    const { protocol, host } = new URL(proxy);
    return `Chamadas à Caixa: via proxy ${protocol}//${host}`;
  } catch {
    return 'Chamadas à Caixa: via proxy (URL inválida em HTTPS_PROXY)';
  }
}
