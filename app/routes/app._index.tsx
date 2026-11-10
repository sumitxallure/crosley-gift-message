import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  DEFAULT_GIFT_MESSAGE_SETTINGS,
  GIFT_MESSAGE_SETTINGS_KEY,
  GIFT_MESSAGE_VALIDATION_ID_KEY,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
  parseGiftMessageSettings,
  validateGiftMessageSettings,
  type GiftMessageSettings,
  type GiftMessageSettingsErrors,
} from "../gift-message-settings";
import { syncGiftMessageValidation } from "../gift-message-validation.server";
import { authenticate } from "../shopify.server";

const SETTINGS_QUERY = `#graphql
  query GiftMessageSettings {
    shop {
      id
      giftMessageSettings: metafield(
        namespace: "$app"
        key: "gift_message_settings"
      ) {
        jsonValue
      }
      giftMessageValidationId: metafield(
        namespace: "$app"
        key: "gift_message_validation_id"
      ) {
        value
      }
    }
  }
`;

const SAVE_SETTINGS_MUTATION = `#graphql
  mutation SaveGiftMessageSettings($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        key
        jsonValue
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(SETTINGS_QUERY);
  const responseJson = await response.json();

  return {
    settings: parseGiftMessageSettings(
      responseJson.data?.shop?.giftMessageSettings?.jsonValue,
    ),
  };
};

type ActionData = {
  saved: boolean;
  settings: GiftMessageSettings | null;
  errors: GiftMessageSettingsErrors;
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const validation = validateGiftMessageSettings({
    enabled: formData.get("enabled") === "true",
    heading: String(formData.get("heading") ?? ""),
    description: String(formData.get("description") ?? ""),
    maxLength: String(formData.get("maxLength") ?? ""),
    required: formData.get("required") === "true",
  });

  if (!validation.settings) {
    return { saved: false, settings: null, errors: validation.errors };
  }

  const shopResponse = await admin.graphql(SETTINGS_QUERY);
  const shopResponseJson = await shopResponse.json();
  const shopId = shopResponseJson.data?.shop?.id;

  if (!shopId) {
    return {
      saved: false,
      settings: null,
      errors: { form: "Shopify could not identify this store. Try again." },
    };
  }

  let validationId: string;
  try {
    validationId = await syncGiftMessageValidation(
      admin,
      validation.settings,
      shopResponseJson.data?.shop?.giftMessageValidationId?.value,
    );
  } catch (error) {
    return {
      saved: false,
      settings: null,
      errors: {
        form:
          error instanceof Error
            ? error.message
            : "Shopify could not update the checkout validation.",
      },
    };
  }

  const saveResponse = await admin.graphql(SAVE_SETTINGS_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          key: GIFT_MESSAGE_SETTINGS_KEY,
          type: "json",
          value: JSON.stringify(validation.settings),
        },
        {
          ownerId: shopId,
          key: GIFT_MESSAGE_VALIDATION_ID_KEY,
          type: "single_line_text_field",
          value: validationId,
        },
      ],
    },
  });
  const saveResponseJson = await saveResponse.json();
  const userErrors = saveResponseJson.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    return {
      saved: false,
      settings: null,
      errors: {
        form: userErrors
          .map((error: { message: string }) => error.message)
          .join(" "),
      },
    };
  }

  return { saved: true, settings: validation.settings, errors: {} };
};

function toFormState(settings: GiftMessageSettings) {
  return { ...settings, maxLength: String(settings.maxLength) };
}

export default function Index() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const shopify = useAppBridge();
  const [form, setForm] = useState(() => toFormState(settings));
  const errors = fetcher.data?.errors ?? {};
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    setForm(toFormState(settings));
  }, [settings]);

  useEffect(() => {
    if (fetcher.data?.saved && fetcher.state === "idle") {
      shopify.toast.show("Gift message settings saved");
    }
  }, [fetcher.data, fetcher.state, shopify]);

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="enabled" value={String(form.enabled)} />
      <input type="hidden" name="required" value={String(form.required)} />

      <s-page heading="Gift message">
        <s-button
          slot="primary-action"
          type="submit"
          variant="primary"
          {...(isSaving ? { loading: true } : {})}
        >
          Save
        </s-button>

        {errors.form && (
          <s-banner heading="Settings could not be saved" tone="critical">
            {errors.form}
          </s-banner>
        )}

        <s-section heading="Checkout field">
          <s-stack direction="block" gap="base">
            <s-checkbox
              label="Enable gift messages"
              details="Show the gift-message field in checkout."
              checked={form.enabled}
              onChange={(event) => {
                const enabled = event.currentTarget.checked ?? false;
                setForm((current) => ({
                  ...current,
                  enabled,
                }));
              }}
            />

            <s-text-field
              label="Heading"
              name="heading"
              value={form.heading}
              maxLength={60}
              error={errors.heading}
              onInput={(event) => {
                const heading = event.currentTarget.value ?? "";
                setForm((current) => ({
                  ...current,
                  heading,
                }));
              }}
              required
            />

            <s-text-area
              label="Description"
              name="description"
              value={form.description}
              rows={3}
              maxLength={160}
              error={errors.description}
              onInput={(event) => {
                const description = event.currentTarget.value ?? "";
                setForm((current) => ({
                  ...current,
                  description,
                }));
              }}
            />

            <s-number-field
              label="Maximum characters"
              name="maxLength"
              value={form.maxLength}
              min={MIN_MESSAGE_LENGTH}
              max={MAX_MESSAGE_LENGTH}
              step={1}
              inputMode="numeric"
              error={errors.maxLength}
              onInput={(event) => {
                const maxLength = event.currentTarget.value ?? "";
                setForm((current) => ({
                  ...current,
                  maxLength,
                }));
              }}
              required
            />

            <s-checkbox
              label="Require a gift message"
              details="Prevent checkout from continuing until a message is entered."
              checked={form.required}
              disabled={!form.enabled}
              onChange={(event) => {
                const required = event.currentTarget.checked ?? false;
                setForm((current) => ({
                  ...current,
                  required,
                }));
              }}
            />
          </s-stack>
        </s-section>

        <s-section heading="Checkout preview">
          {form.enabled ? (
            <s-stack direction="block" gap="base">
              <s-heading>
                {form.heading || DEFAULT_GIFT_MESSAGE_SETTINGS.heading}
                {form.required ? " *" : ""}
              </s-heading>
              {form.description && (
                <s-paragraph>{form.description}</s-paragraph>
              )}
              <s-text-area
                label={
                  form.required ? "Gift message" : "Gift message (optional)"
                }
                rows={3}
                maxLength={Number(form.maxLength) || 250}
                disabled
              />
            </s-stack>
          ) : (
            <s-banner tone="info">
              The checkout field is currently hidden.
            </s-banner>
          )}
        </s-section>

        <s-section slot="aside" heading="Status">
          <s-stack direction="block" gap="base">
            <s-badge tone={form.enabled ? "success" : "neutral"}>
              {form.enabled ? "Enabled" : "Disabled"}
            </s-badge>
            <s-paragraph>
              {form.required
                ? "Customers must enter a message."
                : "The message is optional."}
            </s-paragraph>
            <s-paragraph>
              Maximum length:{" "}
              {form.maxLength || DEFAULT_GIFT_MESSAGE_SETTINGS.maxLength}
            </s-paragraph>
          </s-stack>
        </s-section>
      </s-page>
    </fetcher.Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
