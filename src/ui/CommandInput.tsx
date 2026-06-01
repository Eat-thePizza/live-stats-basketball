import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./CommandInput.module.css";

export interface CommandInputProps {
  onSubmit: (line: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CommandInput({
  onSubmit,
  placeholder = "Type a command (e.g., jackson two make ayaan)",
  disabled = false,
}: CommandInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value.trim().length === 0) return;
    onSubmit(value);
    setValue("");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Command input"
      />
      <button type="submit" className={styles.submit} disabled={disabled}>
        Submit
      </button>
    </form>
  );
}
