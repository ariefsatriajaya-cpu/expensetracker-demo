"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, SendIcon, WalletIcon } from "@/components/Icons";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "var(--accent-primary)",
        color: "var(--accent-on-primary)",
      }}
    >
      {pending ? "Signing in..." : "Unlock Dashboard"}
    </button>
  );
}

export default function LoginForm({ hasError }: { hasError: boolean }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-md space-y-5">
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
          >
            <WalletIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Expense Tracker</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Personal finance &amp; Telegram ledger
            </p>
          </div>
        </div>

        <form method="post" action="/api/login" className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium">
              Dashboard password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                autoComplete="current-password"
                aria-invalid={hasError ? "true" : undefined}
                aria-describedby={hasError ? "password-error" : "password-hint"}
                placeholder="Enter your password"
                className="focus-ring min-h-12 w-full rounded-xl py-3 pr-12 pl-4 text-base transition-colors duration-150"
                style={{
                  background: "var(--surface-subtle)",
                  border: `1px solid ${hasError ? "var(--danger)" : "var(--border-strong)"}`,
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="focus-ring absolute right-1 flex h-11 w-11 items-center justify-center rounded-lg transition-opacity duration-150 hover:opacity-80 active:opacity-70"
                style={{ color: "var(--text-secondary)" }}
              >
                {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            <p id="password-hint" className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Password managers and paste are supported. Session stays signed in for 30 days.
            </p>
          </div>

          {hasError && (
            <div
              id="password-error"
              role="alert"
              className="flex items-start gap-2.5 rounded-xl p-3.5 text-sm font-medium"
              style={{
                background: "var(--danger-soft)",
                color: "var(--danger)",
                border: "1px solid var(--danger)",
              }}
            >
              <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Incorrect password. Check your DASHBOARD_PASSWORD value and try again.</span>
            </div>
          )}

          <SubmitButton />
        </form>
      </div>

      <div className="glass-card flex items-start gap-3 rounded-2xl p-4">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--trust-soft)", color: "var(--trust-blue)" }}
        >
          <SendIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Log expenses on the go via Telegram
          </p>
          <p className="mt-0.5">
            Send <code className="font-mono font-medium">nasi goreng 25k</code>,{" "}
            <code className="font-mono font-medium">/today</code>, or{" "}
            <code className="font-mono font-medium">/undo</code> to your bot.
          </p>
        </div>
      </div>
    </div>
  );
}
