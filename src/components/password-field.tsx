"use client";

import { useFieldReset } from "./use-field-reset";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui";
import { passwordValidationMessage, PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES } from "../lib/password-validation";

export function PasswordField({ mode }: { mode: "login" | "signup" }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  const [bytes, setBytes] = useState(0);
  const [length, setLength] = useState(0);
  const inputRef = useFieldReset(useCallback((input: HTMLInputElement) => {
    input.setCustomValidity("");
    setError("");
    setVisible(false);
    setCapsLock(false);
    setBytes(new TextEncoder().encode(input.value).byteLength);
    setLength(input.value.length);
  }, []));
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const conceal = () => {
      setVisible(false);
      setCapsLock(false);
    };
    form.addEventListener("submit", conceal, true);
    // Invalid does not bubble; capture also covers an invalid username.
    form.addEventListener("invalid", conceal, true);
    return () => {
      form.removeEventListener("submit", conceal, true);
      form.removeEventListener("invalid", conceal, true);
    };
  }, [inputRef]);
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || !visible) return;
    const concealOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The field handles its own Escape, including independently rendered fields.
      if (event.target instanceof Element && event.target.closest(".password-field")) return;
      event.preventDefault();
      event.stopPropagation();
      setVisible(false);
      setCapsLock(false);
    };
    form.addEventListener("keydown", concealOnEscape);
    return () => form.removeEventListener("keydown", concealOnEscape);
  }, [inputRef, visible]);
  useEffect(() => {
    const concealOnDeparture = () => {
      setVisible(false);
      setCapsLock(false);
    };
    const conceal = () => {
      if (document.visibilityState === "hidden") {
        concealOnDeparture();
      }
    };
    document.addEventListener("visibilitychange", conceal);
    window.addEventListener("pagehide", concealOnDeparture);
    window.addEventListener("blur", concealOnDeparture);
    return () => {
      document.removeEventListener("visibilitychange", conceal);
      window.removeEventListener("pagehide", concealOnDeparture);
      window.removeEventListener("blur", concealOnDeparture);
    };
  }, []);
  const synchronizeValue = (input: HTMLInputElement, reportEmpty = false) => {
    setBytes(new TextEncoder().encode(input.value).byteLength);
    setLength(input.value.length);
    const message = passwordValidationMessage(input.value);
    input.setCustomValidity(input.value || reportEmpty ? message : "");
    setError(input.value || reportEmpty ? message : "");
  };
  const id = `${mode}-password`;
  return <>
    <label htmlFor={id}>Password</label>
    <div className="password-field" onKeyDown={event => {
      if (event.key === "Escape" && visible) {
        event.preventDefault();
        event.stopPropagation();
        setVisible(false);
        setCapsLock(false);
      }
    }}>
      <input ref={inputRef} id={id} name="password" type={visible ? "text" : "password"}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_BYTES}
        aria-describedby={`${mode}-hint ${mode}-password-budget ${mode}-password-error ${mode}-caps-lock`} aria-invalid={error ? true : undefined}
        onKeyDown={event => setCapsLock(event.getModifierState("CapsLock"))}
        onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))}
        onClick={event => setCapsLock(event.getModifierState("CapsLock"))}
        onBlur={() => setCapsLock(false)}
        onFocus={event => synchronizeValue(event.currentTarget)}
        onInvalid={event => synchronizeValue(event.currentTarget, true)}
        onChange={event => synchronizeValue(event.currentTarget)}
        autoCapitalize="none" spellCheck={false} />
      <Button variant="secondary" aria-controls={id} aria-pressed={visible}
        aria-describedby={`${mode}-hint ${mode}-password-visibility`}
        aria-label={`${visible ? "Hide" : "Show"} ${mode === "login" ? "sign-in" : "sign-up"} password`}
        onClick={() => {
          if (inputRef.current) synchronizeValue(inputRef.current);
          setVisible(value => !value);
        }}>{visible ? "Hide" : "Show"}</Button>
    </div>
    <p id={`${mode}-password-visibility`} className="password-visibility" role="status">{visible ? "Password is visible. Hide it when you finish checking." : ""}</p>
    <p id={`${mode}-hint`}>At least 12 characters; up to 256 bytes. Press Escape anywhere in this form to conceal a revealed password, or use Hide. Revealed passwords hide when you switch tabs. They also hide when the browser window loses focus, when you leave this page or submit this form, including when a field needs correction.</p>
    <p id={`${mode}-password-budget`} className="password-budget" data-over-limit={bytes > PASSWORD_MAX_BYTES ? "true" : undefined}>
      <span>{length < PASSWORD_MIN_LENGTH
        ? `At least ${PASSWORD_MIN_LENGTH - length} more ${PASSWORD_MIN_LENGTH - length === 1 ? "character" : "characters"} needed`
        : "Minimum length met"}</span>
      <strong>{bytes} / {PASSWORD_MAX_BYTES} bytes</strong>
      <span className="password-budget-capacity">{bytes > PASSWORD_MAX_BYTES
        ? `${bytes - PASSWORD_MAX_BYTES} ${bytes - PASSWORD_MAX_BYTES === 1 ? "byte" : "bytes"} over limit`
        : bytes === PASSWORD_MAX_BYTES ? "Byte limit reached"
        : `${PASSWORD_MAX_BYTES - bytes} ${PASSWORD_MAX_BYTES - bytes === 1 ? "byte" : "bytes"} remaining`}</span>
      <span>Emoji and some letters use more than one byte.</span>
    </p>
    <p id={`${mode}-password-error`} className="password-validation" role="status">{error}</p>
    <p id={`${mode}-caps-lock`} className="password-caps-lock" role="status">{capsLock ? "Caps Lock is on. Passwords are case-sensitive." : ""}</p>
  </>;
}
