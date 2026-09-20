import {
  Archive,
  Building2,
  CheckCircle,
  Clock,
  Download,
  Edit,
  Eye,
  FileText,
  MapPin,
  Plus,
  Printer,
  Search,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import type { View } from '@/lib/rbac';
import { useData } from '@/context/DataContext';
import { DashboardQuickAction } from './DashboardQuickAction';
import { toast } from 'sonner';

type Props = {
  userName: string;
  onNavigate?: (view: View) => void;
};

export function StaffDashboard({ userName, onNavigate }: Props) {
  const { stats } = useData();

  const dashboardStats = [
    {
      label: 'Encoded / Draft',
      value: String(stats?.encodedDraft ?? stats?.pendingAssessments ?? '—'),
      action: 'View Encoded Records',
      color: 'bg-blue-600',
      icon: FileText,
      view: 'land' as View,
    },
    {
      label: 'Under Review',
      value: String(stats?.underReviewAssessments ?? '—'),
      action: 'View Pending Records',
      color: 'bg-amber-500',
      icon: Clock,
      view: 'land' as View,
    },
    {
      label: 'Returned',
      value: String(stats?.rejectedAssessments ?? '—'),
      action: 'View Returned Records',
      color: 'bg-red-500',
      icon: XCircle,
      view: 'land' as View,
    },
    {
      label: 'Approved',
      value: String(stats?.approvedAssessments ?? '—'),
      action: 'View Approved Records',
      color: 'bg-emerald-600',
      icon: CheckCircle,
      view: 'land' as View,
    },
  ];

  const go = (view: View, label: string) => {
    if (onNavigate) {
      onNavigate(view);
      toast.success(`Opened ${label}`);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
          Good morning, {userName}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Staff Assessor Dashboard · Property Assessments & Encoding
          {stats?.encodedToday != null ? ` · ${stats.encodedToday} encoded today` : ''}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Dashboard Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dashboardStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => go(stat.view, stat.action)}
                className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                  <Icon size={16} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">{stat.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Edit size={16} className="text-blue-600" />
          Property Encoding
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DashboardQuickAction label="Encode Land Form 1-A" icon={Plus} variant="primary" navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Edit Land Record" icon={Edit} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Search Property" icon={Search} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Cadastral Map" icon={MapPin} navigateTo="cadastral" onNavigate={onNavigate} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <User size={16} className="text-purple-600" />
          Owner & Soft Copies
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <DashboardQuickAction label="Encode Owner on Form 1-A" icon={Plus} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Edit Owner Information" icon={Edit} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Upload Soft Copies" icon={Upload} navigateTo="land" onNavigate={onNavigate} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-emerald-600" />
          Land / Plants & Trees
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DashboardQuickAction label="Add Land Appraisal" icon={Plus} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Edit Land Appraisal" icon={Edit} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Plants & Trees on Form 1-A" icon={FileText} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Open FAAS on Map" icon={MapPin} navigateTo="cadastral" onNavigate={onNavigate} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-blue-600" />
          Building Appraisal
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DashboardQuickAction label="Encode Building Form 1" icon={Plus} navigateTo="buildings" onNavigate={onNavigate} />
          <DashboardQuickAction label="Edit Building" icon={Edit} navigateTo="buildings" onNavigate={onNavigate} />
          <DashboardQuickAction label="Upload Floor Plan / Photo" icon={Upload} navigateTo="buildings" onNavigate={onNavigate} />
          <DashboardQuickAction label="GIS Locate" icon={MapPin} navigateTo="gis" onNavigate={onNavigate} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <FileText size={16} className="text-purple-600" />
          Documents & Workflow
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DashboardQuickAction label="Upload Scanned Forms" icon={Upload} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Submit for Approval" icon={CheckCircle} variant="success" navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="View Returned" icon={XCircle} navigateTo="land" onNavigate={onNavigate} />
          <DashboardQuickAction label="Certifications" icon={Eye} navigateTo="certifications" onNavigate={onNavigate} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Printer size={16} className="text-blue-600" />
          Reports & Rolls
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <DashboardQuickAction label="Assessor Rolls" icon={Printer} navigateTo="reports" onNavigate={onNavigate} />
          <DashboardQuickAction label="Assessment Reports" icon={FileText} navigateTo="reports" onNavigate={onNavigate} />
          <DashboardQuickAction label="Export / Print" icon={Download} navigateTo="reports" onNavigate={onNavigate} />
          <DashboardQuickAction label="Archive (Land list)" icon={Archive} navigateTo="land" onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
