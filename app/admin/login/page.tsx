"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">
            Styria Estate
          </p>
          <h1 className="mt-2 font-display text-2xl italic text-ink">Admin Sign In</h1>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-line bg-card p-6 shadow-sm"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-line bg-stone px-4 py-3 text-sm text-ink outline-none focus:border-forest"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line bg-stone px-4 py-3 text-sm text-ink outline-none focus:border-forest"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-clay/10 px-4 py-2.5 text-sm text-clay">{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>
    </main>
  );
}
