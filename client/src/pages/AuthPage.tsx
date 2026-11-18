import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/store/auth";

// Only allow redirects to paths inside this app, never to another site.
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function AuthPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const session = useAuth((s) => s.session);
  const authLoading = useAuth((s) => s.loading);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (or just signed in): leave this page.
  if (!authLoading && session) return <Navigate to={next} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      // On success the auth listener updates the store and the redirect above takes over.
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }, // copied into profiles.full_name by a database trigger
          emailRedirectTo: `${window.location.origin}${next}`,
        },
      });
      if (error) setError(error.message);
      else if (!data.session) setNotice("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (error) setError(error.message);
  }

  const isSignUp = mode === "signup";

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">{isSignUp ? "Create your account" : "Sign in"}</h1>

      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or use your email
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && <p role="status" className="text-sm">{notice}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          className="font-medium text-foreground underline"
          onClick={() => {
            setMode(isSignUp ? "signin" : "signup");
            setError(null);
            setNotice(null);
          }}
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </main>
  );
}