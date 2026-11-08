export type Gender = "male" | "female";
export type Goal = "lose" | "maintain" | "gain";

export interface CalcInput {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  activity: number;
  goal: Goal;
}

export type BmiKey = "under" | "normal" | "over" | "obese";

export interface CalcResult {
  bmi: number;
  bmiKey: BmiKey;
  bmr: number;
  tdee: number;
  target: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  idealMin: number;
  idealMax: number;
}

export const calculate = (input: CalcInput): CalcResult => {
  const { gender, age, height, weight, activity, goal } = input;

  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === "male" ? 5 : -161);
  const tdee = bmr * activity;
  const target = goal === "lose" ? tdee * 0.8 : goal === "gain" ? tdee * 1.1 : tdee;

  const proteinPerKg = goal === "lose" ? 2 : goal === "gain" ? 1.8 : 1.6;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((target * 0.25) / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));

  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);

  const bmiKey: BmiKey = bmi < 18.5 ? "under" : bmi < 25 ? "normal" : bmi < 30 ? "over" : "obese";

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmiKey,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    protein,
    carbs,
    fat,
    water: Math.round(weight * 0.035 * 10) / 10,
    idealMin: Math.round(18.5 * heightM * heightM),
    idealMax: Math.round(24.9 * heightM * heightM),
  };
};

export const inRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;
