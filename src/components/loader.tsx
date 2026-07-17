import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";

const Loader = ({
  className,
}: {
  className?: string
}) => {
  return (
    <Loader2Icon className={cn(
      "stroke-1 animate-spin size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50",
      className,
    )} />
  );
};

export default Loader;
