import { Loader2, Save, Target, Weight } from "lucide-react";
import { useEffect, useState } from "react";
import type { ClientPlanDTO } from "../../../shared/types";
import { cn } from "../../lib/utils";

const FIELDS = [
  { key: "heightCm", label: "الطول (سم)", type: "number" },
  { key: "startWeight", label: "وزن البداية (كجم)", type: "number" },
  { key: "currentWeight", label: "الوزن الحالي (كجم)", type: "number" },
  { key: "targetWeight", label: "الوزن المستهدف (كجم)", type: "number" },
  { key: "calories", label: "السعرات اليومية", type: "number" },
  { key: "protein", label: "بروتين (جم)", type: "number" },
  { key: "carbs", label: "كارب (جم)", type: "number" },
  { key: "fat", label: "دهون (جم)", type: "number" },
] as const;

type NumericKey = (typeof FIELDS)[number]["key"];

type PlanState = Record<NumericKey, string> & { goal: string; medicalNotes: string; notes: string };

const fromPlan = (plan: ClientPlanDTO | null): PlanState => ({
  heightCm: plan?.heightCm != null ? String(plan.heightCm) : "",
  startWeight: plan?.startWeight != null ? String(plan.startWeight) : "",
  currentWeight: plan?.currentWeight != null ? String(plan.currentWeight) : "",
  targetWeight: plan?.targetWeight != null ? String(plan.targetWeight) : "",
  calories: plan?.calories != null ? String(plan.calories) : "",
  protein: plan?.protein != null ? String(plan.protein) : "",
  carbs: plan?.carbs != null ? String(plan.carbs) : "",
  fat: plan?.fat != null ? String(plan.fat) : "",
  goal: plan?.goal ?? "",
  medicalNotes: plan?.medicalNotes ?? "",
  notes: plan?.notes ?? "",
});

interface PlanPanelProps {
  plan: ClientPlanDTO | null;
  editable?: boolean;
  saving?: boolean;
  onSave?: (plan: Omit<ClientPlanDTO, "updatedAt">) => Promise<void> | void;
  className?: string;
}

/**
 * The doctor's targets for one client. The client sees the numbers read-only;
 * the doctor (or an assistant) edits them from the customer file.
 */
export function PlanPanel({ plan, editable = false, saving = false, onSave, className }: PlanPanelProps) {
  const [state, setState] = useState<PlanState>(() => fromPlan(plan));

  useEffect(() => {
    setState(fromPlan(plan));
  }, [plan]);

  const numberKeys = FIELDS.map((field) => field.key);
  const filled = numberKeys.filter((key) => state[key] !== "").length;

  if (!editable && !plan) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-white/10 p-6 text-center", className)}>
        <Target className="mx-auto size-6 text-cream/25" aria-hidden />
        <p className="mt-3 text-[11px] text-cream/40">
          الدكتور لسه مضبطش أهدافك. أول ما يحدد السعرات والوزن المستهدف هيظهروا هنا.
        </p>
      </div>
    );
  }

  const submit = async () => {
    if (!onSave) return;
    await onSave({
      heightCm: state.heightCm === "" ? null : Number(state.heightCm),
      startWeight: state.startWeight === "" ? null : Number(state.startWeight),
      currentWeight: state.currentWeight === "" ? null : Number(state.currentWeight),
      targetWeight: state.targetWeight === "" ? null : Number(state.targetWeight),
      calories: state.calories === "" ? null : Number(state.calories),
      protein: state.protein === "" ? null : Number(state.protein),
      carbs: state.carbs === "" ? null : Number(state.carbs),
      fat: state.fat === "" ? null : Number(state.fat),
      goal: state.goal,
      medicalNotes: state.medicalNotes,
      notes: state.notes,
    });
  };

  if (!editable) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "الوزن الحالي", value: plan?.currentWeight ? `${plan.currentWeight} كجم` : "—" },
            { label: "المستهدف", value: plan?.targetWeight ? `${plan.targetWeight} كجم` : "—" },
            { label: "السعرات", value: plan?.calories ? `${plan.calories}` : "—" },
            { label: "البروتين", value: plan?.protein ? `${plan.protein} جم` : "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] text-cream/35">{item.label}</p>
              <p className="mt-1 text-sm font-bold text-lemon">{item.value}</p>
            </div>
          ))}
        </div>
        {(plan?.carbs || plan?.fat) && (
          <p className="text-[10px] text-cream/40">
            الكارب: {plan?.carbs ?? "—"} جم · الدهون: {plan?.fat ?? "—"} جم
          </p>
        )}
        {plan?.goal && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-[10px] font-bold text-cream/35">الهدف</p>
            <p className="mt-1 text-[11px] leading-relaxed text-cream/70">{plan.goal}</p>
          </div>
        )}
        {plan?.notes && (
          <div className="rounded-xl border border-lemon/20 bg-lemon/[0.05] p-3">
            <p className="text-[10px] font-bold text-lemon/70">تعليمات الدكتور</p>
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-cream/75">{plan.notes}</p>
          </div>
        )}
        {plan?.medicalNotes && (
          <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3">
            <p className="text-[10px] font-bold text-amber-200/80">ملاحظات طبية</p>
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-cream/70">{plan.medicalNotes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-[10px] text-cream/40">{field.label}</span>
            <input
              className="field mt-1 py-2 text-[11px]"
              type="number"
              inputMode="decimal"
              value={state[field.key]}
              onChange={(event) => setState((prev) => ({ ...prev, [field.key]: event.target.value }))}
              dir="ltr"
            />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="text-[10px] text-cream/40">الهدف</span>
        <input
          className="field mt-1 py-2 text-[11px]"
          value={state.goal}
          onChange={(event) => setState((prev) => ({ ...prev, goal: event.target.value }))}
          placeholder="مثال: خسارة ٨ كيلو في ٣ شهور"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] text-cream/40">تعليمات / خطة</span>
          <textarea
            className="field mt-1 min-h-20 resize-y text-[11px]"
            value={state.notes}
            onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-cream/40">ملاحظات طبية</span>
          <textarea
            className="field mt-1 min-h-20 resize-y text-[11px]"
            value={state.medicalNotes}
            onChange={(event) => setState((prev) => ({ ...prev, medicalNotes: event.target.value }))}
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-[10px] text-cream/30">
          <Weight className="size-3" aria-hidden /> {filled} من {FIELDS.length} أرقام متسجلة
        </p>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-[11px] font-bold text-ink disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
          حفظ الخطة
        </button>
      </div>
    </div>
  );
}
