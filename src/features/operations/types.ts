export type ContractType = "CALL" | "PUT";

export type PriceRange = {
  low: number;
  high: number;
};

export type OperationPosition = {
  symbol: string;
  status: string;
  contractType?: string | null;
  optionSymbol?: string | null;
  strike?: number | null;
  expiration?: string | null;
  quantity?: number | null;
  orderId?: string | null;
  orderStatus?: string | null;
  tradePrice?: number | null;
  boughtAt?: string | null;
  canBuy: boolean;
  canSell: boolean;
};

export type OperationsTicker = {
  symbol: string;
  name: string | null;
  isFavorite: boolean;
  active: boolean;
  isOperationEnable: boolean;
  optimalRange: PriceRange | null;
  optimalRangeMinMax: PriceRange | null;
  optimalRangeAsOf: string | null;
  position: OperationPosition | null;
};

export type OptionPickContract = {
  optionSymbol: string;
  strike: number;
  bid: number | null;
  ask: number | null;
  mark: number | null;
  delta: number | null;
  expiration: string;
  dte: number;
  putCall: ContractType;
};

export type OptionPickResult = {
  symbol: string;
  optimalRange: PriceRange;
  underlyingPrice: number | null;
  expiration: string | null;
  dte: number | null;
  pick: OptionPickContract | null;
  status: "ok" | "skipped" | "error" | string;
  message: string | null;
};

export type OptionPicksResponse = {
  contractType: ContractType;
  evaluatedAt: string;
  results: OptionPickResult[];
};

export type BuyOptionRequest = {
  symbol: string;
  optionSymbol: string;
  contractType: ContractType;
  quantity?: number;
  strike?: number | null;
  expiration?: string | null;
  ask?: number | null;
  bid?: number | null;
  mark?: number | null;
};

export type BuyOptionResponse = {
  symbol: string;
  contractType: ContractType;
  optionSymbol: string;
  quantity: number;
  strike?: number | null;
  expiration?: string | null;
  orderId?: string | null;
  orderStatus?: string | null;
  tradePrice?: number | null;
  filledQuantity?: number | null;
  status: string;
  message?: string | null;
  position?: OperationPosition | null;
  canBuy: boolean;
  canSell: boolean;
};
