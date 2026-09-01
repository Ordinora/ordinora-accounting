export type ParsedSettlementDiscount = {
  originalInput: string;
  kind: "NONE" | "FIXED" | "PERCENTAGE";
  amountMinor: bigint;
};

function parseUnsignedDecimalToMinor(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`${label} must be a positive number with no more than two decimal places.`);
  }
  const normalized = trimmed.replaceAll(",", "");
  const [major, fractional = ""] = normalized.split(".");
  return BigInt(major) * 100n + BigInt(fractional.padEnd(2, "0"));
}

export function parseSettlementDiscount(input: string | undefined, outstandingMinor: bigint): ParsedSettlementDiscount {
  const originalInput = input?.trim() ?? "";
  if (!originalInput) return { originalInput: "", kind: "NONE", amountMinor: 0n };
  if (outstandingMinor <= 0n) throw new Error("The invoice has no outstanding amount available for a discount.");

  const percentSymbols = [...originalInput].filter((character) => character === "%").length;
  if (percentSymbols > 0) {
    if (percentSymbols !== 1 || !/^\d+(\.\d{1,4})?\s*%$/.test(originalInput)) {
      throw new Error("Discount percentage must look like 5% or 2.5%.");
    }
    const percentage = Number(originalInput.replace("%", "").trim());
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error("Discount percentage must be between 0% and 100%.");
    }
    const scaledPercentage = BigInt(Math.round(percentage * 10_000));
    const amountMinor = (outstandingMinor * scaledPercentage + 500_000n) / 1_000_000n;
    return { originalInput, kind: "PERCENTAGE", amountMinor };
  }

  const amountMinor = parseUnsignedDecimalToMinor(originalInput, "Discount");
  if (amountMinor > outstandingMinor) throw new Error("Discount cannot exceed the invoice outstanding amount.");
  return { originalInput, kind: "FIXED", amountMinor };
}

export function calculateSupplierSettlement(input: { outstandingMinor: bigint; cashInput: string; discountInput?: string }) {
  const cashMinor = input.cashInput.trim() ? parseUnsignedDecimalToMinor(input.cashInput, "Amount paid") : 0n;
  const discount = parseSettlementDiscount(input.discountInput, input.outstandingMinor);
  const totalSettledMinor = cashMinor + discount.amountMinor;
  if (totalSettledMinor <= 0n) throw new Error("Enter an amount paid or a supplier discount.");
  if (totalSettledMinor > input.outstandingMinor) throw new Error("Amount paid plus discount cannot exceed the invoice outstanding amount.");
  return {
    cashMinor,
    discountInput: discount.originalInput,
    discountKind: discount.kind,
    discountMinor: discount.amountMinor,
    totalSettledMinor,
    remainingMinor: input.outstandingMinor - totalSettledMinor,
    posting: { payableDebitMinor: totalSettledMinor, bankCreditMinor: cashMinor, purchaseDiscountCreditMinor: discount.amountMinor },
  };
}
