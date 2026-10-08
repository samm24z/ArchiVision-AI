import React from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-neutral-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="inline-block text-center w-full">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            ArchiVision AI
          </span>
        </Link>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-8 shadow-sm sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
