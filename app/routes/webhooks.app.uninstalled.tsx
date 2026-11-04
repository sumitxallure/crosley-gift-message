import type { ActionFunctionArgs } from "react-router";
import { authenticate, sessionStorage } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const sessions = await sessionStorage.findSessionsByShop(shop);
  if (sessions.length > 0) {
    await sessionStorage.deleteSessions(sessions.map(({ id }) => id));
  }

  return new Response();
};
