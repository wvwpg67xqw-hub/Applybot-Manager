import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitApplication } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Send, LogIn } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["Moderator", "Human Resources", "Partnership"] as const;

const formSchema = z.object({
  discordUsername: z.string().min(2, "Discord username must be at least 2 characters"),
  discordId: z.string().min(17, "Discord ID must be at least 17 characters").regex(/^\d+$/, "Must be a valid numeric ID"),
  role: z.enum(ROLES),
  age: z.coerce.number().min(13, "You must be at least 13 years old to apply"),
  timezone: z.string().min(2, "Timezone is required"),
  experience: z.string().min(20, "Please provide more detail about your experience (min 20 chars)"),
  whyJoin: z.string().min(20, "Please elaborate on why you want to join (min 20 chars)"),
  availability: z.string().min(5, "Please state your availability"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Apply() {
  const [, params] = useRoute("/apply/:role");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated, login } = useAuth();

  const roleParam = params?.role ? decodeURIComponent(params.role) : "";
  const initialRole = (ROLES as readonly string[]).includes(roleParam)
    ? (roleParam as typeof ROLES[number])
    : "Moderator";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      discordUsername: "",
      discordId: "",
      role: initialRole,
      age: undefined as any,
      timezone: "",
      experience: "",
      whyJoin: "",
      availability: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.setValue("discordUsername", user.username);
      form.setValue("discordId", user.id);
    }
  }, [user, form]);

  const submitApp = useSubmitApplication();

  const onSubmit = (data: FormValues) => {
    submitApp.mutate({ data }, {
      onSuccess: () => {
        setLocation("/success");
      },
      onError: () => {
        toast({
          title: "Application Failed",
          description: "There was an error submitting your application. You may be blacklisted or the server is unavailable.",
          variant: "destructive",
        });
      }
    });
  };

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto w-full z-10 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto w-full z-10 pb-16">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roles
          </Link>
        </div>
        <Card className="bg-card/40 border-border/40 backdrop-blur-md shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center gap-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Sign in to Apply</h2>
              <p className="text-muted-foreground max-w-sm">
                You need to sign in with Discord before submitting an application. This lets us verify your identity automatically.
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2 font-semibold px-8"
              onClick={() => login(location)}
              data-testid="button-login-apply"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Sign in with Discord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full z-10 pb-16">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Roles
        </Link>
      </div>

      <Card className="bg-card/40 border-border/40 backdrop-blur-md shadow-2xl">
        <CardHeader className="border-b border-border/40 bg-card/50 pb-8">
          <CardTitle className="text-3xl font-extrabold tracking-tight">Staff Application</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Please fill out all fields honestly and thoroughly. Quality over quantity.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="discordUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discord Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="username"
                          className="bg-background/50"
                          readOnly={!!user}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {user ? "Verified from your Discord account." : "Your current Discord handle."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discordId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discord User ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456789012345678"
                          className="bg-background/50"
                          readOnly={!!user}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {user ? "Verified from your Discord account." : "Enable Developer Mode to copy this."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Moderator">Moderator</SelectItem>
                          <SelectItem value="Human Resources">Human Resources</SelectItem>
                          <SelectItem value="Partnership">Partnership</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="18" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Input placeholder="EST, GMT+1, etc." className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6 pt-4 border-t border-border/20">
                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Past Experience</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="List any servers you have moderated, roles held, and specific duties..."
                          className="min-h-[120px] bg-background/50 resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whyJoin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Why do you want to join our team?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What motivates you? What can you bring to the community?"
                          className="min-h-[120px] bg-background/50 resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Availability</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Weekdays 4PM-10PM EST, Weekends all day"
                          className="bg-background/50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-bold"
                disabled={submitApp.isPending}
                data-testid="button-submit-application"
              >
                {submitApp.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  <>
                    Submit Application
                    <Send className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
