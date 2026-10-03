/** A reviewed real-French calibration artifact is required before activation.
 * No approved evidence has been supplied; do not manufacture it from unit cases. */
export interface CanDoCalibration {
  revision: string;
  model: 'jev-1.13.0';
  threshold: 0.8;
  humanApproved: true;
  task: 'can-do-evidence';
}
export function approvedCanDoCalibration(): CanDoCalibration | null { return null; }
