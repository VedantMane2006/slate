export const CURRENT_EXPERIMENT_CONFIG = {
  configId: 'default',
  promptVersion: '1.0.0'
};

/**
 * When set to a number (e.g. 1024), composeMultimodalRequest will use this
 * fixed resolution instead of calling chooseResolution's adaptive logic.
 * Set to null for normal adaptive behavior.
 *
 * This is a mutable override used only by the experiment runner for A/B comparison.
 */
export let FORCE_FIXED_RESOLUTION: number | null = null;

export function setForceFixedResolution(value: number | null): void {
  FORCE_FIXED_RESOLUTION = value;
}
