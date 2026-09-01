import { describe, expect, it } from "vitest";
import { deriveHistoryTree } from "./history-tree";

const folders = [
  { id: "recipes", name: "Recipes" },
  { id: "math", name: "Math" },
  { id: "empty", name: "Empty" },
];
const chats = [
  { id: "pizza", title: "Simple Homemade Pizza Recipe Guide", folder_id: "recipes" },
  { id: "lasagna", title: "Simple Weeknight Lasagna Recipe Guide", folder_id: "recipes" },
  { id: "equation", title: "Simple Math Problem Answer", folder_id: "math" },
  { id: "loose", title: "Chat from today", folder_id: null },
];

describe("deriveHistoryTree", () => {
  it("shows a matching folder name without revealing unrelated children", () => {
    const tree = deriveHistoryTree(folders, chats, "  RECIPES ");
    expect(tree.visibleFolders.map(({ folder }) => folder.id)).toEqual(["recipes"]);
    expect(tree.visibleFolders[0].chats).toEqual([]);
    expect(tree.noFolderChats).toEqual([]);
  });

  it("shows a matching child under its nonmatching parent and hides sibling chats and empty shells", () => {
    const tree = deriveHistoryTree(folders, chats, "pizza");
    expect(tree.visibleFolders).toEqual([{
      folder: folders[0], chats: [chats[0]], nameMatches: false,
    }]);
  });

  it("shows only matching No Folder chats and hides the section when none match", () => {
    expect(deriveHistoryTree(folders, chats, "chat").noFolderChats).toEqual([chats[3]]);
    expect(deriveHistoryTree(folders, chats, "math").noFolderChats).toEqual([]);
  });

  it("restores the complete tree for an empty or whitespace-only query", () => {
    const tree = deriveHistoryTree(folders, chats, "   ");
    expect(tree.visibleFolders.map(({ folder }) => folder.id)).toEqual(["recipes", "math", "empty"]);
    expect(tree.visibleFolders[0].chats).toEqual([chats[0], chats[1]]);
    expect(tree.noFolderChats).toEqual([chats[3]]);
  });

  it("hides folders without surviving chats when another history filter is active", () => {
    const tree = deriveHistoryTree(folders, [chats[0]], "", true);
    expect(tree.visibleFolders.map(({ folder }) => folder.id)).toEqual(["recipes"]);
  });
});
