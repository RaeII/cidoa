/** Usuário público retornado pela API (sem hash de senha). */
export interface User {
  id: number;
  username: string;
  name: string | null;
  profile_image: string | null;
  email: string | null;
  is_active: boolean;
  is_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UpdateOwnProfileInput {
  name: string;
  username: string;
  profile_image?: string | null;
}
