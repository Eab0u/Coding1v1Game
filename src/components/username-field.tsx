"use client";

import { useState } from "react";
import { USERNAME_HINT, USERNAME_PATTERN, usernameValidationMessage } from "../lib/username-validation";

export function UsernameField({ mode }: { mode: "login" | "signup" | "friend" }) {
  const [error, setError] = useState("");
  const id = `${mode}-username`;
  const hint = mode === "friend" ? USERNAME_HINT.replace("your username", "a player username") : USERNAME_HINT;
  return <>
    <label htmlFor={id}>{mode === "friend" ? "Player username" : "Username"}</label>
    <input id={id} name="username" autoComplete={mode === "friend" ? "off" : "username"} required minLength={3} maxLength={24}
      pattern={USERNAME_PATTERN} autoCapitalize="none" spellCheck={false}
      aria-describedby={`${id}-${error ? "error" : "hint"}`} aria-invalid={error ? true : undefined}
      onChange={event => {
        const message = usernameValidationMessage(event.currentTarget.value);
        event.currentTarget.setCustomValidity(message);
        setError(event.currentTarget.value && message ? hint : "");
      }}
      onInvalid={event => setError(usernameValidationMessage(event.currentTarget.value) ? hint : "")} />
    <p id={`${id}-hint`}>{hint}</p>
    <p id={`${id}-error`} className="field-validation" role="status">{error}</p>
  </>;
}
