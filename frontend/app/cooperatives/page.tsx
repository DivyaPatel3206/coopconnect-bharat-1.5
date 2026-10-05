"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SECTORS } from "@/lib/content";
import Icon from "@/components/Icon";
import { Skeleton } from "@/components/ui";

export default function CooperativesPage() {
  const [inst, setInst] = useState<{ name: string; type: string; state: string | null }[] | null>(null);
  useEffect(() => { api<any>("/api/public/overview").then((d) => setInst(d.institutions)).catch(() => setInst([])); }, []);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <p className="eyebrow">Cooperatives</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-indigo">Sectors we train for</h1>
      <p className="mt-1 max-w-2xl text-coop-slate">Cooperatives work across many parts of the economy. Pick a sector to find related programmes, then see the roles it leads to.</p>

      <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-black/[0.09] bg-black/[0.09] sm:grid-cols-2 lg:grid-cols-3">
        {SECTORS.map((s) => (
          <li key={s.name} className="bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-indigo">{s.name}</h2>
            <p className="mt-2 text-sm text-coop-ink/75">{s.text}</p>
            <div className="mt-4 flex gap-4 text-sm font-medium">
              <Link href={`/programmes?q=${encodeURIComponent(s.q)}`} className="inline-flex items-center gap-1 text-indigo hover:underline focus-ring rounded">Programmes<Icon name="arrow" size={13} /></Link>
              <Link href={`/courses?q=${encodeURIComponent(s.q)}`} className="inline-flex items-center gap-1 text-indigo hover:underline focus-ring rounded">Courses<Icon name="arrow" size={13} /></Link>
            </div>
          </li>
        ))}
      </ul>

      <section id="institutions" className="mt-14 scroll-mt-24">
        <p className="eyebrow">Institutions</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-indigo">Where training is delivered</h2>
        <div className="mt-5 divide-y divide-black/[0.08] rounded-lg border border-black/[0.09] bg-white">
          {!inst && [0, 1, 2].map((i) => <div key={i} className="p-4"><Skeleton className="h-5 w-1/3" /></div>)}
          {inst?.map((i) => (
            <div key={i.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"><span className="font-medium">{i.name}</span><span className="text-sm text-coop-slate">{i.type} · {i.state || "India"}</span></div>))}
        </div>
      </section>
    </div>
  );
}
