"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, UserPlus, Ban, CircleCheck, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/ui/card";
import { Input } from "@/components/atoms/ui/input";
import { Label } from "@/components/atoms/ui/label";
import { Badge } from "@/components/atoms/ui/badge";
import { Checkbox } from "@/components/atoms/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/ui/dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { PasswordInput } from "@/components/molecules/password-input";
import {
  createCompany,
  createHrUser,
  setUserBlocked,
  setUserPassword,
  deleteUser,
  setCompanyBlocked,
  deleteCompany,
} from "@/lib/actions/companies";
import { validatePassword, MIN_PASSWORD_LENGTH } from "@/lib/password";

type CompanyLite = { id: string; name: string; blocked?: boolean };

type CompanyUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  blocked?: boolean;
};

export function CompaniesClient({
  companies,
  usersByCompany,
}: {
  companies: CompanyLite[];
  usersByCompany: Record<string, CompanyUser[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newCompany, setNewCompany] = useState("");
  const [error, setError] = useState("");

  function addCompany() {
    if (!newCompany.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await createCompany(newCompany);
        setNewCompany("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create company.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a company</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label>Company name</Label>
            <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Company A" />
          </div>
          <Button onClick={addCompany} disabled={pending || !newCompany.trim()} loading={pending}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {companies.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="No companies yet" description="Add your first company above to get started." />
      ) : (
        <div className="space-y-4">
          {companies.map((c) => (
            <CompanyCard key={c.id} company={c} users={usersByCompany[c.id] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ company, users }: { company: CompanyLite; users: CompanyUser[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<CompanyUser | null>(null);
  const [confirmCompanyDelete, setConfirmCompanyDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [pwUser, setPwUser] = useState<CompanyUser | null>(null);
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState("");
  // Which action is in flight, so only that button shows a spinner.
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function toggleCompanyBlock() {
    setError("");
    setBusyKey("companyBlock");
    startTransition(async () => {
      try {
        await setCompanyBlocked(company.id, !company.blocked);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update the company.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  function confirmDeleteCompany() {
    setError("");
    setBusyKey("companyDelete");
    startTransition(async () => {
      try {
        await deleteCompany(company.id, forceDelete);
        setConfirmCompanyDelete(false);
        setForceDelete(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete the company.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  function toggleBlock(user: CompanyUser) {
    setError("");
    setBusyKey(`block:${user.id}`);
    startTransition(async () => {
      try {
        await setUserBlocked(user.id, !user.blocked);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update the user.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setError("");
    setBusyKey("userDelete");
    startTransition(async () => {
      try {
        await deleteUser(id);
        setToDelete(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete the user.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  function openChangePassword(user: CompanyUser) {
    setPwUser(user);
    setNewPw("");
    setPwError("");
  }

  function confirmChangePassword() {
    if (!pwUser) return;
    const weak = validatePassword(newPw);
    if (weak) {
      setPwError(weak);
      return;
    }
    const targetEmail = pwUser.email ?? "";
    const id = pwUser.id;
    setPwError("");
    setBusyKey("changePw");
    startTransition(async () => {
      try {
        await setUserPassword(id, newPw);
        setPwUser(null);
        setNewPw("");
        toast.success("Password updated", { description: targetEmail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not update the password.";
        setPwError(msg);
        // Also surface via toast in case the dialog was dismissed mid-request.
        toast.error("Password not updated", { description: msg });
      } finally {
        setBusyKey(null);
      }
    });
  }

  function addUser() {
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    const weak = validatePassword(password);
    if (weak) {
      setError(weak);
      return;
    }
    setError("");
    const createdEmail = email.trim();
    setBusyKey("addUser");
    startTransition(async () => {
      try {
        await createHrUser({ email, password, fullName, companyId: company.id });
        setEmail("");
        setFullName("");
        setPassword("");
        toast.success("HR user created", { description: createdEmail });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create the user.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <CardTitle className="text-base">{company.name}</CardTitle>
        {company.blocked && <Badge variant="destructive">Blocked</Badge>}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCompanyBlock}
            disabled={pending}
            loading={busyKey === "companyBlock"}
            title={company.blocked ? "Unblock this company" : "Block this company and its users"}
          >
            {company.blocked ? (
              <>
                <CircleCheck className="h-3.5 w-3.5" /> Unblock
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" /> Block
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmCompanyDelete(true)}
            disabled={pending}
            loading={busyKey === "companyDelete"}
            title="Delete this company"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">HR users</p>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No HR users yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className={u.blocked ? "text-muted-foreground line-through" : ""}>
                      {u.full_name ? `${u.full_name} · ` : ""}
                      {u.email}
                    </span>
                    {u.blocked && (
                      <Badge variant="destructive" className="ml-2">
                        Blocked
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openChangePassword(u)}
                    disabled={pending}
                    title="Change this user's password"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Password
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleBlock(u)}
                    disabled={pending}
                    loading={busyKey === `block:${u.id}`}
                    title={u.blocked ? "Unblock this account" : "Block this account"}
                  >
                    {u.blocked ? (
                      <>
                        <CircleCheck className="h-3.5 w-3.5" /> Unblock
                      </>
                    ) : (
                      <>
                        <Ban className="h-3.5 w-3.5" /> Block
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setToDelete(u)}
                    disabled={pending}
                    title="Delete this account"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <UserPlus className="h-4 w-4" /> Add an HR user
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input type="email" placeholder="email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <PasswordInput placeholder={`Temp password (${MIN_PASSWORD_LENGTH}+ characters)`} value={password} onChange={setPassword} />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" onClick={addUser} disabled={pending} loading={busyKey === "addUser"}>
              Create user
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </div>
      </CardContent>

      <Dialog open={!!pwUser} onOpenChange={(o) => !o && !pending && setPwUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Set a new password for {pwUser?.email}. They can sign in with it immediately. Existing
              passwords are hashed and can never be shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <PasswordInput
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={newPw}
              onChange={setNewPw}
            />
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwUser(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={confirmChangePassword} disabled={pending || !newPw} loading={busyKey === "changePw"}>
              Update password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && !pending && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
            <DialogDescription>
              {toDelete?.email} will be permanently removed and can no longer sign in. This cannot be
              undone. To keep the account but revoke access, use Block instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending} loading={busyKey === "userDelete"}>
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmCompanyDelete}
        onOpenChange={(o) => {
          if (!o && !pending) {
            setConfirmCompanyDelete(false);
            setForceDelete(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{company.name}”?</DialogTitle>
            <DialogDescription>
              Deleting a company only works once it has no users and no templates — otherwise remove
              them first, or tick <b>Force delete</b> below. To pause access instead, use Block.
            </DialogDescription>
          </DialogHeader>

          <label className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <Checkbox checked={forceDelete} onCheckedChange={(c) => setForceDelete(c === true)} className="mt-0.5" />
            <span>
              <span className="font-medium text-destructive">Force delete everything</span> — also
              permanently remove this company&apos;s HR users, templates, and conversion history.
              This cannot be undone.
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCompanyDelete(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteCompany} disabled={pending} loading={busyKey === "companyDelete"}>
              {forceDelete ? "Force delete everything" : "Delete company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
