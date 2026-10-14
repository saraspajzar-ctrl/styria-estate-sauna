import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { minutesToTime, timeToMinutes } from "@/lib/time";
import { SLOT_INCREMENT_MINUTES } from "@/lib/config";
import { ScheduleSlot } from "@/lib/types";

type ReservationRow = {
  id: string;
  stay_id: string;
  start_time: string;
  end_time: string;
  apartment_id: string;
  apartments: { name: string } | null;
};

/**
 * Builds the resource's full-day timeline. `viewerStayId`, when provided,
 * flags which reserved blocks belong to the caller's own stay — no guest
 * surname, apartment internals, or other PII is ever included.
 */
export async function getPublicSchedule(
  resourceId: string,
  date: string,
  viewerStayId?: string
): Promise<ScheduleSlot[]> {
  const supabase = getServiceClient();

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .select("open_time, close_time")
    .eq("id", resourceId)
    .single();
  if (resourceError || !resource) return [];

  const { data: reservations, error: reservationsError } = await supabase
    .from("sauna_reservations")
    .select("id, stay_id, start_time, end_time, apartment_id, apartments(name)")
    .eq("resource_id", resourceId)
    .eq("reservation_date", date)
    .eq("status", "active")
    .order("start_time", { ascending: true });
  if (reservationsError) throw reservationsError;

  return buildSlots(
    resource.open_time,
    resource.close_time,
    (reservations ?? []) as unknown as ReservationRow[],
    viewerStayId
  );
}

type AdminReservationRow = {
  id: string;
  stay_id: string;
  start_time: string;
  end_time: string;
  apartment_id: string;
  number_of_guests: number;
  apartments: { name: string } | null;
  stays: { guest_surname: string } | null;
};

export type AdminScheduleSlot = ScheduleSlot & {
  guestSurname?: string;
  numberOfGuests?: number;
};

/** Admin view: same timeline, but reveals guest surname and guest count. */
export async function getAdminSchedule(
  resourceId: string,
  date: string
): Promise<AdminScheduleSlot[]> {
  const supabase = getServiceClient();

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .select("open_time, close_time")
    .eq("id", resourceId)
    .single();
  if (resourceError || !resource) return [];

  const { data: reservations, error: reservationsError } = await supabase
    .from("sauna_reservations")
    .select(
      "id, stay_id, start_time, end_time, apartment_id, number_of_guests, apartments(name), stays(guest_surname)"
    )
    .eq("resource_id", resourceId)
    .eq("reservation_date", date)
    .eq("status", "active")
    .order("start_time", { ascending: true });
  if (reservationsError) throw reservationsError;

  const openMinutes = timeToMinutes(resource.open_time.slice(0, 5));
  const closeMinutes = timeToMinutes(resource.close_time.slice(0, 5));
  const rows = (reservations ?? []) as unknown as AdminReservationRow[];

  const slots: AdminScheduleSlot[] = [];
  for (let t = openMinutes; t < closeMinutes; t += SLOT_INCREMENT_MINUTES) {
    const time = minutesToTime(t);
    const match = rows.find(
      (r) =>
        timeToMinutes(r.start_time.slice(0, 5)) <= t &&
        t < timeToMinutes(r.end_time.slice(0, 5))
    );
    if (match) {
      slots.push({
        time,
        status: "reserved",
        apartmentName: match.apartments?.name,
        guestSurname: match.stays?.guest_surname,
        numberOfGuests: match.number_of_guests,
        reservationId: match.id,
        isReservationStart: match.start_time.slice(0, 5) === time,
      });
    } else {
      slots.push({ time, status: "available" });
    }
  }
  return slots;
}

function buildSlots(
  openTime: string,
  closeTime: string,
  reservations: ReservationRow[],
  viewerStayId?: string
): ScheduleSlot[] {
  const openMinutes = timeToMinutes(openTime.slice(0, 5));
  const closeMinutes = timeToMinutes(closeTime.slice(0, 5));

  const slots: ScheduleSlot[] = [];
  for (let t = openMinutes; t < closeMinutes; t += SLOT_INCREMENT_MINUTES) {
    const time = minutesToTime(t);
    const match = reservations.find(
      (r) =>
        timeToMinutes(r.start_time.slice(0, 5)) <= t &&
        t < timeToMinutes(r.end_time.slice(0, 5))
    );
    if (match) {
      slots.push({
        time,
        status: "reserved",
        apartmentName: match.apartments?.name,
        isMine: viewerStayId ? match.stay_id === viewerStayId : undefined,
        reservationId: match.id,
        isReservationStart: match.start_time.slice(0, 5) === time,
      });
    } else {
      slots.push({ time, status: "available" });
    }
  }
  return slots;
}
