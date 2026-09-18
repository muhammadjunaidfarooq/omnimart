"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Plus, KeyRound } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { Role } from "@/lib/auth";
import { fetchUsers, type ManagedUser } from "@/lib/users";
import { useSortedRows } from "@/lib/use-sort";

const SORT_ACCESSORS: Record<string, (u: ManagedUser) => string | number | null> = {
  name: (u) => u.name,
  email: (u) => u.email,
  role: (u) => u.role,
  isActive: (u) => (u.isActive ? 1 : 0),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);

  async function loadUsers() {
    try {
      setUsers(await fetchUsers());
    } catch {
      toast.error("Could not load users.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a synchronous setState
    loadUsers();
  }, []);

  async function handleToggleActive(user: ManagedUser) {
    const res = await fetch(`${API_URL}/users/${user.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? "Could not update status.");
      return;
    }

    toast.success(user.isActive ? "User deactivated." : "User activated.");
    loadUsers();
  }

  const { sortedRows: sortedUsers, sortBy, sortOrder, handleSortChange } = useSortedRows(
    users ?? undefined,
    SORT_ACCESSORS,
    "name",
  );

  const columns: DataTableColumn<ManagedUser>[] = [
    {
      header: "Name",
      sortKey: "name",
      cell: (user) => (
        <span className="font-medium">
          {user.name}
          {user.id === currentUserId && (
            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
          )}
        </span>
      ),
    },
    {
      header: "Email",
      sortKey: "email",
      cell: (user) => <span className="text-muted-foreground">{user.email}</span>,
    },
    {
      header: "Role",
      sortKey: "role",
      cell: (user) => <Badge variant="secondary">{user.role}</Badge>,
    },
    {
      header: "Status",
      sortKey: "isActive",
      cell: (user) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={user.isActive}
            disabled={user.id === currentUserId}
            onCheckedChange={() => handleToggleActive(user)}
          />
          <span className="text-sm text-muted-foreground">
            {user.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
    {
      header: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (user) =>
        user.id !== currentUserId ? (
          <ResetPasswordDialog userId={user.id} userName={user.name} />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <CreateUserDialog onCreated={loadUsers} />
      </div>
      <DataTable
        columns={columns}
        rows={sortedUsers}
        isLoading={users === null}
        emptyMessage="No users yet."
        keyExtractor={(u) => u.id}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </div>
  );
}

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("CASHIER");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, role }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.message ?? "Could not create user.");
        return;
      }

      toast.success("User created.");
      setName("");
      setEmail("");
      setPassword("");
      setRole("CASHIER");
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button><Plus className="size-4" />New user</Button>}
      title="Create user"
      description="Add a new admin or cashier account."
      footer={
        <Button form="create-user-form" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create user"}
        </Button>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-name">Name</Label>
          <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">Password</Label>
          <Input
            id="new-password"
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-role">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as Role)}>
            <SelectTrigger id="new-role" className="w-full">
              <SelectValue>
                {(value: string) => (value === "ADMIN" ? "Admin" : "Cashier")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASHIER">Cashier</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.message ?? "Could not reset password.");
        return;
      }

      toast.success(`Password reset for ${userName}.`);
      setNewPassword("");
      setOpen(false);
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="sm">
          <KeyRound className="size-4" />
          Reset password
        </Button>
      }
      title="Reset password"
      description={`Set a new password for ${userName}. Share it with them securely.`}
      footer={
        <Button form="reset-password-form" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Resetting..." : "Reset password"}
        </Button>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit} className="flex flex-col gap-2 py-4">
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          type="password"
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </form>
    </Modal>
  );
}
