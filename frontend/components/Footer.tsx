import Link from "next/link";
import Logo from "@/components/Logo";

const COLS = [
  { title: "Training", links: [["Programmes", "/programmes"], ["Courses", "/courses"], ["Verify a certificate", "/certificates/verify"], ["Attendance & timetable", "/logistics"]] },
  { title: "Employment", links: [["Jobs & internships", "/jobs"], ["For employers", "/employer"], ["Career guidance", "/career-chat"], ["Create profile", "/register"]] },
  { title: "Ecosystem", links: [["Cooperatives", "/cooperatives"], ["Analytics", "/analytics"], ["Institutions", "/cooperatives#institutions"], ["Resources", "/resources"]] },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-black/[0.09] bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo size={34} tagline />
          <p className="mt-4 max-w-xs text-sm text-coop-slate">A digital platform for cooperative training, certification and employment across VAMNICOM, RICMs and ICMs.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="eyebrow mb-3">{c.title}</p>
            <ul className="space-y-2 text-sm">{c.links.map(([l, h]) => <li key={h}><Link href={h} className="text-coop-ink/80 hover:text-indigo hover:underline">{l}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-black/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 text-xs text-coop-slate">
          <span>© {new Date().getFullYear()} CoopConnect Bharat. For learners, institutions and employers in the cooperative sector.</span>
          <span>Accessible, mobile-first, available in more languages soon.</span>
        </div>
      </div>
    </footer>
  );
}
