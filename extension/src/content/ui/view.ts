import type { I18nKey } from '../../shared/i18n';
import type { WwData } from '../../shared/types';
import type { App } from '../app';
import type { IconName } from './icons';

export interface ViewCtx {
  app: App;
  rerender(): void;
  setTab(id: string, payload?: unknown): void;
  payload?: unknown;
}

export interface View {
  id: string;
  label: I18nKey;
  icon: IconName;
  /** Campos do estado que, quando mudam, redesenham esta tela. */
  fields: (keyof WwData)[];
  render(ctx: ViewCtx): HTMLElement;
}
