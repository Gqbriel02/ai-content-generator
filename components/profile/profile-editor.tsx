"use client";

import { useState } from "react";
import { Button, Card, ColorInput, Divider, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { normalizeAvatarColor, type SafeProfile } from "@/lib/profile/identity";

export function ProfileEditor({ profile }: { profile: SafeProfile }) {
  const router = useRouter();
  const [persistedColor, setPersistedColor] = useState(profile.avatarColor);
  const [draftColor, setDraftColor] = useState(profile.avatarColor);
  const [lastValidColor, setLastValidColor] = useState(profile.avatarColor);
  const [saving, setSaving] = useState(false);
  const normalizedDraft = normalizeAvatarColor(draftColor);
  const error = draftColor.length > 0 && !normalizedDraft
    ? "Enter a six-digit HEX color such as #228BE6."
    : undefined;
  const canSave = Boolean(normalizedDraft && normalizedDraft !== persistedColor && !saving);

  function handleColorChange(value: string) {
    setDraftColor(value);
    const normalized = normalizeAvatarColor(value);
    if (normalized) setLastValidColor(normalized);
  }

  async function save() {
    if (!normalizedDraft || !canSave) return;
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarColor: normalizedDraft }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The profile could not be updated.");
      const savedColor = json.data.avatarColor as string;
      setPersistedColor(savedColor);
      setDraftColor(savedColor);
      setLastValidColor(savedColor);
      notifications.show({ color: "green", title: "Profile updated", message: "Your avatar color was saved." });
      router.refresh();
    } catch (cause) {
      notifications.show({ color: "red", title: "Profile not updated", message: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const memberSince = new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(profile.createdAt));

  return (
    <Stack gap="xl" maw={760} mx="auto" p={{ base: "md", sm: "xl" }}>
      <Button variant="subtle" color="dark" leftSection={<IconArrowLeft size={18} />} onClick={() => router.push("/chat")} w="fit-content">
        Back to chats
      </Button>
      <Stack align="center" gap="xs">
        <Title order={1}>Profile</Title>
        <ProfileAvatar displayName={profile.displayName} email={profile.email} avatarColor={persistedColor} size={88} />
        <Title order={2}>{profile.displayName}</Title>
        <Text c="dimmed">{profile.email}</Text>
      </Stack>

      <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }}>
        <Stack gap="lg">
          <div>
            <Title order={3}>Profile appearance</Title>
            <Text c="dimmed" size="sm">Choose the color used behind your initials.</Text>
          </div>
          <Group align="center" wrap="wrap">
            <ProfileAvatar displayName={profile.displayName} email={profile.email} avatarColor={lastValidColor} size={72} />
            <ColorInput
              label="Avatar color"
              description="Six-digit HEX value"
              value={draftColor}
              onChange={handleColorChange}
              error={error}
              format="hex"
              withEyeDropper={false}
              swatches={[]}
              style={{ flex: 1, minWidth: 220 }}
            />
          </Group>
          <Group justify="flex-end">
            <Button onClick={save} disabled={!canSave} loading={saving}>Save changes</Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }}>
        <Title order={3}>Account information</Title>
        <Divider my="md" />
        <Stack gap="md">
          <Group justify="space-between" align="flex-start"><Text c="dimmed">Display name</Text><Text ta="right">{profile.displayName}</Text></Group>
          <Group justify="space-between" align="flex-start"><Text c="dimmed">Email</Text><Text ta="right">{profile.email}</Text></Group>
          <Group justify="space-between" align="flex-start"><Text c="dimmed">Member since</Text><Text ta="right">{memberSince}</Text></Group>
        </Stack>
      </Card>
    </Stack>
  );
}
