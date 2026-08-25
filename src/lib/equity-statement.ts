import { Prisma } from "@prisma/client";
import { ledgerBalances } from "@/lib/reports";

const zero = new Prisma.Decimal(0);
const earnings = (rows: Awaited<ReturnType<typeof ledgerBalances>>) => {
  const revenue = rows.filter(row => row.type === "REVENUE").reduce((sum,row)=>sum.add(row.credit.sub(row.debit)),zero);
  const expenses = rows.filter(row => row.type === "EXPENSE").reduce((sum,row)=>sum.add(row.debit.sub(row.credit)),zero);
  return revenue.sub(expenses);
};

export async function statementOfChangesInEquity(tenantId:string,from:Date,to:Date){
  const beforeFrom = new Date(from.getTime()-1);
  const [openingRows,periodRows] = await Promise.all([ledgerBalances(tenantId,undefined,beforeFrom),ledgerBalances(tenantId,from,to)]);
  const openingEquity = openingRows.filter(row=>row.type==="EQUITY"),periodEquity = periodRows.filter(row=>row.type==="EQUITY");
  const keys = new Map([...openingEquity,...periodEquity].map(row=>[row.id,{id:row.id,code:row.code,name:row.name}]));
  const rows = [...keys.values()].sort((a,b)=>a.code.localeCompare(b.code)).map(account=>{
    const openingRow=openingEquity.find(row=>row.id===account.id),periodRow=periodEquity.find(row=>row.id===account.id);
    const opening=openingRow?openingRow.credit.sub(openingRow.debit):zero,movement=periodRow?periodRow.credit.sub(periodRow.debit):zero;
    return {...account,opening,movement,closing:opening.add(movement)};
  });
  const openingProfit=earnings(openingRows),periodProfit=earnings(periodRows);
  const openingTotal=rows.reduce((sum,row)=>sum.add(row.opening),openingProfit),movementTotal=rows.reduce((sum,row)=>sum.add(row.movement),periodProfit),closingTotal=openingTotal.add(movementTotal);
  return {rows,openingProfit,periodProfit,openingTotal,movementTotal,closingTotal};
}
