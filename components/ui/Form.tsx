import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import s from "./Form.module.css";

export function FormRow({ children, variant }: { children: ReactNode; variant?: "single" | "triple" }) {
  return <div className={`${s.row} ${variant ? s[variant] : ""}`}>{children}</div>;
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}
export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className={s.group}>
      <label>{label}</label>
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className={s.sectionLabel}>{children}</div>;
}

interface UploadProps {
  label: ReactNode;
  icon?: ReactNode;
  required?: boolean;
  optional?: boolean;
  onClick?: () => void;
}
export function UploadZone({ label, icon = "📄", required, optional, onClick }: UploadProps) {
  return (
    <div className={s.upload} title="Upload real virá com Supabase Storage (Etapa 4)" onClick={onClick}>
      <div className={s.upIcon}>{icon}</div>
      <p>{label}</p>
      {required && <div className={s.req}>Obrigatório · PDF ou imagem</div>}
      {optional && <p style={{ fontSize: 10, color: "var(--hint)" }}>Opcional</p>}
    </div>
  );
}
