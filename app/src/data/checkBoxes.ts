import type { ValidationCheck } from "./types";

/** Validation check boxes [lon0, lat0, lon1, lat1]; mirrors CHECKS in pipeline/validate.py. */
export const CHECK_BOXES: Record<string, NonNullable<ValidationCheck["bbox"]>> = {
  "McMurdo Dry Valleys": [160.5, -78.0, 163.0, -77.2],
  "Haughton Crater (Devon Island)": [-91.0, 74.9, -88.0, 76.0],
  "Alaska North Slope": [-160.0, 69.0, -145.0, 71.0],
};
