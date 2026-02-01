export interface UserInputs {
  // Body stats
  age: number;
  sex: 'male' | 'female';
  height: number; // cm
  weight: number; // kg
  targetWeight: number; // kg
  weeks: number;
  
  // Fitness
  trainingLevel: 'beginner' | 'intermediate' | 'advanced';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  cardioExperience: 'none' | 'some' | 'experienced';
  
  // Logistics
  cardioModalities: string[];
  gymAccess: boolean;
  daysPerWeek: number;
  minutesPerSession: number;
  
  // Constraints
  injuries: string;
  medical: string;
  dietary: string;
}

export interface Calculations {
  bmr: number;
  tdee: number;
  dailyCalories: number;
  deficit: number;
  deficitPercent: number;
  protein: number;
  fat: number;
  carbs: number;
  weeklyLoss: number;
  totalLoss: number;
  warning: string | null;
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculate(inputs: UserInputs): Calculations {
  // Mifflin-St Jeor BMR
  const bmr = inputs.sex === 'male'
    ? (10 * inputs.weight) + (6.25 * inputs.height) - (5 * inputs.age) + 5
    : (10 * inputs.weight) + (6.25 * inputs.height) - (5 * inputs.age) - 161;
  
  // TDEE
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[inputs.activityLevel]);
  
  // Weight loss calculations
  const totalLoss = inputs.weight - inputs.targetWeight;
  const weeklyLoss = totalLoss / inputs.weeks;
  
  // Deficit calculation (7700 kcal per kg of fat)
  let dailyDeficit = (weeklyLoss * 7700) / 7;
  let warning: string | null = null;
  
  // Safety caps
  const maxDeficit = tdee * 0.25; // Max 25% deficit
  const absoluteMaxDeficit = 1000; // Never more than 1000 kcal
  
  if (dailyDeficit > absoluteMaxDeficit) {
    warning = `Your goal requires losing ${weeklyLoss.toFixed(1)}kg/week, which is too aggressive. I've adjusted to a safer ~0.75kg/week target. Sustainable progress beats fast burnout.`;
    dailyDeficit = 750;
  } else if (dailyDeficit > maxDeficit) {
    warning = `Your goal is ambitious. I've capped the deficit at 25% of your TDEE to protect muscle and energy levels.`;
    dailyDeficit = maxDeficit;
  }
  
  const dailyCalories = Math.round(tdee - dailyDeficit);
  
  // Minimum floor
  const minCalories = inputs.sex === 'male' ? 1500 : 1200;
  const finalCalories = Math.max(dailyCalories, minCalories);
  
  if (finalCalories > dailyCalories) {
    warning = `To keep you healthy and energized, I've set a minimum of ${minCalories} kcal/day. Going lower risks muscle loss and metabolic adaptation.`;
  }
  
  // Macros
  const protein = Math.round(inputs.targetWeight * 2); // 2g per kg target weight
  const fat = Math.round(inputs.weight * 0.8); // 0.8g per kg current weight
  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const carbCals = finalCalories - proteinCals - fatCals;
  const carbs = Math.max(Math.round(carbCals / 4), 50); // Min 50g carbs
  
  return {
    bmr: Math.round(bmr),
    tdee,
    dailyCalories: finalCalories,
    deficit: Math.round(tdee - finalCalories),
    deficitPercent: Math.round(((tdee - finalCalories) / tdee) * 100),
    protein,
    fat,
    carbs,
    weeklyLoss: (tdee - finalCalories) * 7 / 7700,
    totalLoss,
    warning,
  };
}

export function formatInputsForPrompt(inputs: UserInputs, calcs: Calculations): string {
  return `
USER PROFILE:
- ${inputs.age}yo ${inputs.sex}, ${inputs.height}cm, ${inputs.weight}kg → ${inputs.targetWeight}kg goal
- Timeline: ${inputs.weeks} weeks
- Training: ${inputs.trainingLevel}, Activity: ${inputs.activityLevel}
- Cardio experience: ${inputs.cardioExperience}
- Available cardio: ${inputs.cardioModalities.join(', ')}
- Gym access: ${inputs.gymAccess ? 'Yes' : 'No'}
- Schedule: ${inputs.daysPerWeek} days/week, ${inputs.minutesPerSession} min/session
- Injuries: ${inputs.injuries || 'None'}
- Medical: ${inputs.medical || 'None'}
- Dietary: ${inputs.dietary || 'None'}

PRE-CALCULATED (use these exact numbers):
- BMR: ${calcs.bmr} kcal
- TDEE: ${calcs.tdee} kcal
- Daily target: ${calcs.dailyCalories} kcal (${calcs.deficitPercent}% deficit)
- Macros: ${calcs.protein}g protein, ${calcs.carbs}g carbs, ${calcs.fat}g fat
- Expected loss: ~${calcs.weeklyLoss.toFixed(2)}kg/week

${calcs.warning ? `⚠️ SAFETY NOTE: ${calcs.warning}` : ''}
`.trim();
}
