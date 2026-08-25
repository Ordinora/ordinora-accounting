import Link from "next/link";
import { AlertTriangle,ArrowRight,CheckCircle2,Download } from "lucide-react";
import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { fixedAssetReportRows } from "@/lib/fixed-asset-reports";
import { ledgerBalances } from "@/lib/reports";
import { requireActiveTenant } from "@/lib/session";

export const dynamic="force-dynamic";
const zero=new Prisma.Decimal(0);
const money=(currency:string,value:Prisma.Decimal|number)=>`${currency} ${Number(value).toLocaleString("en-BN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default async function Page({searchParams}:{searchParams:Promise<{asOf?:string}>}){
  const query=await searchParams,{user,tenants,active}=await requireActiveTenant();
  const asOf=query.asOf?new Date(`${query.asOf}T23:59:59`):new Date();
  const[assets,ledger,billAssetLines,paymentAssetLines]=await Promise.all([
    fixedAssetReportRows(active.id,asOf),
    ledgerBalances(active.id,undefined,asOf),
    db.supplierBillLine.findMany({where:{inventoryItemId:null,expenseAccount:{type:"ASSET"},bill:{tenantId:active.id,status:"POSTED",billDate:{lte:asOf}}},include:{expenseAccount:true,bill:{include:{supplier:true}}},orderBy:{bill:{billDate:"asc"}}}),
    db.paymentLine.findMany({where:{inventoryItemId:null,account:{type:"ASSET"},payment:{tenantId:active.id,paymentDate:{lte:asOf}}},include:{account:true,payment:true},orderBy:{payment:{paymentDate:"asc"}}}),
  ]);
  const sourceIds=[...billAssetLines.map(line=>line.id),...paymentAssetLines.map(line=>line.id)];
  const registeredSources=sourceIds.length?await db.fixedAsset.findMany({where:{tenantId:active.id,sourceLineId:{in:sourceIds}},select:{sourceLineId:true}}):[];
  const registeredSourceIds=new Set(registeredSources.map(row=>row.sourceLineId));
  const manuallyMatchedPaymentLines=new Set<string>(),usedManualAssets=new Set<string>();
  for(const line of paymentAssetLines){
    if(registeredSourceIds.has(line.id))continue;
    const matches=assets.filter(row=>!row.asset.sourceLineId&&!usedManualAssets.has(row.asset.id)&&row.asset.assetAccountId===line.accountId&&row.asset.acquiredOn.getTime()===line.payment.paymentDate.getTime()&&Math.abs(Number(row.asset.originalCost)-Number(line.baseAmount))<0.005);
    if(matches.length===1){manuallyMatchedPaymentLines.add(line.id);usedManualAssets.add(matches[0].asset.id)}
  }
  const pendingSources=[
    ...billAssetLines.filter(line=>!registeredSourceIds.has(line.id)).map(line=>({id:line.id,kind:"Supplier bill",party:line.bill.supplier.name,reference:line.bill.reference,date:line.bill.billDate,description:line.description,account:`${line.expenseAccount.code} — ${line.expenseAccount.name}`,amount:Number(line.lineTotal)*Number(line.bill.exchangeRate),href:`/fixed-assets/new?sourceLineId=${line.id}`})),
    ...paymentAssetLines.filter(line=>!registeredSourceIds.has(line.id)&&!manuallyMatchedPaymentLines.has(line.id)).map(line=>({id:line.id,kind:"Direct payment",party:line.payment.payee,reference:line.payment.reference,date:line.payment.paymentDate,description:line.description,account:`${line.account.code} — ${line.account.name}`,amount:Number(line.baseAmount),href:`/fixed-assets/new?paymentLineId=${line.id}`})),
  ].sort((a,b)=>a.date.getTime()-b.date.getTime());
  const ledgerMap=new Map(ledger.map(row=>[row.id,row]));
  const groups=new Map<string,{id:string;kind:"COST"|"ACCUMULATED";register:Prisma.Decimal}>();
  for(const row of assets){
    const costId=row.asset.assetAccountId,cost=groups.get(costId)??{id:costId,kind:"COST" as const,register:zero};
    cost.register=cost.register.add(row.asset.originalCost);groups.set(costId,cost);
    const accumulatedId=row.asset.accumulatedDepreciationAccountId,accumulated=groups.get(accumulatedId)??{id:accumulatedId,kind:"ACCUMULATED" as const,register:zero};
    accumulated.register=accumulated.register.add(row.actualAccumulated);groups.set(accumulatedId,accumulated);
  }
  const accountRows=[...groups.values()].map(group=>{
    const account=ledgerMap.get(group.id),ledgerAmount=group.kind==="COST"?(account?.balance??zero):(account?.balance??zero).neg(),difference=group.register.sub(ledgerAmount);
    return{...group,code:account?.code??"—",name:account?.name??"Unknown account",ledger:ledgerAmount,difference,balanced:difference.abs().lt(0.005)};
  }).sort((a,b)=>a.code.localeCompare(b.code));
  const balanced=accountRows.length>0&&accountRows.every(row=>row.balanced)&&pendingSources.length===0;
  return <AppShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name}} tenants={tenants} activeTenant={active} pageTitle="Fixed Asset Reconciliation" pageDescription="Compare the asset register with posted general-ledger balances"><main className="module-page">
    <div className="detail-toolbar"><Link href="/fixed-assets" className="back-link">← Fixed assets</Link></div>
    <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Fixed-asset reconciliation</h2><p>Register costs and actually posted depreciation compared with the ledger as at {asOf.toLocaleDateString("en-BN")}.</p></div><form className="report-filter"><label>As of<input name="asOf" type="date" defaultValue={asOf.toISOString().slice(0,10)}/></label><button className="button-secondary">Update</button></form></header>
    <section className="form-notice">{balanced?<CheckCircle2 size={20}/>:<AlertTriangle size={20}/>}<strong>{balanced?"Register agrees with the ledger":"Reconciliation differences found"}</strong><span>{balanced?"All registered fixed-asset balances match their posted control accounts and no unregistered asset purchases were found.":`${pendingSources.length} posted asset purchase line${pendingSources.length===1?" is":"s are"} not yet linked to the Fixed Asset Register. Review these together with account differences and unposted depreciation.`}</span></section>
    <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Account</th><th>Control</th><th className="numeric">Asset register</th><th className="numeric">General ledger</th><th className="numeric">Difference</th><th>Status</th></tr></thead><tbody>{accountRows.map(row=><tr key={`${row.kind}-${row.id}`}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.kind==="COST"?"Original cost":"Accumulated depreciation"}</td><td className="numeric">{money(active.defaultCurrency,row.register)}</td><td className="numeric">{money(active.defaultCurrency,row.ledger)}</td><td className="numeric">{money(active.defaultCurrency,row.difference)}</td><td><span className={`status-badge ${row.balanced?"active":"warning"}`}>{row.balanced?"MATCHED":"REVIEW"}</span></td></tr>)}{!accountRows.length&&<tr><td colSpan={7} className="table-empty">Register assets before running the reconciliation.</td></tr>}</tbody></table></div></section>
    <section className="surface-card table-card"><div className="card-header"><div><h3>Unregistered asset purchases</h3><p>Posted purchase lines using an asset account that have not been connected to an asset-register record.</p></div><span className={`status-badge large ${pendingSources.length?"pending":"complete"}`}>{pendingSources.length}</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Source</th><th>Supplier / payee</th><th>Description</th><th>Asset account</th><th className="numeric">Base amount</th><th></th></tr></thead><tbody>{pendingSources.map(row=><tr key={`${row.kind}-${row.id}`}><td>{row.date.toLocaleDateString("en-BN")}</td><td><strong>{row.kind}</strong><small> · {row.reference}</small></td><td>{row.party}</td><td>{row.description}</td><td>{row.account}</td><td className="numeric">{money(active.defaultCurrency,row.amount)}</td><td><Link className="button-secondary" href={row.href}><ArrowRight size={15}/>Register</Link></td></tr>)}{!pendingSources.length&&<tr><td colSpan={7} className="table-empty">No unregistered asset purchases were found through this date.</td></tr>}</tbody></table></div></section>
    <div className="form-actions"><Link href="/fixed-assets/import" className="button-secondary"><Download size={15}/>Import opening assets</Link></div>
  </main></AppShell>;
}
