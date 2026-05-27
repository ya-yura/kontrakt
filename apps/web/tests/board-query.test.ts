import test from "node:test";
import assert from "node:assert/strict";
import {
  findBoardStagesForUser,
  type BoardStageQueryStore,
  type BoardStageRecord
} from "../src/board/queries";

type StoredBoardStage = BoardStageRecord & {
  ownerId: string;
  position: number;
};

class MemoryBoardStageQueryStore implements BoardStageQueryStore {
  readonly stages: StoredBoardStage[] = [];
  lastOwnerId: string | null = null;

  readonly kanbanStage = {
    findMany: async (args: Parameters<BoardStageQueryStore["kanbanStage"]["findMany"]>[0]) => {
      this.lastOwnerId = args.where.ownerId;

      return this.stages
        .filter((stage) => stage.ownerId === args.where.ownerId)
        .sort((left, right) => left.position - right.position)
        .map(({ code, name, description, isTerminal }) => ({
          code,
          name,
          description,
          isTerminal
        }));
    }
  };
}

test("findBoardStagesForUser returns only stages owned by the current user", async () => {
  const store = new MemoryBoardStageQueryStore();
  store.stages.push(
    {
      ownerId: "user-2",
      code: "INBOX",
      name: "Other Inbox",
      description: null,
      position: 100,
      isTerminal: false
    },
    {
      ownerId: "user-1",
      code: "GO",
      name: "Go",
      description: null,
      position: 200,
      isTerminal: false
    },
    {
      ownerId: "user-1",
      code: "INBOX",
      name: "Inbox",
      description: null,
      position: 100,
      isTerminal: false
    }
  );

  const stages = await findBoardStagesForUser(store, "user-1");

  assert.equal(store.lastOwnerId, "user-1");
  assert.deepEqual(
    stages.map((stage) => stage.code),
    ["INBOX", "GO"]
  );
  assert.equal(stages.some((stage) => stage.name === "Other Inbox"), false);
});
