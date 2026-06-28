import { getTenantContext } from "@/lib/tenant/context";
import { BookingWizard } from "./booking-wizard";

export default async function ReserverPage() {
 const tenant = await getTenantContext();

 return (
 <div className="space-y-4">
 <div>
 <h1 className="text-2xl font-semibold text-slate-900">
 Prendre rendez-vous
 </h1>
 <p className="text-sm text-slate-500">
 {tenant?.name} — reservation en ligne
 </p>
 </div>
 <BookingWizard />
 </div>
 );
}
