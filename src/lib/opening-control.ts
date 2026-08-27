import { AccountControlRole, Prisma } from "@prisma/client";
import { controlRoleForOpeningKind } from "./control-accounts";

type OpeningLine = {
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  account: { controlRole: AccountControlRole | null };
};

export type OpeningControlKind = "RECEIVABLE" | "PAYABLE";

export function isOpeningControlAccount(line: OpeningLine, kind: OpeningControlKind) {
  return line.account.controlRole === controlRoleForOpeningKind[kind];
}

export function openingControlBalance(lines: OpeningLine[] | undefined, kind: OpeningControlKind) {
  return (lines ?? []).filter((line) => isOpeningControlAccount(line, kind)).reduce(
    (total, line) => total.add(kind === "RECEIVABLE" ? line.debit.sub(line.credit) : line.credit.sub(line.debit)),
    new Prisma.Decimal(0),
  );
}
