import { useState } from "react";
import { Plus, Edit, Trash2, Search, Shield, FileText, User, X, Lock, Mail, Banknote, Monitor } from "lucide-react";
import { useData } from "@/context/DataContext";
import { api } from "@/lib/api";
import { MANAGEABLE_ROLES, type UserRole } from "@/lib/rbac";
import { toast } from "sonner";
import { confirmAction } from "@/lib/uiActions";

type UserData = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
};

function RoleBadge({ role }: { role: string }) {
  const cls: Record<string, string> = {
    Admin: "bg-blue-50 text-blue-800 border border-blue-200",
    Treasury: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "Staff Assessor": "bg-sky-50 text-sky-700 border border-sky-200",
    IT: "bg-violet-50 text-violet-700 border border-violet-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls[role] || "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>;
}

export function UsersManagementView() {
  const { usersData, refresh } = useData();
  const users = usersData as UserData[];
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    role: "Staff Assessor" as UserRole,
    status: "Active",
    password: ""
  });

  const filtered = users.filter(
    (u) => search === "" || u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({ name: "", username: "", email: "", role: "Staff Assessor", status: "Active", password: "" });
    setShowModal(true);
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({ ...user, password: "", role: user.role as UserRole });
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    if (!(await confirmAction("This action cannot be undone.", "Delete user?"))) return;
    try {
      await api.deleteUser(userId);
      await refresh();
      toast.success("User deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim() || (!editingUser && !formData.username.trim())) {
      toast.warning("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status,
          ...(formData.password ? { password: formData.password } : {}),
        });
        toast.success("User updated");
      } else {
        if (!formData.password) {
          toast.error("Password is required for new accounts");
          return;
        }
        await api.createUser({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          status: formData.status,
          password: formData.password,
        });
        toast.success("Account created");
      }
      await refresh();
      setShowModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const roleCounts = {
    Admin: users.filter((u) => u.role === "Admin").length,
    Treasury: users.filter((u) => u.role === "Treasury").length,
    "Staff Assessor": users.filter((u) => u.role === "Staff Assessor").length,
    IT: users.filter((u) => u.role === "IT").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>User Management</h2>
          <p className="text-sm text-muted-foreground">{users.length} registered accounts · Manage Treasury & Staff Assessor roles</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-all"
        >
          <Plus size={14} />Create Account
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { role: "Admin", icon: Shield, color: "bg-blue-600", count: roleCounts.Admin },
          { role: "Treasury", icon: Banknote, color: "bg-emerald-600", count: roleCounts.Treasury },
          { role: "Staff Assessor", icon: FileText, color: "bg-sky-600", count: roleCounts["Staff Assessor"] },
          { role: "IT", icon: Monitor, color: "bg-violet-600", count: roleCounts.IT },
        ].map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.role} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${r.color} flex items-center justify-center`}>
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>{r.count}</p>
                <p className="text-xs text-muted-foreground">{r.role}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 w-full max-w-xs focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground/60" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {["User", "Username", "Email", "Role", "Status", "Last Login", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-foreground whitespace-nowrap">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{u.lastLogin}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(u)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Edit User">
                      <Edit size={13} />
                    </button>
                    {u.role !== "Admin" && (
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-red-500" title="Delete User">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-foreground">
                {editingUser ? "Edit User Account" : "Create New Account"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-secondary rounded transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Enter full name" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Username</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} disabled={!!editingUser} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60" placeholder="Enter username" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Enter email address" />
                </div>
              </div>
              {!editingUser && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Enter password" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  disabled={editingUser?.role === "Admin"}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                >
                  {MANAGEABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 p-5 border-t border-border">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-colors">Cancel</button>
              <button type="button" disabled={saving} onClick={handleSave} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editingUser ? "Save Changes" : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
