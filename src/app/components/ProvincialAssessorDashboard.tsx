import { Clock, CheckCircle, FileCheck, MapPin, Building2, XCircle, Eye, FileText, QrCode, Printer, Download } from "lucide-react";

export function ProvincialAssessorDashboard({ userName }: { userName: string }) {
  const dashboardStats = [
    { label: "Pending Approvals", value: "24", action: "View Pending Approvals", color: "bg-amber-500", icon: Clock },
    { label: "Approved Assessments", value: "189", action: "View Approved Assessments", color: "bg-emerald-600", icon: CheckCircle },
    { label: "Rejected Assessments", value: "8", action: "View Rejected Assessments", color: "bg-red-500", icon: XCircle },
    { label: "Taxable Properties", value: "4,827", action: "View Taxable Properties", color: "bg-blue-600", icon: FileText },
    { label: "Exempt Properties", value: "312", action: "View Exempt Properties", color: "bg-gray-500", icon: FileCheck },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Welcome bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
            Good morning, {userName}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Provincial Assessor Dashboard
          </p>
        </div>
      </div>

      {/* Dashboard Stats - Clickable */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Dashboard Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {dashboardStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all text-left"
              >
                <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                  <Icon size={16} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Roboto Slab', serif" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">{stat.action}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Assessment Approval */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          Assessment Approval
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Eye size={14} />
            <span>Review Assessment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs transition-colors">
            <CheckCircle size={14} />
            <span>Approve Assessment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors">
            <XCircle size={14} />
            <span>Reject Assessment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <FileText size={14} />
            <span>Add Remarks</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <FileText size={14} />
            <span>Add Memoranda</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <CheckCircle size={14} />
            <span>Recommend Approval</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs transition-colors">
            <FileCheck size={14} />
            <span>Digitally Sign Assessment</span>
          </button>
        </div>
      </div>

      {/* Property Records */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-blue-600" />
          Property Records
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Eye size={14} />
            <span>View Property Information</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <MapPin size={14} />
            <span>View Land Appraisal</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Building2 size={14} />
            <span>View Building Appraisal</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <MapPin size={14} />
            <span>View Plants & Trees Appraisal</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Clock size={14} />
            <span>View Superseded Assessments</span>
          </button>
        </div>
      </div>

      {/* Reports */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <FileText size={16} className="text-purple-600" />
          Reports
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <FileText size={14} />
            <span>Generate Assessment Reports</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Printer size={14} />
            <span>Print Appraisal Forms</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Printer size={14} />
            <span>Print Assessment Sheet</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Download size={14} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Verification */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <QrCode size={16} className="text-blue-600" />
          Verification
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <Eye size={14} />
            <span>Verify Property</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <QrCode size={14} />
            <span>Validate QR Code</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs transition-colors">
            <FileCheck size={14} />
            <span>Approve Certification Requests</span>
          </button>
        </div>
      </div>
    </div>
  );
}
