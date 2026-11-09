import "@shopify/ui-extensions/preact";
import { useBuyerJourneyIntercept } from "@shopify/ui-extensions/checkout/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

const METAFIELD_NAMESPACE = "$app";
const MESSAGE_KEY = "gift_message";
const SETTINGS_KEY = "gift_message_settings";
const DEFAULT_SETTINGS = {
  enabled: true,
  heading: "Add a gift message",
  description: "Write a short message to include with this order.",
  maxLength: 250,
  required: false,
};

export default async () => {
  render(<Extension />, document.body);
};

function parseSettings(value) {
  if (!value) return DEFAULT_SETTINGS;

  try {
    const candidate = JSON.parse(value);
    const maxLength = Number(candidate.maxLength);

    return {
      enabled:
        typeof candidate.enabled === "boolean"
          ? candidate.enabled
          : DEFAULT_SETTINGS.enabled,
      heading:
        typeof candidate.heading === "string" && candidate.heading.trim()
          ? candidate.heading.trim()
          : DEFAULT_SETTINGS.heading,
      description:
        typeof candidate.description === "string"
          ? candidate.description.trim()
          : DEFAULT_SETTINGS.description,
      maxLength:
        Number.isInteger(maxLength) && maxLength >= 50 && maxLength <= 500
          ? maxLength
          : DEFAULT_SETTINGS.maxLength,
      required:
        typeof candidate.required === "boolean"
          ? candidate.required
          : DEFAULT_SETTINGS.required,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function Extension() {
  const { applyMetafieldChange, appMetafields, i18n, instructions } = shopify;
  const messageMetafield = appMetafields.value.find(
    (entry) =>
      entry.target.type === "cart" &&
      entry.metafield.namespace === METAFIELD_NAMESPACE &&
      entry.metafield.key === MESSAGE_KEY,
  );
  const settingsMetafield = appMetafields.value.find(
    (entry) =>
      entry.target.type === "shop" &&
      entry.metafield.namespace === METAFIELD_NAMESPACE &&
      entry.metafield.key === SETTINGS_KEY,
  );
  const settings = parseSettings(settingsMetafield?.metafield.value);
  const savedMessage = messageMetafield?.metafield.value ?? "";
  const [message, setMessage] = useState(savedMessage);
  const [saveState, setSaveState] = useState("idle");
  const [showRequiredError, setShowRequiredError] = useState(false);

  useEffect(() => {
    setMessage(savedMessage);
  }, [savedMessage]);

  useBuyerJourneyIntercept(async ({ canBlockProgress }) => {
    if (!settings.enabled) return { behavior: "allow" };

    const nextMessage = message.trim();

    if (settings.required && !nextMessage) {
      return canBlockProgress
        ? {
            behavior: "block",
            reason: "A gift message is required",
            errors: [{ message: i18n.translate("requiredError") }],
            perform: (result) =>
              setShowRequiredError(result.behavior === "block"),
          }
        : { behavior: "allow" };
    }

    if (nextMessage !== savedMessage) {
      const saved = await persistGiftMessage(nextMessage);

      if (!saved && canBlockProgress) {
        return {
          behavior: "block",
          reason: "The gift message could not be saved",
          errors: [{ message: i18n.translate("saveError") }],
        };
      }
    }

    return {
      behavior: "allow",
      perform: () => setShowRequiredError(false),
    };
  });

  if (!settings.enabled) return null;

  if (!instructions.value.metafields.canSetCartMetafields) {
    return (
      <s-banner heading={settings.heading} tone="warning">
        {i18n.translate("metafieldChangesAreNotSupported")}
      </s-banner>
    );
  }

  return (
    <s-section heading={settings.heading}>
      <s-stack gap="base">
        {settings.description && <s-text>{settings.description}</s-text>}
        <s-text-area
          label={
            settings.required
              ? i18n.translate("requiredLabel")
              : i18n.translate("label")
          }
          value={message}
          rows={3}
          maxLength={settings.maxLength}
          required={settings.required}
          error={
            showRequiredError ? i18n.translate("requiredError") : undefined
          }
          onInput={(event) => {
            const nextMessage = event.currentTarget.value ?? "";

            setMessage(nextMessage);
            setSaveState("idle");
            if (nextMessage.trim()) setShowRequiredError(false);
          }}
          onBlur={(event) =>
            persistGiftMessage((event.currentTarget.value ?? "").trim())
          }
        />
        {saveState === "saved" && <s-text>{i18n.translate("saved")}</s-text>}
        {saveState === "error" && (
          <s-banner tone="critical">{i18n.translate("saveError")}</s-banner>
        )}
      </s-stack>
    </s-section>
  );

  async function persistGiftMessage(nextMessage) {
    setMessage(nextMessage);

    if (nextMessage === savedMessage) return true;

    setSaveState("saving");
    const result = nextMessage
      ? await applyMetafieldChange({
          type: "updateCartMetafield",
          metafield: {
            namespace: METAFIELD_NAMESPACE,
            key: MESSAGE_KEY,
            value: nextMessage,
            type: "multi_line_text_field",
          },
        })
      : await applyMetafieldChange({
          type: "removeCartMetafield",
          namespace: METAFIELD_NAMESPACE,
          key: MESSAGE_KEY,
        });

    if (result.type === "error") {
      console.error("Unable to save the gift message:", result.message);
      setSaveState("error");
      return false;
    }

    setSaveState("saved");
    return true;
  }
}
