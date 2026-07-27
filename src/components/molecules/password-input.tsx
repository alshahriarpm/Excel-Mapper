"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/atoms/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a show/hide (eye) toggle. */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
