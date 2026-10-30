'use client';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useLanguage } from '@/components/language';
import { translateV32 } from '@/lib/questionnaire-v32-i18n';
import type { Locale } from '@/lib/i18n';
export function localizeV32Tree(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === 'string') return translateV32(node, locale);
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return Children.map(node, (child) => localizeV32Tree(child, locale));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props.translate === 'no') return node;
  const next: Record<string, unknown> = {};
  if ('children' in element.props)
    next.children = localizeV32Tree(element.props.children as ReactNode, locale);
  for (const key of ['aria-label', 'title', 'placeholder', 'alt'])
    if (typeof element.props[key] === 'string')
      next[key] = translateV32(element.props[key] as string, locale);
  if (element.props.lang === 'fr') next.lang = locale;
  return cloneElement(element, next);
}
export function V32Localized({ children }: { children: ReactNode }) {
  const { locale } = useLanguage();
  return <>{localizeV32Tree(children, locale)}</>;
}
