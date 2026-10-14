export type Apartment = {
  id: string;
  name: string;
  accommodation_capacity: number;
  active: boolean;
};

export type Resource = {
  id: string;
  name: string;
  capacity: number;
  open_time: string;
  close_time: string;
  active: boolean;
};

export type StayStatus = "active" | "cancelled" | "completed";

/** Full row — admin views only. Never sent to the guest-facing API. */
export type Stay = {
  id: string;
  apartment_id: string;
  guest_surname: string;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  access_code_revoked: boolean;
  status: StayStatus;
  created_at: string;
  apartment?: Apartment;
};

/** What the guest-facing /sauna session is allowed to know about its own stay. */
export type GuestStayView = {
  apartmentName: string;
  checkIn: string;
  checkOut: string;
};

export type ReservationStatus = "active" | "cancelled";

export type Reservation = {
  id: string;
  stay_id: string;
  resource_id: string;
  apartment_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: ReservationStatus;
  created_at: string;
};

/** Reservation as returned to the guest for their own stay. */
export type GuestReservation = Pick<
  Reservation,
  "id" | "reservation_date" | "start_time" | "end_time" | "duration_minutes"
>;

/** Reservation as returned to the admin, with apartment/surname context. */
export type AdminReservation = Reservation & {
  apartment_name: string;
  guest_surname: string;
};

export type ScheduleSlotStatus = "available" | "reserved" | "closed";

/** Public-safe calendar slot — never carries guest surname or stay id. */
export type ScheduleSlot = {
  time: string;
  status: ScheduleSlotStatus;
  apartmentName?: string;
  isMine?: boolean;
  reservationId?: string;
  isReservationStart?: boolean;
};

export type DailyAllowance = {
  usedMinutes: number;
  remainingMinutes: number;
  limitMinutes: number;
};
