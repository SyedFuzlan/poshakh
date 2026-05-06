/* eslint-disable @typescript-eslint/no-unused-vars */
// cart.ts — no-ops. Express backend doesn't use server-side carts;
// cart items are passed directly at payment time.

export async function getOrCreateCart(): Promise<string> {
  return "local-cart";
}

export async function createFreshCart(): Promise<string> {
  return "local-cart";
}

export async function addLineItem(
  cartId: string,
  variantId: string,
  quantity: number
): Promise<string | null> {
  return null;
}

export async function removeLineItem(
  cartId: string,
  lineItemId: string
): Promise<void> {}

export async function updateLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<void> {}
