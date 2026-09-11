import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CalendarPlus, ArrowUpRight } from "lucide-react";

export default async function Dashboard(){
 const user=await requireUser(); if(!user.tenantId)return null;
 const now=new Date(),todayStart=startOfDay(now),todayEnd=endOfDay(now),weekStart=startOfWeek(now,{weekStartsOn:1}),weekEnd=endOfWeek(now,{weekStartsOn:1});
 const staffFilter=user.role==="STAFF"&&user.staffProfile?{staffId:user.staffProfile.id}:{};
 const [todayCount,weekCount,weekDone,noShows,next]=await Promise.all([
  prisma.appointment.count({where:{tenantId:user.tenantId,startsAt:{gte:todayStart,lte:todayEnd},status:{in:["PENDING","CONFIRMED"]},...staffFilter}}),
  prisma.appointment.count({where:{tenantId:user.tenantId,startsAt:{gte:weekStart,lte:weekEnd},status:{not:"CANCELLED"},...staffFilter}}),
  prisma.appointment.aggregate({where:{tenantId:user.tenantId,startsAt:{gte:weekStart,lte:weekEnd},status:"COMPLETED",...staffFilter},_sum:{priceCents:true}}),
  prisma.appointment.count({where:{tenantId:user.tenantId,startsAt:{gte:weekStart,lte:weekEnd},status:"NO_SHOW",...staffFilter}}),
  prisma.appointment.findMany({where:{tenantId:user.tenantId,startsAt:{gte:now,lte:addDays(now,2)},status:{in:["PENDING","CONFIRMED"]},...staffFilter},take:8,orderBy:{startsAt:"asc"},include:{customer:true,service:true,staff:true}})
 ]);
 const revenue=(weekDone._sum.priceCents||0)/100;
 return <main className="content"><div className="page-title"><div><div className="muted" style={{fontSize:13,fontWeight:750}}>DANAS</div><h1>Pregled poslovanja</h1></div><a className="btn btn-brand" href="/dashboard/calendar"><CalendarPlus size={17}/>Dodaj termin</a></div><section className="stats"><Stat label="Termini danas" value={String(todayCount)}/><Stat label="Termini ovaj tjedan" value={String(weekCount)}/><Stat label="Ostvareni promet" value={`${revenue.toFixed(2)} €`}/><Stat label="No-show ovaj tjedan" value={String(noShows)}/></section><section className="dashboard-grid"><div className="table-card"><div className="card-head"><strong>Nadolazeći termini</strong><a className="muted" href="/dashboard/calendar" style={{fontSize:13}}>Cijeli kalendar <ArrowUpRight size={13}/></a></div>{next.length===0?<div className="empty">Nema nadolazećih termina.</div>:next.map(a=><div className="appt" key={a.id}><div className="appt-time">{new Intl.DateTimeFormat("hr-HR",{hour:"2-digit",minute:"2-digit"}).format(a.startsAt)}</div><div><div className="appt-name">{a.customer.name}</div><div className="muted" style={{fontSize:12,marginTop:3}}>{a.service.name} · <span className="staff-dot"/>{a.staff.displayName}</div></div><span className={`pill ${a.status==="PENDING"?"pending":""}`}>{a.status==="PENDING"?"Čeka":"Potvrđen"}</span></div>)}</div><div className="table-card"><div className="card-head"><strong>Brzi pregled</strong></div><div style={{padding:18}}><p className="muted" style={{lineHeight:1.6,marginTop:0}}>Online booking, email potvrde i PWA push rade iz iste baze. Novi termin se odmah pojavljuje ovdje i šalje obavijest vlasniku.</p><a className="btn" style={{width:"100%"}} href={`/book/${user.tenant?.slug}`}>Otvori booking stranicu</a></div></div></section></main>
}
function Stat({label,value}:{label:string;value:string}){return <div className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-delta">Ažurirano uživo</div></div>}
