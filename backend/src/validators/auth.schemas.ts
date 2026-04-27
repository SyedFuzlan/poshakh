import { z } from "zod";

export const SendOtpSchema = z.object({
  identifier: z.string().min(5, "identifier required"),
  firstName:  z.string().optional(),
  lastName:   z.string().optional(),
});

export const VerifyOtpSchema = z.object({
  identifier: z.string().min(5),
  otp:        z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
  firstName:  z.string().optional(),
  lastName:   z.string().optional(),
});

export const SignupSchema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  phone:     z.string().min(10, "Phone number required"),
  email:     z.string().email().optional(),
  password:  z.string().min(8, "Password must be at least 8 characters"),
});

export const LoginSchema = z.object({
  identifier: z.string().min(1, "Email or phone required"),
  password:   z.string().min(1, "Password required"),
});

export const ForgotPasswordSchema = z.object({
  identifier: z.string().min(5),
});

export const ResetPasswordSchema = z.object({
  identifier:  z.string().min(5),
  otp:         z.string().length(6).regex(/^\d{6}$/),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
