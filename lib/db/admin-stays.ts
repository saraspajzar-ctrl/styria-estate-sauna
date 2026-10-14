import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { generateAccessCode, hashAccessCode } from "@/lib/access-code";

export async function adminCreateStay(input: {
  apartmentId: string;
  guestSurname: string;
  checkIn: string;
  checkOut: string;
  adminUserId: string;
}) {
  const supabase = getServiceClient();
  const plaintextCode = generateAccessCode();
  const hash = hashAccessCode(plaintextCode);

  const { data, error } = await supabase.rpc("admin_create_stay", {
    p_apartment_id: input.apartmentId,
    p_guest_surname: input.guestSurname,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_access_code_hash: hash,
    p_admin_user_id: input.adminUserId,
  });
  if (error) throw error;

  return { stay: data, accessCode: plaintextCode };
}

export async function adminUpdateStayDates(input: {
  stayId: string;
  checkIn: string;
  checkOut: string;
  adminUserId: string;
}) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("admin_update_stay_dates", {
    p_stay_id: input.stayId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_admin_user_id: input.adminUserId,
  });
  if (error) throw error;
  return data;
}

export async function adminCancelStay(stayId: string, adminUserId: string) {
  const supabase = getServiceClient();
  const { error } = await supabase.rpc("admin_cancel_stay", {
    p_stay_id: stayId,
    p_admin_user_id: adminUserId,
  });
  if (error) throw error;
}

export async function adminRevokeAccessCode(stayId: string, adminUserId: string) {
  const supabase = getServiceClient();
  const { error } = await supabase.rpc("admin_revoke_access_code", {
    p_stay_id: stayId,
    p_admin_user_id: adminUserId,
  });
  if (error) throw error;
}

export async function adminReissueAccessCode(stayId: string, adminUserId: string) {
  const supabase = getServiceClient();
  const plaintextCode = generateAccessCode();
  const hash = hashAccessCode(plaintextCode);

  const { data, error } = await supabase.rpc("admin_reissue_access_code", {
    p_stay_id: stayId,
    p_access_code_hash: hash,
    p_admin_user_id: adminUserId,
  });
  if (error) throw error;

  return { stay: data, accessCode: plaintextCode };
}
