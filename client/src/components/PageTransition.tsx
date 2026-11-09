import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

/** A short fade+rise on every route change, keyed by pathname so React
 * remounts (and re-animates) the wrapper instead of diffing across pages. */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-page-in">
      {children}
    </div>
  );
}
