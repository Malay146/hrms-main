type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-zinc-50 via-white to-zinc-50/50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 font-sans antialiased text-zinc-900 dark:text-zinc-100">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-zinc-200/40 via-blue-100/30 to-purple-100/20 dark:from-zinc-800/20 dark:via-zinc-700/10 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-12 sm:py-16 min-h-screen">
        {children}
      </main>
    </div>
  );
}
