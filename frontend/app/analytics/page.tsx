"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BarList, Columns, Funnel } from "@/components/charts";
import { CardSkeleton, Empty, ProgressBar } from "@/components/ui";

type A = any;

function Block({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-black/[0.09] bg-white p-5 ${className}`}>
      <h2 className="font-display text-lg font-semibold text-indigo">{title}</h2>
      {note && <p className="mt-0.5 mb-4 text-sm text-coop-slate">{note}</p>}
      {!note && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const [d, setD] = useState<A | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (user) api<A>("/api/analytics/insights").then(setD).catch((e) => setErr(e.message)); }, [user]);

  if (loading) return <div className="mx-auto max-w-7xl px-6 py-12"><CardSkeleton /></div>;
  if (!user) return <div className="mx-auto max-w-md px-6 py-20 text-center"><h1 className="font-display text-2xl text-indigo">Analytics</h1><p className="mt-2 text-coop-slate">Sign in to see participation, completion and employment outcomes.</p><Link href="/login" className="mt-4 inline-block rounded-md bg-indigo px-5 py-2.5 text-sm font-medium text-white">Sign in</Link></div>;

  const t = d?.totals;
  const topCat = d?.participation?.[0];
  const completionRate = t && t.registrations ? Math.round((t.completed / t.registrations) * 100) : 0;
  const hire = d?.funnel?.[0]?.value ? Math.round((d.funnel[3].value / d.funnel[0].value) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <p className="eyebrow">Analytics</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-indigo">Programme outcomes</h1>
      <p className="mt-1 max-w-2xl text-coop-slate">Aggregate figures from live platform data. No individual learner details are shown.</p>
      {err && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <dl className="mt-6 grid grid-cols-2 divide-black/[0.08] rounded-lg border border-black/[0.09] bg-white md:grid-cols-4 md:divide-x">
        {[["Registrations", t?.registrations], ["Completion rate", t ? `${completionRate}%` : undefined], ["Certificates issued", t?.certificates], ["Employment conversion", d ? `${hire}%` : undefined]].map(([l, v], i) => (
          <div key={l as string} className={`p-5 ${i > 1 ? "border-t border-black/[0.08] md:border-t-0" : ""}`}><dd className="num font-display text-3xl font-semibold text-indigo">{v ?? "—"}</dd><dt className="mt-1 text-sm text-coop-slate">{l}</dt></div>))}
      </dl>

      {!d && !err && <div className="mt-6 grid gap-6 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} rows={5} />)}</div>}
      {d && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Block title="Training participation" note={topCat ? `${topCat.label} has the most registrations (${topCat.registrations}).` : "No registrations yet."}>
            {d.participation.length ? <BarList rows={d.participation.map((p: A) => ({ label: p.label, value: p.registrations, sub: `${p.programmes} programme${p.programmes === 1 ? "" : "s"}` }))} /> : <Empty>No data yet.</Empty>}
          </Block>
          <Block title="Registrations by month" note="New programme registrations over the last six months.">
            <Columns data={d.monthly} />
          </Block>
          <Block title="Course completion" note="Learners who finished each course, and their average progress.">
            {d.completion.length ? <ul className="space-y-4">{d.completion.map((c: A) => (
              <li key={c.label}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{c.label}</span><span className="num shrink-0 text-coop-slate">{c.completed}/{c.enrolled} finished · {c.avg_progress}% avg</span></div><div className="mt-1.5"><ProgressBar value={c.avg_progress} tone="green" label={c.label} /></div></li>))}</ul> : <Empty>No enrolments yet.</Empty>}
          </Block>
          <Block title="Skill development" note="Most common skills among learners, with their average level.">
            {d.skills.length ? <BarList rows={d.skills.map((s: A) => ({ label: s.label, value: s.learners, sub: `Average level ${s.avg_level}%` }))} /> : <Empty>No skills recorded yet.</Empty>}
          </Block>
          <Block title="Employment outcomes" note="From application to hire across all employers.">
            {d.funnel[0].value ? <Funnel stages={d.funnel} /> : <Empty>No job applications yet.</Empty>}
          </Block>
          <Block title="Regions" note="Registrations by the state of the delivering institution.">
            {d.regions.length ? <BarList rows={d.regions.map((r: A) => ({ label: r.label, value: r.registrations, sub: `${r.programmes} programme${r.programmes === 1 ? "" : "s"}` }))} /> : <Empty>No data yet.</Empty>}
          </Block>
          <Block title="Institution performance" className="lg:col-span-2" note="Registrations, completions and trainee attendance by institution.">
            {d.institutions.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs text-coop-slate"><tr><th className="pb-2 font-medium">Institution</th><th className="pb-2 font-medium">Programmes</th><th className="pb-2 font-medium">Registrations</th><th className="pb-2 font-medium">Completed</th><th className="pb-2 font-medium">Attendance</th></tr></thead>
                <tbody>{d.institutions.map((i: A) => (
                  <tr key={i.label} className="border-t border-black/[0.06]"><td className="py-2.5"><span className="font-medium">{i.label}</span><span className="ml-2 text-xs text-coop-slate">{i.state}</span></td><td className="num">{i.programmes}</td><td className="num">{i.registrations}</td><td className="num">{i.completed}</td>
                    <td>{i.attendance_percent == null ? <span className="text-coop-slate">—</span> : <div className="flex items-center gap-2"><div className="w-24"><ProgressBar value={i.attendance_percent} tone={i.attendance_percent >= 75 ? "green" : "saffron"} label="Attendance" /></div><span className="num text-xs">{i.attendance_percent}%</span></div>}</td></tr>))}</tbody></table></div>
            ) : <Empty>No institutions yet.</Empty>}
          </Block>
        </div>
      )}
    </div>
  );
}
