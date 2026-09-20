import { useEffect, useState } from 'react';
import {
  Settings,
  MapPin,
  Layers,
  Database,
  Download,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Landmark,
  Hash,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { api, type SettingsLgu, type SettingsPropertyKind } from '@/lib/api';
import { hasPermission, type UserRole } from '@/lib/rbac';
import { confirmAction } from '@/lib/uiActions';
import { toast } from 'sonner';

const EMPTY_LGU: SettingsLgu = {
  provinceCode: '066',
  provinceName: 'Palawan',
  municipalCode: '14',
  municipalName: 'Jose P. Rizal',
};

export function SettingsView({ userRole }: { userRole: UserRole }) {
  const { settings, settingsError, refresh } = useData();
  const canConfigure = hasPermission(userRole, 'settings:configure');
  const canBackup = hasPermission(userRole, 'backup:restore');

  const [newBarangay, setNewBarangay] = useState('');
  const [newBarangayCode, setNewBarangayCode] = useState('');
  const [backingUp, setBackingUp] = useState(false);
  const [addingBarangay, setAddingBarangay] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newClass, setNewClass] = useState('');
  const [newLevelName, setNewLevelName] = useState('');
  const [newLevelRate, setNewLevelRate] = useState('20');
  const [editingLevelId, setEditingLevelId] = useState<number | null>(null);
  const [editLevelName, setEditLevelName] = useState('');
  const [editLevelRate, setEditLevelRate] = useState('');

  const [lguDraft, setLguDraft] = useState<SettingsLgu>(EMPTY_LGU);
  const [savingLgu, setSavingLgu] = useState(false);

  const [kindsDraft, setKindsDraft] = useState<SettingsPropertyKind[]>([]);
  const [savingKinds, setSavingKinds] = useState(false);
  const [newKindCode, setNewKindCode] = useState('');
  const [newKindLabel, setNewKindLabel] = useState('');

  useEffect(() => {
    if (settings?.lgu) setLguDraft(settings.lgu);
    if (settings?.propertyKinds) setKindsDraft(settings.propertyKinds);
  }, [settings?.lgu, settings?.propertyKinds]);

  const handleAddClass = async () => {
    if (!newClass.trim()) return;
    try {
      await api.addClassification(newClass.trim());
      setNewClass('');
      await refresh();
      toast.success('Classification added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add classification');
    }
  };

  const handleAddLevel = async () => {
    if (!newLevelName.trim() || !newLevelRate) return;
    try {
      await api.addAssessmentLevel(newLevelName.trim(), Number(newLevelRate));
      setNewLevelName('');
      setNewLevelRate('20');
      await refresh();
      toast.success('Assessment level added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add level');
    }
  };

  const saveLevel = async (id: number) => {
    try {
      await api.updateAssessmentLevel(id, { name: editLevelName.trim(), rate: Number(editLevelRate) });
      setEditingLevelId(null);
      await refresh();
      toast.success('Assessment level updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update level');
    }
  };

  const handleAddBarangay = async () => {
    if (!newBarangay.trim() || !newBarangayCode.trim()) {
      toast.warning('Enter barangay name and PIN code (e.g. 001)');
      return;
    }
    setAddingBarangay(true);
    try {
      await api.addBarangay(newBarangay.trim(), newBarangayCode.trim());
      setNewBarangay('');
      setNewBarangayCode('');
      await refresh();
      toast.success('Barangay added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add barangay');
    } finally {
      setAddingBarangay(false);
    }
  };

  const startEdit = (id: number, name: string, code?: string | null) => {
    setEditingId(id);
    setEditName(name);
    setEditCode(code || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCode('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim() || !editCode.trim()) {
      toast.warning('Name and PIN code are required');
      return;
    }
    setSavingId(id);
    try {
      await api.updateBarangay(id, { name: editName.trim(), code: editCode.trim() });
      await refresh();
      toast.success('Barangay updated');
      cancelEdit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update barangay');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!(await confirmAction(`Remove "${name}" from the barangay list?`, 'Delete barangay'))) return;
    setDeletingId(id);
    try {
      await api.deleteBarangay(id);
      await refresh();
      toast.success('Barangay deleted');
      if (editingId === id) cancelEdit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete barangay');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveLgu = async () => {
    const provinceCode = lguDraft.provinceCode.replace(/\D/g, '');
    const municipalCode = lguDraft.municipalCode.replace(/\D/g, '');
    if (provinceCode.length !== 3) {
      toast.warning('Province code must be 3 digits (e.g. 066)');
      return;
    }
    if (municipalCode.length !== 2) {
      toast.warning('Municipal code must be 2 digits (e.g. 14)');
      return;
    }
    if (!lguDraft.provinceName.trim() || !lguDraft.municipalName.trim()) {
      toast.warning('Province and municipality names are required');
      return;
    }
    setSavingLgu(true);
    try {
      await api.updateLgu({
        ...lguDraft,
        provinceCode,
        municipalCode,
        provinceName: lguDraft.provinceName.trim(),
        municipalName: lguDraft.municipalName.trim(),
      });
      await refresh();
      toast.success('LGU identity saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save LGU');
    } finally {
      setSavingLgu(false);
    }
  };

  const handleSaveKinds = async () => {
    setSavingKinds(true);
    try {
      await api.updatePropertyKinds(kindsDraft);
      await refresh();
      toast.success('Property kinds saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save kinds');
    } finally {
      setSavingKinds(false);
    }
  };

  const addKindRow = () => {
    if (!newKindCode.trim() || !newKindLabel.trim()) {
      toast.warning('Kind code and label required');
      return;
    }
    const code = newKindCode.replace(/\D/g, '').padStart(4, '0').slice(-4);
    if (kindsDraft.some((k) => k.code === code)) {
      toast.warning('Kind code already exists');
      return;
    }
    setKindsDraft([...kindsDraft, { code, label: newKindLabel.trim(), short: newKindLabel.trim() }]);
    setNewKindCode('');
    setNewKindLabel('');
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const res = await api.backup();
      toast.success(res.message);
    } catch {
      toast.error('Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const barangayCount = settings?.barangays.length ?? 0;
  const sortedBarangays = [...(settings?.barangays ?? [])].sort((a, b) =>
    String(a.code || '').localeCompare(String(b.code || '')) || a.name.localeCompare(b.name),
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div>
        <h2 className="font-semibold text-foreground text-lg" style={{ fontFamily: "'Roboto Slab', serif" }}>
          {canConfigure ? 'System Settings' : 'Reference Codes'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {canConfigure
            ? 'LGU identity, barangay PIN codes, property kinds, classifications, and backups'
            : 'View-only LGU, barangay, and kind codes for encoding (Admin/IT can edit)'}
        </p>
        {settingsError && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Could not load settings: {settingsError}. Reference lists may show defaults until refresh.
          </p>
        )}
        {!canConfigure && !settingsError && (
          <p className="mt-2 text-xs text-muted-foreground">
            You can look up codes here; editing is limited to Admin and IT.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-card rounded-xl border border-border p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Landmark size={18} className="text-primary" />
            <h3 className="font-semibold text-sm">LGU identity</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Province and municipality codes used in PIN (e.g. 066-14-001-…)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Province name</span>
              <input
                value={lguDraft.provinceName}
                readOnly={!canConfigure}
                disabled={!canConfigure}
                onChange={(e) => setLguDraft({ ...lguDraft, provinceName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background disabled:bg-secondary/40 disabled:opacity-90"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Province code</span>
              <input
                value={lguDraft.provinceCode}
                readOnly={!canConfigure}
                disabled={!canConfigure}
                onChange={(e) => setLguDraft({ ...lguDraft, provinceCode: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono disabled:bg-secondary/40 disabled:opacity-90"
                placeholder="066"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Municipality name</span>
              <input
                value={lguDraft.municipalName}
                readOnly={!canConfigure}
                disabled={!canConfigure}
                onChange={(e) => setLguDraft({ ...lguDraft, municipalName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background disabled:bg-secondary/40 disabled:opacity-90"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Municipal code</span>
              <input
                value={lguDraft.municipalCode}
                readOnly={!canConfigure}
                disabled={!canConfigure}
                onChange={(e) => setLguDraft({ ...lguDraft, municipalCode: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono disabled:bg-secondary/40 disabled:opacity-90"
                placeholder="14"
              />
            </label>
          </div>
          {canConfigure && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={savingLgu}
                onClick={() => void handleSaveLgu()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                {savingLgu ? 'Saving…' : 'Save LGU'}
              </button>
            </div>
          )}
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              <h3 className="font-semibold text-sm">Barangays</h3>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {barangayCount} listed
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Name + 3-digit PIN code (Punta Baja = 001)</p>

          <ul className="space-y-1.5 max-h-72 overflow-y-auto text-sm mb-4 pr-1">
            {sortedBarangays.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/50 border border-border/50"
              >
                {editingId === b.id ? (
                  <>
                    <input
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-16 shrink-0 px-2 py-1 border border-border rounded-md text-sm bg-background font-mono"
                      placeholder="001"
                    />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 border border-border rounded-md text-sm bg-background"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveEdit(b.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <button
                      type="button"
                      disabled={savingId === b.id || !editName.trim() || !editCode.trim()}
                      onClick={() => void handleSaveEdit(b.id)}
                      className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                      aria-label="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary"
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{b.code || '—'}</span>
                    <span className="flex-1 min-w-0 truncate">{b.name}</span>
                    {canConfigure && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(b.id, b.name, b.code)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          aria-label={`Edit ${b.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === b.id}
                          onClick={() => void handleDelete(b.id, b.name)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          aria-label={`Delete ${b.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
            {barangayCount === 0 && (
              <li className="px-3 py-6 text-center text-muted-foreground text-xs border border-dashed border-border rounded-lg">
                No barangays yet.
              </li>
            )}
          </ul>

          {canConfigure ? (
            <div className="flex gap-2">
              <input
                value={newBarangayCode}
                onChange={(e) => setNewBarangayCode(e.target.value)}
                placeholder="001"
                className="w-16 px-2 py-2 border border-border rounded-lg text-sm bg-background font-mono"
              />
              <input
                value={newBarangay}
                onChange={(e) => setNewBarangay(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleAddBarangay()}
                placeholder="Barangay name"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
              <button
                type="button"
                disabled={addingBarangay || !newBarangay.trim() || !newBarangayCode.trim()}
                onClick={() => void handleAddBarangay()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
              >
                <Plus size={14} /> {addingBarangay ? 'Adding…' : 'Add'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Codes are managed by Admin or IT.</p>
          )}
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <Hash size={18} className="text-primary" />
            <h3 className="font-semibold text-sm">Property kinds</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Kind codes start at 1001 (Building); 0001 Land is last</p>

          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Label</th>
                  {canConfigure && <th className="py-2"> </th>}
                </tr>
              </thead>
              <tbody>
                {kindsDraft.map((k, idx) => (
                  <tr key={`${k.code}-${idx}`} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      {canConfigure ? (
                        <input
                          value={k.code}
                          onChange={(e) => {
                            const next = [...kindsDraft];
                            next[idx] = { ...k, code: e.target.value };
                            setKindsDraft(next);
                          }}
                          className="w-20 px-2 py-1 border rounded-md text-sm bg-background font-mono"
                        />
                      ) : (
                        <span className="font-mono text-xs">{k.code}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {canConfigure ? (
                        <input
                          value={k.label}
                          onChange={(e) => {
                            const next = [...kindsDraft];
                            next[idx] = { ...k, label: e.target.value };
                            setKindsDraft(next);
                          }}
                          className="w-full px-2 py-1 border rounded-md text-sm bg-background"
                        />
                      ) : (
                        k.label
                      )}
                    </td>
                    {canConfigure && (
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => setKindsDraft(kindsDraft.filter((_, i) => i !== idx))}
                          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"
                          aria-label={`Remove ${k.label}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canConfigure && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  value={newKindCode}
                  onChange={(e) => setNewKindCode(e.target.value)}
                  placeholder="1001"
                  className="w-20 px-2 py-2 border border-border rounded-lg text-sm bg-background font-mono"
                />
                <input
                  value={newKindLabel}
                  onChange={(e) => setNewKindLabel(e.target.value)}
                  placeholder="Building"
                  className="flex-1 min-w-[120px] px-3 py-2 border border-border rounded-lg text-sm bg-background"
                />
                <button
                  type="button"
                  onClick={addKindRow}
                  className="px-3 py-2 border border-border rounded-lg text-sm flex items-center gap-1"
                >
                  <Plus size={14} /> Add row
                </button>
              </div>
              <button
                type="button"
                disabled={savingKinds || !kindsDraft.length}
                onClick={() => void handleSaveKinds()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                {savingKinds ? 'Saving…' : 'Save kinds'}
              </button>
            </div>
          )}
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-primary" />
            <h3 className="font-semibold text-sm">Classifications (SMV categories)</h3>
          </div>
          <ul className="flex flex-wrap gap-2 mb-3">
            {settings?.classifications.map((c) => (
              <span
                key={c.id}
                className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-medium border border-blue-100"
              >
                {c.name}
              </span>
            ))}
          </ul>
          {canConfigure && (
            <div className="flex gap-2">
              <input
                value={newClass}
                onChange={(e) => setNewClass(e.target.value)}
                placeholder="New classification e.g. RES'L"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background"
                onKeyDown={(e) => e.key === 'Enter' && void handleAddClass()}
              />
              <button
                type="button"
                disabled={!newClass.trim()}
                onClick={() => void handleAddClass()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </section>

        <section className="bg-card rounded-xl border border-border p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={18} className="text-primary" />
            <h3 className="font-semibold text-sm">Assessment Levels (Schedule rates)</h3>
          </div>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Rate %</th>
                  {canConfigure && <th className="py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {settings?.assessmentLevels.map((a) => (
                  <tr key={a.id} className="border-b border-border/50">
                    {editingLevelId === a.id ? (
                      <>
                        <td className="py-2 pr-4">
                          <input
                            value={editLevelName}
                            onChange={(e) => setEditLevelName(e.target.value)}
                            className="w-full px-2 py-1 border rounded-md text-sm bg-background"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            value={editLevelRate}
                            onChange={(e) => setEditLevelRate(e.target.value)}
                            className="w-24 px-2 py-1 border rounded-md text-sm bg-background"
                          />
                        </td>
                        <td className="py-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => void saveLevel(a.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLevelId(null)}
                            className="p-1.5 text-muted-foreground hover:bg-secondary rounded"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-4">{a.name}</td>
                        <td className="py-2 pr-4">{(a.rate * 100).toFixed(0)}%</td>
                        {canConfigure && (
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLevelId(a.id);
                                setEditLevelName(a.name);
                                setEditLevelRate(String(Math.round(a.rate * 100)));
                              }}
                              className="p-1.5 text-muted-foreground hover:bg-secondary rounded"
                              aria-label={`Edit ${a.name}`}
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canConfigure && (
            <div className="flex flex-wrap gap-2">
              <input
                value={newLevelName}
                onChange={(e) => setNewLevelName(e.target.value)}
                placeholder="Level name e.g. Residential"
                className="flex-1 min-w-[140px] px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
              <input
                type="number"
                value={newLevelRate}
                onChange={(e) => setNewLevelRate(e.target.value)}
                placeholder="Rate %"
                className="w-24 px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
              <button
                type="button"
                disabled={!newLevelName.trim() || !newLevelRate}
                onClick={() => void handleAddLevel()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
              >
                <Plus size={14} /> Add level
              </button>
            </div>
          )}
        </section>

        {canBackup && (
          <section className="bg-card rounded-xl border border-border p-5 md:col-span-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-purple-600" />
                <div>
                  <h3 className="font-semibold text-sm">Database Backup</h3>
                  <p className="text-xs text-muted-foreground">PostgreSQL database: propvault (local)</p>
                </div>
              </div>
              <button
                type="button"
                disabled={backingUp}
                onClick={() => void handleBackup()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-60"
              >
                <Download size={14} />
                {backingUp ? 'Backing up…' : 'Run Backup'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
