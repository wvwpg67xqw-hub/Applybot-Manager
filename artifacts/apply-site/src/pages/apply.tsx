import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitApplication } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Send } from "lucide-react";
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
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
                        <Input placeholder="username" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormDescription>Your current Discord handle.</FormDescription>
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
                        <Input placeholder="123456789012345678" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormDescription>Enable Developer Mode to copy this.</FormDescription>
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
