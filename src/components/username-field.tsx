"use client";

import { useState } from "react";
import { USERNAME_HINT, USERNAME_PATTERN, usernameValidationMessage } from "../lib/username-validation";

export function UsernameField({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState("");
  const id = `${mode}-username`;
  return <>
    <label htmlFor={id}>Username</label>
    <input id={id} name="username" autoComplete="username" required minLength={3} maxLength={24}
      pattern={USERNAME_PATTERN} autoCapitalize="none" spellCheck={false}
      aria-describedby={`${id}-${error ? "error" : "hint"}`} aria-invalid={error ? true : undefined}
      onChange={event => {
        const message = usernameValidationMessage(event.currentTarget.value);
        event.currentTarget.setCustomValidity(message);
        setError(event.currentTarget.value ? message : "");
      }}
      onInvalid={event => setError(usernameValidationMessage(event.currentTarget.value))} />
    <p id={`${id}-hint`}>{USERNAME_HINT}</p>
    <p id={`${id}-error`} className="field-validation" role="status">{error}</p>
  </>;
}
