import type { ReactNode } from "react";

const GRADIENTS = {
  blue: "from-blue-600 to-blue-800",
  emerald: "from-emerald-500 to-emerald-700",
  amber: "from-amber-500 to-orange-600",
  violet: "from-violet-600 to-indigo-700",
  rose: "from-rose-500 to-pink-600",
} as const;

export function GradientStatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
  tone: keyof typeof GRADIENTS;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${GRADIENTS[tone]} text-white p-5 shadow-md`}>
      {/* decorative wave pattern, purely visual */}
      <svg
        aria-hidden="true"
        className="absolute -right-6 -bottom-10 w-40 h-40 opacity-20"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M40,-55C53,-45,65,-33,70,-18C75,-3,73,15,64,29C55,43,39,53,22,62C5,71,-13,79,-29,74C-45,69,-59,51,-67,32C-75,13,-77,-8,-69,-25C-61,-42,-43,-55,-25,-63C-7,-71,12,-74,40,-55Z"
          transform="translate(100 100)"
          fill="white"
        />
      </svg>
      <div className="relative flex items-start justify-between">
        <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">{icon}</div>
      </div>
      <div className="relative mt-4">
        <div className="text-sm text-white/80">{label}</div>
        <div className="text-2xl font-semibold mt-0.5">{value}</div>
        {sub && <div className="text-xs text-white/70 mt-1">{sub}</div>}
      </div>
    </div>
  );
}
