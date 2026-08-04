"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signInDemo } from "@/lib/actions/demo-auth";
import { StatementPanel } from "@/components/auth/statement-panel";
import { makeMotionSet } from "@/components/error/motion-presets";

const DEMO =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

const FIELD =
  "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-muted-foreground/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 lg:h-12";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const still = useReducedMotion();
  const { container, item } = useMemo(() => makeMotionSet(!!still), [still]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (DEMO) {
      const res = await signInDemo(email, password);
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? "Sign in failed.");
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(params.get("next") || "/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,53.5%)_1fr]">
      <StatementPanel />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex items-center justify-center bg-background px-6 py-12 lg:px-10"
      >
        <div className="w-full max-w-[21.25rem] lg:max-w-[26rem] xl:max-w-[28rem]">
          <motion.div variants={item} className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              BM
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.14em]">Bulk Mapper</span>
          </motion.div>

          <motion.div variants={item} className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight lg:text-3xl">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue where you left off.
            </p>
          </motion.div>

          <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5 lg:mt-8 lg:gap-6">
            <motion.div variants={item} className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD}
                placeholder="you@company.com"
              />
            </motion.div>

            <motion.div variants={item} className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${FIELD} pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <motion.button
              variants={item}
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:opacity-60 lg:h-12"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </motion.button>
          </form>

          <motion.div
            variants={item}
            aria-hidden
            className="mt-6 h-px bg-[linear-gradient(to_right,hsl(var(--border)),transparent_70%)]"
          />

          <motion.p variants={item} className="mt-4 text-pretty text-xs text-muted-foreground">
            Trouble signing in? Accounts are created for you — ask your administrator.
          </motion.p>

          {DEMO && (
            <motion.p
              variants={item}
              className="mt-5 rounded-lg border border-dashed border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
            >
              Demo mode: sign in with the seeded admin email for Admin access, or any other email to
              explore as HR.
            </motion.p>
          )}
        </div>
      </motion.div>
    </main>
  );
}
