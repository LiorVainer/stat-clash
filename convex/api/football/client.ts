'use node';

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

// Base generic response type
import { BaseLogger } from '../../logs/base-logger.logger';
import type { AxiosInstance, AxiosRequestConfig, HeadersDefaults, ResponseType } from 'axios';
import axios from 'axios';

export interface BaseResponse<TResponse = object, TParameters = object, TErrors = object | any[]> {
    get?: string;
    parameters?: TParameters;
    errors?: TErrors;
    results?: number;
    paging?: {
        current?: number;
        total?: number;
    };
    response?: TResponse;
}

export interface ApiResponse extends BaseResponse {}

export interface PlayerInjuryInfo {
    /** @example 276 */
    id?: number;
    /** @example "Neymar Jr" */
    name?: string;
    /** @format url */
    photo?: string;
    type?: string;
    reason?: string;
}

export interface TeamInfo {
    id?: number;
    name?: string;
    /** @format url */
    logo?: string;
}

export interface FixtureInfo {
    id?: number;
    timezone?: string;
    /** @format date-time */
    date?: string;
    /** @format int64 */
    timestamp?: number;
}

export interface Injury {
    player?: PlayerInjuryInfo;
    team?: TeamInfo;
    fixture?: FixtureInfo;
}

export interface InjuriesApiResponse extends BaseResponse<Injury[]> {}

export interface LeagueCountry {
    name?: string;
    code?: string | null;
    /** @format url */
    flag?: string | null;
}

export interface LeagueCoverageFixtures {
    events?: boolean;
    lineups?: boolean;
    statistics_fixtures?: boolean;
    statistics_players?: boolean;
}

export interface LeagueCoverage {
    fixtures?: LeagueCoverageFixtures;
    standings?: boolean;
    players?: boolean;
    top_scorers?: boolean;
    top_assists?: boolean;
    top_cards?: boolean;
    injuries?: boolean;
    predictions?: boolean;
    odds?: boolean;
}

export interface LeagueInfo {
    id?: number;
    name?: string;
    type?: string;
    /** @format url */
    logo?: string;
}

export interface LeagueSeason {
    year?: number;
    /** @format date */
    start?: string;
    /** @format date */
    end?: string;
    current?: boolean;
    coverage?: LeagueCoverage;
}

export interface League {
    league?: LeagueInfo;
    country?: LeagueCountry;
    seasons?: LeagueSeason[];
}

export interface LeaguesApiResponse extends BaseResponse<League[]> {}

export interface Player {
    id?: number;
    name?: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    birth?: {
        /** @format date */
        date?: string;
        place?: string;
        country?: string;
    };
    nationality?: string;
    height?: string;
    weight?: string;
    injured?: boolean;
    /** @format url */
    photo?: string;
}

export interface TeamStats {
    id?: number;
    name?: string;
    /** @format url */
    logo?: string;
}

export interface LeagueStats {
    id?: number;
    name?: string;
    country?: string;
    /** @format url */
    logo?: string;
    /** @format url */
    flag?: string;
    season?: number;
}

export interface GamesStats {
    appearences?: number;
    lineups?: number;
    minutes?: number;
    number?: number | null;
    position?: string;
    rating?: string;
    captain?: boolean;
}

export interface SubstitutesStats {
    in?: number;
    out?: number;
    bench?: number;
}

export interface ShotsStats {
    total?: number;
    on?: number;
}

export interface GoalsStats {
    total?: number | null;
    conceded?: number | null;
    assists?: number | null;
    saves?: number | null;
}

export interface PassesStats {
    total?: number;
    key?: number;
    accuracy?: number;
}

export interface TacklesStats {
    total?: number | null;
    blocks?: number | null;
    interceptions?: number | null;
}

export interface DuelsStats {
    total?: number | null;
    won?: number | null;
}

export interface DribblesStats {
    attempts?: number;
    success?: number;
    past?: number | null;
}

export interface FoulsStats {
    drawn?: number;
    committed?: number;
}

export interface CardsStats {
    yellow?: number;
    yellowred?: number;
    red?: number;
}

export interface PenaltyStats {
    won?: number | null;
    commited?: number | null;
    scored?: number;
    missed?: number;
    saved?: number | null;
}

export interface PlayerStatistics {
    team?: TeamStats;
    league?: LeagueStats;
    games?: GamesStats;
    substitutes?: SubstitutesStats;
    shots?: ShotsStats;
    goals?: GoalsStats;
    passes?: PassesStats;
    tackles?: TacklesStats;
    duels?: DuelsStats;
    dribbles?: DribblesStats;
    fouls?: FoulsStats;
    cards?: CardsStats;
    penalty?: PenaltyStats;
}

export interface PlayerWithStats {
    player?: Player;
    statistics?: PlayerStatistics[];
}

export interface PlayersApiResponse extends BaseResponse<PlayerWithStats[]> {}

export interface FixturesPlayersApiResponse
    extends BaseResponse<
        {
            team?: {
                id?: number;
                name?: string;
                /** @format url */
                logo?: string;
                /** @format date-time */
                update?: string;
            };
            players?: {
                player?: Player;
                statistics?: PlayerStatistics[];
            }[];
        }[]
    > {}

export interface FixturesApiResponse
    extends BaseResponse<
        {
            fixture?: {
                id?: number;
                referee?: string | null;
                timezone?: string;
                /** @format date-time */
                date?: string;
                timestamp?: number;
                periods?: {
                    first?: number | null;
                    second?: number | null;
                };
                venue?: {
                    id?: number;
                    name?: string;
                    city?: string;
                };
                status?: {
                    long?: string;
                    short?: string;
                    elapsed?: number | null;
                    extra?: string | null;
                };
            };
            league?: LeagueStats;
            teams?: {
                home?: TeamStats;
                away?: TeamStats;
            };
            goals?: {
                home?: number | null;
                away?: number | null;
            };
            score?: {
                halftime?: {
                    home?: number | null;
                    away?: number | null;
                };
                fulltime?: {
                    home?: number | null;
                    away?: number | null;
                };
                extratime?: {
                    home?: number | null;
                    away?: number | null;
                };
                penalty?: {
                    home?: number | null;
                    away?: number | null;
                };
            };
        }[]
    > {}

export interface StandingsApiResponse
    extends BaseResponse<
        {
            league?: LeagueStats & {
                standings?: {
                    rank?: number;
                    team?: TeamStats;
                    points?: number;
                    goalsDiff?: number;
                    group?: string;
                    form?: string;
                    status?: string;
                    description?: string;
                    all?: object;
                    home?: object;
                    away?: object;
                    /** @format date-time */
                    update?: string;
                }[][];
            };
        }[]
    > {}

export interface TeamStatisticsApiResponse
    extends BaseResponse<{
        league?: LeagueStats;
        team?: TeamStats;
        form?: string;
        fixtures?: object;
        goals?: object;
        biggest?: object;
        clean_sheet?: object;
        failed_to_score?: object;
        penalty?: object;
        lineups?: {
            formation?: string;
            played?: number;
        }[];
        cards?: object;
    }> {}

export interface TeamsApiResponse
    extends BaseResponse<
        {
            team?: {
                id?: number;
                name?: string;
                code?: string;
                country?: string;
                founded?: number;
                national?: boolean;
                /** @format url */
                logo?: string;
            };
            venue?: {
                id?: number;
                name?: string;
                address?: string;
                city?: string;
                capacity?: number;
                surface?: string;
                /** @format url */
                image?: string;
            };
        }[]
    > {}

export interface TransfersApiResponse
    extends BaseResponse<
        {
            player?: {
                id?: number;
                name?: string;
            };
            /** @format date-time */
            update?: string;
            transfers?: {
                /** @format date */
                date?: string;
                type?: string | null;
                teams?: {
                    in?: TeamInfo;
                    out?: TeamInfo;
                };
            }[];
        }[]
    > {}

export interface TrophiesApiResponse
    extends BaseResponse<
        {
            league?: string;
            country?: string;
            season?: string;
            place?: string;
        }[]
    > {}

export type TimezoneResponse = ApiResponse;

export type CountriesResponse = ApiResponse;

export type LeaguesResponse = LeaguesApiResponse;

export type LeaguesSeasonsResponse = ApiResponse;

export type TeamsResponse = TeamsApiResponse;

export interface TeamsStatisticsResponse
    extends BaseResponse<
        {
            league?: LeagueStats;
            team?: TeamStats;
            form?: string;
            fixtures?: {
                played?: {
                    home?: number;
                    away?: number;
                    total?: number;
                };
                wins?: {
                    home?: number;
                    away?: number;
                    total?: number;
                };
                draws?: {
                    home?: number;
                    away?: number;
                    total?: number;
                };
                loses?: {
                    home?: number;
                    away?: number;
                    total?: number;
                };
            };
            goals?: {
                for?: {
                    total?: {
                        home?: number;
                        away?: number;
                        total?: number;
                    };
                    average?: {
                        home?: string;
                        away?: string;
                        total?: string;
                    };
                    minute?: {
                        '0-15'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '16-30'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '31-45'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '46-60'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '61-75'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '76-90'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '91-105'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '106-120'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                    };
                    under_over?: {
                        '0.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '1.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '2.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '3.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '4.5'?: {
                            over?: number;
                            under?: number;
                        };
                    };
                };
                against?: {
                    total?: {
                        home?: number;
                        away?: number;
                        total?: number;
                    };
                    average?: {
                        home?: string;
                        away?: string;
                        total?: string;
                    };
                    minute?: {
                        '0-15'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '16-30'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '31-45'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '46-60'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '61-75'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '76-90'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '91-105'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                        '106-120'?: {
                            total?: number | null;
                            percentage?: string | null;
                        };
                    };
                    under_over?: {
                        '0.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '1.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '2.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '3.5'?: {
                            over?: number;
                            under?: number;
                        };
                        '4.5'?: {
                            over?: number;
                            under?: number;
                        };
                    };
                };
            };
            biggest?: {
                streak?: {
                    wins?: number;
                    draws?: number;
                    loses?: number;
                };
                wins?: {
                    home?: string;
                    away?: string;
                };
                loses?: {
                    home?: string;
                    away?: string;
                };
                goals?: {
                    for?: {
                        home?: number;
                        away?: number;
                    };
                    against?: {
                        home?: number;
                        away?: number;
                    };
                };
            };
            clean_sheet?: {
                home?: number;
                away?: number;
                total?: number;
            };
            failed_to_score?: {
                home?: number;
                away?: number;
                total?: number;
            };
            penalty?: {
                scored?: {
                    total?: number;
                    percentage?: string;
                };
                missed?: {
                    total?: number;
                    percentage?: string;
                };
                total?: number;
            };
            lineups?: {
                formation?: string;
                played?: number;
            }[];
            cards?: {
                yellow?: {
                    '0-15'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '16-30'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '31-45'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '46-60'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '61-75'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '76-90'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '91-105'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '106-120'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                };
                red?: {
                    '0-15'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '16-30'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '31-45'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '46-60'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '61-75'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '76-90'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '91-105'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                    '106-120'?: {
                        total?: number | null;
                        percentage?: string | null;
                    };
                };
            };
        },
        {
            /** @example "39" */
            league?: string;
            /** @example "2019" */
            season?: string;
            /** @example "33" */
            team?: string;
        }
    > {}

export type TeamsSeasonsResponse = ApiResponse;

export type TeamsCountriesResponse = ApiResponse;

export type VenuesResponse = ApiResponse;

export type StandingsResponse = StandingsApiResponse;

export type FixturesRoundsResponse = ApiResponse;

export type FixturesResponse = FixturesApiResponse;

export type FixturesHeadtoheadResponse = ApiResponse;

export type FixturesStatisticsResponse = ApiResponse;

export type FixturesEventsResponse = ApiResponse;

export type FixturesLineupsResponse = ApiResponse;

export type FixturesPlayersResponse = FixturesPlayersApiResponse;

export type InjuriesResponse = InjuriesApiResponse;

export type PredictionsResponse = ApiResponse;

export type CoachsResponse = ApiResponse;

export type PlayersSeasonsResponse = ApiResponse;

export type SinglePlayersResponse = PlayerWithStats;

export interface PlayersResponseFull
    extends BaseResponse<
        SinglePlayersResponse[],
        {
            /** @example "276" */
            id?: string;
            /** @example "2019" */
            season?: string;
        }
    > {}

export type PlayersSquadsResponse = SquadsResponse;

export interface PlayersTopscorersResponse extends BaseResponse<PlayerWithStats[]> {}

export interface PlayersTopassistsResponse extends BaseResponse<PlayerWithStats[]> {}

export interface PlayersTopyellowcardsResponse extends BaseResponse<PlayerWithStats[]> {}

export interface PlayersTopredcardsResponse extends BaseResponse<PlayerWithStats[]> {}

export type TransfersResponse = TransfersApiResponse;

export type TrophiesResponse = TrophiesApiResponse;

export type SidelinedResponse = ApiResponse;

export type OddsResponse = ApiResponse;

export type OddsLiveResponse = ApiResponse;

export type OddsBookmakersResponse = ApiResponse;

export type OddsBetsResponse = ApiResponse;

export interface PlayersProfilesResponse
    extends BaseResponse<
        {
            player?: Player & {
                number?: number | null;
                position?: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';
            };
        }[],
        {
            /** @example "276" */
            player?: string;
        }
    > {}

export interface SquadsResponse
    extends BaseResponse<
        {
            team: {
                id: number;
                name: string;
                /** @format uri */
                logo: string;
            };
            players: {
                id: number;
                name: string;
                age: number;
                number?: number | null;
                position: string;
                /** @format uri */
                photo: string;
            }[];
        }[]
    > {}

export type TimezoneListData = TimezoneResponse;

export interface CountriesListParams {
    name?: string;
    code?: string;
    search?: string;
}

export type CountriesListData = CountriesResponse;

export interface LeaguesListParams {
    id?: number;
    name?: string;
    country?: string;
    code?: string;
    season?: number;
    team?: number;
    type?: 'league' | 'cup';
    current?: 'true' | 'false';
    search?: string;
    last?: number;
}

export type LeaguesListData = LeaguesResponse;

export type SeasonsListData = LeaguesSeasonsResponse;

export interface TeamsListParams {
    id?: number;
    name?: string;
    league?: number;
    season?: number;
    country?: string;
    code?: string;
    venue?: number;
    search?: string;
}

export type TeamsListData = TeamsResponse;

export interface StatisticsListParams {
    /** League ID */
    league: number;
    /** Season year */
    season: number;
    /** Team ID */
    team: number;
    /** @format date */
    date?: string;
}

export type StatisticsListData = TeamsStatisticsResponse;

export interface SeasonsListParams1 {
    team: number;
}

export type SeasonsListResult = TeamsSeasonsResponse;

export type CountriesListResult = TeamsCountriesResponse;

export interface VenuesListParams {
    id?: number;
    name?: string;
    city?: string;
    country?: string;
    search?: string;
}

export type VenuesListData = VenuesResponse;

export interface StandingsListParams {
    league: number;
    season: number;
    team?: number;
}

export type StandingsListData = StandingsResponse;

export interface RoundsListParams {
    league: number;
    season: number;
    current?: boolean;
}

export type RoundsListData = FixturesRoundsResponse;

export interface FixturesListParams {
    id?: number;
    /** Comma-separated list of fixture IDs (max 20) */
    ids?: string;
    live?: string;
    /** @format date */
    date?: string;
    league?: number;
    season?: number;
    team?: number;
    last?: number;
    next?: number;
    /** @format date */
    from?: string;
    /** @format date */
    to?: string;
    round?: string;
    status?: string;
    venue?: number;
    timezone?: string;
}

export type FixturesListData = FixturesResponse;

export interface HeadtoheadListParams {
    /** Two team IDs separated by a dash (e.g., 33-34) */
    h2h: string;
    /** @format date */
    date?: string;
}

export type HeadtoheadListData = FixturesHeadtoheadResponse;

export interface StatisticsListParams2 {
    fixture: number;
    team?: number;
    type?: string;
}

export type StatisticsListResult = FixturesStatisticsResponse;

export interface EventsListParams {
    fixture: number;
    team?: number;
    player?: number;
    type?: 'Goal' | 'Card' | 'Subst' | 'Var';
}

export type EventsListData = FixturesEventsResponse;

export interface LineupsListParams {
    fixture: number;
    team?: number;
}

export type LineupsListData = FixturesLineupsResponse;

export interface PlayersListParams {
    fixture: number;
    team?: number;
}

export type PlayersListData = FixturesPlayersResponse;

export interface InjuriesListParams {
    fixture?: number;
    league?: number;
    season?: number;
    team?: number;
    player?: number;
    /** @format date */
    date?: string;
    timezone?: string;
}

export type InjuriesListData = InjuriesResponse;

export interface PredictionsListParams {
    fixture: number;
}

export type PredictionsListData = PredictionsResponse;

export interface CoachsListParams {
    id?: number;
    team?: number;
    search?: string;
}

export type CoachsListData = CoachsResponse;

export type SeasonsListOutput = PlayersSeasonsResponse;

export interface PlayersListParams2 {
    /** Player ID */
    id: number;
    team?: number;
    league?: number;
    /** Season year */
    season: number;
    search?: string;
    page?: number;
}

export type PlayersListResult = PlayersResponseFull;

export interface SquadsListParams {
    /** Team ID */
    team: number;
    player?: number;
}

export type SquadsListData = PlayersSquadsResponse;

export type LeaguesSeasonParams = {
    league: number;
    season: number;
};

export type TopscorersListParams = LeaguesSeasonParams;

export type TopscorersListData = PlayersTopscorersResponse;

export type TopassistsListParams = LeaguesSeasonParams;

export type TopassistsListData = PlayersTopassistsResponse;

export type TopyellowcardsListParams = LeaguesSeasonParams;

export type TopyellowcardsListData = PlayersTopyellowcardsResponse;

export type TopredcardsListParams = LeaguesSeasonParams;

export type TopredcardsListData = PlayersTopredcardsResponse;

export interface TransfersListParams {
    player?: number;
    team?: number;
}

export type TransfersListData = TransfersResponse;

export interface TrophiesListParams {
    player?: number;
    coach?: number;
}

export type TrophiesListData = TrophiesResponse;

export interface SidelinedListParams {
    player?: number;
    coach?: number;
}

export type SidelinedListData = SidelinedResponse;

export interface OddsListParams {
    fixture?: number;
    league?: number;
    season?: number;
    /** @format date */
    date?: string;
    page?: number;
    bookmaker?: number;
    bet?: number;
}

export type OddsListData = OddsResponse;

export interface LiveListParams {
    fixture?: number;
    league?: number;
    bet?: number;
}

export type LiveListData = OddsLiveResponse;

export interface BookmakersListParams {
    id?: number;
    search?: string;
}

export type BookmakersListData = OddsBookmakersResponse;

export interface BetsListParams {
    id?: number;
    search?: string;
}

export type BetsListData = OddsBetsResponse;

export interface ProfilesListParams {
    /** Player ID */
    player: number;
}

export type ProfilesListData = PlayersProfilesResponse;

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams extends Omit<AxiosRequestConfig, 'data' | 'params' | 'url' | 'responseType'> {
    /** set parameter to `true` for call `securityWorker` for this request */
    secure?: boolean;
    /** request path */
    path: string;
    /** content type of request body */
    type?: ContentType;
    /** query params */
    query?: QueryParamsType;
    /** format of response (i.e. response.json() -> format: "json") */
    format?: ResponseType;
    /** request body */
    body?: unknown;
}

export type RequestParams = Omit<FullRequestParams, 'body' | 'method' | 'query' | 'path'>;

export interface ApiConfig<SecurityDataType = unknown> extends Omit<AxiosRequestConfig, 'data' | 'cancelToken'> {
    securityWorker?: (
        securityData: SecurityDataType | null,
    ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
    secure?: boolean;
    format?: ResponseType;
}

export enum ContentType {
    Json = 'application/json',
    JsonApi = 'application/vnd.api+json',
    FormData = 'multipart/form-data',
    UrlEncoded = 'application/x-www-form-urlencoded',
    Text = 'text/plain',
}

export class HttpClient<SecurityDataType = unknown> {
    public instance: AxiosInstance;
    private securityData: SecurityDataType | null = null;
    private securityWorker?: ApiConfig<SecurityDataType>['securityWorker'];
    private secure?: boolean;
    private format?: ResponseType;

    constructor({ securityWorker, secure, format, ...axiosConfig }: ApiConfig<SecurityDataType> = {}) {
        this.instance = axios.create({
            ...axiosConfig,
            baseURL: axiosConfig.baseURL || 'https://v3.football.api-sports.io',
        });
        this.secure = secure;
        this.format = format;
        this.securityWorker = securityWorker;
    }

    public setSecurityData = (data: SecurityDataType | null) => {
        this.securityData = data;
    };

    protected mergeRequestParams(params1: AxiosRequestConfig, params2?: AxiosRequestConfig): AxiosRequestConfig {
        const method = params1.method || (params2 && params2.method);

        return {
            ...this.instance.defaults,
            ...params1,
            ...(params2 || {}),
            headers: {
                ...((method && this.instance.defaults.headers[method.toLowerCase() as keyof HeadersDefaults]) || {}),
                ...(params1.headers || {}),
                ...((params2 && params2.headers) || {}),
            },
        };
    }

    protected stringifyFormItem(formItem: unknown) {
        if (typeof formItem === 'object' && formItem !== null) {
            return JSON.stringify(formItem);
        } else {
            return `${formItem}`;
        }
    }

    protected createFormData(input: Record<string, unknown>): FormData {
        if (input instanceof FormData) {
            return input;
        }
        return Object.keys(input || {}).reduce((formData, key) => {
            const property = input[key];
            const propertyContent: any[] = property instanceof Array ? property : [property];

            for (const formItem of propertyContent) {
                const isFileType = formItem instanceof Blob || formItem instanceof File;
                formData.append(key, isFileType ? formItem : this.stringifyFormItem(formItem));
            }

            return formData;
        }, new FormData());
    }

    async request<T extends BaseResponse = BaseResponse, _E = any>({
        secure,
        path,
        type,
        query,
        format,
        body,
        ...params
    }: FullRequestParams): Promise<T> {
        const secureParams =
            ((typeof secure === 'boolean' ? secure : this.secure) &&
                this.securityWorker &&
                (await this.securityWorker(this.securityData))) ||
            {};
        const requestParams = this.mergeRequestParams(params, secureParams);
        const responseFormat = format || this.format || undefined;

        if (type === ContentType.FormData && body && body !== null && typeof body === 'object') {
            body = this.createFormData(body as Record<string, unknown>);
        }

        if (type === ContentType.Text && body && body !== null && typeof body !== 'string') {
            body = JSON.stringify(body);
        }

        return this.instance
            .request<T>({
                ...requestParams,
                headers: {
                    ...(requestParams.headers || {}),
                    ...(type ? { 'Content-Type': type } : {}),
                },
                params: query,
                responseType: responseFormat,
                data: body,
                url: path,
            })
            .then((response) => response.data);
    }
}

/**
 * @title API-FOOTBALL
 * @version 3.9.3
 * @baseUrl https://v3.football.api-sports.io
 * @contact <support@api-football.com> (https://www.api-football.com)
 *
 * API to access all API endpoints, which can get information about Football Leagues & Cups.
 */
export class FootballApi<SecurityDataType extends unknown = unknown> extends HttpClient<SecurityDataType> {
    constructor(
        apiConfig: ApiConfig,
        private logger: BaseLogger,
    ) {
        super(apiConfig);
    }

    override request = async <T extends BaseResponse = BaseResponse, _E = any>({
        secure,
        ...params
    }: FullRequestParams): Promise<T> => {
        this.logger.info(`FootballAPI Request: ${params.method} ${params.path}`);
        try {
            const response = await super.request<T>({ secure, ...params });
            this.logger.info(`FootballAPI Response: ${params.method} ${params.path} - Success`, { response });

            if (this.isErrorResponse(response)) {
                this.logger.error(`FootballAPI Error Response: ${params.method} ${params.path}`, {
                    errors: response.errors,
                    response,
                    params,
                });
            }

            return response;
        } catch (error) {
            this.logger.error(
                `FootballAPI Request General Error: ${params.method} ${params.path} - Error: ${(error as any).message}`,
                {
                    error,
                    params,
                },
            );
            throw error;
        }
    };

    isErrorResponse = (response: BaseResponse) => {
        const isArrayError = response.errors && 'length' in response.errors && response.errors.length > 0;
        const isObjectError =
            response.errors && !('length' in response.errors) && Object.keys(response.errors).length > 0;

        return isArrayError || isObjectError;
    };

    timezone = {
        /**
         * @description Get the list of available timezones.
         *
         * @tags General
         * @name TimezoneList
         * @summary Get Timezones
         * @request GET:/timezone
         * @secure
         * @response `200` `TimezoneListData` OK
         */
        timezoneList: (params: RequestParams = {}) =>
            this.request<TimezoneListData, any>({
                path: `/timezone`,
                method: 'GET',
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    countries = {
        /**
         * @description Get the list of available countries.
         *
         * @tags General
         * @name CountriesList
         * @summary Get Countries
         * @request GET:/countries
         * @secure
         * @response `200` `CountriesListData` OK
         */
        countriesList: (query: CountriesListParams, params: RequestParams = {}) =>
            this.request<CountriesListData, any>({
                path: `/countries`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    leagues = {
        /**
         * @description Get the list of available leagues and cups.
         *
         * @tags Leagues
         * @name LeaguesList
         * @summary Get Leagues
         * @request GET:/leagues
         * @secure
         * @response `200` `LeaguesListData` OK
         */
        leaguesList: (query: LeaguesListParams, params: RequestParams = {}) =>
            this.request<LeaguesListData, any>({
                path: `/leagues`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the list of available seasons for leagues.
         *
         * @tags Leagues
         * @name SeasonsList
         * @summary Get Seasons
         * @request GET:/leagues/seasons
         * @secure
         * @response `200` `SeasonsListData` OK
         */
        seasonsList: (params: RequestParams = {}) =>
            this.request<SeasonsListData, any>({
                path: `/leagues/seasons`,
                method: 'GET',
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    teams = {
        /**
         * @description Get information for a team.
         *
         * @tags Teams
         * @name TeamsList
         * @summary Get Teams
         * @request GET:/teams
         * @secure
         * @response `200` `TeamsListData` OK
         */
        teamsList: (query: TeamsListParams, params: RequestParams = {}) =>
            this.request<TeamsListData, any>({
                path: `/teams`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * No description
         *
         * @name StatisticsList
         * @summary Get detailed team statistics
         * @request GET:/teams/statistics
         * @secure
         * @response `200` `StatisticsListData` Successful response
         */
        statisticsList: (query: StatisticsListParams, params: RequestParams = {}) =>
            this.request<StatisticsListData, any>({
                path: `/teams/statistics`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the seasons available for a team.
         *
         * @tags Teams
         * @name SeasonsList
         * @summary Get Team Seasons
         * @request GET:/teams/seasons
         * @secure
         * @response `200` `SeasonsListResult` OK
         */
        seasonsList: (query: SeasonsListParams1, params: RequestParams = {}) =>
            this.request<SeasonsListResult, any>({
                path: `/teams/seasons`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get a list of countries for teams.
         *
         * @tags Teams
         * @name CountriesList
         * @summary Get Team Countries
         * @request GET:/teams/countries
         * @secure
         * @response `200` `CountriesListResult` OK
         */
        countriesList: (params: RequestParams = {}) =>
            this.request<CountriesListResult, any>({
                path: `/teams/countries`,
                method: 'GET',
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    venues = {
        /**
         * @description Get information for a venue.
         *
         * @tags Venues
         * @name VenuesList
         * @summary Get Venues
         * @request GET:/venues
         * @secure
         * @response `200` `VenuesListData` OK
         */
        venuesList: (query: VenuesListParams, params: RequestParams = {}) =>
            this.request<VenuesListData, any>({
                path: `/venues`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    standings = {
        /**
         * @description Get league standings.
         *
         * @tags Standings
         * @name StandingsList
         * @summary Get Standings
         * @request GET:/standings
         * @secure
         * @response `200` `StandingsListData` OK
         */
        standingsList: (query: StandingsListParams, params: RequestParams = {}) =>
            this.request<StandingsListData, any>({
                path: `/standings`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    fixtures = {
        /**
         * @description Get rounds for a league season.
         *
         * @tags Fixtures
         * @name RoundsList
         * @summary Get Fixture Rounds
         * @request GET:/fixtures/rounds
         * @secure
         * @response `200` `RoundsListData` OK
         */
        roundsList: (query: RoundsListParams, params: RequestParams = {}) =>
            this.request<RoundsListData, any>({
                path: `/fixtures/rounds`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get fixtures for a date, league, or team.
         *
         * @tags Fixtures
         * @name FixturesList
         * @summary Get Fixtures
         * @request GET:/fixtures
         * @secure
         * @response `200` `FixturesListData` OK
         */
        fixturesList: (query: FixturesListParams, params: RequestParams = {}) =>
            this.request<FixturesListData, any>({
                path: `/fixtures`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get head-to-head fixtures for two teams.
         *
         * @tags Fixtures
         * @name HeadtoheadList
         * @summary Head to Head
         * @request GET:/fixtures/headtohead
         * @secure
         * @response `200` `HeadtoheadListData` OK
         */
        headtoheadList: (query: HeadtoheadListParams, params: RequestParams = {}) =>
            this.request<HeadtoheadListData, any>({
                path: `/fixtures/headtohead`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get statistics for a single fixture.
         *
         * @tags Fixtures
         * @name StatisticsList
         * @summary Get Fixture Statistics
         * @request GET:/fixtures/statistics
         * @secure
         * @response `200` `StatisticsListResult` OK
         */
        statisticsList: (query: StatisticsListParams2, params: RequestParams = {}) =>
            this.request<StatisticsListResult, any>({
                path: `/fixtures/statistics`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get events for a single fixture.
         *
         * @tags Fixtures
         * @name EventsList
         * @summary Get Fixture Events
         * @request GET:/fixtures/events
         * @secure
         * @response `200` `EventsListData` OK
         */
        eventsList: (query: EventsListParams, params: RequestParams = {}) =>
            this.request<EventsListData, any>({
                path: `/fixtures/events`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get lineups for a single fixture.
         *
         * @tags Fixtures
         * @name LineupsList
         * @summary Get Fixture Lineups
         * @request GET:/fixtures/lineups
         * @secure
         * @response `200` `LineupsListData` OK
         */
        lineupsList: (query: LineupsListParams, params: RequestParams = {}) =>
            this.request<LineupsListData, any>({
                path: `/fixtures/lineups`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get player statistics for a single fixture.
         *
         * @tags Fixtures
         * @name PlayersList
         * @summary Get Fixture Players Statistics
         * @request GET:/fixtures/players
         * @secure
         * @response `200` `PlayersListData` OK
         */
        playersList: (query: PlayersListParams, params: RequestParams = {}) =>
            this.request<PlayersListData, any>({
                path: `/fixtures/players`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    injuries = {
        /**
         * @description Get injuries for a fixture, league, or team.
         *
         * @tags Injuries
         * @name InjuriesList
         * @summary Get Injuries
         * @request GET:/injuries
         * @secure
         * @response `200` `InjuriesListData` OK
         */
        injuriesList: (query: InjuriesListParams, params: RequestParams = {}) =>
            this.request<InjuriesListData, any>({
                path: `/injuries`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    predictions = {
        /**
         * @description Get predictions for a fixture.
         *
         * @tags Predictions
         * @name PredictionsList
         * @summary Get Predictions
         * @request GET:/predictions
         * @secure
         * @response `200` `PredictionsListData` OK
         */
        predictionsList: (query: PredictionsListParams, params: RequestParams = {}) =>
            this.request<PredictionsListData, any>({
                path: `/predictions`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    coachs = {
        /**
         * @description Get information about coaches.
         *
         * @tags Coaches
         * @name CoachsList
         * @summary Get Coaches
         * @request GET:/coachs
         * @secure
         * @response `200` `CoachsListData` OK
         */
        coachsList: (query: CoachsListParams, params: RequestParams = {}) =>
            this.request<CoachsListData, any>({
                path: `/coachs`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    players = {
        /**
         * @description Get available seasons for players statistics.
         *
         * @tags Players
         * @name SeasonsList
         * @summary Get Player Seasons
         * @request GET:/players/seasons
         * @secure
         * @response `200` `SeasonsListOutput` OK
         */
        seasonsList: (params: RequestParams = {}) =>
            this.request<SeasonsListOutput, any>({
                path: `/players/seasons`,
                method: 'GET',
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * No description
         *
         * @name PlayersList
         * @summary Get player statistics by player ID and season
         * @request GET:/players
         * @secure
         * @response `200` `PlayersListResult` Successful response
         */
        playersList: (query: PlayersListParams2, params: RequestParams = {}) =>
            this.request<PlayersListResult, any>({
                path: `/players`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the squad for a team.
         *
         * @tags Players
         * @name SquadsList
         * @summary Get Squads
         * @request GET:/players/squads
         * @secure
         * @response `200` `SquadsListData` OK
         */
        squadsList: (query: SquadsListParams, params: RequestParams = {}) =>
            this.request<SquadsListData, any>({
                path: `/players/squads`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the top scorers for a league.
         *
         * @tags Players
         * @name TopscorersList
         * @summary Get Top Scorers
         * @request GET:/players/topscorers
         * @secure
         * @response `200` `TopscorersListData` OK
         */
        topscorersList: (query: TopscorersListParams, params: RequestParams = {}) =>
            this.request<TopscorersListData, any>({
                path: `/players/topscorers`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the top assists for a league.
         *
         * @tags Players
         * @name TopassistsList
         * @summary Get Top Assists
         * @request GET:/players/topassists
         * @secure
         * @response `200` `TopassistsListData` OK
         */
        topassistsList: (query: TopassistsListParams, params: RequestParams = {}) =>
            this.request<TopassistsListData, any>({
                path: `/players/topassists`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the top yellow cards for a league.
         *
         * @tags Players
         * @name TopyellowcardsList
         * @summary Get Top Yellow Cards
         * @request GET:/players/topyellowcards
         * @secure
         * @response `200` `TopyellowcardsListData` OK
         */
        topyellowcardsList: (query: TopyellowcardsListParams, params: RequestParams = {}) =>
            this.request<TopyellowcardsListData, any>({
                path: `/players/topyellowcards`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the top red cards for a league.
         *
         * @tags Players
         * @name TopredcardsList
         * @summary Get Top Red Cards
         * @request GET:/players/topredcards
         * @secure
         * @response `200` `TopredcardsListData` OK
         */
        topredcardsList: (query: TopredcardsListParams, params: RequestParams = {}) =>
            this.request<TopredcardsListData, any>({
                path: `/players/topredcards`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    transfers = {
        /**
         * @description Get player transfers.
         *
         * @tags Transfers
         * @name TransfersList
         * @summary Get Transfers
         * @request GET:/transfers
         * @secure
         * @response `200` `TransfersListData` OK
         */
        transfersList: (query: TransfersListParams, params: RequestParams = {}) =>
            this.request<TransfersListData, any>({
                path: `/transfers`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    trophies = {
        /**
         * @description Get trophies for a player or coach.
         *
         * @tags Trophies
         * @name TrophiesList
         * @summary Get Trophies
         * @request GET:/trophies
         * @secure
         * @response `200` `TrophiesListData` OK
         */
        trophiesList: (query: TrophiesListParams, params: RequestParams = {}) =>
            this.request<TrophiesListData, any>({
                path: `/trophies`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    sidelined = {
        /**
         * @description Get sidelined information for a player or coach.
         *
         * @tags Injuries
         * @name SidelinedList
         * @summary Get Sidelined
         * @request GET:/sidelined
         * @secure
         * @response `200` `SidelinedListData` OK
         */
        sidelinedList: (query: SidelinedListParams, params: RequestParams = {}) =>
            this.request<SidelinedListData, any>({
                path: `/sidelined`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
    odds = {
        /**
         * @description Get pre-match odds for fixtures.
         *
         * @tags Odds
         * @name OddsList
         * @summary Get Pre-Match Odds
         * @request GET:/odds
         * @secure
         * @response `200` `OddsListData` OK
         */
        oddsList: (query: OddsListParams, params: RequestParams = {}) =>
            this.request<OddsListData, any>({
                path: `/odds`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get live, in-play odds for fixtures.
         *
         * @tags Odds
         * @name LiveList
         * @summary Get In-Play Odds
         * @request GET:/odds/live
         * @secure
         * @response `200` `LiveListData` OK
         */
        liveList: (query: LiveListParams, params: RequestParams = {}) =>
            this.request<LiveListData, any>({
                path: `/odds/live`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get a list of available bookmakers.
         *
         * @tags Odds
         * @name BookmakersList
         * @summary Get Bookmakers
         * @request GET:/odds/bookmakers
         * @secure
         * @response `200` `BookmakersListData` OK
         */
        bookmakersList: (query: BookmakersListParams, params: RequestParams = {}) =>
            this.request<BookmakersListData, any>({
                path: `/odds/bookmakers`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get a list of available bet types for pre-match odds.
         *
         * @tags Odds
         * @name BetsList
         * @summary Get Bet Types
         * @request GET:/odds/bets
         * @secure
         * @response `200` `BetsListData` OK
         */
        betsList: (query: BetsListParams, params: RequestParams = {}) =>
            this.request<BetsListData, any>({
                path: `/odds/bets`,
                method: 'GET',
                query: query,
                secure: true,
                format: 'json',
                ...params,
            }),
    };
}
