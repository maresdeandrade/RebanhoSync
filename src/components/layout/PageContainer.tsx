import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const pageContainerVariants = cva("mx-auto w-full", {
  variants: {
    width: {
      full: "max-w-none",
      standard: "max-w-7xl",
      narrow: "max-w-5xl",
    },
  },
  defaultVariants: {
    width: "full",
  },
});

export interface PageContainerProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pageContainerVariants> {}

export const PageContainer = React.forwardRef<
  HTMLDivElement,
  PageContainerProps
>(({ className, width, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(pageContainerVariants({ width }), className)}
    {...props}
  />
));

PageContainer.displayName = "PageContainer";

// eslint-disable-next-line react-refresh/only-export-components
export { pageContainerVariants };
