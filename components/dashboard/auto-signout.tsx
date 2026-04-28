"use client";

import { useEffect } from "react";

export function AutoSignOut() {
  useEffect(() => {
    const remember = localStorage.getItem("tb-remember-me");
    if (remember === "false") {
      const handler = () => {
        navigator.sendBeacon("/api/auth/signout");
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, []);

  return null;
}
