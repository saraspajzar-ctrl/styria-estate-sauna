import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { DailyAllowance, Reservation } from "@/lib/types";
import { MAX_DAILY_MINUTES_PER_STAY } from "@/lib/config";

export type BookInput = {
  stayId: string;
  resourceId: string;
  reservationDate: string;
  startTime: string;
  durationMinutes: number;
  isAdmin?: boolean;
  adminUserId?: string;
};

/** Thrown with the raw Postgres message; callers use parseDbError() on it. */
export async function bookReservation(input: BookInput): Promise<Reservation> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("book_sauna_reservation", {
    p_stay_id: input.stayId,
    p_resource_id: input.resourceId,
    p_reservation_date: input.reservationDate,
    p_start_time: input.startTime,
    p_duration_minutes: input.durationMinutes,
    p_is_admin: input.isAdmin ?? false,
    p_admin_user_id: input.adminUserId ?? null,
  });
  if (error) throw error;
  return data as Reservation;
}

export type UpdateInput = {
  reservationId: string;
  stayId?: string;
  reservationDate: string;
  startTime: string;
  durationMinutes: number;
  isAdmin?: boolean;
  adminUserId?: string;
};

export async function updateReservation(input: UpdateInput): Promise<Reservation> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("update_sauna_reservation", {
    p_reservation_id: input.reservationId,
    p_stay_id: input.stayId ?? null,
    p_reservation_date: input.reservationDate,
    p_start_time: input.startTime,
    p_duration_minutes: input.durationMinutes,
    p_is_admin: input.isAdmin ?? false,
    p_admin_user_id: input.adminUserId ?? null,
  });
  if (error) throw error;
  return data as Reservation;
}

export async function cancelReservation(
  reservationId: string,
  stayId: string | undefined,
  isAdmin: boolean,
  adminUserId?: string
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.rpc("cancel_sauna_reservation", {
    p_reservation_id: reservationId,
    p_stay_id: stayId ?? null,
    p_is_admin: isAdmin,
    p_admin_user_id: adminUserId ?? null,
  });
  if (error) throw error;
}

export async function listReservationsForStay(stayId: string): Promise<Reservation[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("sauna_reservations")
    .select(
      "id, stay_id, resource_id, apartment_id, reservation_date, start_time, end_time, duration_minutes, status, created_at"
    )
    .eq("stay_id", stayId)
    .eq("status", "active")
    .order("reservation_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data as Reservation[];
}

export async function getDailyAllowanceForStay(
  stayId: string,
  date: string,
  excludeReservationId?: string
): Promise<DailyAllowance> {
  const supabase = getServiceClient();
  let query = supabase
    .from("sauna_reservations")
    .select("duration_minutes")
    .eq("stay_id", stayId)
    .eq("reservation_date", date)
    .eq("status", "active");
  if (excludeReservationId) {
    query = query.neq("id", excludeReservationId);
  }
  const { data, error } = await query;
  if (error) throw error;

  const usedMinutes = (data ?? []).reduce((sum, r) => sum + r.duration_minutes, 0);
  return {
    usedMinutes,
    remainingMinutes: Math.max(0, MAX_DAILY_MINUTES_PER_STAY - usedMinutes),
    limitMinutes: MAX_DAILY_MINUTES_PER_STAY,
  };
}
