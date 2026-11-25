// Cliente de IA do content script: monta os pedidos e pede ao background para falar com o Gemini.

import { GEMINI_ORIGIN, buildReplyRequest, buildTranscribeRequest, buildTranslateRequest, type ChatTurn, type GeminiRequest, AI_HISTORY_MESSAGES } from '../../shared/ai';
import { MSG_AI_GENERATE, MSG_AI_MODELS, MSG_HAS_PERMISSION, MSG_REQUEST_PERMISSION } from '../../shared/protocol';
import { t } from '../../shared/i18n';
import type { App } from '../app';

export class AiClient {
  constructor(private app: App) {}

  get configured(): boolean {
    return !!this.app.store.settings.ai.apiKey.trim();
  }

  hasPermission(): Promise<boolean> {
    return this.app.runtime.send<boolean>({ type: MSG_HAS_PERMISSION, origin: GEMINI_ORIGIN }).catch(() => false);
  }

  requestPermission(): Promise<unknown> {
    return this.app.runtime.send({ type: MSG_REQUEST_PERMISSION, origin: GEMINI_ORIGIN });
  }

  async generate(request: GeminiRequest): Promise<string> {
    if (!this.configured) throw new Error(t('aiNoKey'));
    const r = await this.app.runtime.send<{ ok: boolean; text?: string; error?: string }>({ type: MSG_AI_GENERATE, request });
    if (!r?.ok || !r.text) {
      if (r?.error === 'no_permission') throw new Error(t('aiNoPermission'));
      throw new Error(r?.error || 'IA');
    }
    return r.text;
  }

  async models(): Promise<string[]> {
    const r = await this.app.runtime.send<{ ok: boolean; models?: string[]; error?: string }>({ type: MSG_AI_MODELS });
    if (!r?.ok) throw new Error(r?.error === 'no_permission' ? t('aiNoPermission') : r?.error || 'IA');
    return r.models ?? [];
  }

  /** Resposta para a conversa, com as últimas mensagens de texto como contexto. */
  async replyFor(chatId: string, extraPrompt = ''): Promise<string> {
    const history = await this.app.bridge.call<ChatTurn[]>('recentTexts', { chatId, count: AI_HISTORY_MESSAGES }).catch(() => []);
    return this.generate(buildReplyRequest(history, this.app.store.settings.ai, extraPrompt));
  }

  translate(text: string): Promise<string> {
    return this.generate(buildTranslateRequest(text, this.app.store.settings.ai.translateTo));
  }

  async transcribe(msgId: string): Promise<string> {
    const dataUrl = await this.app.bridge.call<string>('downloadMedia', { id: msgId }, 120_000);
    return this.generate(buildTranscribeRequest(dataUrl));
  }

  async test(): Promise<string> {
    return this.generate({ contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }], generationConfig: { temperature: 0, maxOutputTokens: 16 } });
  }
}
