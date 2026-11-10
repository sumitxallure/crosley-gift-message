use crate::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

#[derive(Deserialize, Default, PartialEq)]
pub struct Configuration {
    enabled: bool,
    required: bool,
}

#[shopify_function]
fn cart_validations_generate_run(
    input: schema::cart_validations_generate_run::Input,
) -> Result<schema::CartValidationsGenerateRunResult> {
    let mut errors = Vec::new();
    let default_configuration = Configuration::default();
    let configuration = input
        .validation()
        .metafield()
        .map(|metafield| metafield.json_value())
        .unwrap_or(&default_configuration);
    let is_checkout_completion =
        input.buyer_journey().step() == Some(&schema::BuyerJourneyStep::CheckoutCompletion);
    let gift_message_is_empty = input
        .cart()
        .gift_message()
        .is_none_or(|metafield| metafield.value().trim().is_empty());

    if configuration.enabled
        && configuration.required
        && is_checkout_completion
        && gift_message_is_empty
    {
        errors.push(schema::ValidationError {
            message: "Enter a gift message before continuing.".to_owned(),
            target: "$.cart".to_owned(),
        });
    }

    Ok(schema::CartValidationsGenerateRunResult {
        operations: vec![schema::Operation::ValidationAdd(
            schema::ValidationAddOperation { errors },
        )],
    })
}
