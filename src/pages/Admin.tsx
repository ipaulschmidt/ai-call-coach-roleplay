import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/smartbug-logo.png";
import ScenariosTab from "@/components/admin/ScenariosTab";
import PersonasTab from "@/components/admin/PersonasTab";
import LeaderboardTab from "@/components/admin/LeaderboardTab";
import SessionCard, { type Row } from "@/components/admin/SessionCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ADMIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-sessions`;

const Admin = () => {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const updateRow = (updated: Row) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };
  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (openId === id) setOpenId(null);
  };

  const load = async (pwd: string) => {
    setLoading(true);
    try {
      const resp = await fetch(ADMIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": pwd,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (resp.status === 401) {
        toast.error("Wrong password");
        setAuthed(false);
        sessionStorage.removeItem("adminPwd");
        return;
      }
      if (!resp.ok) throw new Error(`Failed (${resp.status})`);
      const data = await resp.json();
      setRows(data.sessions || []);
      setAuthed(true);
      sessionStorage.setItem("adminPwd", pwd);
    } catch (e: any) {
      toast.error(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("adminPwd");
    if (saved) {
      setPassword(saved);
      void load(saved);
    }
  }, []);

  if (!authed) {
    return (
      <main className="min-h-screen px-4 py-16">
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <img src={logo} alt="SmartBug" className="h-7" />
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
          <Card className="border-border/60 bg-card/70 p-6 backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <h1 className="text-lg font-semibold">Admin access</h1>
            </div>
            <Label htmlFor="pwd" className="text-xs">Admin password</Label>
            <Input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && load(password)}
              className="mt-1.5 bg-background/50"
              autoFocus
            />
            <Button
              onClick={() => load(password)}
              disabled={!password || loading}
              className="mt-4 w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="SmartBug" className="h-7" />
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Admin</div>
              <h1 className="text-2xl font-bold">SmartBug Coach admin</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                sessionStorage.removeItem("adminPwd");
                setAuthed(false);
                setPassword("");
                setRows([]);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="personas">Personas</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {rows.length} session{rows.length === 1 ? "" : "s"}
              </div>
              <Button variant="secondary" onClick={() => load(password)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>
            {rows.length === 0 && !loading && (
              <Card className="border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">
                No coaching calls saved yet.
              </Card>
            )}
            <div className="space-y-3">
          {rows.map((r) => (
            <SessionCard
              key={r.id}
              row={r}
              password={password}
              open={openId === r.id}
              onToggle={() => setOpenId(openId === r.id ? null : r.id)}
              onRowUpdate={updateRow}
              onRowDeleted={removeRow}
            />
          ))}
            </div>
          </TabsContent>

          <TabsContent value="scenarios">
            <ScenariosTab password={password} />
          </TabsContent>

          <TabsContent value="personas">
            <PersonasTab password={password} />
          </TabsContent>

          <TabsContent value="leaderboard">
            <LeaderboardTab password={password} rows={rows} onRowUpdate={updateRow} onRowDeleted={removeRow} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Admin;
