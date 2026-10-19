import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Store, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Seller Sign in — Community Makers' Market" },
      { name: "description", content: "Sign in or create your seller account to list handmade products." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const { redirect } = useSearch({ from: "/_app/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) nav({ to: redirect || "/dashboard" });
  }, [user, loading, nav, redirect]);

  const resolveEmail = (u: string) => {
    const trimmed = u.trim().toLowerCase();
    if (trimmed.includes("@")) return trimmed;
    const clean = trimmed.replace(/[^a-z0-9_]/g, "");
    return `${clean}@makers.local`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const rawInput = username.trim().toLowerCase();
    if (!rawInput.includes("@")) {
      const cleanUser = rawInput.replace(/[^a-z0-9_]/g, "");
      if (cleanUser.length < 3) {
        setErr("Username must be at least 3 letters/numbers.");
        return;
      }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawInput)) {
        setErr("Please enter a valid email address.");
        return;
      }
    }

    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const email = resolveEmail(rawInput);
      if (mode === "signup") {
        if (!shopName.trim()) throw new Error("Shop name is required");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { shop_name: shopName.trim(), area: area.trim(), phone: phone.trim() },
          },
        });
        if (error) {
          const msg = error.message.toLowerCase();
          const errCode = (error as unknown as { code?: string; error_code?: string }).code || (error as unknown as { error_code?: string }).error_code;
          
          if (
            errCode === "weak_password" ||
            msg.includes("weak") ||
            msg.includes("pwned") ||
            msg.includes("guess")
          ) {
            throw new Error("Password is too common or easily guessable. Please choose a stronger password.");
          }

          if (
            errCode === "user_already_exists" ||
            msg.includes("already registered") ||
            msg.includes("already exists") ||
            msg.includes("identity")
          ) {
            throw new Error("An account with this email/username already exists. Please sign in or use a different one.");
          }

          throw error;
        }

        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("An account with this email/username already exists. Please sign in or use a different one.");
        }

        if (data?.user && !data.session) {
          setErr("Account created! If email confirmation is enabled, please verify your email before signing in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("invalid login credentials")) {
            throw new Error("Invalid username/email or password. Please try again.");
          }
          throw error;
        }
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-warm text-primary-foreground shadow-soft">
          <Store className="h-5 w-5" />
        </span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">For Sellers</div>
          <h1 className="font-display text-2xl font-semibold">
            {mode === "signup" ? "Create your seller account" : "Welcome back"}
          </h1>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        {mode === "signup" && (
          <>
            <Field label="Shop name *">
              <input value={shopName} onChange={(e) => setShopName(e.target.value)}
                placeholder="Lakshmi Crafts" className="input" required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Area / city">
                <input value={area} onChange={(e) => setArea(e.target.value)}
                  placeholder="Visakhapatnam, AP" className="input" />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 …" className="input" />
              </Field>
            </div>
          </>
        )}
        <Field label="Username or Email *">
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="lakshmi_crafts or seller@example.com" autoComplete="username" className="input" required />
          <span className="mt-1 block text-[11px] text-muted-foreground">Use a username (e.g. lakshmi_crafts) or your email address.</span>
        </Field>
        <Field label="Password *">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="input" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          <span className="mt-1 block text-[11px] text-muted-foreground">At least 6 characters. Any simple password you'll remember is accepted.</span>
        </Field>

        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

        <button type="submit" disabled={busy}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <p className="pt-2 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New seller?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); }}
            className="font-semibold text-primary hover:underline">
            {mode === "signup" ? "Sign in" : "Create account"}
          </button>
        </p>
      </form>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:0.55rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}