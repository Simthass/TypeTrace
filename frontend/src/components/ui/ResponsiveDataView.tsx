import type { ReactNode } from "react";

interface ResponsiveDataViewProps {
  mobile: ReactNode;
  desktop: ReactNode;
  className?: string;
  breakpoint?: "md" | "lg" | "xl";
}

const VISIBILITY_BY_BREAKPOINT = {
  md: {
    mobile: "md:hidden",
    desktop: "hidden md:block",
  },
  lg: {
    mobile: "lg:hidden",
    desktop: "hidden lg:block",
  },
  xl: {
    mobile: "xl:hidden",
    desktop: "hidden xl:block",
  },
} as const;

/**
 * Presents dense records as touch-friendly cards on constrained viewports and
 * as a table/grid only when the viewport can support the desktop presentation.
 *
 * The default is xl because authenticated layouts reserve horizontal space for
 * navigation. At tablet widths, an md desktop table can be wider than the
 * remaining content column even when the document itself is responsive.
 */
export function ResponsiveDataView({
  mobile,
  desktop,
  className = "",
  breakpoint = "xl",
}: ResponsiveDataViewProps) {
  const visibility = VISIBILITY_BY_BREAKPOINT[breakpoint];

  return (
    <div className={`min-w-0 max-w-full ${className}`.trim()}>
      <div className={visibility.mobile}>{mobile}</div>
      <div className={visibility.desktop}>{desktop}</div>
    </div>
  );
}
