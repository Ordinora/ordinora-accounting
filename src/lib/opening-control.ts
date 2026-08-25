import { Prisma } from "@prisma/client";

type OpeningLine = {
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  account: { code: string; name: string };
};

export type OpeningControlKind = "RECEIVABLE" | "PAYABLE";

export function isOpeningControlAccount(line: OpeningLine, kind: OpeningControlKind) {
  const name = line.account.name.trim().toLocaleLowerCase();
  return kind === "RECEIVABLE"
    ? line.account.code === "1200" || name.includes("trade receivable")
    : ["2000", "2100"].includes(line.account.code) || name.includes("trade payable");
}

export function openingControlBalance(lines: OpeningLine[] | undefined, kind: OpeningControlKind) {
  return (lines ?? []).filter((line) => isOpeningControlAccount(line, kind)).reduce(
    (total, line) => total.add(kind === "RECEIVABLE" ? line.debit.sub(line.credit) : line.credit.sub(line.debit)),
    new Prisma.Decimal(0),
  );
}
