import type { Answers, AnswerValue, Condition } from './domain';

export type Truth = 'true' | 'false' | 'unknown' | 'conflict';
export type Fact = {
  state: 'known' | 'unknown' | 'conflict';
  value?: AnswerValue;
  origins: string[];
};

export function isUnknown(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' && !Number.isFinite(value)) ||
    (Array.isArray(value) &&
      (value.length === 0 ||
        value.some(
          (v) => typeof v === 'string' && ['inconnu', 'inconnue'].includes(v.trim().toLowerCase()),
        ))) ||
    (typeof value === 'string' && ['', 'inconnu', 'inconnue'].includes(value.trim().toLowerCase()))
  );
}

export function fact(value: AnswerValue | undefined, origin: string): Fact {
  return isUnknown(value)
    ? { state: 'unknown', origins: [origin] }
    : { state: 'known', value, origins: [origin] };
}

// Use only for declarations about the SAME actor, operation and fact.
// A supplier's product capability and UNIL's intended use are not interchangeable.
export function reconcileFacts(values: Fact[]): Fact {
  const origins = [...new Set(values.flatMap((v) => v.origins))];
  const known = values.filter((v) => v.state === 'known');
  const signature = (v: AnswerValue | undefined) =>
    JSON.stringify(Array.isArray(v) ? [...v].sort() : v);
  if (
    values.some((v) => v.state === 'conflict') ||
    new Set(known.map((v) => signature(v.value))).size > 1
  )
    return { state: 'conflict', origins };
  return known.length
    ? { state: 'known', value: known[0].value, origins }
    : { state: 'unknown', origins };
}

export function oneOf(value: Fact, options: string[]): Truth {
  if (value.state !== 'known') return value.state;
  return options.some((option) =>
    Array.isArray(value.value) ? value.value.includes(option) : value.value === option,
  )
    ? 'true'
    : 'false';
}

export function anyOf(values: Truth[]): Truth {
  if (values.includes('conflict')) return 'conflict';
  if (values.includes('true')) return 'true';
  return values.includes('unknown') ? 'unknown' : 'false';
}

export function allOf(values: Truth[]): Truth {
  if (values.includes('conflict')) return 'conflict';
  if (values.includes('false')) return 'false';
  return values.includes('unknown') ? 'unknown' : 'true';
}

export const activationDependencies: Record<string, string[]> = {
  '@data': ['U11', 'U12', 'S-U-GDPR-DATA', 'S-F-GDPR-DATA', 'S-F-LPD-DATA', 'S-U-VD-DATA'],
  '@subprocessors': ['@data', 'P-F-SUB'],
  '@transfer': ['@data', 'F24a', 'P-U-EEA', 'P-F-EEA'],
  '@confidential': ['U11', 'U13', 'F22'],
  '@consequential': ['U06', 'U07', 'U08', 'U09', 'U10', 'U23', 'F13'],
  '@prohibited': ['F15', 'F14'],
};

export function conditionTruth(condition: Condition | undefined, answers: Answers): Truth {
  if (!condition) return 'true';
  const answer = (id: string, options: string[]) => oneOf(fact(answers[id], id), options);
  let signal: Truth;
  switch (condition.id) {
    case '@data':
      signal = anyOf([
        answer('U11', ['Personnelles']),
        answer('U12', ['Oui']),
        ...['S-U-GDPR-DATA', 'S-F-GDPR-DATA', 'S-F-LPD-DATA'].map((id) => answer(id, ['Oui'])),
      ]);
      break;
    case '@subprocessors':
      signal = allOf([
        conditionTruth({ id: '@data', values: ['Oui'] }, answers),
        answer('P-F-SUB', ['Oui']),
      ]);
      break;
    case '@transfer':
      signal = allOf([
        conditionTruth({ id: '@data', values: ['Oui'] }, answers),
        anyOf(['F24a', 'P-U-EEA', 'P-F-EEA'].map((id) => answer(id, ['Oui']))),
      ]);
      break;
    case '@confidential':
      signal = anyOf([
        answer('U11', ['Confidentielles']),
        answer('U13', ['Oui']),
        answer('F22', ['Oui', 'Selon configuration']),
      ]);
      break;
    case '@consequential': {
      const internal = anyOf(
        ['U06', 'U07', 'U08', 'U09', 'U10', 'U23'].map((id) => answer(id, ['Oui'])),
      );
      // Product intended use is additional information only when internal use is unresolved.
      signal = internal === 'unknown' && answer('F13', ['Oui']) === 'true' ? 'true' : internal;
      break;
    }
    case '@prohibited':
      signal = anyOf([
        answer('F15', ['Oui']),
        answer('F14', ['Inférence des émotions', 'Les deux']),
      ]);
      break;
    default:
      return answer(condition.id, condition.values);
  }
  if (signal === 'unknown' || signal === 'conflict') return signal;
  return condition.values.includes(signal === 'true' ? 'Oui' : 'Non') ? 'true' : 'false';
}

/** Full closure, including parent conditions and derived activation signals. */
export function dependencyClosure(
  ids: string[],
  conditions: Map<string, Condition | undefined>,
): string[] {
  const found = new Set<string>();
  const visit = (id: string) => {
    if (found.has(id)) return;
    found.add(id);
    for (const child of activationDependencies[id] ?? []) visit(child);
    const condition = conditions.get(id);
    if (condition) visit(condition.id);
  };
  ids.forEach(visit);
  return [...found].filter((id) => !id.startsWith('@')).sort();
}

/** Calendar-month addition with a clamped month end; returns null for incomplete/invalid facts. */
export function contractEndDate(start: string, months: unknown): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    typeof months !== 'number' ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 1200
  )
    return null;
  const date = new Date(`${start}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) return null;
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  if (target.getUTCFullYear() > 9999) return null;
  const last = new Date(target);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  target.setUTCDate(Math.min(date.getUTCDate(), last.getUTCDate()));
  return target.toISOString().slice(0, 10);
}
