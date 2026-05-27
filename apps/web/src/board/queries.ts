export type BoardStageRecord = {
  code: string;
  name: string;
  description: string | null;
  isTerminal: boolean;
};

export type BoardStageQueryStore = {
  kanbanStage: {
    findMany(args: {
      where: {
        ownerId: string;
      };
      orderBy: {
        position: "asc";
      };
      select: {
        code: true;
        name: true;
        description: true;
        isTerminal: true;
      };
    }): Promise<BoardStageRecord[]>;
  };
};

export function findBoardStagesForUser(store: BoardStageQueryStore, userId: string) {
  return store.kanbanStage.findMany({
    where: {
      ownerId: userId
    },
    orderBy: {
      position: "asc"
    },
    select: {
      code: true,
      name: true,
      description: true,
      isTerminal: true
    }
  });
}
