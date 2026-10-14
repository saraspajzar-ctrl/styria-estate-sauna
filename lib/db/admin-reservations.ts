import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminReservation } from "@/lib/types";

export type AdminReservationFilters = {
  date?: string;
  apartmentId?: string;
  stayId?: string;
  status?: string;
};

type Row = {
  id: string;
  stay_id: string;
  resource_id: string;
  apartment_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  apartments: { name: string } | { name: string }[] | null;
  stays: { guest_surname: string } | { guest_surname: string }[] | null;
};

export async function listAdminReservations(
  filters: AdminReservationFilters = {}
): Promise<AdminReservation[]> {
  const supabase = getServiceClient();
  let query = supabase
    .from("sauna_reservations")
    .select(
      "id, stay_id, resource_id, apartment_id, reservation_date, start_time, end_time, duration_minutes, status, created_at, apartments(name), stays(guest_surname)"
    )
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (filters.date) query = query.eq("reservation_date", filters.date);
  if (filters.apartmentId) query = query.eq("apartment_id", filters.apartmentId);
  if (filters.stayId) query = query.eq("stay_id", filters.stayId);
  query = query.eq("status", filters.status ?? "active");

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as Row;
    const apartment = Array.isArray(r.apartments) ? r.apartments[0] : r.apartments;
    const stay = Array.isArray(r.stays) ? r.stays[0] : r.stays;
    return {
      ...r,
      apartment_name: apartment?.name ?? "",
      guest_surname: stay?.guest_surname ?? "",
    } as AdminReservation;
  });
}
