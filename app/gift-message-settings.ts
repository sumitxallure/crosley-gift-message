export const GIFT_MESSAGE_SETTINGS_KEY = "gift_message_settings";
export const MIN_MESSAGE_LENGTH = 50;
export const MAX_MESSAGE_LENGTH = 500;

export type GiftMessageSettings = {
  enabled: boolean;
  heading: string;
  description: string;
  maxLength: number;
  required: boolean;
};

export type GiftMessageSettingsInput = {
  enabled: boolean;
  heading: string;
  description: string;
  maxLength: string | number;
  required: boolean;
};

export type GiftMessageSettingsErrors = Partial<
  Record<"heading" | "description" | "maxLength" | "form", string>
>;

export const DEFAULT_GIFT_MESSAGE_SETTINGS: GiftMessageSettings = {
  enabled: true,
  heading: "Add a gift message",
  description: "Write a short message to include with this order.",
  maxLength: 250,
  required: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGiftMessageSettings(value: unknown): GiftMessageSettings {
  let candidate = value;

  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return DEFAULT_GIFT_MESSAGE_SETTINGS;
    }
  }

  if (!isRecord(candidate)) return DEFAULT_GIFT_MESSAGE_SETTINGS;

  const heading =
    typeof candidate.heading === "string" && candidate.heading.trim()
      ? candidate.heading.trim()
      : DEFAULT_GIFT_MESSAGE_SETTINGS.heading;
  const description =
    typeof candidate.description === "string"
      ? candidate.description.trim()
      : DEFAULT_GIFT_MESSAGE_SETTINGS.description;
  const maxLength = Number(candidate.maxLength);

  return {
    enabled:
      typeof candidate.enabled === "boolean"
        ? candidate.enabled
        : DEFAULT_GIFT_MESSAGE_SETTINGS.enabled,
    heading,
    description,
    maxLength:
      Number.isInteger(maxLength) &&
      maxLength >= MIN_MESSAGE_LENGTH &&
      maxLength <= MAX_MESSAGE_LENGTH
        ? maxLength
        : DEFAULT_GIFT_MESSAGE_SETTINGS.maxLength,
    required:
      typeof candidate.required === "boolean"
        ? candidate.required
        : DEFAULT_GIFT_MESSAGE_SETTINGS.required,
  };
}

export function validateGiftMessageSettings(input: GiftMessageSettingsInput): {
  settings: GiftMessageSettings | null;
  errors: GiftMessageSettingsErrors;
} {
  const heading = input.heading.trim();
  const description = input.description.trim();
  const maxLength = Number(input.maxLength);
  const errors: GiftMessageSettingsErrors = {};

  if (!heading) {
    errors.heading = "Enter a heading.";
  } else if (heading.length > 60) {
    errors.heading = "Use 60 characters or fewer.";
  }

  if (description.length > 160) {
    errors.description = "Use 160 characters or fewer.";
  }

  if (
    !Number.isInteger(maxLength) ||
    maxLength < MIN_MESSAGE_LENGTH ||
    maxLength > MAX_MESSAGE_LENGTH
  ) {
    errors.maxLength = `Enter a whole number from ${MIN_MESSAGE_LENGTH} to ${MAX_MESSAGE_LENGTH}.`;
  }

  if (Object.keys(errors).length > 0) {
    return { settings: null, errors };
  }

  return {
    settings: {
      enabled: input.enabled,
      heading,
      description,
      maxLength,
      required: input.required,
    },
    errors,
  };
}
