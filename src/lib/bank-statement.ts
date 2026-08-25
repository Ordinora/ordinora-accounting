import { Prisma } from "@prisma/client";

export type ParsedStatementLine = { transactionDate: Date; description: string; reference: string | null; amount: Prisma.Decimal };

function fields(row: string) { const result: string[] = []; let value = "", quoted = false; for (let i = 0; i < row.length; i++) { const char = row[i]; if (char === '"') { if (quoted && row[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; } else if (char === "," && !quoted) { result.push(value.trim()); value = ""; } else value += char; } result.push(value.trim()); return result; }
function date(value: string) { const trimmed = value.trim(); const dayFirst = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); const normalized = dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}T00:00:00` : /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed; const parsed = new Date(normalized); if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid statement date: ${value}. Use YYYY-MM-DD or DD/MM/YYYY.`); return parsed; }
function number(value: string) { const trimmed = value.trim(); const negative = /^\(.*\)$/.test(trimmed); const cleaned = trimmed.replace(/[(),$'’ ]/g, ""); if (!cleaned) return new Prisma.Decimal(0); try { const parsed = new Prisma.Decimal(cleaned); return negative ? parsed.neg() : parsed; } catch { throw new Error(`Invalid statement amount: ${value}.`); } }

export function parseBankStatementCsv(text: string): ParsedStatementLine[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim());
  if (rows.length < 2) throw new Error("The CSV must contain a header and at least one transaction.");
  const headerRowIndex = rows.findIndex((row, rowIndex) => rowIndex < 30 && fields(row).some((field) => ["date", "transaction date", "tarikh"].includes(field.trim().toLowerCase())));
  const firstRow = headerRowIndex >= 0 ? headerRowIndex : 0;
  const headers = fields(rows[firstRow]).map((header) => header.toLowerCase().replaceAll(" ", ""));
  const index = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = index(["date", "transactiondate", "valuedate", "tarikh"]), descriptionIndex = index(["description", "details", "narrative", "transactiondetails", "huraian"]), referenceIndex = index(["reference", "ref", "transactionreference"]), amountIndex = index(["amount", "transactionamount"]), debitIndex = index(["debit", "withdrawal", "wangkeluar"]), creditIndex = index(["credit", "deposit", "wangmasuk"]);
  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) { const looksConverted = /account statement|penyata akaun|balance brought forward|previous balance/i.test(text); if (looksConverted) throw new Error("This file appears to be a PDF-to-CSV conversion and is missing usable transaction columns. Download the CSV directly from your bank; it must contain Date, Description, and Amount or Debit/Credit columns."); throw new Error("CSV headers must include Date, Description, and either Amount or Debit/Credit."); }
  if (rows.length > 5001) throw new Error("A statement import can contain no more than 5,000 transactions.");
  return rows.slice(firstRow + 1).map((row) => { const values = fields(row); const amount = amountIndex >= 0 ? number(values[amountIndex] ?? "") : number(values[creditIndex] ?? "").sub(number(values[debitIndex] ?? "")); const description = (values[descriptionIndex] ?? "").trim(); if (!description || amount.eq(0)) throw new Error("Every statement row needs a description and a non-zero amount."); return { transactionDate: date(values[dateIndex] ?? ""), description: description.slice(0, 500), reference: referenceIndex >= 0 ? (values[referenceIndex]?.trim().slice(0, 100) || null) : null, amount }; });
}

export function findExactStatementMatch(statement: { transactionDate: Date; amount: Prisma.Decimal.Value }, candidates: { id: string; accountingDate: Date; debit: Prisma.Decimal.Value; credit: Prisma.Decimal.Value }[]) { const amount = new Prisma.Decimal(statement.amount); const matches = candidates.filter((candidate) => Math.abs(candidate.accountingDate.getTime() - statement.transactionDate.getTime()) <= 3 * 86400000 && new Prisma.Decimal(candidate.debit).sub(candidate.credit).eq(amount)); return matches.length === 1 ? matches[0].id : null; }
