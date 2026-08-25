import { PrismaClient, AccountType } from "@prisma/client";
import { bruneiChart } from "./brunei-chart";
const prisma=new PrismaClient();
async function main(){const tenants=await prisma.tenant.findMany({select:{id:true}});for(const tenant of tenants){for(const[code,name,type,reportingClassification]of bruneiChart){await prisma.account.upsert({where:{tenantId_code:{tenantId:tenant.id,code}},update:{name,type:type as AccountType,reportingClassification},create:{tenantId:tenant.id,code,name,type:type as AccountType,reportingClassification}})}}console.log(`Expanded chart of accounts for ${tenants.length} fictional clients.`)}
main().finally(()=>prisma.$disconnect());
