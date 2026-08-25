import { Prisma } from "@prisma/client";
export function openingControlPosition(input: { target: Prisma.Decimal.Value; allocated: Prisma.Decimal.Value }) { const target = new Prisma.Decimal(input.target), allocated = new Prisma.Decimal(input.allocated), remaining = target.sub(allocated); return { target, allocated, remaining, complete: remaining.eq(0), exceeded: remaining.lt(0) }; }

export type SubledgerDocument = {
  baseTotal: Prisma.Decimal.Value;
  credits?: Prisma.Decimal.Value[];
  allocations?: Prisma.Decimal.Value[];
};

export function outstandingSubledgerBalance(documents: SubledgerDocument[]) {
  return documents.reduce((total, document) => {
    const credits = (document.credits ?? []).reduce<Prisma.Decimal>((sum, value) => sum.add(value), new Prisma.Decimal(0));
    const allocations = (document.allocations ?? []).reduce<Prisma.Decimal>((sum, value) => sum.add(value), new Prisma.Decimal(0));
    return total.add(new Prisma.Decimal(document.baseTotal).sub(credits).sub(allocations));
  }, new Prisma.Decimal(0));
}

export function reconcileControlToSubledger(input: {
  controlBalance: Prisma.Decimal.Value;
  documents: SubledgerDocument[];
  tolerance?: Prisma.Decimal.Value;
}) {
  const controlBalance = new Prisma.Decimal(input.controlBalance);
  const subledgerBalance = outstandingSubledgerBalance(input.documents);
  const difference = controlBalance.sub(subledgerBalance);
  const tolerance = new Prisma.Decimal(input.tolerance ?? "0.01");
  return { controlBalance, subledgerBalance, difference, reconciled: difference.abs().lte(tolerance) };
}
