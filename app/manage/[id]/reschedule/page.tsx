import crypto from "node:crypto";
import { subHours } from "date-fns";
import { notFound,redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { RescheduleClient } from "@/components/RescheduleClient";
const hash=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");
export default async function ReschedulePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){const {id}=await params;const {token=""}=await searchParams;const a=await prisma.appointment.findUnique({where:{id},include:{tenant:true,service:true,staff:true}});if(!a||!token||a.manageTokenHash!==hash(token))notFound();if(new Date()>subHours(a.startsAt,a.tenant.cancellationHours))redirect(`/manage/${id}?token=${encodeURIComponent(token)}`);return <main className="center-shell"><div className="auth-card" style={{maxWidth:650}}><div className="brand"><span className="brand-mark">L+</span><span>{a.tenant.name}</span></div><h1>Promijeni termin</h1><p className="muted">{a.service.name} · {a.staff.displayName}. Odaberite novi slobodni termin.</p><RescheduleClient id={id} token={token} slug={a.tenant.slug} serviceId={a.serviceId} staffId={a.staffId}/></div></main>}
