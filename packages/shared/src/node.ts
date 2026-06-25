export interface NodeDto {
  id: string;
  mapId: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  bgColor: string | null;
  textColor: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | null;
  assignee: string | null;
  isCritical: boolean;
  side: 'LEFT' | 'RIGHT' | null;
  createdAt: string;
  updatedAt: string;
}

export interface NodeListResponse {
  nodes: NodeDto[];
}

export interface CreateNodeBody {
  mapId: string;
  parentId: string;
  title: string;
}

export interface UpdateNodeBody {
  title?: string;
  bgColor?: string | null;
  textColor?: string | null;
  status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | null;
  assignee?: string | null;
  isCritical?: boolean;
}

export interface MoveNodeBody {
  parentId: string;
  index: number;
  side?: 'LEFT' | 'RIGHT';
}
