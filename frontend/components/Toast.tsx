"use client";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";

type T = { id: number; text: string; tone: "success" | "error" | "info" };
const Ctx = createContext<(text: string, tone?: T["tone"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, tone: T["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  const bar = { success: "border-l-coop-green", error: "border-l-red-600", info: "border-l-indigo" };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-80" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} role="status" className={`toast-in flex items-start justify-between gap-3 rounded-md border border-black/10 border-l-4 ${bar[i.tone]} bg-white px-4 py-3 text-sm shadow-lg`}>
            <span>{i.text}</span>
            <button onClick={() => setItems((x) => x.filter((t) => t.id !== i.id))} aria-label="Dismiss" className="text-coop-slate hover:text-coop-ink focus-ring">×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
