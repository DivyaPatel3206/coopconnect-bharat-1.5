"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { JOURNEY, STORIES } from "@/lib/content";
import { LogoMark } from "@/components/Logo";
import Icon from "@/components/Icon";
import { Skeleton, fmtDate } from "@/components/ui";

type Overview = {
  stats: { trainees: number; programmes: number; certificates: number; institutions: number; courses: number; open_jobs: number; completion_rate: number };
  programmes: { id: string; name: string; category: string | null; mode: string; location: string | null; start_date: string | null; institution_name: string | null; seats_left: number | null }[];
  jobs: { id: string; title: string; company_name: string | null; location: string | null; job_type: string; required_skills: string | null }[];
  announcements: { id: string; title: string; body: string | null; tag: string; link: string | null; created_at: string }[];
  institutions: { name: string; type: string; state: string | null }[];
};

function Ecosystem({ s }: { s?: Overview["stats"] }) {
  const nodes = [
    { x: 210, y: 62, t: "Train", sub: s ? `${s.programmes} programmes` : "" },
    { x: 358, y: 210, t: "Skills", sub: s ? `${s.courses} courses` : "" },
    { x: 210, y: 358, t: "Work", sub: s ? `${s.open_jobs} open roles` : "" },
    { x: 62, y: 210, t: "Cooperate", sub: s ? `${s.institutions} institutions` : "" },
  ];
  return (
    <svg viewBox="0 0 420 440" className="w-full max-w-[440px]" role="img" aria-label="Training, skills, work and cooperative ecosystem">
      <circle cx="210" cy="210" r="148" fill="none" stroke="#1B3A5C" strokeOpacity=".18" strokeWidth="1.5" strokeDasharray="2 6" />
      <path d="M210 62A148 148 0 0 1 358 210" fill="none" stroke="#E08A28" strokeWidth="3" strokeLinecap="round" />
      <path d="M358 210A148 148 0 0 1 210 358" fill="none" stroke="#1B3A5C" strokeWidth="3" strokeLinecap="round" />
      <circle cx="210" cy="210" r="62" fill="#F7F4ED" stroke="#1B3A5C" strokeOpacity=".15" />
      <foreignObject x="180" y="170" width="60" height="60"><div><LogoMark size={60} /></div></foreignObject>
      {nodes.map((n, i) => (
        <g key={n.t}>
          <circle cx={n.x} cy={n.y} r="28" fill="#fff" stroke="#1B3A5C" strokeWidth="1.5" />
          <text x={n.x} y={n.y + 5} textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fontWeight="600" fill="#1B3A5C">{i + 1}</text>
          <text x={n.x} y={n.y + (i === 2 ? 52 : i === 0 ? -40 : 0) + (i === 1 ? 52 : i === 3 ? 52 : 0)} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="600" fill="#1A1A1A">{n.t}</text>
          <text x={n.x} y={n.y + (i === 2 ? 68 : i === 0 ? -24 : 0) + (i === 1 ? 68 : i === 3 ? 68 : 0)} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fill="#6B7280">{n.sub}</text>
        </g>
      ))}
    </svg>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [d, setD] = useState<Overview | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<Overview>("/api/public/overview").then(setD).catch(() => setD(null)); }, []);
  const s = d?.stats;

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-black/[0.08] bg-coop-paper">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow">VAMNICOM · RICMs · ICMs · cooperative institutions</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] text-indigo sm:text-5xl lg:text-[56px]">Skills for cooperative India, from training to employment.</h1>
            <p className="mt-5 max-w-xl text-lg text-coop-ink/75">Join a programme, learn at your own pace, earn a certificate that employers can verify, and find the role or venture that comes next.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/register"} className="inline-flex items-center gap-2 rounded-md bg-indigo px-6 py-3 font-medium text-white hover:bg-indigo-dark transition-colors focus-ring">{user ? "Go to dashboard" : "Create free account"}<Icon name="arrow" size={16} /></Link>
              <Link href="/programmes" className="rounded-md border border-indigo/40 bg-white px-6 py-3 font-medium text-indigo hover:border-indigo transition-colors focus-ring">Browse programmes</Link>
            </div>
            <p className="mt-4 text-sm text-coop-slate">No cost to learners. Works on any phone.</p>
          </div>
          <div className="flex justify-center lg:justify-end"><Ecosystem s={s} /></div>
        </div>
      </section>

      {/* Key figures */}
      <section aria-label="Platform figures" className="border-b border-black/[0.08] bg-white">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-black/[0.08] px-4 sm:px-6 md:grid-cols-4 md:divide-x">
          {[["Learners", s?.trainees], ["Training programmes", s?.programmes], ["Certificates issued", s?.certificates], ["Programme completion", s ? `${s.completion_rate}%` : undefined]].map(([l, v], i) => (
            <div key={l as string} className={`py-7 md:px-8 ${i === 0 ? "md:pl-0" : ""}`}>
              <dd className="num font-display text-4xl font-semibold text-indigo">{v === undefined ? <Skeleton className="h-9 w-20" /> : v}</dd>
              <dt className="mt-1 text-sm text-coop-slate">{l}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* Journey */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <p className="eyebrow">The journey</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold text-indigo">One path from first lesson to first job, and back to the cooperative.</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-4">
          {JOURNEY.map((j) => (
            <li key={j.n} className="border-t-2 border-indigo pt-4">
              <span className="num font-display text-sm text-coop-saffron">{j.n}</span>
              <h3 className="mt-1 font-display text-xl font-semibold text-indigo">{j.title}</h3>
              <p className="mt-2 text-sm text-coop-ink/75">{j.text}</p>
              <Link href={j.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo hover:underline focus-ring rounded">{j.cta}<Icon name="arrow" size={14} /></Link>
            </li>
          ))}
        </ol>
      </section>

      {/* Programmes + opportunities */}
      <section className="border-y border-black/[0.08] bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 py-16 lg:grid-cols-2">
          <div>
            <div className="flex items-end justify-between"><div><p className="eyebrow">Featured training</p><h2 className="mt-2 font-display text-2xl font-semibold text-indigo">Upcoming programmes</h2></div><Link href="/programmes" className="text-sm font-medium text-indigo hover:underline">View all</Link></div>
            <ul className="mt-6 divide-y divide-black/[0.08] border-y border-black/[0.08]">
              {!d && [0, 1, 2].map((i) => <li key={i} className="py-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-1/2" /></li>)}
              {d?.programmes.length === 0 && <li className="py-6 text-sm text-coop-slate">New programmes will appear here.</li>}
              {d?.programmes.slice(0, 3).map((p) => (
                <li key={p.id}><Link href={`/programmes?q=${encodeURIComponent(p.name)}`} className="group flex items-start justify-between gap-4 py-4 focus-ring">
                  <div><p className="text-[11px] font-semibold uppercase tracking-wider text-coop-green">{p.category} · {p.mode}</p>
                    <p className="mt-0.5 font-medium text-coop-ink group-hover:text-indigo">{p.name}</p>
                    <p className="text-sm text-coop-slate">{[p.institution_name, p.location].filter(Boolean).join(" · ")}</p></div>
                  <div className="shrink-0 text-right text-sm"><p className="num text-coop-ink">{p.start_date ? fmtDate(p.start_date) : "Dates TBA"}</p>{p.seats_left != null && <p className="text-xs text-coop-slate">{p.seats_left} seats left</p>}</div>
                </Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-end justify-between"><div><p className="eyebrow">Employment</p><h2 className="mt-2 font-display text-2xl font-semibold text-indigo">Open opportunities</h2></div><Link href="/jobs" className="text-sm font-medium text-indigo hover:underline">View all</Link></div>
            <ul className="mt-6 divide-y divide-black/[0.08] border-y border-black/[0.08]">
              {!d && [0, 1, 2].map((i) => <li key={i} className="py-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-1/2" /></li>)}
              {d?.jobs.length === 0 && <li className="py-6 text-sm text-coop-slate">Employers are adding roles. Check back soon.</li>}
              {d?.jobs.slice(0, 4).map((j) => (
                <li key={j.id}><Link href={`/jobs?q=${encodeURIComponent(j.title)}`} className="group block py-4 focus-ring">
                  <div className="flex items-start justify-between gap-3"><p className="font-medium text-coop-ink group-hover:text-indigo">{j.title}</p><span className="shrink-0 rounded-full bg-indigo/[0.08] px-2.5 py-0.5 text-xs font-medium text-indigo">{j.job_type}</span></div>
                  <p className="text-sm text-coop-slate">{[j.company_name, j.location].filter(Boolean).join(" · ")}</p>
                  {j.required_skills && <p className="mt-1 text-xs text-coop-slate">Skills: {j.required_skills}</p>}
                </Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Announcements + stories */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 py-16 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="eyebrow">Latest announcements</p>
          <ul className="mt-4 divide-y divide-black/[0.08] border-y border-black/[0.08]">
            {!d && <li className="py-4"><Skeleton className="h-4 w-3/4" /></li>}
            {d?.announcements.map((a) => (
              <li key={a.id}>
                <button onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id} className="flex w-full items-start justify-between gap-4 py-4 text-left focus-ring">
                  <span><span className="text-[11px] font-semibold uppercase tracking-wider text-coop-saffron">{a.tag} · {fmtDate(a.created_at)}</span><span className="mt-0.5 block font-medium text-coop-ink">{a.title}</span></span>
                  <Icon name="chevron" size={16} className={`mt-1 shrink-0 text-coop-slate transition-transform ${open === a.id ? "rotate-180" : ""}`} />
                </button>
                {open === a.id && <div className="fade-in pb-4 text-sm text-coop-ink/75">{a.body}{a.link && <Link href={a.link} className="ml-2 font-medium text-indigo hover:underline">Open →</Link>}</div>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Learner journeys <span className="normal-case tracking-normal font-normal">(illustrative)</span></p>
          <div className="mt-4 grid gap-6 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {STORIES.map((t) => (
              <figure key={t.name} className="border-l-2 border-coop-saffron pl-4">
                <blockquote className="text-sm leading-relaxed text-coop-ink/85">“{t.text}”</blockquote>
                <figcaption className="mt-3 text-xs"><span className="font-semibold text-coop-ink">{t.name}</span><span className="block text-coop-slate">{t.place}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Institutions */}
      <section className="border-t border-black/[0.08] bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <p className="eyebrow">Training institutions on the platform</p>
          <ul className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
            {!d && [0, 1, 2].map((i) => <li key={i}><Skeleton className="h-6 w-36" /></li>)}
            {d?.institutions.map((i) => <li key={i.name} className="font-display text-lg font-semibold text-indigo/80">{i.name}<span className="ml-2 text-xs font-normal text-coop-slate">{i.state}</span></li>)}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 sm:px-6 py-12">
          <div><h2 className="font-display text-3xl font-semibold text-white">Start with one programme.</h2><p className="mt-1 text-white/75">Create your profile in two minutes and get recommendations for your next step.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/register" className="rounded-md bg-white px-6 py-3 font-medium text-indigo hover:bg-coop-paper focus-ring">Create account</Link><Link href="/register" className="rounded-md border border-white/40 px-6 py-3 font-medium text-white hover:bg-white/10 focus-ring">I am an employer</Link></div>
        </div>
      </section>
    </div>
  );
}
