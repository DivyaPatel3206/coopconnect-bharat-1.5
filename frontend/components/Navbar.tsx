"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, PRIMARY_NAV, workspaceFor } from "@/lib/roles";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import SearchBox from "@/components/SearchBox";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export default function Navbar() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tools = workspaceFor(user?.role);

  useEffect(() => { setDrawer(false); setMenu(false); }, [path]);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-black/[0.09]">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <button onClick={() => setDrawer(true)} aria-label="Open menu" className="lg:hidden -ml-2 rounded-md p-2 text-indigo hover:bg-black/5 focus-ring"><Icon name="menu" size={22} /></button>
        <Link href={user ? "/dashboard" : "/"} className="focus-ring rounded-md shrink-0"><Logo size={32} /></Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 ml-4">
          {PRIMARY_NAV.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined}
              className={`relative rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring ${isActive(path, l.href) ? "text-indigo" : "text-coop-slate hover:text-indigo"}`}>
              {l.label}
              {isActive(path, l.href) && <span className="absolute inset-x-3 -bottom-[17px] h-0.5 bg-coop-saffron" aria-hidden />}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SearchBox className="hidden md:block w-60 xl:w-72" />
          {user ? (
            <div className="relative" ref={ref}>
              <button onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-2 rounded-full border border-black/12 py-1 pl-1 pr-2.5 hover:bg-black/[0.03] focus-ring">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo text-xs font-semibold text-white" aria-hidden>{user.name[0]?.toUpperCase()}</span>
                <span className="hidden sm:block text-sm font-medium">{user.name.split(" ")[0]}</span>
                <Icon name="chevron" size={14} className="text-coop-slate" />
              </button>
              {menu && (
                <div role="menu" className="fade-in absolute right-0 mt-2 w-60 rounded-md border border-black/10 bg-white p-1 shadow-lg">
                  <div className="border-b border-black/5 px-3 py-2"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-coop-slate">{user.email} · {ROLE_LABEL[user.role] || user.role}</p></div>
                  <Link role="menuitem" href="/dashboard" className="mt-1 flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-black/5"><Icon name="home" size={16} /> Dashboard</Link>
                  <Link role="menuitem" href="/profile" className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-black/5"><Icon name="user" size={16} /> My profile</Link>
                  <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Icon name="logout" size={16} /> Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block text-sm font-medium text-indigo hover:underline focus-ring rounded px-1">Sign in</Link>
              <Link href="/register" className="rounded-md bg-indigo px-4 py-2 text-sm font-medium text-white hover:bg-indigo-dark transition-colors focus-ring">Get started</Link>
            </>
          )}
        </div>
      </div>

      {user && tools.length > 0 && (
        <div className="hidden lg:block border-t border-black/[0.06] bg-coop-paper/60">
          <nav aria-label="Workspace" className="mx-auto flex max-w-7xl items-center gap-0.5 overflow-x-auto px-4 sm:px-6 py-1">
            <span className="eyebrow mr-3 shrink-0">My workspace</span>
            {tools.map((t) => (
              <Link key={t.href} href={t.href} aria-current={isActive(path, t.href) ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-medium focus-ring ${isActive(path, t.href) ? "bg-indigo text-white" : "text-coop-slate hover:bg-black/5 hover:text-indigo"}`}>
                <Icon name={t.icon} size={14} />{t.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="fade-in absolute left-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto bg-white">
            <div className="flex h-16 items-center justify-between border-b border-black/[0.09] px-4"><Logo size={30} /><button onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-md p-2 hover:bg-black/5 focus-ring"><Icon name="x" size={20} /></button></div>
            <div className="p-4 space-y-5">
              <SearchBox onDone={() => setDrawer(false)} />
              <nav aria-label="Primary mobile"><p className="eyebrow mb-2">Explore</p><ul>{PRIMARY_NAV.map((l) => (
                <li key={l.href}><Link href={l.href} className={`block rounded-md px-3 py-2.5 text-[15px] font-medium ${isActive(path, l.href) ? "bg-indigo/[0.08] text-indigo" : "text-coop-ink"}`}>{l.label}</Link></li>))}</ul></nav>
              {user ? (
                <nav aria-label="Workspace mobile"><p className="eyebrow mb-2">My workspace</p><ul>{tools.map((t) => (
                  <li key={t.href}><Link href={t.href} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] ${isActive(path, t.href) ? "bg-indigo/[0.08] text-indigo font-medium" : "text-coop-ink"}`}><Icon name={t.icon} size={17} />{t.label}</Link></li>))}</ul>
                  <button onClick={logout} className="mt-3 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[15px] text-red-600"><Icon name="logout" size={17} /> Sign out</button></nav>
              ) : (
                <div className="flex gap-2"><Link href="/login" className="flex-1 rounded-md border border-indigo py-2.5 text-center text-sm font-medium text-indigo">Sign in</Link><Link href="/register" className="flex-1 rounded-md bg-indigo py-2.5 text-center text-sm font-medium text-white">Get started</Link></div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
