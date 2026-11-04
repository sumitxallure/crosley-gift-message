import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "gift_message";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const { applyMetafieldChange, appMetafields, i18n, instructions } = shopify;
  const giftMessageMetafield = appMetafields.value.find(
    (entry) =>
      entry.target.type === "cart" &&
      entry.metafield.namespace === METAFIELD_NAMESPACE &&
      entry.metafield.key === METAFIELD_KEY,
  );
  const savedMessage = giftMessageMetafield?.metafield.value ?? "";
  const [message, setMessage] = useState(savedMessage);
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    setMessage(savedMessage);
  }, [savedMessage]);

  if (!instructions.value.metafields.canSetCartMetafields) {
    return (
      <s-banner heading={i18n.translate("heading")} tone="warning">
        {i18n.translate("metafieldChangesAreNotSupported")}
      </s-banner>
    );
  }

  return (
    <s-section heading={i18n.translate("heading")}>
      <s-stack gap="base">
        <s-text>{i18n.translate("description")}</s-text>
        <s-text-area
          label={i18n.translate("label")}
          value={message}
          rows={3}
          maxLength={250}
          onInput={(event) => {
            setMessage(event.currentTarget.value);
            setSaveState("idle");
          }}
          onBlur={saveGiftMessage}
        />
        {saveState === "saved" && <s-text>{i18n.translate("saved")}</s-text>}
        {saveState === "error" && (
          <s-banner tone="critical">{i18n.translate("saveError")}</s-banner>
        )}
      </s-stack>
    </s-section>
  );

  async function saveGiftMessage(event) {
    const nextMessage = event.currentTarget.value.trim();
    setMessage(nextMessage);

    if (nextMessage === savedMessage) return;

    setSaveState("saving");
    const change = nextMessage
      ? {
          type: "updateCartMetafield",
          metafield: {
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            value: nextMessage,
            type: "multi_line_text_field",
          },
        }
      : {
          type: "removeCartMetafield",
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
        };

    const result = await applyMetafieldChange(change);

    if (result.type === "error") {
      console.error("Unable to save the gift message:", result.message);
      setSaveState("error");
      return;
    }

    setSaveState("saved");
  }
}
