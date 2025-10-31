/**
 * Chain Data Query
 * Provides methods for querying on-chain data
 * High cohesion: Blockchain data queries
 */

import type { FhevmClient } from "./client";
import { FhevmConfigError, FhevmNetworkError } from "../errors";
import { isValidAddress } from "../utils/validation";
import { toRpcProvider } from "../adapters/rpc";

/**
 * Block information
 */
export interface BlockInfo {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  gasLimit: bigint;
  gasUsed: bigint;
  miner: string;
  transactions: string[];
}

/**
 * Transaction information
 */
export interface TransactionInfo {
  hash: string;
  blockNumber: number | null;
  blockHash: string | null;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  value: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  nonce: number;
  data: string;
  status?: "success" | "failed" | "pending";
}

/**
 * Transaction receipt
 */
export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  from: string;
  to: string | null;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: "success" | "failed";
  logs: any[];
  contractAddress: string | null;
}

/**
 * Call result
 */
export interface CallResult {
  result: string;
  gasUsed?: bigint;
}

/**
 * Gas estimate result
 */
export interface GasEstimate {
  gasLimit: bigint;
  gasPrice?: bigint;
}

/**
 * Get balance for an address
 * 
 * @param client - FHEVM client
 * @param address - Address to query
 * @param blockTag - Block tag (latest, earliest, pending, or block number)
 * @returns Balance in wei
 * 
 * @example
 * ```ts
 * const balance = await getBalance(client, "0x...", "latest");
 * console.log("Balance:", balance.toString());
 * ```
 */
export async function getBalance(
  client: FhevmClient,
  address: string,
  blockTag: string | number = "latest"
): Promise<bigint> {
  if (!isValidAddress(address)) {
    throw new FhevmConfigError(`Invalid address: ${address}`);
  }

  try {
    const provider = await getProvider(client);
    const result = await provider.request({
      method: "eth_getBalance",
      params: [address, typeof blockTag === "number" ? `0x${blockTag.toString(16)}` : blockTag],
    });

    return BigInt(result);
  } catch (error: any) {
    throw new FhevmNetworkError(`Failed to get balance: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Get block information
 * 
 * @param client - FHEVM client
 * @param blockTag - Block number or tag (latest, earliest, pending)
 * @param includeTransactions - Include full transaction objects (default: false)
 * @returns Block information
 * 
 * @example
 * ```ts
 * const block = await getBlock(client, "latest");
 * console.log("Block number:", block.number);
 * ```
 */
export async function getBlock(
  client: FhevmClient,
  blockTag: string | number = "latest",
  includeTransactions: boolean = false
): Promise<BlockInfo> {
  try {
    const provider = await getProvider(client);
    const blockNumber = typeof blockTag === "number" ? `0x${blockTag.toString(16)}` : blockTag;
    
    const result = await provider.request({
      method: "eth_getBlockByNumber",
      params: [blockNumber, includeTransactions],
    });

    if (!result) {
      throw new FhevmNetworkError(`Block ${blockTag} not found`);
    }

    return {
      number: parseInt(result.number, 16),
      hash: result.hash,
      parentHash: result.parentHash,
      timestamp: parseInt(result.timestamp, 16),
      gasLimit: BigInt(result.gasLimit),
      gasUsed: BigInt(result.gasUsed),
      miner: result.miner,
      transactions: Array.isArray(result.transactions) 
        ? result.transactions.map((tx: any) => typeof tx === "string" ? tx : tx.hash)
        : [],
    };
  } catch (error: any) {
    throw new FhevmNetworkError(`Failed to get block: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Get transaction information
 * 
 * @param client - FHEVM client
 * @param txHash - Transaction hash
 * @returns Transaction information
 * 
 * @example
 * ```ts
 * const tx = await getTransaction(client, "0x...");
 * console.log("From:", tx.from);
 * ```
 */
export async function getTransaction(
  client: FhevmClient,
  txHash: string
): Promise<TransactionInfo> {
  if (!txHash.startsWith("0x") || txHash.length !== 66) {
    throw new FhevmConfigError(`Invalid transaction hash: ${txHash}`);
  }

  try {
    const provider = await getProvider(client);
    const result = await provider.request({
      method: "eth_getTransactionByHash",
      params: [txHash],
    });

    if (!result) {
      throw new FhevmNetworkError(`Transaction ${txHash} not found`);
    }

    return {
      hash: result.hash,
      blockNumber: result.blockNumber ? parseInt(result.blockNumber, 16) : null,
      blockHash: result.blockHash || null,
      transactionIndex: result.transactionIndex ? parseInt(result.transactionIndex, 16) : null,
      from: result.from,
      to: result.to || null,
      value: BigInt(result.value || "0x0"),
      gasPrice: BigInt(result.gasPrice || "0x0"),
      gasLimit: BigInt(result.gasLimit || "0x0"),
      nonce: parseInt(result.nonce, 16),
      data: result.input || "0x",
    };
  } catch (error: any) {
    throw new FhevmNetworkError(`Failed to get transaction: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Get transaction receipt
 * 
 * @param client - FHEVM client
 * @param txHash - Transaction hash
 * @returns Transaction receipt
 * 
 * @example
 * ```ts
 * const receipt = await getTransactionReceipt(client, "0x...");
 * console.log("Status:", receipt.status);
 * ```
 */
export async function getTransactionReceipt(
  client: FhevmClient,
  txHash: string
): Promise<TransactionReceipt | null> {
  if (!txHash.startsWith("0x") || txHash.length !== 66) {
    throw new FhevmConfigError(`Invalid transaction hash: ${txHash}`);
  }

  try {
    const provider = await getProvider(client);
    const result = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });

    if (!result) {
      return null; // Transaction not yet mined
    }

    return {
      transactionHash: result.transactionHash,
      blockNumber: parseInt(result.blockNumber, 16),
      blockHash: result.blockHash,
      transactionIndex: parseInt(result.transactionIndex, 16),
      from: result.from,
      to: result.to || null,
      gasUsed: BigInt(result.gasUsed),
      effectiveGasPrice: BigInt(result.effectiveGasPrice || result.gasPrice || "0x0"),
      status: parseInt(result.status, 16) === 1 ? "success" : "failed",
      logs: result.logs || [],
      contractAddress: result.contractAddress || null,
    };
  } catch (error: any) {
    throw new FhevmNetworkError(`Failed to get transaction receipt: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Call contract method (read-only)
 * 
 * @param client - FHEVM client
 * @param params - Call parameters
 * @returns Call result
 * 
 * @example
 * ```ts
 * const result = await call(client, {
 *   to: "0x...",
 *   data: "0x..."
 * });
 * ```
 */
export async function call(
  client: FhevmClient,
  params: {
    to: string;
    data: string;
    from?: string;
    value?: bigint;
    gas?: bigint;
    gasPrice?: bigint;
    blockTag?: string | number;
  }
): Promise<CallResult> {
  if (!isValidAddress(params.to)) {
    throw new FhevmConfigError(`Invalid contract address: ${params.to}`);
  }

  if (!params.data.startsWith("0x")) {
    throw new FhevmConfigError("Data must be hex string starting with 0x");
  }

  try {
    const provider = await getProvider(client);
    const blockTag = params.blockTag 
      ? (typeof params.blockTag === "number" ? `0x${params.blockTag.toString(16)}` : params.blockTag)
      : "latest";

    const callParams: any = {
      to: params.to,
      data: params.data,
    };

    if (params.from) {
      callParams.from = params.from;
    }
    if (params.value !== undefined) {
      callParams.value = `0x${params.value.toString(16)}`;
    }
    if (params.gas !== undefined) {
      callParams.gas = `0x${params.gas.toString(16)}`;
    }
    if (params.gasPrice !== undefined) {
      callParams.gasPrice = `0x${params.gasPrice.toString(16)}`;
    }

    const result = await provider.request({
      method: "eth_call",
      params: [callParams, blockTag],
    });

    return {
      result,
    };
  } catch (error: any) {
    throw new FhevmNetworkError(`Contract call failed: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Estimate gas for a transaction
 * 
 * @param client - FHEVM client
 * @param params - Transaction parameters
 * @returns Gas estimate
 * 
 * @example
 * ```ts
 * const estimate = await estimateGas(client, {
 *   to: "0x...",
 *   data: "0x...",
 *   from: "0x..."
 * });
 * console.log("Gas limit:", estimate.gasLimit.toString());
 * ```
 */
export async function estimateGas(
  client: FhevmClient,
  params: {
    to?: string;
    data?: string;
    from: string;
    value?: bigint;
    gas?: bigint;
    gasPrice?: bigint;
  }
): Promise<GasEstimate> {
  if (!isValidAddress(params.from)) {
    throw new FhevmConfigError(`Invalid from address: ${params.from}`);
  }

  if (params.to && !isValidAddress(params.to)) {
    throw new FhevmConfigError(`Invalid to address: ${params.to}`);
  }

  try {
    const provider = await getProvider(client);
    
    const txParams: any = {
      from: params.from,
    };

    if (params.to) {
      txParams.to = params.to;
    }
    if (params.data) {
      txParams.data = params.data;
    }
    if (params.value !== undefined) {
      txParams.value = `0x${params.value.toString(16)}`;
    }
    if (params.gas !== undefined) {
      txParams.gas = `0x${params.gas.toString(16)}`;
    }
    if (params.gasPrice !== undefined) {
      txParams.gasPrice = `0x${params.gasPrice.toString(16)}`;
    }

    const result = await provider.request({
      method: "eth_estimateGas",
      params: [txParams],
    });

    return {
      gasLimit: BigInt(result),
    };
  } catch (error: any) {
    throw new FhevmNetworkError(`Gas estimation failed: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Get current gas price
 * 
 * @param client - FHEVM client
 * @returns Gas price in wei
 * 
 * @example
 * ```ts
 * const gasPrice = await getGasPrice(client);
 * console.log("Gas price:", gasPrice.toString());
 * ```
 */
export async function getGasPrice(client: FhevmClient): Promise<bigint> {
  try {
    const provider = await getProvider(client);
    const result = await provider.request({
      method: "eth_gasPrice",
      params: [],
    });

    return BigInt(result);
  } catch (error: any) {
    throw new FhevmNetworkError(`Failed to get gas price: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Get block number
 * 
 * @param client - FHEVM client
 * @returns Current block number
 * 
 * @example
 * ```ts
 * const blockNumber = await getBlockNumber(client);
 * console.log("Current block:", blockNumber);
 * ```
 */
export async function getBlockNumber(client: FhevmClient): Promise<number> {
  try {
    const provider = await getProvider(client);
    const result = await provider.request({
      method: "eth_blockNumber",
      params: [],
    });

    return parseInt(result, 16);
  } catch (error: any) {
    throw new FhevmNetworkError(`Failed to get block number: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Get transaction count (nonce) for an address
 * 
 * @param client - FHEVM client
 * @param address - Address to query
 * @param blockTag - Block tag (default: "latest")
 * @returns Transaction count
 * 
 * @example
 * ```ts
 * const nonce = await getTransactionCount(client, "0x...");
 * console.log("Nonce:", nonce);
 * ```
 */
export async function getTransactionCount(
  client: FhevmClient,
  address: string,
  blockTag: string | number = "latest"
): Promise<number> {
  if (!isValidAddress(address)) {
    throw new FhevmConfigError(`Invalid address: ${address}`);
  }

  try {
    const provider = await getProvider(client);
    const blockNumber = typeof blockTag === "number" ? `0x${blockTag.toString(16)}` : blockTag;
    
    const result = await provider.request({
      method: "eth_getTransactionCount",
      params: [address, blockNumber],
    });

    return parseInt(result, 16);
  } catch (error: any) {
    throw new FhevmNetworkError(`Failed to get transaction count: ${error?.message || "Unknown error"}`, error);
  }
}

/**
 * Helper: Get provider from client
 */
async function getProvider(client: FhevmClient): Promise<any> {
  const network = client.config.network;
  
  if (!network) {
    throw new FhevmConfigError("Network provider is required");
  }

  // If it's already an EIP-1193 provider, use it directly
  if (typeof network === "object" && network !== null && "request" in network) {
    return network;
  }

  // For string URLs, use RPC adapter
  if (typeof network === "string") {
    return toRpcProvider(network);
  }

  return network;
}

