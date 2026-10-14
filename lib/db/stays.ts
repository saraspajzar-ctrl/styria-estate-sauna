import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { Stay } from "@/lib/types";

/**
 * Looks up an active, non-revoked stay by its access-code hash. Used only by
 * the guest verify endpoint. Never returns stays whose code was revoked or
 * whose status is no longer 'active'.
 */
export async function findActiveStayByCodeHash(hash: string): Promise<Stay | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("stays")
    .select(
      "id, apartment_id, guest_surname, check_in, check_out, access_code_revoked, status, created_at, apartments(id, name, accommodation_capacity, active)"
    )
    .eq("access_code_hash", hash)
    .eq("status", "active")
    .eq("access_code_revoked", false)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    apartment: Array.isArray(data.apartments) ? data.apartments[0] : data.apartments,
  } as unknown as Stay;
}

export async function getStayById(stayId: string): Promise<Stay | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("stays")
    .select(
      "id, apartment_id, guest_surname, check_in, check_out, access_code_revoked, status, created_at, apartments(id, name, accommodation_capacity, active)"
    )
    .eq("id", stayId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    apartment: Array.isArray(data.apartments) ? data.apartments[0] : data.apartments,
  } as unknown as Stay;
}

export type StayFilters = {
  apartmentId?: string;
  status?: string;
};

export async function listStays(filters: StayFilters = {}): Promise<Stay[]> {
  const supabase = getServiceClient();
  let query = supabase
    .from("stays")
    .select(
      "id, apartment_id, guest_surname, check_in, check_out, access_code_revoked, status, created_at, apartments(id, name, accommodation_capacity, active)"
    )
    .order("created_at", { ascending: false });

  if (filters.apartmentId) query = query.eq("apartment_id", filters.apartmentId);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    apartment: Array.isArray(row.apartments) ? row.apartments[0] : row.apartments,
  })) as unknown as Stay[];
}
