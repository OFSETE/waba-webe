// Listas do WhatsApp (conversas, contatos, grupos, etiquetas), buscadas sob demanda.

import type { ChatInfo, ContactInfo, LabelInfo } from '../shared/types';
import type { Bridge } from './bridge';

export class Directory {
  chats: ChatInfo[] = [];
  contacts: ContactInfo[] = [];
  labels: LabelInfo[] = [];
  loadedAt = 0;
  private loading: Promise<void> | null = null;

  constructor(private bridge: Bridge) {}

  get groups(): ChatInfo[] {
    return this.chats.filter((c) => c.isGroup);
  }

  get broadcastLists(): ChatInfo[] {
    return this.chats.filter((c) => c.isBroadcast && c.id !== 'status@broadcast');
  }

  /** Recarrega se os dados têm mais de 60 s (ou se force). */
  async refresh(force = false): Promise<void> {
    if (!force && Date.now() - this.loadedAt < 60_000 && this.loadedAt) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const [chats, contacts, labels] = await Promise.all([
          this.bridge.call<ChatInfo[]>('listChats').catch(() => this.chats),
          this.bridge.call<ContactInfo[]>('listContacts').catch(() => this.contacts),
          this.bridge.call<LabelInfo[]>('listLabels').catch(() => this.labels),
        ]);
        this.chats = chats;
        this.contacts = contacts;
        this.labels = labels;
        this.loadedAt = Date.now();
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  nameOf(id: string): string {
    const c = this.chats.find((x) => x.id === id);
    if (c?.name) return c.name;
    const k = this.contacts.find((x) => x.id === id);
    if (k) return k.name || k.pushname || k.phone;
    return id.split('@')[0];
  }

  labelName(id: string): string {
    return this.labels.find((l) => l.id === id)?.name ?? id;
  }
}
