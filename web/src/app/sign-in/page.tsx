import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmailOtpSignIn } from "@/components/email-otp-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo: requestedReturnTo } = await searchParams;
  const returnTo =
    requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/app";

  return (
    <main className="min-h-screen bg-ink px-4 py-4 text-paper sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] overflow-hidden rounded-[16px] bg-paper text-ink lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="flex min-h-[20rem] flex-col justify-between bg-violet p-6 text-white sm:p-10 lg:p-14">
          <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-semibold">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to Ordiva
          </Link>
          <div className="max-w-lg">
            <h1 className="text-balance text-[clamp(2.7rem,6vw,5.5rem)] font-semibold leading-[0.94] tracking-[-0.04em]">
              Your Arc wallet is your account.
            </h1>
            <p className="mt-7 max-w-[55ch] text-base leading-7 text-white/85">
              Circle verifies your email and creates one user-controlled EOA on Arc Testnet. Ordiva never receives your PIN, encryption key, or wallet key material.
            </p>
          </div>
        </aside>
        <section className="flex items-center px-5 py-12 sm:px-10 lg:px-20">
          <div className="mx-auto w-full max-w-lg">
            <EmailOtpSignIn returnTo={returnTo} />
          </div>
        </section>
      </div>
    </main>
  );
}
