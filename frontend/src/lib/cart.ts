// cart.ts — no-ops. Express backend doesn't use server-side carts;
// cart items are passed directly at payment time.

export async function getOrCreateCart(): Promise<string> {
  return "local-cart";
}

export async function createFreshCart(): Promise<string> {
  return "local-cart";
}

export async function addLineItem(
  _cartId: string,
  _variantId: string,
  _quantity: number
): Promise<string | null> {
  return null;
}

export async function removeLineItem(
  _cartId: string,
  _lineItemId: string
): Promise<void> {}

export async function updateLineItem(
  _cartId: string,
  _lineItemId: string,
  _quantity: number
): Promise<void> {}
