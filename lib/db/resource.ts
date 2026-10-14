import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { Resource } from "@/lib/types";

export async function getSaunaResource(): Promise<Resource> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("resources")
    .select("id, name, capacity, open_time, close_time, active")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error("RESOURCE_NOT_FOUND: No active sauna resource configured.");
  return data as Resource;
}

export async function listApartments() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("apartments")
    .select("id, name, accommodation_capacity, active")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}
