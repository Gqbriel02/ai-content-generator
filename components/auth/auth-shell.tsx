"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Anchor,
  Button,
  Card,
  Container,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { notifications } from "@mantine/notifications";

type AuthShellProps = {
  mode: "login" | "register";
};

export function AuthShell({ mode }: AuthShellProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  function extractApiErrorMessage(json: unknown, fallback: string) {
    if (!json || typeof json !== "object") return fallback;
    const errorObj = (json as { error?: unknown }).error;
    if (!errorObj || typeof errorObj !== "object") return fallback;

    const message = (errorObj as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;

    const details = (errorObj as { details?: unknown }).details;
    if (details && typeof details === "object") {
      const fieldErrors = (details as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
      if (fieldErrors) {
        for (const msgs of Object.values(fieldErrors)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            return msgs[0];
          }
        }
      }
    }

    return fallback;
  }

  async function onSubmit() {
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login" ? { email, password } : { email, password, displayName };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(extractApiErrorMessage(json, "The request failed."));
      }

      notifications.show({
        color: "green",
        title: "Success",
        message: mode === "login" ? "Successfully logged in." : "Account created successfully.",
      });

      router.push("/chat");
      router.refresh();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Error",
        message: error instanceof Error ? error.message : "An error occurred.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size={460} py="xl">
      <Card shadow="lg" p="xl" withBorder radius="lg">
        <Stack gap="md">
          <Title order={2}>
            {mode === "login" ? "Welcome back" : "Create a new account"}
          </Title>
          <Text c="dimmed" size="sm">
            {mode === "login"
              ? "Sign in to continue to your chat workspace."
              : "Create an account to use the local chat with LM Studio."}
          </Text>
          {mode === "register" && (
            <TextInput
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              required
            />
          )}
          <TextInput
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            type="email"
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            description={
              mode === "register"
                ? "At least 8 characters, including one uppercase letter, one lowercase letter, and one number."
                : undefined
            }
            required
          />
          <Button loading={loading} onClick={onSubmit}>
            {mode === "login" ? "Log In" : "Register"}
          </Button>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}
            </Text>
            <Anchor component={Link} href={mode === "login" ? "/register" : "/login"} size="sm">
              {mode === "login" ? "Go to Register" : "Go to Login"}
            </Anchor>
          </Group>
        </Stack>
      </Card>
    </Container>
  );
}