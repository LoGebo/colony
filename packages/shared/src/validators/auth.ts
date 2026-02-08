import { z } from 'zod';

// ---------- Sign In ----------
export const signInSchema = z.object({
  email: z.email('Correo electronico invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
});
export type SignInForm = z.infer<typeof signInSchema>;

// ---------- Sign Up (invited resident/guard) ----------
export const signUpSchema = z
  .object({
    email: z.email('Correo electronico invalido'),
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  });
export type SignUpForm = z.infer<typeof signUpSchema>;

// ---------- Admin Onboarding ----------
export const adminOnboardingSchema = z.object({
  orgName: z.string().min(1, 'Nombre de organizacion requerido'),
  communityName: z.string().min(1, 'Nombre de comunidad requerido'),
  communityAddress: z.string().optional(),
  communityCity: z.string().optional(),
  communityState: z.string().optional(),
  communityZip: z.string().optional(),
  firstName: z.string().optional(),
  paternalSurname: z.string().optional(),
});
export type AdminOnboardingForm = z.infer<typeof adminOnboardingSchema>;

// ---------- Password Reset ----------
export const resetPasswordSchema = z.object({
  email: z.email('Correo electronico invalido'),
});
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

// ---------- Invite User ----------
export const inviteUserSchema = z.object({
  email: z.email('Correo electronico invalido'),
  firstName: z.string().min(1, 'Nombre requerido'),
  paternalSurname: z.string().min(1, 'Apellido paterno requerido'),
  unitId: z.string().uuid('ID de unidad invalido'),
  role: z.enum(['resident', 'guard'], {
    error: 'Rol debe ser residente o guardia',
  }),
});
export type InviteUserForm = z.infer<typeof inviteUserSchema>;
