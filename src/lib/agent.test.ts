import assert from "node:assert/strict";
import test from "node:test";

import { seededUsers } from "@/db/seed-data";
import {
  executeAgentAction,
  getAgentThread,
  resetAgentFallbackStore,
  sendAgentMessage,
} from "@/lib/agent";
import {
  getKnowledgeBaseView,
  getPageRevisions,
  resetFallbackKnowledgeBase,
  savePage,
} from "@/lib/knowledge-base";

function resetAllState() {
  resetFallbackKnowledgeBase();
  resetAgentFallbackStore();
}

test("agent thread is created once per user and reused", async () => {
  resetAllState();

  const firstThread = await getAgentThread({ actingUserId: seededUsers[0].id });
  const secondThread = await getAgentThread({ actingUserId: seededUsers[0].id });

  assert.equal(firstThread.id, secondThread.id);
  assert.equal(firstThread.agentKey, "shvr-research-agent");
});

test("agent can ground responses in a user's private readable page when it is attached", async () => {
  resetAllState();

  const result = await sendAgentMessage({
    actingUserId: seededUsers[0].id,
    content: "Summarize what this page is about.",
    attachments: [
      {
        entityId: "30000000-0000-4000-8000-000000000001",
        entityType: "page",
        href: "/?page=30000000-0000-4000-8000-000000000001",
        label: "Daily briefing",
      },
    ],
  });

  assert.equal(result.assistantMessage.role, "assistant");
  assert.ok(result.assistantMessage.citations.some((citation) => citation.pageId === "30000000-0000-4000-8000-000000000001"));
});

test("attaching a parent page expands retrieval to readable descendant pages", async () => {
  resetAllState();

  const result = await sendAgentMessage({
    actingUserId: seededUsers[2].id,
    content: "What is included in these operations materials?",
    attachments: [
      {
        entityId: "30000000-0000-4000-8000-000000000010",
        entityType: "page",
        href: "/?page=30000000-0000-4000-8000-000000000010",
        label: "Operations",
      },
    ],
  });

  assert.ok(
    result.assistantMessage.citations.some(
      (citation) => citation.pageId === "30000000-0000-4000-8000-000000000011",
    ),
  );
});

test("attached page subtree expansion still respects unreadable descendants", async () => {
  resetAllState();

  const result = await sendAgentMessage({
    actingUserId: seededUsers[0].id,
    content: "Summarize this strategy area.",
    attachments: [
      {
        entityId: "30000000-0000-4000-8000-000000000010",
        entityType: "page",
        href: "/?page=30000000-0000-4000-8000-000000000010",
        label: "Operations",
      },
    ],
  });

  assert.ok(
    result.assistantMessage.citations.every(
      (citation) => citation.pageId !== "30000000-0000-4000-8000-000000000013",
    ),
  );
});

test("agent rejects attachments to unreadable pages", async () => {
  resetAllState();

  await assert.rejects(
    sendAgentMessage({
      actingUserId: seededUsers[0].id,
      content: "Use this restricted page.",
      attachments: [
        {
          entityId: "30000000-0000-4000-8000-000000000014",
          entityType: "page",
          href: "/?page=30000000-0000-4000-8000-000000000014",
          label: "Finance",
        },
      ],
    }),
    /not readable/i,
  );
});

test("agent patch proposals create generic actions that can be applied", async () => {
  resetAllState();

  const sendResult = await sendAgentMessage({
    actingUserId: seededUsers[0].id,
    content: "Please update this page with a clearer summary.",
    attachments: [
      {
        entityId: "30000000-0000-4000-8000-000000000001",
        entityType: "page",
        href: "/?page=30000000-0000-4000-8000-000000000001",
        label: "Daily briefing",
      },
    ],
  });

  assert.ok(sendResult.assistantMessage.patchProposal);
  assert.equal(sendResult.assistantMessage.actions.length, 2);

  const applyAction = sendResult.assistantMessage.actions.find(
    (action) => action.actionType === "apply_page_patch",
  );

  assert.ok(applyAction);

  const threadAfterApply = await executeAgentAction({
    actingUserId: seededUsers[0].id,
    actionId: applyAction!.id,
  });
  const updatedMessage = threadAfterApply.messages.find(
    (message) => message.id === sendResult.assistantMessage.id,
  );
  const revisions = await getPageRevisions({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });
  const updatedView = await getKnowledgeBaseView({
    userId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });

  assert.ok(updatedMessage);
  assert.equal(updatedMessage?.actions.find((action) => action.actionType === "apply_page_patch")?.status, "completed");
  assert.match(
    updatedView.selectedRevision?.contentMarkdown ?? "",
    /## Agent proposal/,
  );
  assert.equal(revisions[0]?.revisionNumber, 2);
});

test("discarding a patch marks both patch actions unavailable", async () => {
  resetAllState();

  const sendResult = await sendAgentMessage({
    actingUserId: seededUsers[0].id,
    content: "Rewrite this page.",
    attachments: [
      {
        entityId: "30000000-0000-4000-8000-000000000001",
        entityType: "page",
        href: "/?page=30000000-0000-4000-8000-000000000001",
        label: "Daily briefing",
      },
    ],
  });
  const discardAction = sendResult.assistantMessage.actions.find(
    (action) => action.actionType === "discard_page_patch",
  );

  assert.ok(discardAction);

  const threadAfterDiscard = await executeAgentAction({
    actingUserId: seededUsers[0].id,
    actionId: discardAction!.id,
  });
  const updatedMessage = threadAfterDiscard.messages.find(
    (message) => message.id === sendResult.assistantMessage.id,
  );

  assert.ok(updatedMessage);
  assert.ok(updatedMessage?.actions.every((action) => action.status !== "pending"));
});

test("applying an agent patch clears stale drafts so the new revision is visible", async () => {
  resetAllState();

  await savePage({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
    title: "Daily briefing draft",
    contentMarkdown: "# Daily briefing draft\n\nThis stale draft should be cleared.",
    currentRevisionId: "40000000-0000-4000-8000-000000000001",
    editorSessionId: "editor-session-for-agent-test",
    saveMode: "autosave",
  });

  const sendResult = await sendAgentMessage({
    actingUserId: seededUsers[0].id,
    content: "Please update this page with a clearer summary.",
    attachments: [
      {
        entityId: "30000000-0000-4000-8000-000000000001",
        entityType: "page",
        href: "/?page=30000000-0000-4000-8000-000000000001",
        label: "Daily briefing",
      },
    ],
  });
  const applyAction = sendResult.assistantMessage.actions.find(
    (action) => action.actionType === "apply_page_patch",
  );

  assert.ok(applyAction);

  await executeAgentAction({
    actingUserId: seededUsers[0].id,
    actionId: applyAction!.id,
  });

  const viewAfterApply = await getKnowledgeBaseView({
    userId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });

  assert.equal(viewAfterApply.selectedDraft, null);
  assert.match(viewAfterApply.selectedRevision?.contentMarkdown ?? "", /## Agent proposal/);
});
