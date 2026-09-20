import {
  Pencil,
  Pentagon,
  Compass,
  Merge,
  Split,
  Upload,
  Ruler,
  MousePointer,
  Save,
  Trash2,
} from 'lucide-react';

export type CadastralTool =
  | 'select'
  | 'draw'
  | 'edit'
  | 'measure'
  | 'bearings'
  | 'merge'
  | 'split'
  | 'import'
  | 'survey';

interface Props {
  active: CadastralTool;
  onChange: (tool: CadastralTool) => void;
  onSave: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

const TOOLS: { id: CadastralTool; icon: typeof Pencil; label: string; editOnly?: boolean }[] = [
  { id: 'select', icon: MousePointer, label: 'Select' },
  { id: 'draw', icon: Pentagon, label: 'Trace parcel', editOnly: true },
  { id: 'edit', icon: Pencil, label: 'Edit vertices', editOnly: true },
  { id: 'measure', icon: Ruler, label: 'Measure' },
  { id: 'bearings', icon: Compass, label: 'Bearings & distances', editOnly: true },
  { id: 'merge', icon: Merge, label: 'Merge', editOnly: true },
  { id: 'split', icon: Split, label: 'Split', editOnly: true },
  { id: 'import', icon: Upload, label: 'Import', editOnly: true },
  { id: 'survey', icon: Upload, label: 'Survey plan', editOnly: true },
];

export function DigitizeToolbar({ active, onChange, onSave, onDelete, canEdit }: Props) {
  return (
    <div className="absolute left-3 top-3 z-[1500] flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
      {TOOLS.filter((t) => canEdit || !t.editOnly).map((tool) => {
        const Icon = tool.icon;
        const isActive = active === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            title={tool.label}
            onClick={() => onChange(tool.id)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              isActive ? 'bg-brand-navy text-brand-gold' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
      {canEdit && (
        <>
          <hr className="my-1 border-gray-100" />
          <button
            type="button"
            title="Save parcel"
            onClick={onSave}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
          >
            <Save className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Delete selected"
            onClick={onDelete}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
