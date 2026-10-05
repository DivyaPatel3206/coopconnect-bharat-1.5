export type Role = "super_admin" | "institution_admin" | "trainer" | "trainee" | "employer" | "career_counselor";

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Admin",
  institution_admin: "Institution",
  trainer: "Trainer",
  trainee: "Trainee",
  employer: "Employer",
  career_counselor: "Counsellor",
};

export const STAFF: string[] = ["super_admin", "institution_admin", "trainer"];
export const ADMINS: string[] = ["super_admin", "institution_admin"];

export type NavItem = { href: string; label: string; icon: string; group: string; roles: string[] | "all" };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home", group: "Overview", roles: "all" },
  { href: "/programmes", label: "Programmes", icon: "graduation", group: "Learn", roles: "all" },
  { href: "/courses", label: "Courses", icon: "book", group: "Learn", roles: "all" },
  { href: "/learning", label: "Interactive Learning", icon: "play", group: "Learn", roles: "all" },
  { href: "/certificates/verify", label: "Verify Certificate", icon: "check", group: "Learn", roles: "all" },
  { href: "/attendance", label: "Attendance", icon: "qr", group: "Training", roles: ["super_admin", "institution_admin", "trainer", "trainee"] },
  { href: "/logistics", label: "Timetable & Logistics", icon: "calendar", group: "Training", roles: ["super_admin", "institution_admin", "trainer", "trainee"] },
  { href: "/people", label: "People", icon: "users", group: "Training", roles: STAFF },
  { href: "/institutions", label: "Institutions", icon: "building", group: "Training", roles: ADMINS },
  { href: "/jobs", label: "Jobs", icon: "briefcase", group: "Career", roles: "all" },
  { href: "/career-chat", label: "Career Chat", icon: "chat", group: "Career", roles: ["trainee", "trainer", "career_counselor", "super_admin", "institution_admin"] },
  { href: "/employer", label: "Employer Hub", icon: "briefcase", group: "Career", roles: ["employer", "super_admin"] },
  { href: "/ai-profile", label: "My AI Profile", icon: "spark", group: "Career", roles: ["trainee", "trainer", "career_counselor"] },
  { href: "/career-path", label: "Career Path", icon: "target", group: "Career", roles: ["trainee", "trainer", "career_counselor"] },
  { href: "/ai-studio", label: "AI Studio", icon: "spark", group: "Career", roles: "all" },
  { href: "/ai-admin", label: "AI Admin Copilot", icon: "spark", group: "Training", roles: ADMINS },
  { href: "/profile", label: "My Profile", icon: "user", group: "Account", roles: "all" },
];

/** Public-facing sections shown in the main navigation for everyone. */
export const PRIMARY_NAV = [
  { href: "/", label: "Home" },
  { href: "/programmes", label: "Training" },
  { href: "/courses", label: "Learning" },
  { href: "/jobs", label: "Employment" },
  { href: "/cooperatives", label: "Cooperatives" },
  { href: "/analytics", label: "Analytics" },
  { href: "/resources", label: "Resources" },
];

/** Role-specific tools shown in the workspace bar once signed in. */
export function workspaceFor(role?: string): NavItem[] {
  if (!role) return [];
  const want = ["/dashboard", "/learning", "/attendance", "/logistics", "/people", "/institutions", "/career-chat", "/employer", "/ai-profile", "/career-path", "/ai-studio", "/ai-admin", "/profile"];
  return NAV.filter((n) => want.includes(n.href) && (n.roles === "all" || n.roles.includes(role)));
}

export function navFor(role?: string): NavItem[] {
  if (!role) return [];
  return NAV.filter((n) => n.roles === "all" || n.roles.includes(role));
}
