"use client";

import { useFieldReset } from "./use-field-reset";
import { useCallback, useState } from "react";
import { USERNAME_HINT, USERNAME_PATTERN, usernameValidationMessage } from "../lib/username-validation";

export function UsernameField({ mode }: { mode: "login" | "signup" | "friend" }) {
  const [error, setError] = useState("");
  const [length, setLength] = useState(0);
  const inputRef = useFieldReset(useCallback((input: HTMLInputElement) => {
    input.setCustomValidity("");
    setLength(input.value.length);
    setError("");
  }, []));
  const synchronizeValue = (input: HTMLInputElement, reportEmpty = false) => {
    setLength(input.value.length);
    const message = usernameValidationMessage(input.value);
    input.setCustomValidity(input.value || reportEmpty ? message : "");
    const corrections: string[] = [];
    if (!input.value) corrections.push("Enter a username.");
    else {
      if (input.value.length < 3) corrections.push("Username is too short.");
      if (input.value.length > 24) corrections.push("Username is too long.");
      if (/[^A-Za-z0-9_]/.test(input.value)) corrections.push("Remove spaces and characters other than English letters, numbers or underscores.");
    }
    setError((input.value || reportEmpty) && message ? `${corrections.join(" ")} ${hint}` : "");
  };
  const id = `${mode}-username`;
  const hint = mode === "friend" ? USERNAME_HINT.replace("your username", "a player username") : USERNAME_HINT;
  return <>
    <label htmlFor={id}>{mode === "friend" ? "Player username" : "Username"}</label>
    <input ref={inputRef} id={id} name="username" autoComplete={mode === "friend" ? "off" : "username"} required minLength={3} maxLength={24}
      pattern={USERNAME_PATTERN} autoCapitalize="none" spellCheck={false}
      aria-describedby={`${id}-${error ? "error" : "hint"} ${id}-budget`} aria-invalid={error ? true : undefined}
      onFocus={event => synchronizeValue(event.currentTarget)}
      onChange={event => synchronizeValue(event.currentTarget)}
      onInvalid={event => synchronizeValue(event.currentTarget, true)} />
    <p id={`${id}-hint`}>{hint}</p>
    <p id={`${id}-budget`} className="username-budget" data-over-limit={length > 24 ? "true" : undefined}>
      <strong>{length} / 24 characters</strong>{" "}
      <span>{length > 24 ? `${length - 24} ${length - 24 === 1 ? "character" : "characters"} over limit`
        : length === 24 ? "Character limit reached"
        : length < 3 ? `At least ${3 - length} more ${3 - length === 1 ? "character" : "characters"} needed`
        : `${24 - length} ${24 - length === 1 ? "character" : "characters"} remaining`}</span>
    </p>
    <p id={`${id}-error`} className="field-validation" role="status">{error}</p>
  </>;
}
