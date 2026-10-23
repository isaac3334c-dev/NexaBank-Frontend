export interface Country {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
}

// Dial codes per ITU-T E.164/E.123. List is curated (not exhaustive) —
// Latin America first since NexaBank's demo market is Peru, then the rest
// of the countries a wallet app would realistically need.
export const COUNTRIES: Country[] = [
  { iso2: 'PE', name: 'Perú', dialCode: '51', flag: '🇵🇪' },
  { iso2: 'CL', name: 'Chile', dialCode: '56', flag: '🇨🇱' },
  { iso2: 'CO', name: 'Colombia', dialCode: '57', flag: '🇨🇴' },
  { iso2: 'EC', name: 'Ecuador', dialCode: '593', flag: '🇪🇨' },
  { iso2: 'BO', name: 'Bolivia', dialCode: '591', flag: '🇧🇴' },
  { iso2: 'AR', name: 'Argentina', dialCode: '54', flag: '🇦🇷' },
  { iso2: 'BR', name: 'Brasil', dialCode: '55', flag: '🇧🇷' },
  { iso2: 'PY', name: 'Paraguay', dialCode: '595', flag: '🇵🇾' },
  { iso2: 'UY', name: 'Uruguay', dialCode: '598', flag: '🇺🇾' },
  { iso2: 'VE', name: 'Venezuela', dialCode: '58', flag: '🇻🇪' },
  { iso2: 'MX', name: 'México', dialCode: '52', flag: '🇲🇽' },
  { iso2: 'PA', name: 'Panamá', dialCode: '507', flag: '🇵🇦' },
  { iso2: 'CR', name: 'Costa Rica', dialCode: '506', flag: '🇨🇷' },
  { iso2: 'GT', name: 'Guatemala', dialCode: '502', flag: '🇬🇹' },
  { iso2: 'DO', name: 'República Dominicana', dialCode: '1', flag: '🇩🇴' },
  { iso2: 'US', name: 'Estados Unidos', dialCode: '1', flag: '🇺🇸' },
  { iso2: 'CA', name: 'Canadá', dialCode: '1', flag: '🇨🇦' },
  { iso2: 'ES', name: 'España', dialCode: '34', flag: '🇪🇸' },
  { iso2: 'PT', name: 'Portugal', dialCode: '351', flag: '🇵🇹' },
  { iso2: 'FR', name: 'Francia', dialCode: '33', flag: '🇫🇷' },
  { iso2: 'DE', name: 'Alemania', dialCode: '49', flag: '🇩🇪' },
  { iso2: 'IT', name: 'Italia', dialCode: '39', flag: '🇮🇹' },
  { iso2: 'GB', name: 'Reino Unido', dialCode: '44', flag: '🇬🇧' },
  { iso2: 'JP', name: 'Japón', dialCode: '81', flag: '🇯🇵' },
  { iso2: 'CN', name: 'China', dialCode: '86', flag: '🇨🇳' },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0];
