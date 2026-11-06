"use client";

import { useState } from "react";
import { Button } from "./ui";

export function PasswordField({ mode }: { mode: "login" | "signup" }) {
  const [visible, setVisible] = useState(false);
  const id = `${mode}-password`;
  return <>
    <label htmlFor={id}>Password</label>
    <div className="password-field">
      <input id={id} name="password" type={visible ? "text" : "password"}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required minLength={12} maxLength={256} aria-describedby={`${mode}-hint`}
        autoCapitalize="none" spellCheck={false} />
      <Button variant="secondary" aria-controls={id} aria-pressed={visible}
        aria-label={`${visible ? "Hide" : "Show"} ${mode === "login" ? "sign-in" : "sign-up"} password`}
        onClick={() => setVisible(value => !value)}>{visible ? "Hide" : "Show"}</Button>
    </div>
    <p id={`${mode}-hint`}>At least 12 characters; up to 256 bytes.</p>
  </>;
}
