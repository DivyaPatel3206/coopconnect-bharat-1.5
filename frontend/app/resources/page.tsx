"use client";

import { useState } from "react";
import Link from "next/link";
import { FAQ } from "@/lib/content";
import Icon from "@/components/Icon";

const GUIDES = [
  { title: "Create your profile", text: "Add your details, skills and documents so institutions and employers can find you.", href: "/profile", icon: "user" },
  { title: "Register for a programme", text: "Find a programme, register, and watch for your institution's confirmation.", href: "/programmes", icon: "graduation" },
  { title: "Mark attendance with a QR code", text: "Scan the code your trainer shows to check in, and scan again to check out.", href: "/attendance", icon: "qr" },
  { title: "Learn and earn a certificate", text: "Finish lessons and quizzes in a course to receive a certificate with a verification ID.", href: "/courses", icon: "book" },
  { title: "Verify a certificate", text: "Employers and institutions can confirm a certificate using its verification ID.", href: "/certificates/verify", icon: "check" },
  { title: "Find and apply for jobs", text: "See which skills you match for each role, then apply in one step.", href: "/jobs", icon: "briefcase" },
];

export default function ResourcesPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <p className="eyebrow">Resources</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-indigo">Guides and help</h1>
      <p className="mt-1 max-w-2xl text-coop-slate">Short guides for learners, trainers and employers. Need more help? Ask your institution's training coordinator.</p>

      <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-black/[0.09] bg-black/[0.09] sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((g) => (
          <li key={g.title} className="bg-white"><Link href={g.href} className="group flex h-full gap-4 p-5 hover:bg-coop-paper/60 focus-ring">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo/[0.08] text-indigo"><Icon name={g.icon} size={17} /></span>
            <span><span className="block font-medium group-hover:text-indigo">{g.title}</span><span className="mt-0.5 block text-sm text-coop-ink/70">{g.text}</span></span></Link></li>))}
      </ul>

      <section className="mt-14 max-w-3xl">
        <h2 className="font-display text-2xl font-semibold text-indigo">Frequently asked questions</h2>
        <ul className="mt-4 divide-y divide-black/[0.08] border-y border-black/[0.09]">
          {FAQ.map(([q, a], i) => (
            <li key={q}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium focus-ring">{q}<Icon name="chevron" size={16} className={`shrink-0 text-coop-slate transition-transform ${open === i ? "rotate-180" : ""}`} /></button>
              {open === i && <p className="fade-in pb-4 text-sm leading-relaxed text-coop-ink/75">{a}</p>}
            </li>))}
        </ul>
      </section>
    </div>
  );
}
