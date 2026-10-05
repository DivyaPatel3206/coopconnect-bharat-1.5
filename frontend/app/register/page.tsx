"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import Card from "@/components/Card";

const roles = [
  { value: "trainee", label: "Trainee / Participant" },
  { value: "trainer", label: "Trainer / Faculty" },
  { value: "employer", label: "Employer / Recruiter" },
  { value: "institution_admin", label: "Institution Admin" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("trainee");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password, role);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-indigo mb-2">Create an account</h1>
      <p className="text-coop-slate mb-8 text-sm">Join CoopConnect Bharat in under a minute.</p>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-coop-ink mb-1">Full name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-black/15 px-3 py-2 focus-ring"
            />
          </div>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-black/15 px-3 py-2 focus-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-coop-ink mb-1">I am a…</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-black/15 px-3 py-2 focus-ring bg-white"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo text-white font-medium py-2.5 hover:bg-indigo-dark transition-colors disabled:opacity-60 focus-ring"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </Card>
      <p className="text-sm text-coop-slate mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
