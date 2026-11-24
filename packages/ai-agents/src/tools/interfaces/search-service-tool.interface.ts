import { Result, AgentError } from '../../core';

export interface SearchCandidateSpace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  hourlyRate: number;
  evCharging: boolean;
  covered: boolean;
  recommendationScore: number;
}

export interface SearchQueryParams {
  query?: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  evOnly?: boolean;
  coveredOnly?: boolean;
  maxRate?: number;
}

export interface ISearchServiceTool {
  searchSpaces(params: SearchQueryParams): Promise<Result<SearchCandidateSpace[], AgentError>>;
}
