"use client";

import { useFieldReset } from "./use-field-reset";
import { useCallback, useState } from "react";
import { USERNAME_HINT, USERNAME_PATTERN, usernameValidationMessage } from "../lib/username-validation";

export function UsernameField({ mode }: { mode: "login" | "signup" | "friend" }) {
  const [error, setError] = useState("");
  const inputRef = useFieldReset(useCallback((input: HTMLInputElement) => {
    input.setCustomValidity("");
    setError("");
  }, []));
  const synchronizeValue = (input: HTMLInputElement, reportEmpty = false) => {
    const message = usernameValidationMessage(input.value);
    input.setCustomValidity(input.value || reportEmpty ? message : "");
    setError((input.value || reportEmpty) && message ? hint : "");
  };
  const id = `${mode}-username`;
  const hint = mode === "friend" ? USERNAME_HINT.replace("your username", "a player username") : USERNAME_HINT;
  return <>
    <label htmlFor={id}>{mode === "friend" ? "Player username" : "Username"}</label>
    <input ref={inputRef} id={id} name="username" autoComplete={mode === "friend" ? "off" : "username"} required minLength={3} maxLength={24}
      pattern={USERNAME_PATTERN} autoCapitalize="none" spellCheck={false}
      aria-describedby={`${id}-${error ? "error" : "hint"}`} aria-invalid={error ? true : undefined}
      onFocus={event => synchronizeValue(event.currentTarget)}
      onChange={event => synchronizeValue(event.currentTarget)}
      onInvalid={event => synchronizeValue(event.currentTarget, true)} />
    <p id={`${id}-hint`}>{hint}</p>
    <p id={`${id}-error`} className="field-validation" role="status">{error}</p>
  </>;
}
