export type BootState = {
  migrationDirs: string[];
  applied: string[];
  hasFailed: boolean;
  storedHash: string | null;
  currentHash: string;
};
export type BootPlan = { migrate: boolean; constraints: boolean; reason: string };
export function planBoot(state: BootState): BootPlan;
