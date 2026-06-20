// ISO 3166-1 alpha-2 → display name. Covers the ~60 most common codes in
// the iptv-org catalogue; unknown codes fall back to the code itself.
const NAMES: Record<string, string> = {
  AD: "Andorra", AE: "United Arab Emirates", AF: "Afghanistan", AG: "Antigua and Barbuda",
  AL: "Albania", AM: "Armenia", AO: "Angola", AR: "Argentina", AT: "Austria",
  AU: "Australia", AZ: "Azerbaijan", BA: "Bosnia and Herzegovina", BD: "Bangladesh",
  BE: "Belgium", BF: "Burkina Faso", BG: "Bulgaria", BH: "Bahrain", BJ: "Benin",
  BN: "Brunei", BO: "Bolivia", BR: "Brazil", BY: "Belarus", CA: "Canada",
  CD: "DR Congo", CF: "Central African Republic", CG: "Congo", CH: "Switzerland",
  CI: "Côte d'Ivoire", CL: "Chile", CM: "Cameroon", CN: "China", CO: "Colombia",
  CR: "Costa Rica", CU: "Cuba", CV: "Cape Verde", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DJ: "Djibouti", DK: "Denmark", DO: "Dominican Republic", DZ: "Algeria",
  EC: "Ecuador", EE: "Estonia", EG: "Egypt", ER: "Eritrea", ES: "Spain",
  ET: "Ethiopia", FI: "Finland", FJ: "Fiji", FR: "France", GA: "Gabon",
  GB: "United Kingdom", GE: "Georgia", GH: "Ghana", GN: "Guinea", GQ: "Equatorial Guinea",
  GR: "Greece", GT: "Guatemala", GW: "Guinea-Bissau", HK: "Hong Kong", HN: "Honduras",
  HR: "Croatia", HT: "Haiti", HU: "Hungary", ID: "Indonesia", IE: "Ireland",
  IL: "Israel", IN: "India", IQ: "Iraq", IR: "Iran", IS: "Iceland",
  IT: "Italy", JM: "Jamaica", JO: "Jordan", JP: "Japan", KE: "Kenya",
  KG: "Kyrgyzstan", KH: "Cambodia", KR: "South Korea", KW: "Kuwait", KZ: "Kazakhstan",
  LA: "Laos", LB: "Lebanon", LK: "Sri Lanka", LT: "Lithuania", LU: "Luxembourg",
  LV: "Latvia", LY: "Libya", MA: "Morocco", MD: "Moldova", ME: "Montenegro",
  MG: "Madagascar", MK: "North Macedonia", ML: "Mali", MM: "Myanmar", MN: "Mongolia",
  MR: "Mauritania", MT: "Malta", MU: "Mauritius", MV: "Maldives", MW: "Malawi",
  MX: "Mexico", MY: "Malaysia", MZ: "Mozambique", NA: "Namibia", NE: "Niger",
  NG: "Nigeria", NI: "Nicaragua", NL: "Netherlands", NO: "Norway", NP: "Nepal",
  NZ: "New Zealand", OM: "Oman", PA: "Panama", PE: "Peru", PG: "Papua New Guinea",
  PH: "Philippines", PK: "Pakistan", PL: "Poland", PS: "Palestine", PT: "Portugal",
  PY: "Paraguay", QA: "Qatar", RO: "Romania", RS: "Serbia", RU: "Russia",
  RW: "Rwanda", SA: "Saudi Arabia", SC: "Seychelles", SD: "Sudan", SE: "Sweden",
  SG: "Singapore", SI: "Slovenia", SK: "Slovakia", SL: "Sierra Leone", SN: "Senegal",
  SO: "Somalia", SR: "Suriname", SS: "South Sudan", SV: "El Salvador", SY: "Syria",
  SZ: "Eswatini", TD: "Chad", TG: "Togo", TH: "Thailand", TJ: "Tajikistan",
  TL: "Timor-Leste", TM: "Turkmenistan", TN: "Tunisia", TR: "Turkey", TT: "Trinidad and Tobago",
  TW: "Taiwan", TZ: "Tanzania", UA: "Ukraine", UG: "Uganda", US: "United States",
  UY: "Uruguay", UZ: "Uzbekistan", VE: "Venezuela", VN: "Vietnam", YE: "Yemen",
  ZA: "South Africa", ZM: "Zambia", ZW: "Zimbabwe",
};

export function countryName(code: string): string {
  return NAMES[code.toUpperCase()] ?? code;
}
