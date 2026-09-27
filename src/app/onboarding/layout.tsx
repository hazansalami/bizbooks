import { Logo } from "@/components/brand";
import { skipOnboarding } from "@/app/actions/onboarding";
import { getCurrentUser } from "@/lib/auth";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-4 sm:px-6">
        <Logo href="/onboarding" />
        {user?.business && (
          <form action={skipOnboarding}>
            <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-muted hover:text-ink">Finish later</button>
          </form>
        )}
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
