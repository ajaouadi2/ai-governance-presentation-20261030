'use client';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode, ReactElement } from 'react';
import { translate } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { usePathname } from 'next/navigation';
const LanguageContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: 'fr',
  setLocale: () => {},
});
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `clair-language=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
    const title = pathname?.startsWith('/projects')
      ? locale === 'en'
        ? 'Projects and assessments'
        : 'Projets et évaluations'
      : pathname?.startsWith('/guide')
        ? locale === 'en'
          ? 'Process guide'
          : 'Guide du parcours'
        : pathname?.startsWith('/questionnaire-v32')
          ? locale === 'en'
            ? 'Checklist v3.2'
            : 'Checklist v3.2'
          : pathname?.startsWith('/demo')
            ? locale === 'en'
              ? 'Presenter guide'
              : 'Fiche présentateur'
            : pathname?.startsWith('/archives')
              ? locale === 'en'
                ? 'Archives'
                : 'Archives'
              : null;
    if (title)
      document.title = `${title} · ${locale === 'en' ? 'AI tool assessment' : 'Évaluation des outils d’IA'}`;
  }, [locale, pathname]);
  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale: (value) => {
          document.cookie = `clair-language=${value}; Path=/; SameSite=Lax; Max-Age=31536000`;
          setLocale(value);
        },
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={locale === 'fr' ? 'Langue de l’interface' : 'Interface language'}
      translate="no"
    >
      {(['fr', 'en'] as const).map((value) => (
        <button
          type="button"
          key={value}
          lang={value}
          aria-label={value === 'fr' ? 'Français' : 'English'}
          aria-pressed={locale === value}
          onClick={() => setLocale(value)}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Translate rendered interface copy, not IDs, event handlers, values or state.
 * Each custom component owns a boundary; no DOM mutation or external service is used.
 * User-authored content opts out with translate="no".
 */
export function localizeTree(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === 'string') return translate(node, locale);
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return Children.map(node, (child) => localizeTree(child, locale));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props = element.props;
  if (props.translate === 'no') return node;
  const next: Record<string, unknown> = {};
  if ('children' in props) next.children = localizeTree(props.children as ReactNode, locale);
  for (const key of ['aria-label', 'title', 'placeholder', 'alt'])
    if (typeof props[key] === 'string') next[key] = translate(props[key] as string, locale);
  return cloneElement(element, next);
}
export function Localized({ children }: { children: ReactNode }) {
  const { locale } = useLanguage();
  return <>{localizeTree(children, locale)}</>;
}
