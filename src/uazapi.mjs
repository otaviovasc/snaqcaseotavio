// Contrato oficial: https://docs.uazapi.com/reference/sendText.md
// Preparado para próxima etapa. A aplicação desta versão não chama sendText.
export function uazapiStatus(env = process.env) {
  return {
    provider: 'Uazapi', mode: 'simulation', realSendEnabled: false,
    tokenConfigured: Boolean(env.UAZAPI_TOKEN),
    serverUrlConfigured: Boolean(env.UAZAPI_BASE_URL),
    instanceConfigured: Boolean(env.UAZAPI_INSTANCE_NAME),
    reason: 'Envio real bloqueado nesta versão. Nenhuma conexão ou consulta à instância é feita.',
    nextStep: 'Informar Server URL, validar destinatário de teste e combinar teste com ngrok para webhooks.'
  };
}

export function textPayload(communication) {
  return { number: communication.phone, text: communication.text,
    track_source: 'snaqfit', track_id: communication.id };
}

export class UazapiAdapter {
  constructor({ baseUrl = process.env.UAZAPI_BASE_URL, token = process.env.UAZAPI_TOKEN,
    allowRealSend = false } = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.allowRealSend = allowRealSend;
  }
  async sendText(communication) {
    if (!this.allowRealSend) throw new Error('Envio Uazapi bloqueado. Aguarda etapa de teste autorizada.');
    if (!this.baseUrl || !this.token) throw new Error('Server URL e token da Uazapi são necessários.');
    const url = new URL(this.baseUrl);
    if (url.protocol !== 'https:') throw new Error('Server URL deve usar HTTPS.');
    try {
      const response = await fetch(new URL('/send/text', url), {
        method: 'POST', headers: { 'Content-Type': 'application/json', token: this.token },
        body: JSON.stringify(textPayload(communication)), signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) return { status: 'unknown', reason: `Resposta HTTP ${response.status}; conferir provedor antes de tentar novamente.` };
      const data = await response.json();
      return { status: 'accepted', providerId: data.messageid || data.id || null };
    } catch {
      return { status: 'unknown', reason: 'Resultado de envio desconhecido; revisão manual necessária.' };
    }
  }
}
