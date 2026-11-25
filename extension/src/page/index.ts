// Script do contexto da página: usa o wa-js (global WPP) e conversa com o content script
// por CustomEvents 'wabawebe:req' / 'wabawebe:res' / 'wabawebe:evt'.

import { EV_EVT, EV_REQ, EV_RES, type BridgeRequest, type BridgeResponse } from '../shared/protocol';
import type { ChatInfo, ContactInfo, LabelInfo, MsgEvent, PrivacySettings, ResolvedMessage } from '../shared/types';
import { applyPrivacy } from './privacy';

declare const WPP: any;

const ATTACH_TYPES = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'];

function send(type: string, payload: unknown): void {
  document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(payload) }));
}

function emit(event: string, data: unknown): void {
  send(EV_EVT, { event, data });
}

function wid(w: any): string {
  if (!w) return '';
  if (typeof w === 'string') return w;
  return w._serialized ?? (w.user && w.server ? `${w.user}@${w.server}` : String(w));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function myId(): string {
  try {
    return wid(WPP.conn.getMyUserId());
  } catch {
    return '';
  }
}

function chatName(c: any): string {
  return c?.formattedTitle || c?.name || c?.contact?.name || c?.contact?.pushname || c?.id?.user || '';
}

function chatInfo(c: any): ChatInfo {
  const id = wid(c.id);
  return {
    id,
    name: chatName(c),
    isGroup: !!c.isGroup || id.endsWith('@g.us'),
    isBroadcast: id.endsWith('@broadcast'),
    archived: !!c.archive,
    pinned: !!c.pin,
    unread: c.unreadCount || 0,
    labels: Array.isArray(c.labels) ? c.labels.map(String) : [],
    t: c.t || 0,
  };
}

function contactPhone(c: any): string {
  const id = wid(c.id);
  if (id.endsWith('@c.us')) return id.split('@')[0];
  const pn = c.phoneNumber ? wid(c.phoneNumber) : '';
  return pn ? pn.split('@')[0] : '';
}

function contactInfo(c: any): ContactInfo {
  return {
    id: wid(c.id),
    name: c.name || '',
    pushname: c.pushname || c.verifiedName || '',
    phone: contactPhone(c),
    isMyContact: !!c.isMyContact,
  };
}

function getChat(id: string): any {
  try {
    return WPP.chat.get(id);
  } catch {
    return null;
  }
}

function getContact(id: string): any {
  try {
    return WPP.contact.get(id);
  } catch {
    return null;
  }
}

function activeChatId(): string | null {
  try {
    const c = WPP.chat.getActiveChat();
    return c ? wid(c.id) : null;
  } catch {
    return null;
  }
}

function msgEvent(m: any): MsgEvent {
  const chatId = wid(m.id?.remote ?? m.from);
  const chat = m.chat ?? getChat(chatId);
  const isGroup = chatId.endsWith('@g.us');
  const sender = wid(m.author ?? (m.id?.fromMe ? WPP.conn.getMyUserId() : m.from));
  const contact = getContact(sender);
  const type = m.type || 'chat';
  return {
    id: wid(m.id),
    chatId,
    chatName: chatName(chat) || contact?.name || contact?.pushname || chatId.split('@')[0],
    fromMe: !!m.id?.fromMe,
    sender,
    senderName: contact?.name || '',
    pushname: m.notifyName || contact?.pushname || '',
    isGroup,
    isContact: !!contact?.isMyContact,
    type,
    body: type === 'chat' ? m.body || '' : '',
    caption: m.caption || '',
    t: m.t || Math.floor(Date.now() / 1000),
    mime: m.mimetype,
    filename: m.filename,
    size: m.size,
    lat: m.lat,
    lng: m.lng,
    labels: Array.isArray(chat?.labels) ? chat.labels.map(String) : [],
    platform: platformOf(m),
    ctwaSourceUrl: m.ctwaContext?.sourceUrl || m.ctwaContext?.source_url || '',
    activeChatId: activeChatId(),
    myId: myId(),
  };
}

async function participantIds(groupId: string): Promise<string[]> {
  try {
    const parts = await WPP.group.getParticipants(groupId);
    return (parts ?? []).map((x: any) => wid(x.id)).filter(Boolean);
  } catch {
    return [];
  }
}

function platformOf(m: any): string {
  try {
    return String(WPP.chat.getPlatformFromMessage(m.id) ?? '');
  } catch {
    return '';
  }
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/* ------------------------- envio ------------------------- */

interface SendParams {
  chatId: string;
  msg: ResolvedMessage;
  quotedMsgId?: string;
  typingMs?: number;
  /** Em grupos: marcar todos os membros (menção silenciosa), como a opção da referência. */
  mentionAll?: boolean;
}

async function sendResolved(p: SendParams): Promise<{ id: string }> {
  const { chatId, msg } = p;
  if (p.typingMs && p.typingMs > 0) {
    try {
      await WPP.chat.markIsComposing(chatId, p.typingMs);
    } catch {
      /* ignora */
    }
    await sleep(p.typingMs);
  }
  const opts: Record<string, unknown> = { createChat: true };
  if (p.quotedMsgId) opts.quotedMsg = p.quotedMsgId;
  if (p.mentionAll && chatId.endsWith('@g.us')) opts.mentionedList = await participantIds(chatId);
  let res: any;
  switch (msg.kind) {
    case 'text':
      // prévia de link: só a montada localmente pela extensão (nunca servidores de terceiros)
      res = await WPP.chat.sendTextMessage(chatId, msg.text, {
        ...opts,
        linkPreview: msg.linkPreview ? { ...msg.linkPreview, doNotPlayInline: true, richPreviewType: 0 } : false,
      });
      break;
    case 'call': {
      const c = msg.call!;
      res = await WPP.chat.sendScheduledCallMessage(chatId, { ...opts, title: c.title, description: msg.text || undefined, callType: c.callType, scheduledTimestampMs: c.startMs });
      break;
    }
    case 'list': {
      const l = msg.list!;
      let n = 0;
      res = await WPP.chat.sendListMessage(chatId, {
        ...opts,
        buttonText: l.buttonText || 'Opções',
        description: msg.text || ' ',
        title: l.title || undefined,
        footer: l.footer || undefined,
        sections: l.sections.map((s) => ({ title: s.title, rows: s.rows.map((r) => ({ rowId: `r${++n}`, title: r.title, description: r.description })) })),
      });
      break;
    }
    case 'media': {
      const f = msg.media;
      if (!f) throw new Error('no_media');
      let type = 'auto-detect';
      if (f.asDocument) type = 'document';
      else if (f.asVoice && f.mime.startsWith('audio/')) type = 'audio';
      res = await WPP.chat.sendFileMessage(chatId, f.dataUrl, {
        ...opts,
        type,
        caption: msg.text || undefined,
        filename: f.name,
        mimetype: f.mime,
        isPtt: type === 'audio' ? true : undefined,
        isViewOnce: f.viewOnce && !f.asDocument ? true : undefined,
      });
      break;
    }
    case 'vcard':
      res = await WPP.chat.sendVCardContactMessage(
        chatId,
        (msg.vcards ?? []).map((v) => ({ id: `${v.phone.replace(/\D/g, '')}@c.us`, name: v.name })),
        opts,
      );
      if (msg.text) await WPP.chat.sendTextMessage(chatId, msg.text, { createChat: true, linkPreview: false });
      break;
    case 'location': {
      const l = msg.location!;
      res = await WPP.chat.sendLocationMessage(chatId, { ...opts, lat: l.lat, lng: l.lng, name: l.name || undefined, address: l.address || undefined });
      break;
    }
    case 'poll': {
      const pl = msg.poll!;
      res = await WPP.chat.sendCreatePollMessage(chatId, pl.question, pl.options, { ...opts, selectableCount: pl.selectable });
      break;
    }
    case 'pix': {
      const px = msg.pix!;
      res = await WPP.chat.sendPixKeyMessage(chatId, { keyType: px.keyType, key: px.key, name: px.name, instructions: px.instructions || undefined }, opts);
      break;
    }
    case 'event': {
      const ev = msg.event!;
      res = await WPP.chat.sendEventMessage(chatId, {
        ...opts,
        name: ev.name,
        description: msg.text || undefined,
        startTime: ev.startTime,
        endTime: ev.endTime,
        callType: ev.callType,
      });
      break;
    }
    default:
      throw new Error('unknown_kind');
  }
  return { id: wid(res?.id) };
}

/* ------------------------- métodos ------------------------- */

type Handler = (p: any) => Promise<unknown> | unknown;

const handlers: Record<string, Handler> = {
  status: () => ({ ready: !!WPP?.isReady, me: myId(), version: WPP?.version ?? '' }),

  listChats: async () => (await WPP.chat.list()).map(chatInfo),

  listContacts: async () =>
    (await WPP.contact.list())
      .filter((c: any) => {
        const id = wid(c.id);
        return (id.endsWith('@c.us') || id.endsWith('@lid')) && !c.isMe;
      })
      .map(contactInfo),

  listGroups: async () => (await WPP.chat.list({ onlyGroups: true })).map(chatInfo),

  groupParticipants: async (p: { id: string }) => {
    const parts = await WPP.group.getParticipants(p.id);
    return (parts ?? []).map((x: any) => {
      const id = wid(x.id);
      const c = x.contact ?? getContact(id);
      return { id, phone: c ? contactPhone(c) : id.split('@')[0], name: c?.name || c?.pushname || '', isAdmin: !!x.isAdmin };
    });
  },

  listLabels: async (): Promise<LabelInfo[]> => {
    try {
      const labels = await WPP.labels.getAllLabels();
      return (labels ?? []).map((l: any) => ({ id: String(l.id), name: l.name, color: l.hexColor || l.color || '#888', count: l.count ?? 0 }));
    } catch {
      return [];
    }
  },

  broadcastMembers: async (p: { id: string }) => {
    const c = getChat(p.id);
    const meta = c?.broadcastMetadata ?? WPP.whatsapp?.BroadcastMetadataStore?.get?.(p.id);
    const recips = meta?.recipients?.getModelsArray?.() ?? meta?.recipients ?? [];
    return (Array.isArray(recips) ? recips : []).map((r: any) => wid(r.id ?? r));
  },

  queryExists: async (p: { phone: string }) => {
    const r = await WPP.contact.queryExists(`${p.phone}@c.us`);
    return r ? { exists: true, id: wid(r.wid) } : { exists: false, id: '' };
  },

  contactInfo: async (p: { id: string }) => {
    const id = p.id;
    const chat = getChat(id);
    const c = id.endsWith('@g.us') ? null : getContact(id);
    return {
      id,
      name: c?.name || '',
      pushname: c?.pushname || '',
      phone: c ? contactPhone(c) : id.endsWith('@c.us') ? id.split('@')[0] : '',
      isMyContact: !!c?.isMyContact,
      isGroup: id.endsWith('@g.us'),
      groupName: id.endsWith('@g.us') ? chatName(chat) : '',
      chatName: chatName(chat),
      labels: Array.isArray(chat?.labels) ? chat.labels.map(String) : [],
      archived: !!chat?.archive,
      pinned: !!chat?.pin,
      unread: chat?.unreadCount || 0,
    };
  },

  sendMessage: (p: SendParams) => sendResolved(p),

  chatAction: async (p: { chatId: string; action: string; msgId?: string; hours?: number; emoji?: string }) => {
    const { chatId } = p;
    switch (p.action) {
      case 'archive':
        return WPP.chat.archive(chatId, true);
      case 'unarchive':
        return WPP.chat.archive(chatId, false);
      case 'read':
        return WPP.chat.markIsRead(chatId);
      case 'unread':
        return WPP.chat.markIsUnread(chatId);
      case 'pin':
        return WPP.chat.pin(chatId, true);
      case 'unpin':
        return WPP.chat.pin(chatId, false);
      case 'togglePin': {
        const c = getChat(chatId);
        return WPP.chat.pin(chatId, !c?.pin);
      }
      case 'toggleRead': {
        const c = getChat(chatId);
        return c?.unreadCount ? WPP.chat.markIsRead(chatId) : WPP.chat.markIsUnread(chatId);
      }
      case 'mute':
        // muteHours < 0 = para sempre
        return WPP.chat.mute(chatId, p.hours && p.hours > 0 ? { duration: Math.round(p.hours * 3600) } : { expiration: -1 });
      case 'unmute':
        return WPP.chat.unmute(chatId);
      case 'delete':
        return WPP.chat.delete(chatId);
      case 'react':
        if (p.msgId) return WPP.chat.sendReactionToMessage(p.msgId, p.emoji || '👍');
        return null;
      case 'pinMsg':
        // 24 h, 7 dias ou 30 dias (opções do WhatsApp), em segundos
        if (p.msgId) return WPP.chat.pinMsg(p.msgId, true, Math.round((p.hours || 24) * 3600));
        return null;
      case 'like':
        return WPP.chat.sendTextMessage(chatId, '👍', { createChat: true, linkPreview: false });
      case 'block':
        return WPP.blocklist.blockContact(chatId);
      case 'unblock':
        return WPP.blocklist.unblockContact(chatId);
      case 'star':
        if (p.msgId) return WPP.chat.starMessage(p.msgId, true);
        return null;
      case 'open':
        await WPP.chat.find(chatId).catch(() => null);
        return WPP.chat.openChatBottom(chatId);
      default:
        throw new Error('unknown_action');
    }
  },

  labelChats: (p: { chatIds: string[]; add: string[]; remove: string[] }) => {
    const ops = [
      ...p.add.map((labelId) => ({ labelId, type: 'add' as const })),
      ...p.remove.map((labelId) => ({ labelId, type: 'remove' as const })),
    ];
    if (!ops.length) return null;
    return WPP.labels.addOrRemoveLabels(p.chatIds, ops);
  },

  groupParticipantsChange: (p: { groupId: string; participants: string[]; op: 'add' | 'remove' }) =>
    p.op === 'add' ? WPP.group.addParticipants(p.groupId, p.participants) : WPP.group.removeParticipants(p.groupId, p.participants),

  createGroup: async (p: { name: string; participants: string[]; description?: string }) => {
    const r = await WPP.group.create(p.name, p.participants);
    const gid = wid(r?.gid);
    if (gid && p.description) await WPP.group.setDescription(gid, p.description).catch(() => null);
    return { id: gid };
  },

  cloneGroup: async (p: { sourceId: string; name: string }) => {
    const parts = await WPP.group.getParticipants(p.sourceId);
    const me = myId();
    const ids = (parts ?? []).map((x: any) => wid(x.id)).filter((id: string) => id && id !== me);
    const chat = getChat(p.sourceId);
    const desc = chat?.groupMetadata?.desc || '';
    const r = await WPP.group.create(p.name, ids);
    const gid = wid(r?.gid);
    if (gid && desc) await WPP.group.setDescription(gid, desc).catch(() => null);
    return { id: gid, count: ids.length };
  },

  saveContact: async (p: { id: string; first: string; last: string }) => {
    await WPP.contact.save(p.id, p.first, { lastName: p.last || undefined, surname: p.last || undefined });
    return true;
  },

  openChat: async (p: { id: string }) => {
    await WPP.chat.find(p.id).catch(() => null);
    return WPP.chat.openChatBottom(p.id);
  },

  setInputText: async (p: { chatId?: string; text: string }) => {
    if (p.chatId && activeChatId() !== p.chatId) {
      await WPP.chat.openChatBottom(p.chatId);
      await sleep(400);
    }
    return WPP.chat.setInputText(p.text);
  },

  activeChat: () => activeChatId(),

  getMessages: async (p: { chatId: string; from?: number; to?: number; max?: number }) => {
    const msgs = await WPP.chat.getMessages(p.chatId, { count: Math.min(p.max ?? 5000, 20000) });
    const from = p.from ?? 0;
    const to = p.to ?? Number.MAX_SAFE_INTEGER;
    return (msgs ?? [])
      .filter((m: any) => (m.t ?? 0) * 1000 >= from && (m.t ?? 0) * 1000 <= to)
      .map((m: any) => ({
        id: wid(m.id),
        t: m.t,
        fromMe: !!m.id?.fromMe,
        sender: wid(m.author ?? m.from),
        type: m.type,
        body: m.type === 'chat' ? m.body : m.caption || '',
      }));
  },

  downloadMedia: async (p: { id: string }) => blobToDataUrl(await WPP.chat.downloadMedia(p.id)),

  /** Números para as estatísticas (contatos, grupos, conversas, canais, etiquetas, chamadas, produtos). */
  counts: async () => {
    const safe = async <T>(fn: () => Promise<T> | T, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch {
        return fallback;
      }
    };
    const chats: any[] = await safe(() => WPP.chat.list(), []);
    const contacts: any[] = await safe(() => WPP.contact.list(), []);
    const users = contacts.filter((c) => /@(c\.us|lid)$/.test(wid(c.id)) && !c.isMe);
    const labels: any[] = await safe(() => WPP.labels.getAllLabels(), []);
    const blocked: any[] = await safe(() => WPP.blocklist.all(), []);
    const channels = await safe(() => WPP.whatsapp?.NewsletterStore?.getModelsArray?.()?.length ?? 0, 0);
    const calls = await safe(() => WPP.whatsapp?.CallStore?.getModelsArray?.()?.length ?? 0, 0);
    const products = await safe(async () => (await WPP.catalog.getProducts(myId(), 1000))?.length ?? 0, 0);
    return {
      contacts: users.length,
      savedContacts: users.filter((c) => c.isMyContact).length,
      groups: chats.filter((c) => wid(c.id).endsWith('@g.us')).length,
      chats: chats.length,
      unreadChats: chats.filter((c) => (c.unreadCount || 0) > 0).length,
      archived: chats.filter((c) => c.archive).length,
      labels: labels.length,
      broadcastLists: chats.filter((c) => /@broadcast$/.test(wid(c.id)) && wid(c.id) !== 'status@broadcast').length,
      channels,
      calls,
      products,
      blocked: blocked.length,
    };
  },

  /** Fixar conversas só neste navegador, sem o limite de 3 (pinnedChats da referência: chat.pin = chat.t). */
  applyLocalPins: (p: { ids: string[]; previous: string[] }) => {
    for (const id of p.previous) {
      if (p.ids.includes(id)) continue;
      const c = getChat(id);
      if (c && c.__wwLocalPin) {
        c.pin = 0;
        c.__wwLocalPin = false;
      }
    }
    for (const id of p.ids) {
      const c = getChat(id);
      if (c && !c.pin) {
        c.pin = c.t || Math.floor(Date.now() / 1000);
        c.__wwLocalPin = true;
      }
    }
    return true;
  },

  /** Foto de perfil (URL) para a variável ${profilePicture}. */
  profilePicture: async (p: { id: string }) => {
    try {
      return (await WPP.contact.getProfilePictureUrl(p.id)) || '';
    } catch {
      return '';
    }
  },

  /** Mensagens de TODAS as conversas num período (exportação da referência, com limite). */
  allMessages: async (p: { from: number; to: number; max: number }) => {
    const out: any[] = [];
    const chats: any[] = await WPP.chat.list();
    for (const c of chats) {
      const id = wid(c.id);
      if (id === 'status@broadcast' || !c.t || c.t * 1000 < p.from) continue;
      const msgs: any[] = await WPP.chat.getMessages(id, { count: 500 }).catch(() => []);
      for (const m of msgs) {
        const ms = (m.t ?? 0) * 1000;
        if (ms < p.from || ms > p.to) continue;
        out.push({ chatId: id, chatName: chatName(c), isGroup: id.endsWith('@g.us'), id: wid(m.id), t: m.t, fromMe: !!m.id?.fromMe, sender: wid(m.author ?? m.from), type: m.type, body: m.type === 'chat' ? m.body : m.caption || '' });
        if (out.length >= p.max) return { messages: out, truncated: true };
      }
    }
    return { messages: out, truncated: false };
  },

  /** Últimas mensagens de texto da conversa (contexto da IA): minhas = "model", do contato = "user". */
  recentTexts: async (p: { chatId: string; count: number }) => {
    const msgs = await WPP.chat.getMessages(p.chatId, { count: Math.max(1, Math.min(100, p.count || 20)) * 2 });
    return (msgs ?? [])
      .filter((m: any) => ['chat', 'image', 'video', 'document'].includes(m.type) && (m.body || m.caption))
      .slice(-(p.count || 20))
      .map((m: any) => ({ role: m.id?.fromMe ? 'model' : 'user', text: m.type === 'chat' ? m.body : m.caption }));
  },

  /** Tipo e texto de uma mensagem pelo id (botões Traduzir/Transcrever). */
  messageInfo: async (p: { id: string }) => {
    const m = await WPP.chat.getMessageById(p.id).catch(() => null);
    if (!m) return null;
    return { id: wid(m.id), type: m.type, text: m.type === 'chat' ? m.body || '' : m.caption || '', chatId: wid(m.id?.remote), fromMe: !!m.id?.fromMe };
  },

  setPrivacy: (p: PrivacySettings) => applyPrivacy(p),

  typing: async (p: { chatId: string; ms: number }) => WPP.chat.markIsComposing(p.chatId, p.ms || 3000),

  /** Manda "@" marcando todos os membros do grupo (app.min.js 0x93663, palavras @todos/@everyone...). */
  mentionAll: async (p: { chatId: string }) => {
    const ids = await participantIds(p.chatId);
    if (!ids.length) return false;
    await WPP.chat.sendTextMessage(p.chatId, '@', { mentionedList: ids, linkPreview: false });
    return true;
  },

  subscribePresence: async (p: { ids: string[] }) => {
    if (!p.ids.length) return true;
    await WPP.contact.subscribePresence(p.ids);
    return true;
  },
};

/* ------------------------- ponte ------------------------- */

document.addEventListener(EV_REQ, async (e: Event) => {
  let req: BridgeRequest;
  try {
    req = JSON.parse(String((e as CustomEvent).detail));
  } catch {
    return;
  }
  const reply = (r: Omit<BridgeResponse, 'id'>) => send(EV_RES, { id: req.id, ...r });
  try {
    const h = handlers[req.method];
    if (!h) throw new Error(`unknown_method:${req.method}`);
    if (req.method !== 'status' && !WPP?.isReady) throw new Error('not_ready');
    const result = await h(req.params);
    reply({ ok: true, result: result === undefined ? null : JSON.parse(JSON.stringify(result ?? null)) });
  } catch (err) {
    reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/* ------------------------- eventos ------------------------- */

function setupEvents(): void {
  WPP.on('chat.new_message', (m: any) => {
    try {
      const chatId = wid(m.id?.remote ?? m.from);
      if (!chatId || m.isNotification) return;
      if (chatId === 'status@broadcast') {
        // status publicado por um contato: vira gatilho "status" (como a referência)
        if (!m.id?.fromMe) {
          const ev = msgEvent(m);
          const sender = wid(m.author ?? m.from);
          emit('status', { ...ev, chatId: sender, sender, isStatus: true });
        }
        return;
      }
      const ev = msgEvent(m);
      if (ev.type === 'e2e_notification' || ev.type === 'gp2' || ev.type === 'revoked') return;
      emit('message', ev);
    } catch {
      /* ignora mensagens que não dá para ler */
    }
  });

  WPP.on('chat.msg_revoke', (r: any) => {
    const chatId = wid(r.from ?? r.to);
    // como na referência (app.min.js 0x93663): só conversas de pessoas, grupos e lid
    if (!/@(c\.us|g\.us|lid)$/.test(chatId)) return;
    emit('revoke', { id: wid(r.refId), chatId });
  });

  WPP.on('call.incoming_call', (c: any) => {
    emit('call', { id: c.id, from: wid(c.sender ?? c.peerJid), isVideo: !!c.isVideo, isGroup: !!c.isGroup, myId: myId() });
  });

  WPP.on('group.participant_changed', (g: any) => {
    emit('group', { groupId: wid(g.groupId), action: g.action, participants: (g.participants ?? []).map(wid), myId: myId() });
  });

  WPP.on('chat.presence_change', (p: any) => {
    emit('presence', { id: wid(p.id), isOnline: !!p.isOnline, state: p.state || '', name: p.shortName || '' });
  });

  WPP.on('chat.active_chat', (c: any) => {
    emit('activeChat', { id: c ? wid(c.id) : null });
  });
}

/** Baixa a mídia de uma mensagem (para o anti-apagar), quando pedida pelo content. */
handlers.cacheMedia = async (p: { id: string; maxBytes: number }) => {
  const m = WPP.chat.getMessageById ? await WPP.chat.getMessageById(p.id).catch(() => null) : null;
  if (!m || !ATTACH_TYPES.includes(m.type)) return null;
  if (m.size && m.size > p.maxBytes) return null;
  const blob: Blob = await WPP.chat.downloadMedia(p.id);
  if (blob.size > p.maxBytes) return null;
  return blobToDataUrl(blob);
};

function boot(): void {
  if (typeof WPP === 'undefined') {
    setTimeout(boot, 500);
    return;
  }
  (WPP.loader ?? WPP.webpack).onReady(() => {
    setupEvents();
    emit('ready', { me: myId(), version: WPP.version });
  });
}

boot();
