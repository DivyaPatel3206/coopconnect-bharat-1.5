"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import Card from "@/components/Card";

type VerifyResult = {
  verified: boolean;
  programme_name?: string;
  institution_name?: string;
  skill?: string;
  issued_date?: string;
  holder_name?: string;
};

export default function VerifyCertificatePage() {
  const [id, setId] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api<VerifyResult>(`/api/certificates/verify/${encodeURIComponent(id.trim())}`);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-indigo mb-2">Verify a certificate</h1>
      <p className="text-coop-slate mb-8 text-sm">
        Enter the verification ID printed on the certificate, or scan its QR code.
      </p>
      <Card>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            required
            placeholder="e.g. A1B2C3D4E5"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="flex-1 rounded-md border border-black/15 px-3 py-2 uppercase focus-ring"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo text-white font-medium px-4 py-2 text-sm hover:bg-indigo-dark transition-colors disabled:opacity-60 focus-ring"
          >
            {loading ? "Checking…" : "Verify"}
          </button>
        </form>
      </Card>

      {result && (
        <Card className="mt-6">
          {result.verified ? (
            <>
              <p className="text-coop-green font-medium text-sm mb-3">✓ Verified certificate</p>
              <dl className="text-sm space-y-2">
                <div><dt className="text-coop-slate">Programme</dt><dd className="font-medium">{result.programme_name}</dd></div>
                <div><dt className="text-coop-slate">Institution</dt><dd>{result.institution_name}</dd></div>
                <div><dt className="text-coop-slate">Skill</dt><dd>{result.skill}</dd></div>
                <div><dt className="text-coop-slate">Holder</dt><dd>{result.holder_name}</dd></div>
                <div>
                  <dt className="text-coop-slate">Issued</dt>
                  <dd>{result.issued_date ? new Date(result.issued_date).toLocaleDateString() : "—"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-red-600">No certificate found for this ID. Double-check and try again.</p>
          )}
        </Card>
      )}
    </div>
  );
}
