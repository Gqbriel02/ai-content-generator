"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, ColorInput, Divider, FileButton, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconPhoto, IconTrash, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { normalizeAvatarColor, type SafeProfile } from "@/lib/profile/identity";

const CLIENT_MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const CLIENT_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ProfileEditor({ profile }: { profile: SafeProfile }) {
  const router = useRouter();
  const [persistedColor, setPersistedColor] = useState(profile.avatarColor);
  const [draftColor, setDraftColor] = useState(profile.avatarColor);
  const [lastValidColor, setLastValidColor] = useState(profile.avatarColor);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const localPreviewRef = useRef<string | null>(null);
  const normalizedDraft = normalizeAvatarColor(draftColor);
  const error = draftColor.length > 0 && !normalizedDraft ? "Enter a six-digit HEX color such as #228BE6." : undefined;
  const canSave = Boolean(normalizedDraft && normalizedDraft !== persistedColor && !saving);

  useEffect(() => () => { if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current); }, []);

  function clearLocalPreview() {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null; setLocalPreviewUrl(null); setSelectedFile(null);
  }

  function selectPhoto(file: File | null) {
    if (!file) return;
    if (!CLIENT_AVATAR_TYPES.has(file.type) || !file.size || file.size > CLIENT_MAX_AVATAR_BYTES) {
      notifications.show({ color: "red", title: "Invalid profile photo", message: "Choose a JPEG, PNG, or WebP image that is 5 MB or smaller." });
      return;
    }
    clearLocalPreview();
    const previewUrl = URL.createObjectURL(file);
    localPreviewRef.current = previewUrl; setLocalPreviewUrl(previewUrl); setSelectedFile(file);
  }

  async function savePhoto() {
    if (!selectedFile || savingPhoto) return;
    setSavingPhoto(true);
    try {
      const body = new FormData(); body.set("avatar", selectedFile);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not upload profile photo.");
      setAvatarUrl(json.data.avatarUrl ?? null); clearLocalPreview();
      notifications.show({ color: "green", title: "Profile photo updated", message: "Your profile photo was saved." });
      router.refresh();
    } catch (cause) {
      notifications.show({ color: "red", title: "Profile photo not updated", message: cause instanceof Error ? cause.message : "Please try again." });
    } finally { setSavingPhoto(false); }
  }

  async function removePhoto() {
    if (removingPhoto) return;
    setRemovingPhoto(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" }); const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not remove profile photo.");
      clearLocalPreview(); setAvatarUrl(null);
      notifications.show({ color: "green", title: "Profile photo removed", message: "Your initials and fallback color are active again." });
      router.refresh();
    } catch (cause) {
      notifications.show({ color: "red", title: "Profile photo not removed", message: cause instanceof Error ? cause.message : "Please try again." });
    } finally { setRemovingPhoto(false); }
  }

  function handleColorChange(value: string) {
    setDraftColor(value); const normalized = normalizeAvatarColor(value); if (normalized) setLastValidColor(normalized);
  }

  async function save() {
    if (!normalizedDraft || !canSave) return;
    setSaving(true);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarColor: normalizedDraft }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The profile could not be updated.");
      const savedColor = json.data.avatarColor as string;
      setPersistedColor(savedColor); setDraftColor(savedColor); setLastValidColor(savedColor);
      notifications.show({ color: "green", title: "Profile updated", message: "Your avatar fallback color was saved." });
      router.refresh();
    } catch (cause) {
      notifications.show({ color: "red", title: "Profile not updated", message: cause instanceof Error ? cause.message : "Please try again." });
    } finally { setSaving(false); }
  }

  const memberSince = new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(profile.createdAt));
  const displayedAvatarUrl = localPreviewUrl ?? avatarUrl;

  return <Stack gap="xl" maw={760} mx="auto" p={{ base: "md", sm: "xl" }}>
    <Button variant="subtle" color="dark" leftSection={<IconArrowLeft size={18} />} onClick={() => router.push("/chat")} w="fit-content">Back to chats</Button>
    <Stack align="center" gap="xs">
      <Title order={1}>Profile</Title>
      <ProfileAvatar displayName={profile.displayName} email={profile.email} avatarColor={persistedColor} avatarUrl={displayedAvatarUrl} size={88} />
      <Title order={2}>{profile.displayName}</Title><Text c="dimmed">{profile.email}</Text>
    </Stack>
    <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }}><Stack gap="lg">
      <div><Title order={3}>Profile appearance</Title><Text c="dimmed" size="sm">Manage your profile photo and the fallback color used behind your initials.</Text></div>
      <Stack gap="sm"><Text fw={500}>Profile photo</Text><Group align="center" wrap="wrap">
        <ProfileAvatar displayName={profile.displayName} email={profile.email} avatarColor={lastValidColor} avatarUrl={displayedAvatarUrl} size={72} />
        <Group gap="xs" wrap="wrap">
          <FileButton onChange={selectPhoto} accept="image/jpeg,image/png,image/webp">{(props) => <Button {...props} variant="light" leftSection={<IconPhoto size={17} />} disabled={savingPhoto || removingPhoto}>{avatarUrl || selectedFile ? "Change photo" : "Upload photo"}</Button>}</FileButton>
          {selectedFile ? <><Button onClick={savePhoto} loading={savingPhoto} disabled={removingPhoto}>Save photo</Button><Button variant="default" leftSection={<IconX size={16} />} onClick={clearLocalPreview} disabled={savingPhoto}>Cancel</Button></> : avatarUrl ? <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={removePhoto} loading={removingPhoto}>Remove photo</Button> : null}
        </Group>
      </Group><Text size="xs" c="dimmed">JPEG, PNG, or WebP. Maximum 5 MB.</Text></Stack>
      <Divider />
      <ColorInput label="Avatar fallback color" description="Used whenever your profile photo is removed or unavailable. Six-digit HEX value." value={draftColor} onChange={handleColorChange} error={error} format="hex" withEyeDropper={false} swatches={[]} />
      <Group justify="flex-end"><Button onClick={save} disabled={!canSave} loading={saving}>Save changes</Button></Group>
    </Stack></Card>
    <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }}><Title order={3}>Account information</Title><Divider my="md" /><Stack gap="md">
      <Group justify="space-between" align="flex-start"><Text c="dimmed">Display name</Text><Text ta="right">{profile.displayName}</Text></Group>
      <Group justify="space-between" align="flex-start"><Text c="dimmed">Email</Text><Text ta="right">{profile.email}</Text></Group>
      <Group justify="space-between" align="flex-start"><Text c="dimmed">Member since</Text><Text ta="right">{memberSince}</Text></Group>
    </Stack></Card>
  </Stack>;
}
