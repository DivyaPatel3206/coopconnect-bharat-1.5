// Small additions on top of lib/api.ts: multipart uploads and authenticated file downloads.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function token(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem("ccb_token");
}

async function fail(res: Response): Promise<never> {
  let detail = res.statusText;
  try {
    const b = await res.json();
    detail = typeof b.detail === "string" ? b.detail : Array.isArray(b.detail) ? b.detail.map((d: any) => d.msg).join("; ") : detail;
  } catch {}
  throw new Error(detail);
}

export async function apiForm<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  const t = token();
  const res = await fetch(`${API_URL}${path}`, { method, body: form, headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function fetchBlob(path: string): Promise<Blob> {
  const t = token();
  const res = await fetch(`${API_URL}${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) return fail(res);
  return res.blob();
}

export async function openFile(path: string) {
  const url = URL.createObjectURL(await fetchBlob(path));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function downloadFile(path: string, filename: string) {
  const url = URL.createObjectURL(await fetchBlob(path));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Turn "" into null so optional backend fields with patterns validate. */
export function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const k of Object.keys(o)) out[k] = typeof o[k] === "string" && o[k].trim() === "" ? null : o[k];
  return out;
}
