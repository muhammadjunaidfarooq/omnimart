"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const sizeClass = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const;

interface ModalProps {
  /** The element that opens the modal when clicked. */
  trigger: React.ReactElement;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /**
   * Action button(s) rendered in the footer alongside a Close button.
   * Pass `null` to suppress the footer entirely.
   * Omit (undefined) for a footer with only a Close button.
   */
  footer?: React.ReactNode | null;
  size?: keyof typeof sizeClass;
  /** Controlled open state. Omit to let Base UI manage it internally. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Modal({
  trigger,
  title,
  description,
  children,
  footer,
  size = "md",
  open,
  onOpenChange,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className={sizeClass[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer !== null && (
          <DialogFooter showCloseButton>{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
