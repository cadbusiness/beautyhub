"use client";

export function BookingStepper({
  steps,
  currentIndex,
}: {
  steps: { id: string; label: string }[];
  currentIndex: number;
}) {
  return (
    <nav aria-label="Progression" className="border-b border-slate-200">
      <ol className="flex">
        {steps.map((step, index) => {
          const active = index === currentIndex;
          const done = index < currentIndex;
          return (
            <li
              key={step.id}
              className={`relative flex-1 px-1 pb-3 text-center text-[11px] sm:text-xs ${
                active
                  ? "font-semibold text-slate-900"
                  : done
                    ? "font-medium text-slate-700"
                    : "text-slate-400"
              }`}
            >
              {index + 1}. {step.label}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-slate-900"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
