export interface CountryItem {
  code: string;
  name: string;
  flag: string;
  keywords?: string;
}

export const COUNTRIES: CountryItem[] = [
  // ─── Pays Fréquents / Principaux ──────────────────────────────────────────
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', keywords: 'burkina faso ouaga ouagadougou' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', keywords: 'cote ivoire abidjan ivorie cotedivoire' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', keywords: 'senegal dakar' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', keywords: 'mali bamako' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', keywords: 'togo lome' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', keywords: 'benin cotonou porto-novo' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', keywords: 'niger niamey' },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳', keywords: 'guinee conakry' },
  { code: 'CD', name: 'Congo (RDC)', flag: '🇨🇩', keywords: 'rdc congo rdc congo-kinshasa kinshasa zaire drc' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲', keywords: 'cameroun yaounde douala cameroon' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', keywords: 'gabon libreville' },
  { code: 'CG', name: 'Congo (Brazzaville)', flag: '🇨🇬', keywords: 'congo-brazzaville brazzaville brazza' },
  { code: 'TD', name: 'Tchad', flag: '🇹🇩', keywords: 'tchad ndjamena chad' },
  { code: 'FR', name: 'France', flag: '🇫🇷', keywords: 'france paris' },

  // ─── Tous les autres Pays Africains (Ordre alphabétique) ────────────────────
  { code: 'ZA', name: 'Afrique du Sud', flag: '🇿🇦', keywords: 'south africa pretoria johannesburg' },
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿', keywords: 'algerie alger algeria' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴', keywords: 'angola luanda' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', keywords: 'botswana gaborone' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', keywords: 'burundi bujumbura gitega' },
  { code: 'CV', name: 'Cap-Vert', flag: '🇨🇻', keywords: 'cap-vert praia cape verde' },
  { code: 'CF', name: 'Centrafrique (RCA)', flag: '🇨🇫', keywords: 'centrafrique rca bangui' },
  { code: 'KM', name: 'Comores', flag: '🇰🇲', keywords: 'comores moroni' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯', keywords: 'djibouti' },
  { code: 'EG', name: 'Égypte', flag: '🇪🇬', keywords: 'egypte cairo le caire egypt' },
  { code: 'ER', name: 'Érythrée', flag: '🇪🇷', keywords: 'erythree asmara eritrea' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿', keywords: 'eswatini swaziland mbabane' },
  { code: 'ET', name: 'Éthiopie', flag: '🇪🇹', keywords: 'ethiopie addis abeba ethiopia' },
  { code: 'GM', name: 'Gambie', flag: '🇬🇲', keywords: 'gambie banjul gambia' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', keywords: 'ghana accra' },
  { code: 'GW', name: 'Guinée-Bissau', flag: '🇬🇼', keywords: 'guinee-bissau bissau' },
  { code: 'GQ', name: 'Guinée équatoriale', flag: '🇬🇶', keywords: 'guinee equatoriale malabo' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', keywords: 'kenya nairobi' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸', keywords: 'lesotho maseru' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷', keywords: 'liberia monrovia' },
  { code: 'LY', name: 'Libye', flag: '🇱🇾', keywords: 'libye tripoli libya' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', keywords: 'madagascar antananarivo' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', keywords: 'malawi lilongwe' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦', keywords: 'maroc rabat casablanca morocco' },
  { code: 'MU', name: 'Maurice', flag: '🇲🇺', keywords: 'maurice mauritius port-louis' },
  { code: 'MR', name: 'Mauritanie', flag: '🇲🇷', keywords: 'mauritanie nouakchott' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', keywords: 'mozambique maputo' },
  { code: 'NA', name: 'Namibie', flag: '🇳🇦', keywords: 'namibie windhoek namibia' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', keywords: 'nigeria lagos abuja' },
  { code: 'UG', name: 'Ouganda', flag: '🇺🇬', keywords: 'ouganda kampala uganda' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', keywords: 'rwanda kigali' },
  { code: 'ST', name: 'São Tomé-et-Príncipe', flag: '🇸🇹', keywords: 'sao tome principe' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', keywords: 'seychelles victoria' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱', keywords: 'sierra leone freetown' },
  { code: 'SO', name: 'Somalie', flag: '🇸🇴', keywords: 'somalie mogadiscio somalia' },
  { code: 'SD', name: 'Soudan', flag: '🇸🇩', keywords: 'soudan khartoum sudan' },
  { code: 'SS', name: 'Soudan du Sud', flag: '🇸🇸', keywords: 'soudan du sud juba south sudan' },
  { code: 'TZ', name: 'Tanzanie', flag: '🇹🇿', keywords: 'tanzanie dodoma dar es salaam tanzania' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳', keywords: 'tunisie tunis tunisia' },
  { code: 'ZM', name: 'Zambie', flag: '🇿🇲', keywords: 'zambie lusaka zambia' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', keywords: 'zimbabwe harare' },

  // ─── Diaspora & Partenaires Fréquents ───────────────────────────────────────
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', keywords: 'belgique bruxelles belgium' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', keywords: 'canada quebec montreal ottawa' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭', keywords: 'suisse geneve zurich switzerland' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', keywords: 'etats-unis usa america new york' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', keywords: 'royaume-uni uk angleterre londres london' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', keywords: 'allemagne berlin germany' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹', keywords: 'italie rome milan italy' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸', keywords: 'espagne madrid spain' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', keywords: 'portugal lisbonne' },
  { code: 'AE', name: 'Émirats arabes unis', flag: '🇦🇪', keywords: 'emirats uae dubai abu dhabi' },
  { code: 'CN', name: 'Chine', flag: '🇨🇳', keywords: 'chine china beijing guangzhou' },
  { code: 'TR', name: 'Turquie', flag: '🇹🇷', keywords: 'turquie turkey istanbul' },

  // ─── Option Manuelle ────────────────────────────────────────────────────────
  { code: 'OTHER', name: 'Autre (Saisie manuelle)', flag: '🌐', keywords: 'autre other custom manuel' },
];

/**
 * Vérifie si le code pays fait partie de la liste standard
 */
export function isStandardCountry(code: string): boolean {
  if (!code || code === 'OTHER') return false;
  return COUNTRIES.some(c => c.code === code && c.code !== 'OTHER');
}

/**
 * Retourne le libellé complet du pays (avec drapeau si disponible)
 */
export function getCountryName(code: string): string {
  if (!code) return 'Sélectionner…';
  const found = COUNTRIES.find(c => c.code === code);
  if (found) {
    return found.flag ? `${found.flag} ${found.name}` : found.name;
  }
  return `Autre (${code})`;
}

/**
 * Normalise une chaîne pour la recherche (minuscule, sans accents)
 */
function normalizeStr(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filtre les pays par terme de recherche
 */
export function filterCountries(query: string): CountryItem[] {
  const q = normalizeStr(query.trim());
  if (!q) return COUNTRIES;

  return COUNTRIES.filter(c => {
    const nameNorm = normalizeStr(c.name);
    const codeNorm = normalizeStr(c.code);
    const keywNorm = normalizeStr(c.keywords || '');
    return nameNorm.includes(q) || codeNorm.includes(q) || keywNorm.includes(q);
  });
}
