import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'pages.login.validation.identifierRequired'),
  password: z.string().min(6, 'pages.login.validation.passwordMin'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
