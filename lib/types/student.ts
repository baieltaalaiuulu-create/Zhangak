export type UserRole =
  | "student_online"
  | "student_offline"
  | "admin"
  | "admin_jr"
  | "finance"
  | "manager";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  name_ru: string;
  icon: string;
}