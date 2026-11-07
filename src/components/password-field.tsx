"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";
import { passwordValidationMessage, PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES } from "../lib/password-validation";

export function PasswordField({ mode }: { mode: "login" | "signup" }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  const [bytes, setBytes] = useState(0);
  useEffect(() => {
    const conceal = () => {
      if (document.visibilityState === "hidden") {
        setVisible(false);
        setCapsLock(false);
      }
    };
    document.addEventListener("visibilitychange", conceal);
    return () => document.removeEventListener("visibilitychange", conceal);
  }, []);
  const id = `${mode}-password`;
  return <>
    <label htmlFor={id}>Password</label>
    <div className="password-field">
      <input id={id} name="password" type={visible ? "text" : "password"}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_BYTES}
        aria-describedby={`${mode}-hint ${mode}-password-budget ${mode}-password-error ${mode}-caps-lock`} aria-invalid={error ? true : undefined}
        onKeyDown={event => setCapsLock(event.getModifierState("CapsLock"))}
        onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))}
        onBlur={() => setCapsLock(false)}
        onInvalid={event => setError(passwordValidationMessage(event.currentTarget.value))}
        onChange={event => {
          setBytes(new TextEncoder().encode(event.currentTarget.value).byteLength);
          const message = passwordValidationMessage(event.currentTarget.value);
          event.currentTarget.setCustomValidity(message);
          setError(event.currentTarget.value ? message : "");
        }}
        autoCapitalize="none" spellCheck={false} />
      <Button variant="secondary" aria-controls={id} aria-pressed={visible}
        aria-label={`${visible ? "Hide" : "Show"} ${mode === "login" ? "sign-in" : "sign-up"} password`}
        onClick={() => setVisible(value => !value)}>{visible ? "Hide" : "Show"}</Button>
    </div>
    <p id={`${mode}-hint`}>At least 12 characters; up to 256 bytes. Revealed passwords hide when you switch tabs.</p>
    <p id={`${mode}-password-budget`} className="password-budget" data-over-limit={bytes > PASSWORD_MAX_BYTES ? "true" : undefined}>
      <strong>{bytes} / {PASSWORD_MAX_BYTES} bytes</strong>
      <span>Emoji and some letters use more than one byte.</span>
    </p>
    <p id={`${mode}-password-error`} className="password-validation" role="status">{error}</p>
    <p id={`${mode}-caps-lock`} className="password-caps-lock" role="status">{capsLock ? "Caps Lock is on. Passwords are case-sensitive." : ""}</p>
  </>;
}
