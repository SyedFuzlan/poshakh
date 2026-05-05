export async function signupWithPassword(
  firstName: string,
  lastName: string,
  phone: string,
  password: string,
  email?: string
): Promise<{ id: string; email: string | null; phone: string | null; firstName: string; lastName: string }> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName, phone, email, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Signup failed");
  return data.customer;
}

export async function loginWithPassword(
  identifier: string,
  password: string
): Promise<{ id: string; email: string | null; phone: string | null; firstName: string; lastName: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Invalid credentials");
  return data.customer;
}
