import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import type { ReportSnapshot } from "../../src/lib/report-snapshot";

const databaseUrl=process.env.E2E_DATABASE_URL??"";
const safeDatabase=(()=>{try{return new URL(databaseUrl).pathname.replace(/^\//,"").endsWith("_e2e")}catch{return false}})();
test.skip(process.env.E2E_ALLOW_ACCOUNTING_WRITES!=="true"||!safeDatabase,"Run only through scripts/run-e2e-cycle.ps1 with a disposable *_e2e database.");

test("published client reports remain immutable and are replaced only by a new version",async({page,context})=>{
  const db=new PrismaClient({datasourceUrl:databaseUrl}),password=process.env.E2E_STAFF_PASSWORD!;
  const staffLogin=async()=>{await page.goto("/login");await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in securely"}).click();await expect(page).toHaveURL(/\/$/)};
  const clientLogin=async()=>{await page.goto("/portal/login");await page.getByLabel("Email address").fill("finance1@demo.invalid");await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Open client portal"}).click();await expect(page).toHaveURL(/\/portal$/)};
  await staffLogin();
  await page.goto("/reports/income-statement?from=2026-08-01&to=2026-08-24");
  await page.getByRole("button",{name:"Publish to portal"}).click();
  await expect(page).toHaveURL(/\/reports\/published$/);
  const tenant=await db.tenant.findFirstOrThrow({where:{legalName:"Borneo Supply Co. (Demo)"}}),first=await db.reportVersion.findFirstOrThrow({where:{tenantId:tenant.id,reportType:"income-statement",state:"PUBLISHED"}}),firstPayload=first.payload as unknown as ReportSnapshot;
  const period=await db.accountingPeriod.findFirstOrThrow({where:{tenantId:tenant.id,startsOn:{lte:new Date("2026-08-24")},endsOn:{gte:new Date("2026-08-24")}}}),staff=await db.user.findFirstOrThrow({where:{id:first.publishedById!}}),accounts=await db.account.findMany({where:{tenantId:tenant.id,code:{in:["1000","4000"]}}}),account=(code:string)=>accounts.find(row=>row.code===code)?.id??"";
  await db.journal.create({data:{tenantId:tenant.id,periodId:period.id,reference:"E2E-SNAPSHOT-LATER",description:"Posting after first publication",accountingDate:new Date("2026-08-24"),status:"POSTED",source:"MANUAL",createdById:staff.id,approvedById:staff.id,postedById:staff.id,postedAt:new Date(),lines:{create:[{accountId:account("1000"),debit:new Prisma.Decimal(100),credit:new Prisma.Decimal(0),description:"Cash received"},{accountId:account("4000"),debit:new Prisma.Decimal(0),credit:new Prisma.Decimal(100),description:"Revenue posted later"}]}}});
  const unchanged=await db.reportVersion.findUniqueOrThrow({where:{id:first.id}});expect(unchanged.payload).toEqual(first.payload);
  await context.clearCookies();await clientLogin();
  await page.getByRole("row").filter({hasText:"income-statement"}).getByRole("link",{name:"Open"}).click();await expect(page).toHaveURL(new RegExp(`/portal/reports/${first.id}$`));
  const oldProfit=firstPayload.sections.flatMap(section=>section.rows).find(row=>row.label==="Net profit / (loss)")?.amount;expect(oldProfit).toBeTruthy();await expect(page.getByRole("row").filter({hasText:"Net profit / (loss)"})).toContainText(oldProfit!);
  await context.clearCookies();await staffLogin();await page.goto("/reports/income-statement?from=2026-08-01&to=2026-08-24");await page.getByRole("button",{name:"Publish to portal"}).click();await expect(page).toHaveURL(/\/reports\/published$/);
  const versions=await db.reportVersion.findMany({where:{tenantId:tenant.id,reportType:"income-statement"},orderBy:{version:"asc"}});expect(versions).toHaveLength(2);expect(versions[0].state).toBe("SUPERSEDED");expect(versions[1].state).toBe("PUBLISHED");expect(versions[1].payload).not.toEqual(versions[0].payload);
  await context.clearCookies();await clientLogin();const publishedRow=page.getByRole("row").filter({hasText:"income-statement"});await expect(publishedRow.getByRole("cell",{name:"2",exact:true})).toBeVisible();await expect(publishedRow.getByRole("cell",{name:"1",exact:true})).toHaveCount(0);
  await db.$disconnect();
});
