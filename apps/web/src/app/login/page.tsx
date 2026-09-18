"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ROLE_HOME } from "@/lib/auth";
import { businessSettingsLogoSrc, fetchSettings, settingsKeys } from "@/lib/settings";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DEFAULT_STORE_NAME = "IMS POS";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: settings } = useQuery({ queryKey: settingsKeys.all, queryFn: fetchSettings });
  const storeName = settings?.storeName ?? DEFAULT_STORE_NAME;
  const logoSrc = settings ? businessSettingsLogoSrc(settings) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError("Invalid email or password.");
        return;
      }

      const data = await res.json();
      router.push(ROLE_HOME[data.user.role as "ADMIN" | "CASHIER"]);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-sidebar p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60rem 60rem at 15% 20%, oklch(0.32 0.07 264 / 0.6), transparent), radial-gradient(50rem 50rem at 85% 80%, oklch(0.4 0.12 260 / 0.5), transparent)",
        }}
      />
      <Card className="relative w-full max-w-sm border-0 shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
            {logoSrc ? (
              <Image
                src={logoSrc}
                alt={storeName}
                width={44}
                height={44}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              storeName.charAt(0).toUpperCase()
            )}
          </div>
          <CardTitle className="text-xl">Sign in to {storeName}</CardTitle>
          <CardDescription>Enter your credentials to access the system</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <ForgotPasswordDialog />
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function ForgotPasswordDialog() {
  return (
    <Modal
      trigger={
        <button type="button" className="text-xs font-medium text-primary hover:underline">
          Forgot password?
        </button>
      }
      title="Forgot your password?"
      footer={null}
    >
      <p className="text-sm text-muted-foreground text-left">
        For security, password resets are handled by your store administrator.
        Contact them directly and ask them to reset your password from the{" "}
        <span className="font-medium text-foreground">Users</span> page — they can set a
        new one for you right away.
      </p>
    </Modal>
  );
}
