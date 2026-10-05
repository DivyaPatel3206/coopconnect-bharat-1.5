"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import Card from "@/components/Card";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("priya@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-indigo mb-2">Sign in</h1>
      <p className="text-coop-slate mb-8 text-sm">
        Demo account pre-filled: <code>priya@example.com</code> / <code>password123</code>
      </p>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-coop-ink mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-black/15 px-3 py-2 focus-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-coop-ink mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-black/15 px-3 py-2 focus-ring"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo text-white font-medium py-2.5 hover:bg-indigo-dark transition-colors disabled:opacity-60 focus-ring"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </Card>
      <p className="text-sm text-coop-slate mt-4">
        New here?{" "}
        <Link href="/register" className="text-indigo font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
