import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home } from "lucide-react";

export default function Success() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] z-10">
      <div className="max-w-md w-full text-center space-y-6 p-8 bg-card/30 backdrop-blur-md rounded-2xl border border-emerald-500/20 shadow-[0_0_50px_-12px] shadow-emerald-500/10">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Application Received</h1>
          <p className="text-muted-foreground leading-relaxed">
            Thank you for applying. Our team will review your application and reach out to you via Discord if you are selected for an interview. Please make sure your DMs are open.
          </p>
        </div>

        <div className="pt-6">
          <Link href="/">
            <Button variant="outline" className="w-full sm:w-auto h-11 px-8 gap-2">
              <Home className="w-4 h-4" />
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
