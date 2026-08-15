export type HistoryFolder = { id: string; name: string };
export type HistoryTreeChat = { id: string; title: string; folder_id: string | null };

export function deriveHistoryTree<TFolder extends HistoryFolder, TChat extends HistoryTreeChat>(
  folders: TFolder[],
  chats: TChat[],
  search: string,
) {
  const needle = search.trim().toLocaleLowerCase();
  const matchingChats = needle
    ? chats.filter((chat) => chat.title.toLocaleLowerCase().includes(needle))
    : chats;
  const chatsByFolder = new Map<string, TChat[]>();

  for (const chat of matchingChats) {
    if (!chat.folder_id) continue;
    const folderChats = chatsByFolder.get(chat.folder_id) ?? [];
    folderChats.push(chat);
    chatsByFolder.set(chat.folder_id, folderChats);
  }

  const visibleFolders = folders
    .map((folder) => ({
      folder,
      chats: chatsByFolder.get(folder.id) ?? [],
      nameMatches: Boolean(needle && folder.name.toLocaleLowerCase().includes(needle)),
    }))
    .filter(({ chats: childChats, nameMatches }) => !needle || nameMatches || childChats.length > 0);

  return {
    visibleFolders,
    noFolderChats: matchingChats.filter((chat) => !chat.folder_id),
  };
}
