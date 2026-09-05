"use client";

type RecoverPanelProps = {
  reset?: () => void;
  title?: string;
  description?: string;
};

export function RecoverPanel({
  reset,
  title = "Something went wrong",
  description = "The page could not finish loading. Your last saved data is still in the system.",
}: RecoverPanelProps) {
  const homeClassName = reset
    ? "rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold px-4 py-2"
    : "rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-4 py-2";

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">{title}</h1>
        <p className="text-body-lg text-zinc-500 font-medium">{description}</p>
      </div>
      <div className="flex gap-3">
        {reset ? (
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-4 py-2"
          >
            Try again
          </button>
        ) : null}
        <a href="/" className={homeClassName}>
          Home
        </a>
      </div>
    </div>
  );
}
