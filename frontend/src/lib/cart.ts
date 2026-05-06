// cart.ts — no-ops. Express backend doesn't use server-side carts;
// cart items are passed directly at payment time.

export async function getOrCreateCart(): Promise<string> {
  return "local-cart";
}

export async function createFreshCart(): Promise<string> {
  return "local-cart";
}

export async function addLineItem(): Promise<string | null> {
  return null;
}

export async function removeLineItem(): Promise<void> {}

export async function updateLineItem(): Promise<void> {}
