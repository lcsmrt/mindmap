export interface MapSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  criticalCount: number;
}

export interface MapDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapListResponse {
  maps: MapSummary[];
}

export interface CreateMapBody {
  title: string;
}

export interface UpdateMapBody {
  title: string;
}
