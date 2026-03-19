import { type RefObject, useEffect } from "react";
import { isEditableKeyboardTarget } from "./keyboardTarget";

export function useSearchFocusShortcut(searchRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || isEditableKeyboardTarget(event.target)) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchRef]);
}
