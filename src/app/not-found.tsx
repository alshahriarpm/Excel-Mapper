import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { MessageScreen } from "@/components/molecules/message-screen";

export default function NotFound() {
  return (
    <MessageScreen
      icon={<Compass className="h-6 w-6" />}
      iconMotion="spin"
      eyebrow="404"
      title="We couldn't find that page"
      description="The link may be out of date, or the template or company it pointed to has been removed."
      actions={
        <>
          <Button asChild>
            <Link href="/">Go to my dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </>
      }
    />
  );
}
