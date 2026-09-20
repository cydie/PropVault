import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import rizalLogo from "@/imports/Rizal_Logo.png";
import { StaffDashboard } from "./components/StaffDashboard";
import { TreasuryDashboard } from "./components/TreasuryDashboard";
import { ItDashboard } from "./components/ItDashboard";
import { UsersManagementView } from "./components/UsersManagementView";
import { SettingsView } from "./components/SettingsView";
import { ReportsView } from "./components/ReportsView";
import { GisView } from "./components/GisView";
import { CadastralGisView } from "./components/cadastral/CadastralGisView";
import { NotificationToasts } from "./components/NotificationToasts";
import { SyncControl } from "./components/SyncControl";
import { PaymentsView } from "./components/PaymentsView";
import { SoftCopyBulkUpload } from "./components/SoftCopyBulkUpload";
import { LandEncodeForm } from "./components/LandEncodeForm";
import { BuildingEncodeForm } from "./components/BuildingEncodeForm";
import { ForgotPasswordDialog } from "./components/ForgotPasswordDialog";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UserAccountDialogs, PROFILE_MENU, type AccountDialog } from "./components/UserAccountDialogs";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/lib/api";
import { api } from "@/lib/api";
import { useData } from "@/context/DataContext";
import {
  hasPermission,
  pathToView,
  VIEW_TO_PATH,
  type UserRole,
  type View,
} from "@/lib/rbac";
import { toast } from "sonner";
import { comingSoon, confirmAction, exportCsv, openPrintDocument } from "@/lib/uiActions";
import {
  LayoutDashboard, Users, FileText, Building2, Eye, EyeOff,
  LogOut, Bell, Search, Menu, X, CheckCircle, Clock, XCircle,
  ChevronDown, Download, Upload, Shield, Filter, Plus, Edit,
  Trash2, ChevronRight, Settings, Map, BarChart2, FileCheck,
  AlertCircle, MoreVertical, ArrowUpRight, Moon, Sun,
  Lock, Activity, Archive, ChevronUp, ChevronLeft, RefreshCw, User, TrendingUp,
  QrCode, Printer, MapPin, Layers, Database, Stamp, Home, Banknote, MapPinned
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ── Helper Components ──────────────────────────────────────────────────────

const statusCfg: Record<string, { bg: string; text: string; dot: string }> = {
  Approved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Pending: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  "Under Review": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  Rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  Released: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  Exempt: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Inactive: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg[status] || { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

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

function ActionBadge({ action, color }: { action: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold tracking-wide ${colorMap[color] || "bg-gray-50 text-gray-600"}`}>
      {action}
    </span>
  );
}

// ── Login Page ─────────────────────────────────────────────────────────────

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);

  function refreshCaptcha() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    setCaptchaCode(Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
    setCaptchaInput("");
  }

  useEffect(() => {
    refreshCaptcha();
  }, []);

  async function handleLogin() {
    if (captchaInput.toUpperCase() !== captchaCode) {
      setError("Invalid CAPTCHA code. Please try again.");
      refreshCaptcha();
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(username, password, captchaInput, captchaCode, remember);
      toast.success("Welcome to PropVault");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
      refreshCaptcha();
    }
  }

  async function handleForgot() {
    setForgotOpen(true);
  }

  return (
    <>
    <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    <div className="min-h-screen flex items-center justify-center bg-[#061526] relative overflow-hidden px-4 py-8">
      {/* Background geometric pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 40px)",
        }}
      />
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-800/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3" />

      <div className="relative w-full max-w-[420px]">
        {/* Header */}
        <div className="flex flex-col items-center mb-7">
          <div className="flex items-center gap-4">
            <ImageWithFallback
              src={rizalLogo}
              alt="Municipality of Rizal, Palawan Official Seal"
              className="w-[68px] h-[68px] object-contain drop-shadow-lg"
            />
            <div>
              <p className="text-blue-300/70 text-[10px] font-semibold uppercase tracking-[0.15em]">
                Republic of the Philippines
              </p>
              <p className="text-white font-semibold text-base leading-tight">
                Municipality of Rizal, Palawan
              </p>
              <p className="text-blue-300/60 text-xs">Municipal Assessor's Office</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/5">
          <div className="bg-[#1e3a8a] px-7 py-5 text-center">
            <h1 className="text-white text-xl font-semibold" style={{ fontFamily: "'Roboto Slab', serif" }}>
              VeriTrack Solutions
            </h1>
            <p className="text-blue-200/80 text-xs mt-0.5 tracking-wide">
              Municipal Assessor Information System
            </p>
          </div>

          <div className="px-8 py-7 space-y-5">
            {/* Username */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Username
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* CAPTCHA */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Security Verification
              </label>
              <div className="flex gap-2 mb-2">
                <div
                  className="flex-1 bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg flex items-center justify-center h-10 select-none relative overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='white'/%3E%3C/svg%3E\")" }} />
                  <span
                    className="font-mono text-white text-lg font-bold tracking-[0.4em] pr-1"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                      transform: "skewX(-5deg)",
                    }}
                  >
                    {captchaCode}
                  </span>
                </div>
                <button type="button" onClick={refreshCaptcha} className="px-3 h-10 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all">
                  <RefreshCw size={14} />
                </button>
              </div>
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="Type the characters shown above"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
              />
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-700"
                />
                <span className="text-sm text-gray-600 select-none">Remember me</span>
              </label>
              <button type="button" onClick={handleForgot} className="text-sm text-blue-700 hover:text-blue-800 font-medium transition-colors">
                Forgot password?
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs">
                {error}
              </div>
            )}

            {/* Login button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleLogin}
              className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20 text-sm tracking-wide"
            >
              {loading ? "Signing in…" : "Sign In to System"}
            </button>

          </div>
        </div>

        <p className="text-center text-blue-400/30 text-xs mt-5">
          © 2024 Municipality of Rizal, Palawan · All rights reserved
        </p>
      </div>
    </div>
    </>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

type NavItemDef = { id: View; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };
type NavGroup = { label?: string; items?: NavItemDef[]; children?: NavItemDef[] };

const getNavGroupsForRole = (role: UserRole): NavGroup[] => {
  const adminNav: NavGroup[] = [
    { items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Property Records",
      children: [
        { id: "land", label: "Land & Plants/Trees", icon: MapPin },
        { id: "buildings", label: "Buildings & Structures", icon: Building2 },
      ],
    },
    {
      items: [
        { id: "certifications", label: "Certifications", icon: FileCheck },
        { id: "payments", label: "Tax Payments", icon: Banknote },
        { id: "gis", label: "GIS Mapping", icon: Map },
        { id: "cadastral", label: "Cadastral", icon: MapPinned },
        { id: "reports", label: "Reports", icon: BarChart2 },
      ],
    },
    {
      label: "Administration",
      items: [
        { id: "users", label: "User Management", icon: Users },
        { id: "audit", label: "Audit Trail", icon: Shield },
        { id: "settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  const treasuryNav: NavGroup[] = [
    { items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      items: [
        { id: "payments", label: "Tax Payments", icon: Banknote },
        { id: "reports", label: "Collection Reports", icon: BarChart2 },
      ],
    },
    {
      label: "Property Reference",
      children: [
        { id: "land", label: "Land Records", icon: MapPin },
        { id: "buildings", label: "Building Records", icon: Building2 },
      ],
    },
  ];

  const staffAssessorNav: NavGroup[] = [
    { items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Property Assessments",
      children: [
        { id: "land", label: "Land & Plants/Trees", icon: MapPin },
        { id: "buildings", label: "Buildings & Structures", icon: Building2 },
      ],
    },
    {
      items: [
        { id: "certifications", label: "Certification Requests", icon: FileCheck },
        { id: "gis", label: "GIS / Property Location", icon: Map },
        { id: "cadastral", label: "Cadastral", icon: MapPinned },
        { id: "reports", label: "Assessment Reports", icon: BarChart2 },
        { id: "settings", label: "Reference Codes", icon: Settings },
      ],
    },
  ];

  const itNav: NavGroup[] = [
    { items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "System Operations",
      items: [
        { id: "audit", label: "Audit Trail", icon: Shield },
        { id: "settings", label: "System Settings", icon: Settings },
        { id: "reports", label: "System Reports", icon: BarChart2 },
      ],
    },
  ];

  switch (role) {
    case "Admin":
      return adminNav;
    case "Treasury":
      return treasuryNav;
    case "Staff Assessor":
      return staffAssessorNav;
    case "IT":
      return itNav;
    default:
      return [{ items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] }];
  }
};

function Sidebar({
  activeView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onClose,
  isMobile,
  userRole,
  userName,
}: {
  activeView: View;
  onNavigate: (v: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
  isMobile: boolean;
  userRole: UserRole;
  userName: string;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const navGroups = getNavGroupsForRole(userRole);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  function NavItem({ item }: { item: { id: View; label: string; icon: React.ComponentType<{ size?: number; className?: string }> } }) {
    const Icon = item.icon;
    const active = activeView === item.id;
    return (
      <button
        onClick={() => { onNavigate(item.id); if (isMobile) onClose(); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group relative ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-400 rounded-r" />}
        <Icon size={16} className={`shrink-0 ${active ? "text-blue-400" : ""}`} />
        {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
      </button>
    );
  }

  return (
    <aside
      className={`flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
        collapsed ? "w-[62px]" : "w-[240px]"
      } min-h-screen shrink-0 z-30`}
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-sidebar-border ${collapsed ? "justify-center" : ""}`}>
        <ImageWithFallback
          src={rizalLogo}
          alt="Rizal Palawan Logo"
          className={`object-contain shrink-0 ${collapsed ? "w-8 h-8" : "w-9 h-9"}`}
        />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sidebar-foreground font-semibold text-sm leading-tight truncate" style={{ fontFamily: "'Roboto Slab', serif" }}>
              VeriTrack
            </p>
            <p className="text-sidebar-foreground/50 text-[10px] truncate">Rizal, Palawan MAO</p>
          </div>
        )}
      </div>

      {/* Nav — role-filtered */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-hide">
        {navGroups.map((group, gi) => {
          const groupKey = group.label || `group-${gi}`;
          const isOpen = openGroups[groupKey] ?? true;
          const childActive = group.children?.some((c) => c.id === activeView);

          return (
            <div key={groupKey} className={gi > 0 ? "mt-1" : ""}>
              {group.label && !collapsed && (
                <button
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [groupKey]: !isOpen }))}
                  className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    childActive ? "text-blue-400" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/60"
                  }`}
                >
                  <span>{group.label}</span>
                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
              {group.label && collapsed && <div className="h-px bg-sidebar-border mx-1 my-2" />}
              {group.items?.map((item) => (
                <NavItem key={item.id} item={item} />
              ))}
              {group.children && (isOpen || collapsed) && (
                <div className={collapsed ? "" : "pl-2 space-y-0.5"}>
                  {group.children.map((item) => (
                    <NavItem key={item.id} item={item} />
                  ))}
                </div>
              )}
              {!group.label && gi > 0 && !collapsed && <div className="h-px bg-sidebar-border mx-1 my-2" />}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`border-t border-sidebar-border px-3 py-3 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {getInitials(userName)}
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-sidebar-foreground text-xs font-semibold truncate">{userName}</p>
            <p className="text-sidebar-foreground/40 text-[10px] truncate">{userRole} · Online</p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        {collapsed && (
          <button onClick={onToggleCollapse} className="p-1 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Top Nav ────────────────────────────────────────────────────────────────

const viewLabels: Record<View, string> = {
  dashboard: "Dashboard",
  land: "Land & Plants/Trees Records",
  buildings: "Buildings & Structures Records",
  certifications: "Certification Requests",
  payments: "Tax Payment Records",
  gis: "GIS Property Mapping",
  cadastral: "Cadastral GIS",
  reports: "Reports",
  users: "User Management",
  audit: "Audit Trail",
  settings: "Settings",
};

function TopNav({
  activeView,
  onMenuToggle,
  darkMode,
  onDarkToggle,
  notifOpen,
  onNotifToggle,
  profileOpen,
  onProfileToggle,
  onLogout,
  onNavigate,
  user,
}: {
  activeView: View;
  onMenuToggle: () => void;
  darkMode: boolean;
  onDarkToggle: () => void;
  notifOpen: boolean;
  onNotifToggle: () => void;
  profileOpen: boolean;
  onProfileToggle: () => void;
  onLogout: () => void;
  onNavigate: (view: View) => void;
  user: AuthUser;
}) {
  const userName = user.name;
  const userRole = user.role as UserRole;
  const userEmail = user.email;
  const [accountDialog, setAccountDialog] = useState<AccountDialog>(null);
  const { notifs, markAllNotifsRead, markNotifRead, landProps, refresh } = useData();
  const [quickSearch, setQuickSearch] = useState("");
  const [markingRead, setMarkingRead] = useState(false);
  const unreadCount = notifs.filter((n) => !n.read).length;

  function runQuickSearch() {
    const q = quickSearch.trim();
    if (!q) {
      toast.warning("Enter a search term");
      return;
    }
    const matches = landProps.filter(
      (p) =>
        p.owner.toLowerCase().includes(q.toLowerCase()) ||
        p.pin.toLowerCase().includes(q.toLowerCase()) ||
        p.td.toLowerCase().includes(q.toLowerCase())
    );
    if (canAccessView(userRole, "land")) {
      onNavigate("land");
      toast.info(matches.length ? `Found ${matches.length} matching record(s)` : "No matches — open Land Records to search", {
        description: q,
      });
    } else {
      toast.info(`Search: "${q}"`, { description: `${matches.length} match(es) in land records` });
    }
    setQuickSearch("");
  }

  // Generate initials from userName
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return name.substring(0, 2);
  };

  const initials = getInitials(userName).toUpperCase();

  return (
    <header className="bg-card border-b border-border px-4 md:px-6 h-14 flex items-center gap-4 sticky top-0 shrink-0">
      {/* Mobile hamburger */}
      <button onClick={onMenuToggle} className="md:hidden text-muted-foreground hover:text-foreground transition-colors">
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
        <Home size={13} />
        <ChevronRight size={13} />
        <span className="text-foreground font-medium">{viewLabels[activeView]}</span>
      </div>
      <div className="md:hidden text-sm font-semibold text-foreground">{viewLabels[activeView]}</div>

      <div className="flex-1" />

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 w-52 group focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runQuickSearch()}
          placeholder="Quick search..."
          className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground/60"
          aria-label="Quick search"
        />
      </div>

      {/* Dark mode */}
      <button
        type="button"
        onClick={onDarkToggle}
        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        title={darkMode ? "Light mode" : "Dark mode"}
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <SyncControl compact onSyncComplete={refresh} />

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={onNotifToggle}
          className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-[1101] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">Notifications</span>
              <button
                type="button"
                disabled={markingRead || unreadCount === 0}
                onClick={async () => {
                  setMarkingRead(true);
                  try {
                    await markAllNotifsRead();
                    toast.success("All notifications marked as read");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not update notifications");
                  } finally {
                    setMarkingRead(false);
                  }
                }}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {markingRead ? "Updating…" : "Mark all read"}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifs.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications</p>
              )}
              {notifs.map((n) => {
                const iconCls = { success: "text-emerald-500", warning: "text-amber-500", error: "text-red-500", info: "text-blue-500" }[n.type];
                const Icon = { success: CheckCircle, warning: AlertCircle, error: XCircle, info: Bell }[n.type];
                return (
                  <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${!n.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}>
                    <Icon size={16} className={`shrink-0 mt-0.5 ${iconCls}`} />
                    <button
                      type="button"
                      onClick={() => !n.read && markNotifRead(n.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-semibold text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.msg}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => markNotifRead(n.id)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0 self-start"
                      aria-label="Dismiss notification"
                      title="Mark as read"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  onNotifToggle();
                  toast.info("Showing latest notifications", { description: `${notifs.length} total` });
                }}
                className="text-xs text-primary hover:underline font-medium"
              >
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={onProfileToggle}
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-secondary transition-all"
        >
          <div className="w-7 h-7 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <span className="hidden md:block text-sm font-medium text-foreground">{userRole}</span>
          <ChevronDown size={13} className="hidden md:block text-muted-foreground" />
        </button>
        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-[1101] overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="font-semibold text-sm">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">@{user.username}</p>
              <RoleBadge role={userRole} />
            </div>
            {PROFILE_MENU.filter(
              (item) => !item.roles || item.roles.includes(userRole)
            ).map(({ icon: Icon, label, action, view }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onProfileToggle();
                  if (action === 'navigate' && view) {
                    onNavigate(view);
                    toast.success(`Opened ${label}`);
                  } else if (action !== 'navigate') {
                    setAccountDialog(action);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-sm text-left focus:outline-none focus-visible:bg-secondary"
              >
                <Icon size={14} className="text-muted-foreground" />
                {label}
              </button>
            ))}
            <div className="border-t border-border" />
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm text-red-600"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}
      </div>
      <UserAccountDialogs
        open={accountDialog}
        onClose={() => setAccountDialog(null)}
        user={user}
        onNavigate={onNavigate}
      />
    </header>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────────────

function DashboardView({ userName, userRole, onNavigate }: { userName?: string; userRole: UserRole; onNavigate: (view: View) => void }) {
  const { stats, auditLogs, monthlyData, loading } = useData();
  const mv = stats?.monthlyMovement;

  const statCards = [
    { label: "Total Properties", value: String(stats?.totalProperties ?? "—"), change: "Live from database", trend: "up", icon: Layers, color: "bg-blue-600", view: "land" as View },
    { label: "Pending Assessments", value: String(stats?.pendingAssessments ?? "—"), change: "Awaiting approval", trend: "down", icon: Clock, color: "bg-amber-500", view: "land" as View },
    { label: "Under Review", value: String(stats?.underReviewAssessments ?? "—"), change: "Submitted by staff", trend: "down", icon: FileCheck, color: "bg-blue-500", view: "land" as View },
    { label: "Approved Assessments", value: String(stats?.approvedAssessments ?? "—"), change: "Land records", trend: "up", icon: CheckCircle, color: "bg-emerald-600", view: "land" as View },
    { label: "Certification Requests", value: String(stats?.certificationRequests ?? "—"), change: `${stats?.certificationPending ?? 0} pending`, trend: "neutral", icon: FileCheck, color: "bg-purple-600", view: "certifications" as View },
    { label: "Active Users", value: String(stats?.activeUsers ?? "—"), change: "Registered accounts", trend: "neutral", icon: Users, color: "bg-sky-600", view: "users" as View },
  ];

  const recentActivity = auditLogs.slice(0, 5);
  const chartClass = stats?.classData?.length ? stats.classData : [{ name: "—", value: 0, color: "#94a3b8" }];
  const chartBrgy = stats?.brgyData?.length ? stats.brgyData : [{ name: "—", count: 0 }];
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
            Good morning, {userName || "Administrator"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todayLabel} · Municipal Assessor (Head of Office) · Rizal, Palawan
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("cadastral")}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary"
        >
          <MapPinned size={14} /> Assessor Rolls / Cadastral
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading && <p className="col-span-full text-sm text-muted-foreground">Loading dashboard…</p>}
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onNavigate(s.view)}
              className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow text-left"
            >
              <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center mb-3`}>
                <Icon size={16} className="text-white" />
              </div>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{s.label}</p>
              <p className={`text-[10px] mt-1.5 font-medium ${s.trend === "up" ? "text-emerald-600" : s.trend === "down" ? "text-amber-600" : "text-muted-foreground/70"}`}>
                {s.change}
              </p>
            </button>
          );
        })}
      </div>

      {mv && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm text-foreground mb-1">Monthly Assessment Movement</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {mv.month} {mv.year} · like the Monthly Assessment Report (existing / new / cancelled / end-of-month)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-lg font-bold">{mv.existingEndPreceding}</p>
              <p className="text-[10px] text-muted-foreground">End of {mv.precedingMonth}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-lg font-bold text-emerald-700">+{mv.newDuringPresent}</p>
              <p className="text-[10px] text-emerald-700">New this month</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-lg font-bold text-red-700">−{mv.cancelledDuringPresent}</p>
              <p className="text-[10px] text-red-700">Cancelled / returned</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-lg font-bold text-blue-800">{mv.endPresent}</p>
              <p className="text-[10px] text-blue-800">End of {mv.month}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-lg font-bold text-amber-800">
                {Number(mv.totalAssessedValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-amber-800">Total assessed value</p>
            </div>
          </div>
        </div>
      )}

      {(stats?.approvalQueue?.length ?? 0) > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-foreground">Approval inbox</h3>
            <button type="button" onClick={() => onNavigate("land")} className="text-xs text-primary font-medium hover:underline">
              Open Land Records
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="py-2 pr-3">TD</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Barangay</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">AV</th>
                </tr>
              </thead>
              <tbody>
                {stats!.approvalQueue!.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono text-xs text-primary">{r.td}</td>
                    <td className="py-2 pr-3">{r.owner}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.barangay}</td>
                    <td className="py-2 pr-3"><StatusBadge status={r.status} /></td>
                    <td className="py-2 font-mono text-xs">{r.av}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Area chart - Monthly Assessments */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Monthly Assessment Activity</h3>
              <p className="text-xs text-muted-foreground">Fiscal Year {stats?.fiscalYear ?? new Date().getFullYear()}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-0.5 bg-blue-500 rounded" />Assessments</span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-0.5 bg-emerald-500 rounded" />Certifications</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} key="area">
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)" }} />
              <Area type="monotone" dataKey="assessments" stroke="#3b82f6" strokeWidth={2} fill="url(#aGrad)" dot={false} />
              <Area type="monotone" dataKey="certifications" stroke="#22c55e" strokeWidth={2} fill="url(#cGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - Classification */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-foreground">Property Classification</h3>
            <p className="text-xs text-muted-foreground">Total: {stats?.totalProperties ?? "—"} properties</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={chartClass} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                {chartClass.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)" }}
                formatter={(v: number) => [v.toLocaleString(), ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {chartClass.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-medium text-foreground">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bar chart - Barangay */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-foreground">Properties by Barangay</h3>
            <p className="text-xs text-muted-foreground">Top 8 barangays</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartBrgy} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={75} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)" }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Recent System Activity</h3>
              <p className="text-xs text-muted-foreground">Latest actions logged</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (canAccessView(userRole, "audit")) {
                  onNavigate("audit");
                } else {
                  toast.warning("You do not have access to the audit trail");
                }
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              View full log
            </button>
          </div>
          <div className="space-y-3">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                <ActionBadge action={log.action} color={log.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium truncate">{log.detail}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground/70">{log.user}</span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground/60">{log.module}</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/50 shrink-0 mt-0.5">{log.time.split(" ").slice(-2).join(" ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Properties Views ───────────────────────────────────────────────────────

function PropertiesView({ type, userRole }: { type: "land" | "buildings", userRole: UserRole }) {
  const { landProps, buildingProps, refresh } = useData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{
    propertyId?: string;
    pin?: string;
    tdOrArp?: string;
  } | null>(null);
  const [encodeOpen, setEncodeOpen] = useState(false);
  const [editingLand, setEditingLand] = useState<(typeof landProps)[0] | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<(typeof buildingProps)[0] | null>(null);

  const statuses = ["All", "Approved", "Pending", "Under Review", "Rejected", "Exempt"];

  // Role-specific title suffixes
  const canCreate = hasPermission(userRole, "records:create");
  const canEdit = hasPermission(userRole, "records:edit");
  const canUpload = hasPermission(userRole, "documents:upload");
  const canSubmit = hasPermission(userRole, "assessments:submit");
  const canApprove = hasPermission(userRole, "assessments:approve");
  const isReadOnly = userRole === "Treasury";

  const updateLandWorkflow = async (id: string, status: string) => {
    let remarks: string | undefined;
    if (status === "Rejected") {
      const note = window.prompt("Return remarks (required for staff):");
      if (!note?.trim()) {
        toast.error("Remarks are required when returning an assessment");
        return;
      }
      remarks = note.trim();
    } else if (status === "Under Review") {
      if (!(await confirmAction("Submit this assessment for Municipal Assessor approval?", "Submit"))) return;
    } else if (status === "Approved") {
      if (!(await confirmAction("Approve this assessment?", "Approve"))) return;
    }
    try {
      await api.updateLandStatus(id, status, remarks);
      toast.success(`Status → ${status}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    }
  };

  const openBulkUpload = (target?: { propertyId?: string; pin?: string; tdOrArp?: string }) => {
    setUploadTarget(target || null);
    setUploadOpen(true);
  };

  const openLandEncode = (record?: (typeof landProps)[0] | null) => {
    setEditingLand(record || null);
    setEncodeOpen(true);
  };

  const openBuildingEncode = (record?: (typeof buildingProps)[0] | null) => {
    setEditingBuilding(record || null);
    setEncodeOpen(true);
  };

  const uploadDialog = uploadOpen ? (
    <SoftCopyBulkUpload
      propertyType={type === "land" ? "land" : "building"}
      open={uploadOpen}
      propertyId={uploadTarget?.propertyId}
      pin={uploadTarget?.pin}
      tdOrArp={uploadTarget?.tdOrArp}
      onClose={() => {
        setUploadOpen(false);
        setUploadTarget(null);
      }}
      onDone={() => {
        void refresh();
      }}
    />
  ) : null;

  const encodeDialog =
    type === "land" && encodeOpen ? (
      <LandEncodeForm
        open={encodeOpen}
        record={editingLand}
        onClose={() => {
          setEncodeOpen(false);
          setEditingLand(null);
        }}
        onSaved={() => void refresh()}
      />
    ) : type === "buildings" && encodeOpen ? (
      <BuildingEncodeForm
        open={encodeOpen}
        record={editingBuilding}
        onClose={() => {
          setEncodeOpen(false);
          setEditingBuilding(null);
        }}
        onSaved={() => void refresh()}
      />
    ) : null;

  const getTitleSuffix = () => {
    if (isReadOnly) return " - Reference (Read Only)";
    if (hasPermission(userRole, "assessments:approve")) return " - Assessments";
    if (canCreate) return " - Encoding";
    return "";
  };

  if (type === "land") {
    const filtered = landProps.filter((p) => {
      const matchSearch =
        search === "" ||
        Object.values(p).some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "All" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
    const handleExport = () => {
      exportCsv(
        "land-records.csv",
        ["TD", "PIN", "Owner", "Barangay", "Classification", "Area", "Market Value", "Assessed Value", "Status"],
        filtered.map((p) => [p.td, p.pin, p.owner, p.barangay, p.classification, p.area, p.mv, p.av, p.status])
      );
    };

    const handlePrint = (p: (typeof landProps)[0]) => {
      openPrintDocument(
        `Tax Declaration — ${p.td}`,
        `<h1>Municipality of Jose P. Rizal, Palawan</h1>
        <h2>Tax Declaration of Real Property (Land / Plants &amp; Trees)</h2>
        <p><strong>TD No.:</strong> ${p.td} &nbsp; <strong>PIN:</strong> ${p.pin}</p>
        <table>
        <tr><th>Owner</th><td>${p.owner}</td></tr>
        <tr><th>Barangay</th><td>${p.barangay}</td></tr>
        <tr><th>Classification / Actual Use</th><td>${p.classification}</td></tr>
        <tr><th>Area</th><td>${p.area}</td></tr>
        <tr><th>Market Value</th><td>${p.mv}</td></tr>
        <tr><th>Assessed Value</th><td>${p.av}</td></tr>
        <tr><th>Status</th><td>${p.status}</td></tr>
        ${p.remarks ? `<tr><th>Remarks</th><td>${p.remarks}</td></tr>` : ""}
        </table>
        <p style="margin-top:24px;font-size:12px">Generated ${new Date().toLocaleString()} · PropVault Assessor Office</p>`
      );
    };

    return (
      <div className="p-4 md:p-6 space-y-4">
        {uploadDialog}
        {encodeDialog}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
              Land & Plants/Trees Records{getTitleSuffix()}
            </h2>
            <p className="text-sm text-muted-foreground">{landProps.length} records · FY 2024</p>
          </div>
          <div className="flex items-center gap-2">
            {hasPermission(userRole, "documents:generate") && (
              <button
                type="button"
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-all disabled:opacity-50"
              >
                <Download size={14} className="text-muted-foreground" />Export
              </button>
            )}
            {canUpload && !isReadOnly && (
              <button
                type="button"
                onClick={() => openBulkUpload()}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-all"
              >
                <Upload size={14} className="text-muted-foreground" />Upload Soft Copies
              </button>
            )}
            {canCreate && !isReadOnly && (
              <button
                type="button"
                onClick={() => openLandEncode()}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-all"
              >
                <Plus size={14} />Encode New
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 min-w-48 max-w-xs focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by owner, TD No., PIN..." className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground/60" />
          </div>
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
            {statuses.map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto max-h-[min(520px,calc(100vh-16rem))]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur-sm">
                <tr className="border-b border-border">
                  {["TD Number", "PIN", "Owner Name", "Barangay", "Classification", "Area", "Market Value", "Assessed Value", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-3 font-mono text-xs text-primary font-medium">{p.td}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.pin}</td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">{p.owner}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.barangay}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-foreground/80">{p.classification}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.area}</td>
                    <td className="px-4 py-3 text-xs font-mono font-medium text-foreground">{p.mv}</td>
                    <td className="px-4 py-3 text-xs font-mono font-medium text-foreground">{p.av}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      {!isReadOnly && (
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button type="button" onClick={() => openLandEncode(p)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Edit Form 1-A" aria-label="Edit record">
                              <Edit size={13} />
                            </button>
                          )}
                          {canSubmit && (p.status === "Pending" || p.status === "Rejected") && (
                            <button
                              type="button"
                              onClick={() => void updateLandWorkflow(p.id, "Under Review")}
                              className="px-1.5 py-1 rounded text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                              title="Submit for approval"
                            >
                              Submit
                            </button>
                          )}
                          {canApprove && (p.status === "Under Review" || p.status === "Pending") && (
                            <>
                              <button
                                type="button"
                                onClick={() => void updateLandWorkflow(p.id, "Approved")}
                                className="px-1.5 py-1 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                title="Approve"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void updateLandWorkflow(p.id, "Rejected")}
                                className="px-1.5 py-1 rounded text-[10px] font-medium bg-red-50 text-red-700 hover:bg-red-100"
                                title="Return with remarks"
                              >
                                Return
                              </button>
                            </>
                          )}
                          {canUpload && (
                            <button
                              type="button"
                              onClick={() => openBulkUpload({ propertyId: p.id, pin: p.pin, tdOrArp: p.td })}
                              className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                              title="Upload soft copy"
                              aria-label="Upload soft copy"
                            >
                              <Upload size={13} />
                            </button>
                          )}
                          <button type="button" onClick={() => handlePrint(p)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Print" aria-label="Print record">
                            <Printer size={13} />
                          </button>
                          <button type="button" onClick={() => toast.info(`PIN: ${p.pin}`, { description: "QR code generation is under development." })} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="QR Code" aria-label="Generate QR code">
                            <QrCode size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-sm">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border shrink-0 bg-card">
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {landProps.length} record{filtered.length === 1 ? "" : "s"} · scroll to view all
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "buildings") {
    return (
      <div className="p-4 md:p-6 space-y-4">
        {uploadDialog}
        {encodeDialog}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>Buildings & Structures Records{getTitleSuffix()}</h2>
            <p className="text-sm text-muted-foreground">{buildingProps.length} records · FY 2024</p>
          </div>
          <div className="flex items-center gap-2">
            {canUpload && !isReadOnly && (
              <button
                type="button"
                onClick={() => openBulkUpload()}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-all"
              >
                <Upload size={14} className="text-muted-foreground" />Upload Soft Copies
              </button>
            )}
            {canCreate && !isReadOnly && (
              <button type="button" onClick={() => openBuildingEncode()} className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-all">
                <Plus size={14} />Encode New
              </button>
            )}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto max-h-[min(520px,calc(100vh-16rem))]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur-sm">
                <tr className="border-b border-border">
                  {["ARP Number", "PIN", "Owner Name", "Barangay", "Kind of Building", "Structural Type", "Floors", "Floor Area", "Market Value", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buildingProps.map((p, i) => (
                  <tr key={p.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-3 font-mono text-xs text-primary font-medium">{p.arp}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.pin}</td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">{p.owner}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.barangay}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{p.kind}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{p.structural}</td>
                    <td className="px-4 py-3 text-xs text-center text-muted-foreground">{p.floors}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.floorArea}</td>
                    <td className="px-4 py-3 text-xs font-mono font-medium">{p.mv}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      {!isReadOnly && (
                        <div className="flex gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openBuildingEncode(p)}
                              className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground"
                              title="Edit Building Form 1"
                              aria-label="Edit building"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                          {canUpload && (
                            <button
                              type="button"
                              onClick={() => openBulkUpload({ propertyId: p.id, pin: p.pin, tdOrArp: p.arp })}
                              className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground"
                              title="Upload soft copy"
                              aria-label="Upload soft copy"
                            >
                              <Upload size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {buildingProps.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground text-sm">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border shrink-0 bg-card">
            <span className="text-xs text-muted-foreground">
              {buildingProps.length} record{buildingProps.length === 1 ? "" : "s"} · scroll to view all
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Certifications View ────────────────────────────────────────────────────

function CertificationsView({ userRole }: { userRole: UserRole }) {
  const { certifications, createCertification, updateCertStatus, landProps } = useData();
  const [statusFilter, setStatusFilter] = useState("All");
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newType, setNewType] = useState("Tax Declaration Copy");
  const [newPropertyId, setNewPropertyId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const statuses = ["All", "Pending", "Under Review", "Approved", "Rejected", "Released"];

  const statusCounts = statuses.slice(1).reduce((acc, s) => {
    acc[s] = certifications.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = certifications.filter((c) => statusFilter === "All" || c.status === statusFilter);

  // Role-specific title
  const canApprove = hasPermission(userRole, "certifications:approve");

  const getTitle = () => {
    if (canApprove) return "Certification Approvals";
    return "Certification Requests";
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>{getTitle()}</h2>
          <p className="text-sm text-muted-foreground">{certifications.length} total requests</p>
        </div>
        {hasPermission(userRole, "certifications:request") && (
          <button type="button" onClick={() => setShowNewRequest(true)} className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-all">
            <Plus size={14} />New Request
          </button>
        )}
        {canApprove && (
          <span className="text-xs text-muted-foreground">Click Review to approve or reject</span>
        )}
      </div>

      {/* Status pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Pending", color: "border-amber-200 bg-amber-50", text: "text-amber-700", count: statusCounts["Pending"] || 0 },
          { label: "Under Review", color: "border-blue-200 bg-blue-50", text: "text-blue-700", count: statusCounts["Under Review"] || 0 },
          { label: "Approved", color: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", count: statusCounts["Approved"] || 0 },
          { label: "Rejected", color: "border-red-200 bg-red-50", text: "text-red-700", count: statusCounts["Rejected"] || 0 },
          { label: "Released", color: "border-purple-200 bg-purple-50", text: "text-purple-700", count: statusCounts["Released"] || 0 },
        ].map((s) => (
          <div key={s.label} className={`border-2 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-all ${s.color} ${statusFilter === s.label ? "ring-2 ring-offset-2 ring-primary" : ""}`} onClick={() => setStatusFilter(statusFilter === s.label ? "All" : s.label)}>
            <p className={`text-2xl font-bold ${s.text}`} style={{ fontFamily: "'Roboto Slab', serif" }}>{s.count}</p>
            <p className={`text-xs font-medium mt-1 ${s.text}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 w-fit">
        {["All", ...statuses.slice(1)].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {["Request ID", "Certificate Type", "Requestor", "Property ID", "Date Requested", "Due Date", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{c.id}</td>
                <td className="px-4 py-3 text-xs font-medium text-foreground">{c.type}</td>
                <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">{c.requestor}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.pid}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.date}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.due}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {c.status === "Approved" || c.status === "Released" ? (
                      <button
                        type="button"
                        onClick={() => openPrintDocument(`Certificate ${c.id}`, `<h1>${c.type}</h1><p>Request ID: ${c.id}</p><p>Requestor: ${c.requestor}</p><p>Status: ${c.status}</p>`)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
                      >
                        <Download size={11} />Download
                      </button>
                    ) : canApprove ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={processingId === c.id}
                          onClick={async () => {
                            if (!(await confirmAction(`Approve certification request ${c.id}?`, "Approve"))) return;
                            setProcessingId(c.id);
                            try {
                              await updateCertStatus(c.id, "Approved");
                              toast.success("Certification approved");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Approval failed");
                            } finally {
                              setProcessingId(null);
                            }
                          }}
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={processingId === c.id}
                          onClick={async () => {
                            if (!(await confirmAction(`Reject certification request ${c.id}?`, "Reject"))) return;
                            setProcessingId(c.id);
                            try {
                              await updateCertStatus(c.id, "Rejected");
                              toast.warning("Certification rejected");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Rejection failed");
                            } finally {
                              setProcessingId(null);
                            }
                          }}
                          className="px-2 py-1 rounded bg-red-50 text-red-700 text-xs disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toast.info(`Request ${c.id}`, { description: `${c.type} · ${c.status}` })}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 transition-colors"
                      >
                        <Edit size={11} />Review
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold mb-4">New Certification Request</h3>
            <label className="block text-xs text-muted-foreground mb-1">Certificate type</label>
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full mb-3 px-3 py-2 border border-border rounded-lg text-sm bg-background">
              {["Tax Declaration Copy", "Certificate of Property Holdings", "No Property Holdings Certificate", "Assessment Certificate", "Verification Certificate"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="block text-xs text-muted-foreground mb-1">Property ID (optional)</label>
            <select value={newPropertyId} onChange={(e) => setNewPropertyId(e.target.value)} className="w-full mb-4 px-3 py-2 border border-border rounded-lg text-sm bg-background">
              <option value="">— None —</option>
              {landProps.map((p) => (
                <option key={p.id} value={p.id}>{p.id} — {p.td}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNewRequest(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button
                type="button"
                disabled={submitting || !newType}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await createCertification(newType, newPropertyId || undefined);
                    setShowNewRequest(false);
                    setNewPropertyId("");
                    toast.success("Request submitted");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Submit failed");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Audit Trail View ───────────────────────────────────────────────────────

function AuditView() {
  const { auditLogs } = useData();
  const [moduleFilter, setModuleFilter] = useState("All");
  const modules = ["All", "Authentication", "Land Records", "Assessments", "Certifications", "Documents", "Reports", "User Management"];

  const filtered = moduleFilter === "All" ? auditLogs : auditLogs.filter((l) => l.module === moduleFilter);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>Audit Trail</h2>
          <p className="text-sm text-muted-foreground">Complete system activity log · Nov 20, 2024</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              exportCsv(
                "audit-log.csv",
                ["Time", "Actor", "Action", "Module", "Detail", "IP"],
                filtered.map((l) => [l.time, l.user, l.action, l.module, l.detail, l.ip || ""])
              );
            }}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-all disabled:opacity-50"
          >
            <Download size={14} className="text-muted-foreground" />Export Log
          </button>
          <button type="button" onClick={() => comingSoon("Date range filter")} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-all">
            <Filter size={14} className="text-muted-foreground" />Date Range
          </button>
        </div>
      </div>

      {/* Module filter */}
      <div className="flex flex-wrap gap-2">
        {modules.map((m) => (
          <button key={m} onClick={() => setModuleFilter(m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${moduleFilter === m ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Activity Log</span>
          <span className="text-xs text-muted-foreground font-mono">{filtered.length} events</span>
        </div>
        <div className="divide-y divide-border/50">
          {filtered.map((log) => {
            const dotColor: Record<string, string> = {
              green: "bg-emerald-500", blue: "bg-blue-500",
              red: "bg-red-500", amber: "bg-amber-500", purple: "bg-purple-500",
            };
            return (
              <div key={log.id} className="px-5 py-4 hover:bg-secondary/20 transition-colors flex items-start gap-4">
                <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor[log.color] || "bg-gray-400"}`} />
                  <span className="w-px h-full bg-border" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <ActionBadge action={log.action} color={log.color} />
                    <span className="text-xs font-medium text-foreground">{log.detail}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <User size={10} />
                      <span className="font-mono">{log.user}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{log.module}</span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[11px] font-mono text-muted-foreground/70">{log.ip}</span>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground/60 shrink-0 font-mono whitespace-nowrap">{log.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Placeholder View ───────────────────────────────────────────────────────

function PlaceholderView({ view }: { view: View }) {
  const icons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    gis: Map, reports: BarChart2, settings: Settings,
  };
  const Icon = icons[view] || Layers;

  const titles: Record<string, string> = {
    gis: "GIS Property Mapping",
    reports: "Reports Module",
    settings: "System Settings",
  };

  const descs: Record<string, string> = {
    gis: "Interactive municipal map with property parcel boundaries, color-coded classifications, barangay heatmap, and location search.",
    reports: "Generate PDF reports, printable appraisal sheets, assessment reports, and statistical summaries by date range, barangay, or classification.",
    settings: "LGU identity, barangay PIN codes, property kinds, classifications, assessment levels, and backups.",
  };

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Icon size={28} className="text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2" style={{ fontFamily: "'Roboto Slab', serif" }}>
          {titles[view] || viewLabels[view]}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{descs[view] || "This module is under development."}</p>
        <button type="button" onClick={() => comingSoon(titles[view] || viewLabels[view])} className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all">
          Coming Soon
        </button>
      </div>
    </div>
  );
}

// ── Access Denied Page ─────────────────────────────────────────────────────

function AccessDeniedPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Lock size={32} className="text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground mb-6">
          You don&apos;t have permission to access this section. Direct URL access to restricted modules is blocked.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

// ── Main App Shell ─────────────────────────────────────────────────────────

function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = user!.role as UserRole;
  const userName = user!.name;
  const activeView = pathToView(location.pathname) ?? "dashboard";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  function handleNavigate(view: View) {
    navigate(VIEW_TO_PATH[view]);
    setNotifOpen(false);
    setProfileOpen(false);
  }

  function handleOverlayClick() {
    setNotifOpen(false);
    setProfileOpen(false);
    setMobileSidebarOpen(false);
  }

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground flex">
        {(mobileSidebarOpen || notifOpen || profileOpen) && (
          <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={handleOverlayClick} />
        )}
        {(notifOpen || profileOpen) && (
          <div
            className="fixed inset-0 z-[1090]"
            onClick={handleOverlayClick}
            aria-hidden
          />
        )}

        <div className="hidden md:flex">
          <Sidebar
            activeView={activeView}
            onNavigate={handleNavigate}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onClose={() => {}}
            isMobile={false}
            userRole={userRole}
            userName={userName}
          />
        </div>

        {mobileSidebarOpen && (
          <div className="fixed inset-y-0 left-0 z-40 md:hidden">
            <Sidebar
              activeView={activeView}
              onNavigate={handleNavigate}
              collapsed={false}
              onToggleCollapse={() => {}}
              onClose={() => setMobileSidebarOpen(false)}
              isMobile={true}
              userRole={userRole}
              userName={userName}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Elevated above Leaflet map panes (z ~400–1000) so nav dropdowns are not covered on GIS */}
          <div className="relative z-[1100] shrink-0">
            <TopNav
              activeView={activeView}
              onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              darkMode={darkMode}
              onDarkToggle={() => setDarkMode(!darkMode)}
              notifOpen={notifOpen}
              onNotifToggle={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              profileOpen={profileOpen}
              onProfileToggle={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
              onLogout={() => { logout(); navigate("/login"); }}
              onNavigate={handleNavigate}
              user={user!}
            />
          </div>

          <main className="relative z-0 flex-1 overflow-y-auto">
            {activeView === "dashboard" && (
              <>
                {userRole === "Admin" && <DashboardView userName={userName} userRole={userRole} onNavigate={handleNavigate} />}
                {userRole === "Treasury" && <TreasuryDashboard userName={userName} onNavigate={handleNavigate} />}
                {userRole === "Staff Assessor" && <StaffDashboard userName={userName} onNavigate={handleNavigate} />}
                {userRole === "IT" && <ItDashboard userName={userName} onNavigate={handleNavigate} />}
              </>
            )}
            {activeView === "land" && <PropertiesView type="land" userRole={userRole} />}
            {activeView === "buildings" && <PropertiesView type="buildings" userRole={userRole} />}
            {activeView === "certifications" && <CertificationsView userRole={userRole} />}
            {activeView === "payments" && <PaymentsView userRole={userRole} />}
            {activeView === "users" && <UsersManagementView />}
            {activeView === "audit" && <AuditView />}
            {activeView === "gis" && <GisView />}
            {activeView === "cadastral" && (
              <div className="h-[calc(100vh-7.5rem)] min-h-[480px]">
                <CadastralGisView />
              </div>
            )}
            {activeView === "reports" && <ReportsView />}
            {activeView === "settings" && <SettingsView userRole={userRole} />}
          </main>

          <NotificationToasts
            panelOpen={notifOpen}
            onOpenPanel={() => setNotifOpen(true)}
          />

          <footer className="border-t border-border bg-card px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageWithFallback src={rizalLogo} alt="Rizal" className="w-5 h-5 object-contain opacity-60" />
              <span className="text-[11px] text-muted-foreground">
                VeriTrack Solutions · Municipality of Rizal, Palawan · MAO
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">v2.4.0 · 2024</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

// ── Root Router ────────────────────────────────────────────────────────────

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/access-denied"
        element={isAuthenticated ? <AccessDeniedPage /> : <Navigate to="/login" replace />}
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
