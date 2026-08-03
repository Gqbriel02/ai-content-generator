export const taskCardJsonSchema = {
  name: "task_card",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      submitLabel: { type: "string" },
      fields: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["checkbox", "radio", "select", "text"] },
            label: { type: "string" },
            placeholder: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  value: { type: "string" },
                  label: { type: "string" },
                },
                required: ["value", "label"],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "type", "label"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "description", "fields", "submitLabel"],
    additionalProperties: false,
  },
} as const;
