import { translate } from './i18n';
import type { Locale } from './i18n';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const decode = (s: string) =>
  s.replace(
    /&(?:amp|lt|gt|quot|#39);/g,
    (c) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[c]!,
  );
/** The input is our escaped report template, not arbitrary user HTML.
 * Preserve user-authored text and CSS. Only presentation text is localised.
 */
export function translateReportHtml(html: string, locale: Locale) {
  if (locale === 'fr') return html;
  const stack: { tag: string; skip: boolean }[] = [];
  return html.replace(/<[^>]*>|[^<]+/g, (token) => {
    if (token.startsWith('<')) {
      const closing = token.match(/^<\/([\w-]+)/);
      if (closing) {
        if (stack.at(-1)?.tag === closing[1].toLowerCase()) stack.pop();
        return token;
      }
      const opening = token.match(/^<([\w-]+)/);
      if (opening && !/^(meta|br|hr|img|input|link|wbr)$/i.test(opening[1]))
        stack.push({
          tag: opening[1].toLowerCase(),
          skip:
            !!stack.at(-1)?.skip ||
            /translate="no"/.test(token) ||
            /^(style|script)$/i.test(opening[1]),
        });
      return token.replace('<html lang="fr"', '<html lang="en"');
    }
    if (stack.at(-1)?.skip) return token;
    const value = decode(token);
    const translated = translate(value, locale);
    return translated === value ? token : escape(translated);
  });
}
