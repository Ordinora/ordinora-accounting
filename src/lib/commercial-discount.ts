export type ParsedCommercialDiscount = { discountType: "NONE" | "PERCENT" | "AMOUNT"; discountValue: string };

export function parseCommercialDiscount(input: string): ParsedCommercialDiscount {
  const value = input.trim().replace(/^\$\s*/, "");
  if (!value || /^0+(?:\.0+)?$/.test(value)) return { discountType: "NONE", discountValue: "0" };
  if (value.endsWith("%")) {
    const percentage = value.slice(0, -1).trim();
    if (!/^\d+(?:\.\d{1,4})?$/.test(percentage) || Number(percentage) > 100) throw new Error("Enter a discount percentage such as 5% (maximum 100%).");
    return { discountType: "PERCENT", discountValue: percentage };
  }
  const amount = value.replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) throw new Error("Enter the discount as a fixed amount or percentage, for example 50.00, $100, or 5%.");
  return { discountType: "AMOUNT", discountValue: amount };
}
