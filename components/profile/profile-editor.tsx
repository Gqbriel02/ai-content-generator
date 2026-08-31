"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, Card, ColorInput, Divider, FileButton, Group, Modal, Stack, Text, Title } from "@mantine/core";
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
  const [removePhotoModalOpen, setRemovePhotoModalOpen] = useState(false);
  const removingPhotoRef = useRef(false);
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
    if (removingPhotoRef.current) return;
    removingPhotoRef.current = true;
    setRemovingPhoto(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" }); const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not remove profile photo.");
      clearLocalPreview(); setAvatarUrl(null);
      notifications.show({ color: "green", title: "Profile photo removed", message: "Your initials and fallback color are active again." });
      setRemovePhotoModalOpen(false);
      router.refresh();
    } catch (cause) {
      notifications.show({ color: "red", title: "Profile photo not removed", message: cause instanceof Error ? cause.message : "Please try again." });
    } finally { removingPhotoRef.current = false; setRemovingPhoto(false); }
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

  const valueStyle = { minWidth: 0, overflowWrap: "anywhere" as const };

  return <Box bg="#f8fbff" mih="100dvh" data-testid="profile-page-background">
    <Box
      pos="sticky"
      top={0}
      style={{ zIndex: 10, borderBottom: "1px solid var(--mantine-color-gray-3)", backgroundColor: "#f8fbff" }}
      data-testid="profile-sticky-header"
    >
      <Group maw={760} mx="auto" px={{ base: "md", sm: "xl" }} py="sm" justify="space-between" wrap="wrap">
        <Button variant="subtle" color="dark" leftSection={<IconArrowLeft size={18} />} onClick={() => router.push("/chat")}>
          Back to chats
        </Button>
        <Title order={2}>Profile</Title>
      </Group>
    </Box>
    <Stack gap="lg" maw={760} mx="auto" px={{ base: "md", sm: "xl" }} py="xl">
      <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }} data-testid="account-information-card">
        <Title order={3}>Account information</Title><Divider my="md" /><Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap"><Text c="dimmed" style={{ flexShrink: 0 }}>Display name</Text><Text ta="right" style={valueStyle}>{profile.displayName}</Text></Group>
          <Group justify="space-between" align="flex-start" wrap="nowrap"><Text c="dimmed" style={{ flexShrink: 0 }}>Email</Text><Text ta="right" style={valueStyle}>{profile.email}</Text></Group>
          <Group justify="space-between" align="flex-start" wrap="nowrap"><Text c="dimmed" style={{ flexShrink: 0 }}>Member since</Text><Text ta="right" style={valueStyle}>{memberSince}</Text></Group>
        </Stack>
      </Card>
      <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }} data-testid="profile-appearance-card"><Stack gap="lg">
        <Title order={3}>Profile appearance</Title>
        <Stack gap="sm"><Group align="center" wrap="wrap">
          <ProfileAvatar displayName={profile.displayName} email={profile.email} avatarColor={lastValidColor} avatarUrl={displayedAvatarUrl} size={88} />
          <Group gap="xs" wrap="wrap">
            <FileButton onChange={selectPhoto} accept="image/jpeg,image/png,image/webp">{(props) => <Button {...props} variant="light" leftSection={<IconPhoto size={17} />} disabled={savingPhoto || removingPhoto}>{avatarUrl || selectedFile ? "Change photo" : "Upload photo"}</Button>}</FileButton>
            {selectedFile ? <><Button onClick={savePhoto} loading={savingPhoto} disabled={removingPhoto}>Save photo</Button><Button variant="default" leftSection={<IconX size={16} />} onClick={clearLocalPreview} disabled={savingPhoto}>Cancel</Button></> : avatarUrl ? <Button data-testid="open-remove-photo-modal" color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={() => setRemovePhotoModalOpen(true)}>Remove photo</Button> : null}
          </Group>
        </Group><Text size="xs" c="dimmed">JPEG, PNG, or WebP. Maximum 5 MB.</Text></Stack>
        <Divider />
        <ColorInput label="Avatar fallback color" description="Used whenever your profile photo is removed or unavailable. Six-digit HEX value." value={draftColor} onChange={handleColorChange} error={error} format="hex" withEyeDropper={false} swatches={[]} />
        <Group justify="flex-end"><Button onClick={save} disabled={!canSave} loading={saving}>Save changes</Button></Group>
      </Stack></Card>
    </Stack>
    <Modal
      opened={removePhotoModalOpen}
      onClose={() => { if (!removingPhoto) setRemovePhotoModalOpen(false); }}
      title="Remove profile photo?"
      centered
      closeOnClickOutside={!removingPhoto}
      closeOnEscape={!removingPhoto}
      withCloseButton={!removingPhoto}
    >
      <Stack gap="lg">
        <Text size="sm">Are you sure you want to remove your profile photo? Your initials and fallback color will be shown instead.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setRemovePhotoModalOpen(false)} disabled={removingPhoto} autoFocus>Cancel</Button>
          <Button color="red" onClick={removePhoto} loading={removingPhoto} disabled={removingPhoto}>Remove photo</Button>
        </Group>
      </Stack>
    </Modal>
  </Box>;
}
