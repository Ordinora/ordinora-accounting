export function journalSourceLabel(source: string) {
  return source === "DAILY_CASH_SALES" ? "DAILY SALES" : source.replaceAll("_", " ");
}

export function journalDescriptionLabel(source: string, description: string) {
  return source === "DAILY_CASH_SALES" ? description.replace(/^Daily cash sales/i, "Daily sales") : description;
}
