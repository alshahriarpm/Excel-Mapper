"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, type ButtonProps } from "@/components/atoms/ui/button";
import { cn } from "@/lib/utils";

export function BackButton({
  label = "Back",
  fallbackHref = "/",
  variant = "ghost",
  size = "sm",
  className,
}: {
  label?: string;
  fallbackHref?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(variant === "ghost" && "text-muted-foreground hover:text-foreground", className)}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </Button>
  );
}
