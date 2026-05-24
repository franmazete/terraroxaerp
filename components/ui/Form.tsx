import { useId, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
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
  /** Quando definido, abre file picker real e devolve o arquivo escolhido. */
  onFileSelected?: (file: File) => void;
  /** Tipos aceitos (default: PDF + imagens). */
  accept?: string;
  /** Fallback antigo — quando onFileSelected não é definido, dispara este onClick. */
  onClick?: () => void;
}
export function UploadZone({
  label,
  icon = "📄",
  required,
  optional,
  onFileSelected,
  accept = "application/pdf,image/*",
  onClick,
}: UploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivoSel, setArquivoSel] = useState<string | null>(null);

  function handleClick() {
    if (onFileSelected) {
      inputRef.current?.click();
    } else if (onClick) {
      onClick();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoSel(file.name);
    onFileSelected?.(file);
  }

  return (
    <>
      {onFileSelected && (
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={handleChange}
        />
      )}
      <div
        className={s.upload}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        <div className={s.upIcon}>{icon}</div>
        <p>{arquivoSel ? `✓ ${arquivoSel}` : label}</p>
        {required && !arquivoSel && <div className={s.req}>Obrigatório · PDF ou imagem</div>}
        {optional && !arquivoSel && <p style={{ fontSize: 10, color: "var(--hint)" }}>Opcional</p>}
        {arquivoSel && (
          <p style={{ fontSize: 10, color: "var(--g600)", marginTop: 4 }}>
            Clique para trocar
          </p>
        )}
      </div>
    </>
  );
}
