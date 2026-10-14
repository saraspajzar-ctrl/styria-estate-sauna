"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { formatDisplayDate } from "@/lib/time";
import { Apartment, Stay } from "@/lib/types";

export default function AdminStaysPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [apartmentFilter, setApartmentFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ apartmentId: "", guestSurname: "", checkIn: "", checkOut: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<{ surname: string; code: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState({ checkIn: "", checkOut: "" });
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [reissuedCode, setReissuedCode] = useState<{ stayId: string; code: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (apartmentFilter) params.set("apartmentId", apartmentFilter);
    const res = await fetch(`/api/admin/stays?${params.toString()}`);
    const data = await res.json();
    setStays(data.stays ?? []);
    setLoading(false);
  }, [statusFilter, apartmentFilter]);

  useEffect(() => {
    fetch("/api/admin/apartments")
      .then((r) => r.json())
      .then((d) => {
        setApartments(d.apartments ?? []);
        setForm((f) => ({ ...f, apartmentId: d.apartments?.[0]?.id ?? "" }));
      });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-filter-change
    refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIssuedCode(null);

    const res = await fetch("/api/admin/stays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error ?? "Could not create stay.");
      return;
    }
    setIssuedCode({ surname: form.guestSurname, code: data.accessCode });
    setForm((f) => ({ ...f, guestSurname: "", checkIn: "", checkOut: "" }));
    await refresh();
  }

  async function handleCancelStay(id: string) {
    const res = await fetch(`/api/admin/stays/${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/admin/stays/${id}/revoke`, { method: "POST" });
    if (res.ok) await refresh();
  }

  async function handleReissue(id: string) {
    setReissuedCode(null);
    const res = await fetch(`/api/admin/stays/${id}/reissue`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setReissuedCode({ stayId: id, code: data.accessCode });
      await refresh();
    }
  }

  function startEditDates(stay: Stay) {
    setEditingId(stay.id);
    setEditDates({ checkIn: stay.check_in, checkOut: stay.check_out });
  }

  async function saveDates(id: string) {
    setRowError((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/admin/stays/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editDates),
    });
    const data = await res.json();
    if (!res.ok) {
      setRowError((prev) => ({ ...prev, [id]: data.error ?? "Could not update dates." }));
      return;
    }
    setEditingId(null);
    await refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Create accommodation stay
        </p>
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-2xl border border-line bg-card p-5 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Apartment
            </label>
            <select
              value={form.apartmentId}
              onChange={(e) => setForm((f) => ({ ...f, apartmentId: e.target.value }))}
              className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
            >
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Guest surname
            </label>
            <input
              required
              value={form.guestSurname}
              onChange={(e) => setForm((f) => ({ ...f, guestSurname: e.target.value }))}
              className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
              placeholder="e.g. Novak"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Check-in
            </label>
            <input
              type="date"
              required
              value={form.checkIn}
              onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))}
              className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Check-out
            </label>
            <input
              type="date"
              required
              value={form.checkOut}
              onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
              className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
            />
          </div>
          {formError && (
            <p className="sm:col-span-2 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">
              {formError}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit">Create stay &amp; generate access code</Button>
          </div>
        </form>

        {issuedCode && (
          <div className="mt-3 rounded-2xl border border-forest/40 bg-available p-5">
            <p className="text-sm text-ink">
              Access code for <span className="font-semibold">{issuedCode.surname}</span> — share
              this with the guest now. It will not be shown again.
            </p>
            <p className="mt-2 font-mono text-2xl tracking-widest text-forest-light">
              {issuedCode.code}
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            All stays
          </p>
          <div className="flex gap-2">
            <select
              value={apartmentFilter}
              onChange={(e) => setApartmentFilter(e.target.value)}
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs outline-none"
            >
              <option value="">All apartments</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs outline-none"
            >
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
              <option value="">All</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="rounded-2xl border border-line bg-card p-5 text-sm text-ink-soft">
            Loading…
          </p>
        ) : stays.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-5 text-sm text-ink-soft">
            No stays found.
          </p>
        ) : (
          <ul className="space-y-3">
            {stays.map((stay) => (
              <li key={stay.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-ink">{stay.guest_surname}</span>{" "}
                    <span className="text-ink-soft">· {stay.apartment?.name}</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest ${
                      stay.status === "active"
                        ? "bg-available text-forest-light border border-available-border"
                        : "bg-stone-dim text-ink-soft"
                    }`}
                  >
                    {stay.status}
                    {stay.access_code_revoked ? " · code revoked" : ""}
                  </span>
                </div>

                {editingId === stay.id ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] uppercase text-ink-soft">
                        Check-in
                      </label>
                      <input
                        type="date"
                        value={editDates.checkIn}
                        onChange={(e) =>
                          setEditDates((d) => ({ ...d, checkIn: e.target.value }))
                        }
                        className="rounded-lg border border-line bg-stone px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] uppercase text-ink-soft">
                        Check-out
                      </label>
                      <input
                        type="date"
                        value={editDates.checkOut}
                        onChange={(e) =>
                          setEditDates((d) => ({ ...d, checkOut: e.target.value }))
                        }
                        className="rounded-lg border border-line bg-stone px-2 py-1.5 text-sm"
                      />
                    </div>
                    <Button className="!px-3 !py-1.5 text-xs" onClick={() => saveDates(stay.id)}>
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-ink-soft">
                    {formatDisplayDate(stay.check_in)} → {formatDisplayDate(stay.check_out)}
                  </p>
                )}
                {rowError[stay.id] && (
                  <p className="mt-1 text-xs text-clay">{rowError[stay.id]}</p>
                )}

                {reissuedCode?.stayId === stay.id && (
                  <div className="mt-2 rounded-xl border border-forest/40 bg-available p-3">
                    <p className="text-xs text-ink-soft">New access code (shown once):</p>
                    <p className="font-mono text-lg tracking-widest text-forest-light">
                      {reissuedCode.code}
                    </p>
                  </div>
                )}

                {stay.status === "active" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => startEditDates(stay)}
                    >
                      Edit dates
                    </Button>
                    <Button
                      variant="secondary"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => handleReissue(stay.id)}
                    >
                      Reissue code
                    </Button>
                    {!stay.access_code_revoked && (
                      <Button
                        variant="secondary"
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => handleRevoke(stay.id)}
                      >
                        Revoke code
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => handleCancelStay(stay.id)}
                    >
                      Cancel stay
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
