// Display references only. No new legal obligations or routing rules are inferred.
// Article numbers below are explicit references in the existing questionnaire.
const laws = {
  AI: [
    'Règlement sur l’intelligence artificielle (UE) 2024/1689',
    'Artificial Intelligence Act (EU) 2024/1689',
    'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
  ],
  VD: [
    'Loi vaudoise sur la protection des données personnelles (LPrD)',
    'Vaud Personal Data Protection Act (LPrD)',
    'https://prestations.vd.ch/pub/blv-publication/actes/consolide/172.65?id=cf9df545-13f7-4106-a95b-9b3ab8fa8b01&key=1543934892528',
  ],
  LPD: [
    'Loi fédérale sur la protection des données (LPD)',
    'Federal Act on Data Protection (LPD)',
    'https://www.fedlex.admin.ch/eli/cc/2022/491/fr',
  ],
  OP: [
    'Ordonnance sur la protection des données (OPDo)',
    'Data Protection Ordinance (OPDo)',
    'https://www.fedlex.admin.ch/eli/cc/2022/568/fr',
  ],
  RG: [
    'Règlement général sur la protection des données (UE) 2016/679',
    'General Data Protection Regulation (EU) 2016/679',
    'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
  ],
  MP: [
    'Accord intercantonal sur les marchés publics (AIMP 2019)',
    'Intercantonal Agreement on Public Procurement (AIMP 2019)',
    'https://prestations.vd.ch/pub/blv-publication/actes/consolide/726.91?id=33f91cc1-e0fd-4ede-9a24-780a5f65ec15&key=1746516330094',
  ],
  CS: [
    'Constitution fédérale (Cst.)',
    'Federal Constitution (Cst.)',
    'https://www.fedlex.admin.ch/eli/cc/1999/404/fr',
  ],
  CD: [
    'Convention relative aux droits des personnes handicapées (CDPH)',
    'Convention on the Rights of Persons with Disabilities (CDPH)',
    'https://www.fedlex.admin.ch/eli/cc/2014/245/fr',
  ],
  UL: [
    'Loi sur l’Université de Lausanne (LUL)',
    'University of Lausanne Act (LUL)',
    'https://prestations.vd.ch/pub/blv-publication/actes/consolide/414.11?id=d058f36a-66d6-487b-820d-529dbdad74d8&key=1634050561234',
  ],
} as const;
type Law = keyof typeof laws;
type Citation = [Law, string];
const refs: Record<string, Citation[]> = {};
const add = (stage: number, question: number, ...citations: Citation[]) => {
  refs[`V32-S${String(stage).padStart(2, '0')}-Q${String(question).padStart(2, '0')}`] = citations;
};
add(0, 1, ['AI', 'art. 2']);
add(1, 2, ['VD', 'art. 5']);
add(1, 5, ['VD', 'art. 7']);
add(1, 6, ['VD', 'art. 10']);
add(1, 9, ['VD', 'art. 18']);
add(2, 1, ['AI', 'art. 5 § 1']);
add(2, 2, ['AI', 'art. 6 ; annexes I et III']);
add(2, 3, ['AI', 'art. 3 § 3 ; art. 25 § 1']);
for (const [q, article] of Object.entries({
  4: '26 § 2',
  5: '27',
  6: '26 § 6',
  7: '86',
  8: '26 § 7',
  9: '26 § 11',
  10: '26 § 8 ; art. 49',
  11: '26 § 5',
  12: '50 § 4',
  13: '4',
}))
  add(2, Number(q), ['AI', `art. ${article}`]);
add(2, 15, ['CS', 'art. 8 al. 2']);
add(3, 1, ['MP', 'art. 8']);
add(3, 2, ['MP', 'art. 25']);
add(3, 4, ['MP', 'annexes 1 et 2']);
add(3, 6, ['MP', 'art. 21 al. 2']);
add(4, 1, ['MP', 'art. 44']);
add(4, 2, ['MP', 'art. 12 et 26']);
add(4, 3, ['MP', 'art. 27']);
add(4, 4, ['MP', 'art. 27']);
for (let q = 1; q <= 4; q++) add(5, q, ['VD', 'art. 17 al. 1'], ['OP', 'annexe 1']);
add(5, 5, ['VD', 'art. 17 al. 2']);
add(5, 6, ['VD', 'art. 11']);
add(5, 7, ['VD', 'art. 10'], ['LPD', 'art. 8']);
add(5, 11, ['LPD', 'art. 24 al. 3'], ['RG', 'art. 33']);
add(5, 12, ['VD', 'art. 10'], ['LPD', 'art. 8'], ['OP', 'art. 1 à 3']);
add(5, 14, ['AI', 'art. 15']);
add(5, 15, ['OP', 'art. 4']);
add(5, 16, ['OP', 'art. 4 al. 1 et 4']);
add(5, 17, ['VD', 'art. 10'], ['OP', 'art. 4 al. 5'], ['AI', 'art. 12 ; art. 26 § 6']);
for (const [q, article] of Object.entries({
  1: '50 § 1',
  2: '50 § 2',
  3: '47 à 49',
  4: '13 et 15',
  5: '14',
  6: '13, 27 et 86',
  10: '43 § 4',
  11: '15 § 5',
  12: '13 § 3 let. b ; art. 15 § 1',
  14: '15 § 5',
  17: '26 § 5',
}))
  add(6, Number(q), ['AI', `art. ${article}`]);
add(6, 7, ['VD', 'art. 18'], ['LPD', 'art. 9']);
for (const q of [15, 16]) add(6, q, ['VD', 'art. 10'], ['LPD', 'art. 8'], ['OP', 'art. 1 à 3']);
add(6, 18, ['LPD', 'art. 8'], ['AI', 'art. 15']);
add(6, 19, ['CS', 'art. 8'], ['AI', 'art. 10']);
add(6, 20, ['CS', 'art. 8 al. 2'], ['CD', 'art. 9 et 24']);
add(6, 21, ['UL', 'art. 15 al. 1 et 3'], ['CS', 'art. 20']);
add(6, 22, ['AI', 'annexe XI']);
add(7, 1, ['AI', 'art. 53']);
add(7, 6, ['AI', 'art. 51 et 52']);
add(9, 3, ['AI', 'art. 26 § 5']);
export function v32LegalReferences(id: string, locale: 'fr' | 'en' = 'fr') {
  return (refs[id] ?? []).map(([law, article]) => ({
    law,
    article:
      locale === 'en'
        ? article
            .replace(/annexes/g, 'annexes')
            .replace(/annexe/g, 'annex')
            .replace(/ et /g, ' and ')
            .replace(/ à /g, '–')
        : article,
    title: laws[law][locale === 'en' ? 1 : 0],
    url: laws[law][2],
  }));
}
