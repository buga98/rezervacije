import { requireUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/AdminShell";
export default async function DashboardLayout({children}:{children:React.ReactNode}){const user=await requireUser();return <AdminShell user={{name:user.name,role:user.role,tenant:user.tenant?{name:user.tenant.name,slug:user.tenant.slug}:null}}>{children}</AdminShell>}
