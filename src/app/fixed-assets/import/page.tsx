import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FixedAssetImportForm } from "@/components/fixed-asset-import-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { importOpeningFixedAssets } from "./actions";
export const dynamic="force-dynamic";
export default async function Page(){const{user,tenants,active}=await requireActiveTenant(),accounts=await db.account.findMany({where:{tenantId:active.id,isActive:true},orderBy:{code:"asc"}});return <AppShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name}} tenants={tenants} activeTenant={active} pageTitle="Import Opening Fixed Assets" pageDescription="Bulk-register assets owned before bookkeeping began"><main className="module-page form-page"><div className="detail-toolbar"><Link href="/fixed-assets" className="back-link">← Fixed assets</Link></div><FixedAssetImportForm action={importOpeningFixedAssets} assets={accounts.filter(a=>a.type==="ASSET")} expenses={accounts.filter(a=>a.type==="EXPENSE")}/></main></AppShell>}
