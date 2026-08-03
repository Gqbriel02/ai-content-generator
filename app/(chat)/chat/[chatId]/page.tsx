import { ChatShell } from "@/components/chat/chat-shell";

export default async function ChatPage(props: PageProps<"/chat/[chatId]">) {
  const { chatId } = await props.params;
  return <ChatShell chatId={chatId} />;
}
