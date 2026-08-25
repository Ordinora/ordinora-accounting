export function monthlyAccountingPeriods(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Setup year must be between 2000 and 2100.");
  return Array.from({ length: 12 }, (_, month) => {
    const startsOn = new Date(Date.UTC(year, month, 1));
    const endsOn = new Date(Date.UTC(year, month + 1, 0));
    return { name: startsOn.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), startsOn, endsOn, status: "OPEN" as const };
  });
}
