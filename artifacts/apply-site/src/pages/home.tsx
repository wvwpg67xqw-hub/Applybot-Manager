import { Link } from "wouter";
import { useGetApplicationStats, getGetApplicationStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Users, Handshake, ChevronRight, Activity, Clock, CheckCircle, XCircle } from "lucide-react";
import { ApplicationInputRole } from "@workspace/api-zod/src/generated/types";

export default function Home() {
  const { data: stats, isLoading } = useGetApplicationStats({
    query: { queryKey: getGetApplicationStatsQueryKey() }
  });

  const roles = [
    {
      id: "Moderator",
      title: "Moderator",
      icon: <ShieldAlert className="w-6 h-6 text-primary" />,
      description: "Keep our community safe. Handle reports, enforce rules, and maintain a positive environment.",
      requirements: ["Active daily", "Conflict resolution", "Familiar with Discord ToS"],
      color: "border-primary/20 hover:border-primary/50"
    },
    {
      id: "Human Resources",
      title: "Human Resources",
      icon: <Users className="w-6 h-6 text-emerald-400" />,
      description: "Manage the team. Coordinate schedules, handle internal disputes, and review new staff applicants.",
      requirements: ["Previous leadership", "Strong communication", "Empathetic"],
      color: "border-emerald-500/20 hover:border-emerald-500/50"
    },
    {
      id: "Partnership",
      title: "Partnership Team",
      icon: <Handshake className="w-6 h-6 text-amber-400" />,
      description: "Grow the community. Reach out to other servers, negotiate partnerships, and plan cross-server events.",
      requirements: ["Networking skills", "Professional demeanor", "Goal-oriented"],
      color: "border-amber-500/20 hover:border-amber-500/50"
    }
  ];

  return (
    <div className="flex flex-col gap-16 pb-16 w-full max-w-5xl mx-auto z-10">
      <section className="text-center space-y-6 pt-12">
        <Badge variant="outline" className="px-4 py-1 text-primary border-primary/30 bg-primary/10 font-medium">
          Applications are Open
        </Badge>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
          Join the Team.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          We are looking for dedicated individuals to help build, moderate, and grow one of the most active communities on Discord.
        </p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
            <Activity className="w-5 h-5 text-muted-foreground mb-1" />
            <span className="text-3xl font-bold text-foreground">
              {isLoading ? <span className="animate-pulse">--</span> : stats?.total || 0}
            </span>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total</span>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
            <Clock className="w-5 h-5 text-amber-400 mb-1" />
            <span className="text-3xl font-bold text-foreground">
              {isLoading ? <span className="animate-pulse">--</span> : stats?.pending || 0}
            </span>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending</span>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-3xl font-bold text-foreground">
              {isLoading ? <span className="animate-pulse">--</span> : stats?.accepted || 0}
            </span>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Accepted</span>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
            <XCircle className="w-5 h-5 text-rose-400 mb-1" />
            <span className="text-3xl font-bold text-foreground">
              {isLoading ? <span className="animate-pulse">--</span> : stats?.denied || 0}
            </span>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Denied</span>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Open Positions</h2>
          <div className="h-[1px] flex-1 bg-border/40" />
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((role) => (
            <Card key={role.id} className={`bg-card/30 backdrop-blur-sm transition-all duration-300 ${role.color} flex flex-col`}>
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-background/50 flex items-center justify-center mb-4 border border-border/50">
                  {role.icon}
                </div>
                <CardTitle className="text-xl">{role.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed min-h-[60px]">
                  {role.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requirements</h4>
                  <ul className="space-y-2 text-sm text-foreground/80">
                    {role.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/50 mt-2 shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/apply/${encodeURIComponent(role.id)}`} className="w-full">
                  <Button className="w-full group font-semibold" variant="secondary">
                    Apply Now
                    <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
