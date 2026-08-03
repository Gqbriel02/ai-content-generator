"use client";

import { useState } from "react";
import { Button, Card, Checkbox, Group, Radio, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { TaskCardPayload } from "@/types/domain";

type TaskCardProps = {
  messageId: string;
  payload: TaskCardPayload;
  onSubmitted: () => Promise<void>;
};

export function TaskCard({ messageId, payload, onSubmitted }: TaskCardProps) {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string | string[]>>({});

  const setValue = (key: string, value: string | string[]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  async function submit() {
    setLoading(true);
    try {
      const response = await fetch(`/api/messages/${messageId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? "Trimiterea task-ului a esuat.");
      }

      await onSubmitted();
      notifications.show({
        color: "green",
        title: "Task trimis",
        message: "Raspunsul tau a fost trimis cu succes.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Eroare",
        message: error instanceof Error ? error.message : "Trimiterea task-ului a esuat.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card withBorder radius="md" bg="gray.0">
      <Stack gap="sm">
        <Title order={5}>{payload.title}</Title>
        <Text c="dimmed" size="sm">
          {payload.description}
        </Text>
        {payload.fields.map((field) => {
          if (field.type === "checkbox") {
            return (
              <Checkbox.Group
                key={field.id}
                label={field.label}
                value={Array.isArray(values[field.id]) ? (values[field.id] as string[]) : []}
                onChange={(nextValue) => setValue(field.id, nextValue)}
              >
                <Stack mt={6} gap="xs">
                  {field.options.map((option) => (
                    <Checkbox key={option.value} value={option.value} label={option.label} />
                  ))}
                </Stack>
              </Checkbox.Group>
            );
          }

          if (field.type === "radio") {
            return (
              <Radio.Group
                key={field.id}
                label={field.label}
                value={typeof values[field.id] === "string" ? (values[field.id] as string) : ""}
                onChange={(nextValue) => setValue(field.id, nextValue)}
              >
                <Stack mt={6} gap="xs">
                  {field.options.map((option) => (
                    <Radio key={option.value} value={option.value} label={option.label} />
                  ))}
                </Stack>
              </Radio.Group>
            );
          }

          if (field.type === "select") {
            return (
              <Select
                key={field.id}
                label={field.label}
                data={field.options.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                value={typeof values[field.id] === "string" ? (values[field.id] as string) : null}
                onChange={(nextValue) => setValue(field.id, nextValue ?? "")}
              />
            );
          }

          return (
            <TextInput
              key={field.id}
              label={field.label}
              placeholder={field.placeholder}
              value={typeof values[field.id] === "string" ? (values[field.id] as string) : ""}
              onChange={(event) => setValue(field.id, event.currentTarget.value)}
            />
          );
        })}
        <Group justify="flex-end">
          <Button onClick={submit} loading={loading}>
            {payload.submitLabel}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
