// Tipos compartilhados entre background, content e página.

import type { AiSettings } from './ai';

export type Lang = 'pt_BR' | 'en' | 'es' | 'ar' | 'ru' | 'tr';
export type Theme = 'auto' | 'light' | 'dark';

export interface PrivacySettings {
  blurNames: boolean;
  blurPhotos: boolean;
  blurRecent: boolean;
  blurConversation: boolean;
  blurComposer: boolean;
  invisible: boolean;
  hideTyping: boolean;
  hideRecording: boolean;
  noReadReceipts: boolean;
  viewStatusHidden: boolean;
  listenAudioHidden: boolean;
  disableCalls: boolean;
}

export interface HeaderButtons {
  readUnread: boolean;
  pin: boolean;
  quickLabel: boolean;
  saveContact: boolean;
  sendTemplate: boolean;
  addTask: boolean;
  /** 👍 na conversa aberta */
  like: boolean;
  /** País, número e etiquetas da conversa aberta */
  chatInfo: boolean;
  /** Sugerir resposta com IA no campo de mensagem */
  aiSuggest: boolean;
  /** Botão "Traduzir" nas mensagens (IA) */
  translate: boolean;
  /** Botão "Transcrever" nos áudios (IA) */
  transcribe: boolean;
  /** Botão de baixar status no visualizador de status */
  downloadStatus: boolean;
  /** Botão "Executar automação" na conversa aberta */
  runAutomation: boolean;
  /** Botão "Nova conversa" no topo da conversa */
  newChat: boolean;
  /** Botão que mostra, dentro da própria conversa, as mensagens que o remetente apagou */
  restoreDeleted: boolean;
}

/** "Personalizações" da referência (atalho Alt+C). */
export interface Customizations {
  /** Impedir que a lista de conversas "pule" depois de enviar uma mensagem. */
  preventChatsListJumping: boolean;
  /** Avisar quando qualquer contato ficar online/offline. */
  notifyOnlineActivities: boolean;
  /** Avisar quando qualquer contato estiver digitando/gravando. */
  notifyTypingRecordingActivities: boolean;
}

export interface WatchSettings {
  chatIds: string[];
  online: boolean;
  typing: boolean;
}

export interface Settings {
  lang: Lang;
  theme: Theme;
  privacy: PrivacySettings;
  antiDelete: { enabled: boolean; maxMediaKb: number };
  offline: boolean;
  quickReplies: boolean;
  headerButtons: HeaderButtons;
  background: { dataUrl: string; dim: number } | null;
  watch: WatchSettings;
  /** Ao mandar @todos/@everyone num grupo, marcar todos os membros. */
  mentionAllTokens: boolean;
  /** Inteligência artificial (Google Gemini) — só funciona com a chave de API do próprio usuário. */
  ai: AiSettings;
  customizations: Customizations;
  /** Conversas fixadas só neste navegador, sem o limite de 3 do WhatsApp (pinnedChats da referência). */
  pinnedChats: string[];
  /** Webhooks de entrada sem servidor: a extensão busca mensagens para enviar numa URL sua. */
  incoming: IncomingSettings;
  termsAccepted: boolean;
}

export interface IncomingSettings {
  enabled: boolean;
  /** URL que devolve as mensagens a enviar (GET). */
  url: string;
  headers: { key: string; value: string }[];
  /** A cada quantos segundos buscar (mínimo 10). */
  intervalSec: number;
  /** URL opcional que recebe (POST) o resultado de cada envio. */
  ackUrl: string;
  lastRunAt: number;
  lastError: string;
  received: number;
}

export type TemplateKind = 'text' | 'media' | 'vcard' | 'location' | 'poll' | 'pix' | 'event' | 'call' | 'list' | 'dynamicImage';

export interface ListSection {
  title: string;
  rows: { title: string; description: string }[];
}

export interface MediaFile {
  name: string;
  mime: string;
  dataUrl: string;
  size: number;
  asDocument?: boolean;
  asVoice?: boolean;
  /** Foto/vídeo/áudio de visualização única */
  viewOnce?: boolean;
}

export interface VCardEntry {
  name: string;
  phone: string;
}

export type PixKeyType = 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP';

export interface Template {
  id: string;
  name: string;
  kind: TemplateKind;
  /** Texto (ou legenda / descrição, conforme o tipo). */
  text: string;
  media?: MediaFile;
  vcards?: VCardEntry[];
  location?: { lat: number; lng: number; name: string; address: string };
  poll?: { question: string; options: string[]; selectable: number };
  pix?: { keyType: PixKeyType; key: string; name: string; instructions: string };
  event?: { name: string; start: string; end: string; callType: '' | 'voice' | 'video' };
  /** Chamada agendada (o "evento" da referência). */
  call?: { title: string; start: string; callType: 'voice' | 'video' };
  /** Mensagem de lista com várias opções. */
  list?: { buttonText: string; title: string; footer: string; sections: ListSection[] };
  /** Imagem buscada numa URL montada com variáveis (inclui ${profilePicture}). */
  dynamicImage?: { url: string };
  /** Gerar prévia do primeiro link do texto. */
  linkPreview?: boolean;
  quick: boolean;
  createdAt: number;
}

/** Mensagem já com variáveis e spintax resolvidos, pronta para a página enviar. */
export interface ResolvedMessage {
  kind: TemplateKind;
  text: string;
  media?: MediaFile;
  vcards?: VCardEntry[];
  location?: { lat: number; lng: number; name: string; address: string };
  poll?: { question: string; options: string[]; selectable: number };
  pix?: { keyType: PixKeyType; key: string; name: string; instructions: string };
  event?: { name: string; startTime: number; endTime?: number; callType?: 'voice' | 'video' };
  call?: { title: string; startMs: number; callType: 'voice' | 'video' };
  list?: { buttonText: string; title: string; footer: string; sections: ListSection[] };
  /** Prévia de link já montada localmente (título, descrição, miniatura). */
  linkPreview?: { title: string; description: string; canonicalUrl: string; matchedText: string; thumbnail?: string };
}

export type SelectMode = 'none' | 'all' | 'allExcept' | 'only';

export interface TargetSelection {
  mode: SelectMode;
  ids: string[];
}

export interface BroadcastTargets {
  /**
   * source: 'saved' = contatos salvos; 'chatted' = contatos salvos que já conversaram comigo;
   * 'unsaved' = números NÃO salvos que já conversaram comigo (opções da referência).
   */
  contacts: TargetSelection & { source?: 'saved' | 'chatted' | 'unsaved' };
  /** mention = marcar todos os membros (menção silenciosa) ao enviar para o próprio grupo */
  groups: TargetSelection & { members: boolean; mention?: boolean };
  labels: TargetSelection;
  lists: TargetSelection & { members: boolean };
  countries: TargetSelection;
  sheet: { rows: string[][]; numberFormat: 'international' | 'local'; ddi: string };
  pasted: string;
  validate: boolean;
}

export interface Recipient {
  /** id do WhatsApp (5511999999999@c.us, ...@g.us, ...@broadcast) */
  id: string;
  /** colunas da planilha (para ${1}..${N}) */
  columns?: string[];
  status: 'pending' | 'sent' | 'failed' | 'invalid' | 'skipped';
  error?: string;
}

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'everyHours';

export interface BroadcastSchedule {
  startAt: number | null;
  workingHours: { enabled: boolean; start: string; end: string; days: number[] };
  repeat: { kind: RepeatKind; hours: number; times: number };
}

export interface PostActions {
  labelIds: string[];
  archive: boolean;
  block: boolean;
  webhookIds: string[];
}

export type BroadcastStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'stopped' | 'done';

export interface Broadcast {
  id: string;
  name: string;
  templateIds: string[];
  templateMode: 'all' | 'random';
  targets: BroadcastTargets;
  intervalMin: number;
  intervalMax: number;
  schedule: BroadcastSchedule;
  post: PostActions;
  status: BroadcastStatus;
  recipients: Recipient[];
  cursor: number;
  runs: number;
  nextAt: number | null;
  lastError?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export type TriggerType = 'keyword' | 'outgoing' | 'attachment' | 'location' | 'order' | 'status' | 'facebookAd' | 'call' | 'groupJoin' | 'groupLeave';

export interface AutomationFilters {
  ignoreGroups: boolean;
  ignoreContacts: boolean;
  ignoreNonContacts: boolean;
  skipIfChatOpen: boolean;
  days: number[];
  hours: { enabled: boolean; start: string; end: string };
  labelIds: string[];
  countries: string[];
  chatIds: string[];
}

export interface AutomationActions {
  templateIds: string[];
  templateMode: 'all' | 'random';
  delaySec: number;
  typing: boolean;
  quote: boolean;
  addLabels: string[];
  removeLabels: string[];
  mark: 'none' | 'read' | 'unread';
  archive: boolean;
  block: boolean;
  addToGroups: string[];
  removeFromGroups: string[];
  star: boolean;
  webhookIds: string[];
  /** Em grupos, responder no privado de quem mandou. */
  replyPrivately?: boolean;
  /** Responder com IA (Gemini), usando as últimas mensagens da conversa como contexto. */
  aiReply?: boolean;
  /** Instruções extras só para esta automação. */
  aiPrompt?: string;
  /** Reagir à mensagem com este emoji (vazio = não reagir). */
  reaction?: string;
  pinChat?: boolean;
  /** Silenciar a conversa por N horas (0 = não; -1 = sempre). */
  muteHours?: number;
  deleteChat?: boolean;
  /** Salvar quem mandou na agenda, com prefixo opcional no nome. */
  saveContact?: { enabled: boolean; prefix: string };
  /** Mandar um texto para outras conversas (ex.: avisar a equipe). */
  notify?: { chatIds: string[]; text: string };
  /** Fixar a mensagem recebida por N horas (24, 168 ou 720; 0 = não). */
  pinMessageHours?: number;
  unmuteChat?: boolean;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: TriggerType;
    keywords: string;
    exact: boolean;
    attachmentTypes: string[];
    /** Chamadas: personal_audio, personal_video, group_audio, group_video (vazio = todas). */
    callTypes?: string[];
    /** Anúncio do Facebook: parte do link/ID do anúncio (vazio = qualquer anúncio). */
    facebookAdId?: string;
  };
  filters: AutomationFilters;
  actions: AutomationActions;
  /** Evita responder a mesma conversa repetidamente (segundos, 0 = sem limite). */
  cooldownSec: number;
  runs: number;
  createdAt: number;
}

export interface Webhook {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'GET';
  headers: { key: string; value: string }[];
  payload: string;
  onIncoming: boolean;
  onOutgoing: boolean;
  replyFromResponse: boolean;
  /** Caminho do texto da resposta no JSON devolvido (ex.: reply ou data.message). */
  replyPath?: string;
  /** Caminho de uma URL de arquivo no JSON devolvido, enviada como anexo. */
  attachmentPath?: string;
  createdAt: number;
}

export interface QueueItem {
  id: string;
  webhookId: string;
  url: string;
  method: Webhook['method'];
  headers: Record<string, string>;
  body: string;
  attempts: number;
  nextAt: number;
  chatId?: string;
  lastError?: string;
  createdAt: number;
}

export type Priority = 'urgent' | 'high' | 'normal' | 'low';

export interface Task {
  id: string;
  chatId: string;
  chatName: string;
  title: string;
  description: string;
  priority: Priority;
  due: number | null;
  notify: boolean;
  notified: boolean;
  done: boolean;
  createdAt: number;
}

export interface CachedMsg {
  id: string;
  chatId: string;
  chatName: string;
  sender: string;
  senderName: string;
  type: string;
  body: string;
  caption: string;
  mime?: string;
  filename?: string;
  mediaDataUrl?: string;
  lat?: number;
  lng?: number;
  t: number;
}

export interface DeletedMsg extends CachedMsg {
  deletedAt: number;
}

export interface Stats {
  /** Mensagens recebidas por tipo (chat, image, video, audio/ptt, document, sticker...). */
  received?: Record<string, number>;
  /** Chamadas recebidas por tipo (personal_audio, personal_video, group_audio, group_video). */
  calls?: Record<string, number>;
  broadcastSent: number;
  broadcastFailed: number;
  automationReplies: number;
  webhooksOk: number;
  webhooksFailed: number;
  deletedCaught: number;
  daily: Record<string, number>;
}

export interface WwData {
  settings: Settings;
  templates: Template[];
  broadcasts: Broadcast[];
  automations: Automation[];
  webhooks: Webhook[];
  queue: QueueItem[];
  tasks: Task[];
  deleted: DeletedMsg[];
  stats: Stats;
}

/* ---- Ponte página ↔ content ---- */

export interface ChatInfo {
  id: string;
  name: string;
  isGroup: boolean;
  isBroadcast: boolean;
  archived: boolean;
  pinned: boolean;
  unread: number;
  labels: string[];
  t: number;
}

export interface ContactInfo {
  id: string;
  name: string;
  pushname: string;
  phone: string;
  isMyContact: boolean;
}

export interface LabelInfo {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface MsgEvent {
  id: string;
  chatId: string;
  chatName: string;
  fromMe: boolean;
  sender: string;
  senderName: string;
  pushname: string;
  isGroup: boolean;
  isContact: boolean;
  type: string;
  body: string;
  caption: string;
  t: number;
  mime?: string;
  filename?: string;
  size?: number;
  /** Status publicado por um contato (chatId = quem publicou). */
  isStatus?: boolean;
  /** Link do anúncio de origem ("clique para conversar" do Facebook/Instagram). */
  ctwaSourceUrl?: string;
  lat?: number;
  lng?: number;
  labels: string[];
  /** Aparelho de origem (android, iphone, web...), quando o wa-js sabe dizer. */
  platform?: string;
  activeChatId: string | null;
  myId: string;
}
