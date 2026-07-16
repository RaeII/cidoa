/** Usuário público retornado pela API (sem hash de senha). */
export interface User {
  id: number;
  username: string;
  email: string | null;
  is_active: boolean;
  is_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string | null;
}
