"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";

const links = [
  { href: "/", label: "Today" },
  { href: "/history", label: "History" },
];

export default function Nav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-2xl px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-sm tracking-tight text-fg-muted">
          lifetracker
        </span>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-surface text-fg"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md text-sm text-fg-muted hover:text-fg transition-colors"
            >
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}