// Componentes reutilizáveis do painel.

import { t } from '../../shared/i18n';
import { h, clear, type Child } from './h';
import { icon, type IconName } from './icons';

export interface UiRoot {
  /** Raiz dentro do Shadow DOM onde ficam modais, menus e avisos. */
  layer: HTMLElement;
}

let root: UiRoot | null = null;

export function setUiRoot(r: UiRoot): void {
  root = r;
}

function layer(): HTMLElement {
  if (!root) throw new Error('ui root not set');
  return root.layer;
}

export function btn(label: Child, onClick: (e: MouseEvent) => void, opts: { variant?: 'primary' | 'danger' | 'ghost'; icon?: IconName; small?: boolean; title?: string; disabled?: boolean } = {}): HTMLButtonElement {
  const cls = ['btn', opts.variant ?? '', opts.small ? 'small' : ''].filter(Boolean).join(' ');
  return h('button', { class: cls, title: opts.title, disabled: opts.disabled, onclick: onClick }, opts.icon ? icon(opts.icon, 17) : null, label);
}

export function iconBtn(name: IconName, title: string, onClick: (e: MouseEvent) => void, variant: 'ghost' | 'danger' = 'ghost'): HTMLButtonElement {
  return h('button', { class: `btn ghost ${variant === 'danger' ? 'danger' : ''}`, title, onclick: onClick }, icon(name, 18));
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string): HTMLElement {
  return h(
    'label',
    { class: 'toggle' },
    h('input', { type: 'checkbox', checked, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) }),
    h('span', { class: 'sw' }),
    h('span', { class: 'txt' }, label, hint ? h('div', { class: 'hint' }, hint) : null),
  );
}

export function check(label: Child, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) }), h('span', null, label));
}

export function field(label: string, control: Child, hint?: string): HTMLElement {
  return h('label', { class: 'field' }, label, control, hint ? h('span', { class: 'hint' }, hint) : null);
}

export function textInput(value: string, onInput: (v: string) => void, attrs: Record<string, unknown> = {}): HTMLInputElement {
  return h('input', { type: 'text', value: value ?? '', oninput: (e: Event) => onInput((e.target as HTMLInputElement).value), ...attrs });
}

export function numInput(value: number, onInput: (v: number) => void, attrs: Record<string, unknown> = {}): HTMLInputElement {
  return h('input', { type: 'number', class: 'num', value: String(value ?? 0), oninput: (e: Event) => onInput(Number((e.target as HTMLInputElement).value) || 0), ...attrs });
}

export function textArea(value: string, onInput: (v: string) => void, attrs: Record<string, unknown> = {}): HTMLTextAreaElement {
  const ta = h('textarea', { oninput: (e: Event) => onInput((e.target as HTMLTextAreaElement).value), ...attrs });
  ta.value = value ?? '';
  return ta;
}

export function selectBox<T extends string>(options: { value: T; label: string }[], value: T, onChange: (v: T) => void): HTMLSelectElement {
  const s = h('select', { onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value as T) }, ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  return s;
}

export function segmented<T extends string>(options: { value: T; label: string }[], value: T, onChange: (v: T) => void): HTMLElement {
  const wrap = h('div', { class: 'seg' });
  const render = (v: T) => {
    clear(wrap);
    for (const o of options)
      wrap.appendChild(
        h('button', {
          class: o.value === v ? 'on' : '',
          type: 'button',
          onclick: () => {
            onChange(o.value);
            render(o.value);
          },
        }, o.label),
      );
  };
  render(value);
  return wrap;
}

export interface PickItem {
  id: string;
  label: string;
  sub?: string;
}

/** Lista com busca e caixas de seleção. Altera `selected` no lugar e avisa em onChange. */
export function picker(items: PickItem[], selected: string[], onChange: (ids: string[]) => void, opts: { emptyText?: string } = {}): HTMLElement {
  const sel = new Set(selected);
  let query = '';
  const list = h('div', { class: 'pl' });
  const count = h('span', { class: 'count' });
  const emit = () => {
    count.textContent = `${sel.size} ${t('selected')}`;
    onChange(Array.from(sel));
  };
  const render = () => {
    clear(list);
    const q = query.trim().toLowerCase();
    const shown = items.filter((i) => !q || i.label.toLowerCase().includes(q) || (i.sub ?? '').toLowerCase().includes(q)).slice(0, 400);
    if (!shown.length) list.appendChild(h('div', { class: 'hint', style: 'padding:8px 0' }, opts.emptyText ?? t('empty')));
    for (const it of shown)
      list.appendChild(
        check([it.label, it.sub ? h('small', null, it.sub) : null], sel.has(it.id), (v) => {
          if (v) sel.add(it.id);
          else sel.delete(it.id);
          emit();
        }),
      );
  };
  const search = h('input', {
    type: 'search',
    placeholder: t('search'),
    oninput: (e: Event) => {
      query = (e.target as HTMLInputElement).value;
      render();
    },
  });
  const all = btn(t('selectAll'), () => {
    const q = query.trim().toLowerCase();
    items.filter((i) => !q || i.label.toLowerCase().includes(q)).forEach((i) => sel.add(i.id));
    render();
    emit();
  }, { small: true });
  const none = btn(t('selectNone'), () => {
    sel.clear();
    render();
    emit();
  }, { small: true });
  render();
  count.textContent = `${sel.size} ${t('selected')}`;
  return h('div', { class: 'picker' }, h('div', { class: 'ph' }, search, all, none, count), list);
}

export function daysPicker(days: number[], onChange: (d: number[]) => void): HTMLElement {
  const names = t('dayNames').split(',');
  const sel = new Set(days);
  return h(
    'div',
    { class: 'row' },
    names.map((n, i) =>
      check(n, sel.has(i), (v) => {
        if (v) sel.add(i);
        else sel.delete(i);
        onChange(Array.from(sel).sort());
      }),
    ),
  );
}

export interface ModalHandle {
  close(): void;
  body: HTMLElement;
}

export function modal(title: string, content: Child, footer: (close: () => void) => Child, opts: { wide?: boolean; onClose?: () => void } = {}): ModalHandle {
  const body = h('div', { class: 'mb' }, content);
  let overlay: HTMLElement;
  const close = () => {
    overlay.remove();
    opts.onClose?.();
  };
  const box = h(
    'div',
    { class: 'modal', style: opts.wide ? 'width:680px' : undefined },
    h('div', { class: 'mh' }, h('span', { class: 'grow', style: 'flex:1' }, title), iconBtn('close', t('close'), close)),
    body,
    h('div', { class: 'mf' }, footer(close)),
  );
  overlay = h('div', {
    class: 'overlay',
    onmousedown: (e: MouseEvent) => {
      if (e.target === overlay) close();
    },
  }, box);
  layer().appendChild(overlay);
  return { close, body };
}

export function confirmBox(text: string, okLabel = t('yes')): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(t('appName'), h('div', null, text), (close) => [
      btn(t('no'), () => {
        done = true;
        resolve(false);
        close();
      }),
      btn(okLabel, () => {
        done = true;
        resolve(true);
        close();
      }, { variant: 'primary' }),
    ], {
      onClose: () => {
        if (!done) resolve(false);
      },
    });
    void m;
  });
}

let toastHost: HTMLElement | null = null;

export function toast(text: string, kind: 'info' | 'ok' | 'error' = 'info'): void {
  if (!toastHost || !toastHost.isConnected) {
    toastHost = h('div', { class: 'toasts' });
    layer().appendChild(toastHost);
  }
  const el = h('div', { class: `toast ${kind === 'info' ? '' : kind}` }, text);
  toastHost.appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 4200);
}

/** Menu flutuante ancorado num ponto da tela. */
export function popupMenu(x: number, y: number, entries: { label: string; sub?: string; onClick: () => void }[], emptyText = t('empty')): () => void {
  const menu = h('div', { class: 'menu' });
  if (!entries.length) menu.appendChild(h('div', { class: 'mt', style: 'text-transform:none' }, emptyText));
  for (const e of entries)
    menu.appendChild(
      h('button', {
        class: 'mi',
        onclick: () => {
          closeMenu();
          e.onClick();
        },
      }, e.label, e.sub ? h('small', null, e.sub) : null),
    );
  layer().appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  const onDoc = (ev: MouseEvent) => {
    if (!ev.composedPath().includes(menu)) closeMenu();
  };
  function closeMenu() {
    menu.remove();
    document.removeEventListener('mousedown', onDoc, true);
  }
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  return closeMenu;
}

export function emptyState(text = t('empty')): HTMLElement {
  return h('div', { class: 'empty' }, text);
}
