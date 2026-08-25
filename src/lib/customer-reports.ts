import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
const zero = new Prisma.Decimal(0);

export async function customerSummary(tenantId:string,from:Date,to:Date){
  const customers=await db.customer.findMany({where:{tenantId},orderBy:{name:"asc"},include:{
    invoices:{where:{invoiceDate:{lte:to},status:{not:"VOIDED"}}},creditNotes:{where:{creditDate:{lte:to}}},receipts:{where:{receiptDate:{lte:to}}}
  }});
  return customers.map(customer=>{
    const invoices=customer.invoices.filter(row=>row.invoiceDate>=from).reduce((sum,row)=>sum.add(row.baseTotal),zero);
    const credits=customer.creditNotes.filter(row=>row.creditDate>=from).reduce((sum,row)=>sum.add(row.baseTotal),zero);
    const receipts=customer.receipts.filter(row=>row.receiptDate>=from).reduce((sum,row)=>sum.add(row.baseAmount),zero);
    const outstanding=customer.invoices.reduce((sum,row)=>sum.add(row.baseTotal),zero).sub(customer.creditNotes.reduce((sum,row)=>sum.add(row.baseTotal),zero)).sub(customer.receipts.reduce((sum,row)=>sum.add(row.baseAmount),zero));
    return{id:customer.id,code:customer.code,name:customer.name,currency:customer.currencyCode,invoices,credits,receipts,outstanding};
  }).filter(row=>!row.invoices.eq(0)||!row.credits.eq(0)||!row.receipts.eq(0)||!row.outstanding.eq(0));
}

export async function customerStatement(tenantId:string,customerId:string,from:Date,to:Date){
  const customer=await db.customer.findFirst({where:{id:customerId,tenantId},include:{
    invoices:{where:{invoiceDate:{lte:to},status:{not:"VOIDED"}}},creditNotes:{where:{creditDate:{lte:to}}},receipts:{where:{receiptDate:{lte:to}}}
  }}); if(!customer)return null;
  const before=(date:Date)=>date<from;
  const opening=customer.invoices.filter(row=>before(row.invoiceDate)).reduce((sum,row)=>sum.add(row.baseTotal),zero)
    .sub(customer.creditNotes.filter(row=>before(row.creditDate)).reduce((sum,row)=>sum.add(row.baseTotal),zero))
    .sub(customer.receipts.filter(row=>before(row.receiptDate)).reduce((sum,row)=>sum.add(row.baseAmount),zero));
  const transactions=[
    ...customer.invoices.filter(row=>row.invoiceDate>=from).map(row=>({id:`invoice-${row.id}`,date:row.invoiceDate,type:row.isOpeningBalance?"Opening invoice":"Sales invoice",reference:row.reference,description:row.description??"Sales invoice",debit:row.baseTotal,credit:zero})),
    ...customer.creditNotes.filter(row=>row.creditDate>=from).map(row=>({id:`credit-${row.id}`,date:row.creditDate,type:"Credit note",reference:row.reference,description:row.description,debit:zero,credit:row.baseTotal})),
    ...customer.receipts.filter(row=>row.receiptDate>=from).map(row=>({id:`receipt-${row.id}`,date:row.receiptDate,type:"Receipt",reference:row.reference,description:"Customer receipt",debit:zero,credit:row.baseAmount})),
  ].sort((a,b)=>a.date.getTime()-b.date.getTime()||a.reference.localeCompare(b.reference));
  let running=opening; const rows=transactions.map(row=>{running=running.add(row.debit).sub(row.credit);return{...row,balance:running};});
  return{id:customer.id,code:customer.code,name:customer.name,currency:customer.currencyCode,opening,rows,closing:running};
}
