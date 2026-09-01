import { Prisma } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";

export type TaxCompanyCategory = "NEWLY_INCORPORATED" | "OTHER";
export type TaxRateMode = "STANDARD" | "POST_PIONEER" | "LNG";

export type SectionGInput = {
  companyCategory: TaxCompanyCategory;
  rateMode: TaxRateMode;
  taxRate: string;
  chargeableIncome: string;
  foreignIncome: string;
  doubleTaxRelief: string;
  tapCredit: string;
  localEmploymentCredit: string;
  trainingCredit: string;
  exportSalesTax: string;
  taxPaidEci: string;
  priorYearTaxOffset: string;
  withholdingTaxPaid: string;
};

const zero = new Prisma.Decimal(0);
const hundredThousand = new Prisma.Decimal(100_000);
const hundredFiftyThousand = new Prisma.Decimal(150_000);
const twoHundredFiftyThousand = new Prisma.Decimal(250_000);

function money(value: string, label: string) {
  try {
    return new Prisma.Decimal(parseMoneyToMinor(value.trim() || "0").toString()).div(100);
  } catch {
    throw new Error(`${label} must be zero or a positive amount with no more than two decimal places.`);
  }
}

function percentage(value: string, mode: TaxRateMode) {
  if (mode === "STANDARD") return new Prisma.Decimal("18.5");
  if (mode === "LNG") return new Prisma.Decimal(55);
  const parsed = new Prisma.Decimal(value.trim() || "0");
  if (!parsed.isFinite() || parsed.lte(0) || parsed.gt(100) || parsed.decimalPlaces() > 4) throw new Error("The post-pioneer tax rate must be greater than zero and no more than 100%.");
  return parsed;
}

function tax(amount: Prisma.Decimal, taxablePercentage: number, rate: Prisma.Decimal) {
  return amount.mul(taxablePercentage).div(100).mul(rate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateSectionG(input: SectionGInput) {
  const chargeableIncome = money(input.chargeableIncome, "Chargeable income");
  const foreignIncome = money(input.foreignIncome, "Foreign income");
  const doubleTaxRelief = money(input.doubleTaxRelief, "Double-taxation relief");
  const tapCredit = money(input.tapCredit, "TAP tax credit");
  const localEmploymentCredit = money(input.localEmploymentCredit, "New-local-employment tax credit");
  const trainingCredit = money(input.trainingCredit, "Training-expenditure tax credit");
  const exportSalesTax = money(input.exportSalesTax, "Tax payable on export sales");
  const taxPaidEci = money(input.taxPaidEci, "Tax paid based on ECI");
  const priorYearTaxOffset = money(input.priorYearTaxOffset, "Prior-year tax offset");
  const withholdingTaxPaid = money(input.withholdingTaxPaid, "Withholding tax paid");
  const taxRate = percentage(input.taxRate, input.rateMode);

  const firstBand = Prisma.Decimal.min(chargeableIncome, hundredThousand);
  const nextBand = Prisma.Decimal.min(Prisma.Decimal.max(chargeableIncome.sub(hundredThousand), zero), hundredFiftyThousand);
  const remainingBand = Prisma.Decimal.max(chargeableIncome.sub(twoHundredFiftyThousand), zero);
  const newlyIncorporated = input.companyCategory === "NEWLY_INCORPORATED";
  const lng = input.rateMode === "LNG";

  const firstTax = lng || newlyIncorporated ? zero : tax(firstBand, 25, taxRate);
  const nextTax = lng ? zero : tax(nextBand, 50, taxRate);
  const remainingTax = lng ? zero : tax(remainingBand, 100, taxRate);
  const grossTaxPayable = lng ? tax(chargeableIncome, 100, taxRate) : firstTax.add(nextTax).add(remainingTax);

  if (doubleTaxRelief.gt(0) && foreignIncome.eq(0)) throw new Error("Enter foreign income before claiming double-taxation relief.");
  if (doubleTaxRelief.gt(grossTaxPayable)) throw new Error("Double-taxation relief cannot exceed gross tax payable.");
  const taxAfterDoubleTaxRelief = grossTaxPayable.sub(doubleTaxRelief);
  const totalTaxCredits = tapCredit.add(localEmploymentCredit).add(trainingCredit);
  const netTaxPayable = Prisma.Decimal.max(taxAfterDoubleTaxRelief.add(exportSalesTax).sub(totalTaxCredits), zero);
  const totalTaxAlreadyPaid = taxPaidEci.add(priorYearTaxOffset).add(withholdingTaxPaid);
  const balanceTaxPayable = netTaxPayable.sub(totalTaxAlreadyPaid);

  return {
    companyCategory: input.companyCategory,
    rateMode: input.rateMode,
    taxRate,
    chargeableIncome,
    firstBand,
    nextBand,
    remainingBand,
    firstTax,
    nextTax,
    remainingTax,
    grossTaxPayable,
    foreignIncome,
    doubleTaxRelief,
    taxAfterDoubleTaxRelief,
    tapCredit,
    localEmploymentCredit,
    trainingCredit,
    totalTaxCredits,
    exportSalesTax,
    netTaxPayable,
    taxPaidEci,
    priorYearTaxOffset,
    withholdingTaxPaid,
    totalTaxAlreadyPaid,
    balanceTaxPayable,
  };
}
