"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState
  );

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form action={formAction} className="w-full max-w-sm space-y-5">
        <div className="text-center mb-2">
          <div className="font-mono text-sm text-fg-muted tracking-tight">
            lifetracker
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm text-fg-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg outline-none focus:border-fg-faint"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm text-fg-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg outline-none focus:border-fg-faint"
          />
        </div>

        {state.error && (
          <p className="text-sm text-center" style={{ color: "#ff8552" }}>
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-surface-hover border border-border py-2.5 text-sm font-medium hover:bg-surface disabled:opacity-60 transition-colors"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}