const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  AUD: "A$",
  BND: "B$",
  CAD: "C$",
  CNY: "CN¥",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  MYR: "RM",
  SGD: "S$",
  USD: "US$",
};

export function currencyDisplaySymbol(currency: string) {
  const code = currency.trim().toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? code;
}
