import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

async function main(){
 const superEmail=(process.env.SUPERADMIN_EMAIL||"admin@lineaplusdev.com").toLowerCase();
 const superPass=process.env.SUPERADMIN_PASSWORD||"ChangeMe123!";
 await prisma.user.upsert({where:{email:superEmail},update:{role:"SUPERADMIN",active:true},create:{email:superEmail,name:"Linea+ SuperAdmin",role:"SUPERADMIN",passwordHash:await bcrypt.hash(superPass,12)}});
 const tenant=await prisma.tenant.upsert({where:{slug:"demo-salon"},update:{},create:{slug:"demo-salon",name:"Studio Lumina",email:"studio@example.com",phone:"091 111 2222",status:"ACTIVE",defaultReminderHours:[24,2],cancellationHours:12}});
 const owner=await prisma.user.upsert({where:{email:"demo@lineaplusdev.com"},update:{tenantId:tenant.id},create:{tenantId:tenant.id,email:"demo@lineaplusdev.com",name:"Ana Vlasnik",role:"OWNER",passwordHash:await bcrypt.hash("Demo123!",12)}});
 const staffUser=await prisma.user.upsert({where:{email:"ana@demo-salon.hr"},update:{tenantId:tenant.id},create:{tenantId:tenant.id,email:"ana@demo-salon.hr",name:"Ana Horvat",role:"STAFF",passwordHash:await bcrypt.hash("Demo123!",12)}});
 const staff=await prisma.staffProfile.upsert({where:{userId:staffUser.id},update:{},create:{tenantId:tenant.id,userId:staffUser.id,displayName:"Ana Horvat",bio:"Senior stilist",color:"#665cf6"}});
 const category=await prisma.serviceCategory.upsert({where:{id:"demo-hair-category"},update:{},create:{id:"demo-hair-category",tenantId:tenant.id,name:"Frizerske usluge",sortOrder:1}});
 const service=await prisma.service.upsert({where:{id:"demo-cut"},update:{},create:{id:"demo-cut",tenantId:tenant.id,categoryId:category.id,name:"Žensko šišanje",description:"Pranje, šišanje i završno oblikovanje",durationMin:45,cleanupMin:10,priceCents:2400}});
 await prisma.staffService.upsert({where:{staffId_serviceId:{staffId:staff.id,serviceId:service.id}},update:{},create:{staffId:staff.id,serviceId:service.id}});
 const existingHours=await prisma.workingHour.count({where:{tenantId:tenant.id,staffId:null}});if(!existingHours){for(const weekday of [1,2,3,4,5])await prisma.workingHour.create({data:{tenantId:tenant.id,weekday,startMin:8*60,endMin:18*60}})}
 const existingStaffHours=await prisma.workingHour.count({where:{tenantId:tenant.id,staffId:staff.id}});if(!existingStaffHours){for(const weekday of [1,2,3,4,5])await prisma.workingHour.create({data:{tenantId:tenant.id,staffId:staff.id,weekday,startMin:8*60,endMin:18*60}})}
 const existingBreak=await prisma.staffBreak.count({where:{staffId:staff.id}});if(!existingBreak){for(const weekday of [1,2,3,4,5])await prisma.staffBreak.create({data:{staffId:staff.id,weekday,startMin:12*60,endMin:12*60+30}})}
 console.log(`Seeded. SuperAdmin: ${superEmail}; demo owner: demo@lineaplusdev.com / Demo123!`);
}
main().finally(()=>prisma.$disconnect());
