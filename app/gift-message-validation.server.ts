import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

import type { GiftMessageSettings } from "./gift-message-settings";

const FUNCTION_HANDLE = "gift-message-validation";
const VALIDATION_CONFIG_KEY = "gift_message_validation_settings";
const VALIDATION_TITLE = "Gift message requirement";

const CREATE_VALIDATION_MUTATION = `#graphql
  mutation CreateGiftMessageValidation($validation: ValidationCreateInput!) {
    validationCreate(validation: $validation) {
      validation {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const UPDATE_VALIDATION_MUTATION = `#graphql
  mutation UpdateGiftMessageValidation(
    $id: ID!
    $validation: ValidationUpdateInput!
  ) {
    validationUpdate(id: $id, validation: $validation) {
      validation {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

type ValidationUserError = {
  message: string;
};

function validationMetafield(settings: GiftMessageSettings) {
  return {
    namespace: "$app",
    key: VALIDATION_CONFIG_KEY,
    type: "json",
    value: JSON.stringify({
      enabled: settings.enabled,
      required: settings.required,
    }),
  };
}

function formatErrors(errors: ValidationUserError[]) {
  return errors.map((error) => error.message).join(" ");
}

export async function syncGiftMessageValidation(
  admin: AdminApiContext,
  settings: GiftMessageSettings,
  validationId?: string,
) {
  if (validationId) {
    const response = await admin.graphql(UPDATE_VALIDATION_MUTATION, {
      variables: {
        id: validationId,
        validation: {
          title: VALIDATION_TITLE,
          enable: true,
          blockOnFailure: false,
          metafields: [validationMetafield(settings)],
        },
      },
    });
    const result = await response.json();
    const errors = result.data?.validationUpdate?.userErrors ?? [];

    if (errors.length > 0) {
      throw new Error(formatErrors(errors));
    }

    const updatedId = result.data?.validationUpdate?.validation?.id;
    if (!updatedId) throw new Error("Shopify did not return the validation ID.");

    return updatedId;
  }

  const response = await admin.graphql(CREATE_VALIDATION_MUTATION, {
    variables: {
      validation: {
        functionHandle: FUNCTION_HANDLE,
        title: VALIDATION_TITLE,
        enable: true,
        blockOnFailure: false,
        metafields: [validationMetafield(settings)],
      },
    },
  });
  const result = await response.json();
  const errors = result.data?.validationCreate?.userErrors ?? [];

  if (errors.length > 0) {
    throw new Error(formatErrors(errors));
  }

  const createdId = result.data?.validationCreate?.validation?.id;
  if (!createdId) throw new Error("Shopify did not return the validation ID.");

  return createdId;
}
