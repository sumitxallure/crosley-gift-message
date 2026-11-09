import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GIFT_MESSAGE_SETTINGS,
  parseGiftMessageSettings,
  validateGiftMessageSettings,
} from "./gift-message-settings.ts";

test("uses defaults when no settings have been stored", () => {
  assert.deepEqual(
    parseGiftMessageSettings(null),
    DEFAULT_GIFT_MESSAGE_SETTINGS,
  );
});

test("parses a stored JSON settings value", () => {
  assert.deepEqual(
    parseGiftMessageSettings(
      JSON.stringify({
        enabled: false,
        heading: "Gift note",
        description: "Add a note for the recipient.",
        maxLength: 180,
        required: true,
      }),
    ),
    {
      enabled: false,
      heading: "Gift note",
      description: "Add a note for the recipient.",
      maxLength: 180,
      required: true,
    },
  );
});

test("rejects invalid merchant input", () => {
  const result = validateGiftMessageSettings({
    enabled: true,
    heading: "",
    description: "x".repeat(161),
    maxLength: "12.5",
    required: false,
  });

  assert.equal(result.settings, null);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    "description",
    "heading",
    "maxLength",
  ]);
});

test("normalizes valid merchant input", () => {
  const result = validateGiftMessageSettings({
    enabled: true,
    heading: "  Add a personal note  ",
    description: "  Printed with the order.  ",
    maxLength: "300",
    required: true,
  });

  assert.deepEqual(result.settings, {
    enabled: true,
    heading: "Add a personal note",
    description: "Printed with the order.",
    maxLength: 300,
    required: true,
  });
  assert.deepEqual(result.errors, {});
});
