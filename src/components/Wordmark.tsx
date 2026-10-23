import { AudioLines } from "lucide-react";

export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <AudioLines className="h-4 w-4" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">Call Coach</span>
    </div>
  );
}
