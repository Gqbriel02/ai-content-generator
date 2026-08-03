export type Role = "system" | "user" | "assistant" | "tool";

export type AttachmentInput = {
  storagePath: string;
  mimeType: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
};

export type TaskOption = {
  value: string;
  label: string;
};

export type TaskField =
  | {
      id: string;
      type: "checkbox";
      label: string;
      options: TaskOption[];
    }
  | {
      id: string;
      type: "radio";
      label: string;
      options: TaskOption[];
    }
  | {
      id: string;
      type: "select";
      label: string;
      options: TaskOption[];
    }
  | {
      id: string;
      type: "text";
      label: string;
      placeholder?: string;
    };

export type TaskCardPayload = {
  title: string;
  description: string;
  fields: TaskField[];
  submitLabel: string;
};
