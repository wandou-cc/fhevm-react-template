"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFhevmClient, useFhevmInstance } from "~~/hooks/fhevm";
import { useWagmiEthers } from "~~/hooks/wagmi/useWagmiEthers";
import {
  getBalance,
  getBlock,
  getBlockNumber,
  getTransaction,
  getTransactionReceipt,
  call,
  estimateGas,
  getGasPrice,
  getTransactionCount,
  createRpcProvider,
  type BlockInfo,
  type TransactionInfo,
} from "@fhevm-sdk";
import { GenericStringInMemoryStorage } from "@fhevm-sdk";
import { isValidAddress } from "@fhevm-sdk";

/**
 * Chain Query Demo Component
 * 
 * 展示链上数据查询功能的演示页面
 */
export const ChainQueryDemo = () => {
  const { isConnected } = useAccount();
  const initialMockChains = { 31337: "http://localhost:8545" };

  // Wagmi + ethers interop
  const { chainId, ethersSigner } = useWagmiEthers(initialMockChains);

  // Create FHEVM client
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const network = useMemo(() => {
    if (provider) return provider;
    if (chainId && initialMockChains && chainId in initialMockChains) {
      return (initialMockChains as Record<number, string>)[chainId];
    }
    // Fallback to HTTP RPC
    const fallbackUrl = chainId && chainId in (initialMockChains as Record<number, string>)
      ? (initialMockChains as Record<number, string>)[chainId]
      : "https://eth.llamarpc.com";
    return createRpcProvider(fallbackUrl);
  }, [provider, chainId, initialMockChains]);

  const client = useFhevmClient({
    network,
    chainId,
    mockChains: initialMockChains as Record<number, string>,
    storage: new GenericStringInMemoryStorage(),
  });

  // Create FHEVM instance
  const { instance, status: fhevmStatus } = useFhevmInstance(client, {
    enabled: Boolean(network && chainId),
  });

  // State
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [blockNumber, setBlockNumber] = useState<string>("latest");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null);
  const [txInfo, setTxInfo] = useState<TransactionInfo | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  // Query functions
  const queryBalance = async () => {
    if (!address || !isValidAddress(address)) {
      setError("Invalid address");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage("Querying balance...");

    try {
      const result = await getBalance(client, address, blockNumber === "latest" ? "latest" : parseInt(blockNumber));
      setBalance(result);
      setMessage(`Balance: ${result.toString()} wei`);
    } catch (err: any) {
      setError(err.message || "Failed to query balance");
      setMessage("Query failed");
    } finally {
      setLoading(false);
    }
  };

  const queryBlock = async () => {
    setLoading(true);
    setError(null);
    setMessage("Querying block...");

    try {
      const blockTag = blockNumber === "latest" ? "latest" : parseInt(blockNumber);
      const result = await getBlock(client, blockTag);
      setBlockInfo(result);
      setMessage(`Block ${result.number} queried successfully`);
    } catch (err: any) {
      setError(err.message || "Failed to query block");
      setMessage("Query failed");
    } finally {
      setLoading(false);
    }
  };

  const queryTransaction = async () => {
    if (!txHash || !txHash.startsWith("0x")) {
      setError("Invalid transaction hash");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage("Querying transaction...");

    try {
      const result = await getTransaction(client, txHash);
      setTxInfo(result);
      setMessage("Transaction queried successfully");
    } catch (err: any) {
      setError(err.message || "Failed to query transaction");
      setMessage("Query failed");
    } finally {
      setLoading(false);
    }
  };

  const queryGasPrice = async () => {
    setLoading(true);
    setError(null);
    setMessage("Querying gas price...");

    try {
      const result = await getGasPrice(client);
      setGasPrice(result);
      setMessage(`Gas price: ${result.toString()} wei`);
    } catch (err: any) {
      setError(err.message || "Failed to query gas price");
      setMessage("Query failed");
    } finally {
      setLoading(false);
    }
  };

  const queryBlockNumber = async () => {
    setLoading(true);
    setError(null);
    setMessage("Querying current block number...");

    try {
      const result = await getBlockNumber(client);
      setCurrentBlock(result);
      setMessage(`Current block: ${result}`);
    } catch (err: any) {
      setError(err.message || "Failed to query block number");
      setMessage("Query failed");
    } finally {
      setLoading(false);
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center px-4 py-2 font-semibold shadow-lg rounded-lg " +
    "transition-all duration-200 hover:scale-105 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

  const primaryButtonClass =
    buttonClass +
    " bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] focus-visible:ring-[#2D2D2D] cursor-pointer";

  const secondaryButtonClass =
    buttonClass +
    " bg-black text-[#F4F4F4] hover:bg-[#1F1F1F] focus-visible:ring-[#FFD208] cursor-pointer";

  const sectionClass = "bg-[#f4f4f4] shadow-lg p-6 mb-6 text-gray-900 rounded-lg";
  const titleClass = "font-bold text-gray-900 text-xl mb-4 border-b-2 border-gray-700 pb-2";

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-gray-900">
        <div className="flex items-center justify-center">
          <div className="bg-white border shadow-xl p-8 text-center rounded-lg">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-900/30 text-amber-400 text-3xl">
                ⚠️
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">钱包未连接</h2>
            <p className="text-gray-700 mb-6">请连接钱包以使用链上数据查询功能。</p>
            <div className="flex items-center justify-center">
              <RainbowKitCustomConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-gray-900">
      {/* Header */}
      <div className="text-center mb-8 text-black">
        <h1 className="text-3xl font-bold mb-2">链上数据查询演示</h1>
        <p className="text-gray-600">查询区块链数据（余额、区块、交易等）</p>
      </div>

      {/* Status */}
      <div className={sectionClass}>
        <h3 className={titleClass}>🔧 连接状态</h3>
        <div className="grid grid-cols-2 gap-4">
          {printProperty("实例状态", instance ? "✅ 已连接" : "❌ 未连接")}
          {printProperty("状态", fhevmStatus)}
          {printProperty("Chain ID", chainId || "未知")}
        </div>
      </div>

      {/* Query Balance */}
      <div className={sectionClass}>
        <h3 className={titleClass}>💰 查询余额</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">地址</label>
            <input
              type="text"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">区块标签</label>
              <input
                type="text"
                placeholder="latest"
                value={blockNumber}
                onChange={(e) => setBlockNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={queryBalance}
                disabled={loading || !address}
                className={primaryButtonClass + " w-full"}
              >
                {loading ? "查询中..." : "查询余额"}
              </button>
            </div>
          </div>
          {balance !== null && (
            <div className="p-4 bg-white border border-gray-300 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">余额</div>
              <div className="text-2xl font-bold text-[#A38025]">
                {balance.toString()} wei
              </div>
              <div className="text-sm text-gray-500 mt-1">
                ≈ {(Number(balance) / 1e18).toFixed(6)} ETH
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Query Block */}
      <div className={sectionClass}>
        <h3 className={titleClass}>📦 查询区块</h3>
        <div className="space-y-4">
          <button
            onClick={queryBlock}
            disabled={loading}
            className={primaryButtonClass}
          >
            {loading ? "查询中..." : `查询区块 ${blockNumber}`}
          </button>
          {blockInfo && (
            <div className="p-4 bg-white border border-gray-300 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {printProperty("区块号", blockInfo.number)}
                {printProperty("哈希", blockInfo.hash.slice(0, 20) + "...")}
                {printProperty("时间戳", new Date(blockInfo.timestamp * 1000).toLocaleString())}
                {printProperty("Gas Used", blockInfo.gasUsed.toString())}
                {printProperty("Gas Limit", blockInfo.gasLimit.toString())}
                {printProperty("交易数", blockInfo.transactions.length)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Query Transaction */}
      <div className={sectionClass}>
        <h3 className={titleClass}>📝 查询交易</h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="交易哈希 (0x...)"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
          />
          <button
            onClick={queryTransaction}
            disabled={loading || !txHash}
            className={primaryButtonClass + " w-full"}
          >
            {loading ? "查询中..." : "查询交易"}
          </button>
          {txInfo && (
            <div className="p-4 bg-white border border-gray-300 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {printProperty("From", txInfo.from.slice(0, 20) + "...")}
                {printProperty("To", txInfo.to?.slice(0, 20) + "..." || "null")}
                {printProperty("Value", txInfo.value.toString() + " wei")}
                {printProperty("Gas Price", txInfo.gasPrice.toString())}
                {printProperty("Block", txInfo.blockNumber?.toString() || "Pending")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Queries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={queryBlockNumber}
          disabled={loading}
          className={secondaryButtonClass}
        >
          {loading ? "查询中..." : "📊 当前区块号"}
        </button>
        <button
          onClick={queryGasPrice}
          disabled={loading}
          className={secondaryButtonClass}
        >
          {loading ? "查询中..." : "⛽ Gas 价格"}
        </button>
      </div>

      {currentBlock !== null && (
        <div className={sectionClass}>
          <h3 className={titleClass}>当前区块</h3>
          <div className="text-3xl font-bold text-[#A38025]">{currentBlock}</div>
        </div>
      )}

      {gasPrice !== null && (
        <div className={sectionClass}>
          <h3 className={titleClass}>Gas 价格</h3>
          <div className="text-2xl font-bold text-[#A38025]">{gasPrice.toString()} wei</div>
          <div className="text-sm text-gray-500 mt-1">
            ≈ {(Number(gasPrice) / 1e9).toFixed(2)} Gwei
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={sectionClass}>
          <h3 className={titleClass}>💬 消息</h3>
          <div className="border bg-white border-gray-200 p-4 rounded-lg">
            <p className="text-gray-800">{message}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
          <div className="text-red-800 font-semibold">错误:</div>
          <div className="text-red-700 mt-1">{error}</div>
        </div>
      )}
    </div>
  );
};

function printProperty(name: string, value: unknown) {
  let displayValue: string;

  if (typeof value === "boolean") {
    return printBooleanProperty(name, value);
  } else if (typeof value === "string" || typeof value === "number") {
    displayValue = String(value);
  } else if (typeof value === "bigint") {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = "null";
  } else if (value === undefined) {
    displayValue = "undefined";
  } else {
    displayValue = JSON.stringify(value);
  }
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 rounded">
      <span className="text-gray-800 font-medium">{name}</span>
      <span className="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300 rounded break-all">
        {displayValue}
      </span>
    </div>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 rounded">
      <span className="text-gray-700 font-medium">{name}</span>
      <span
        className={`font-mono text-sm font-semibold px-2 py-1 border rounded ${
          value
            ? "text-green-800 bg-green-100 border-green-300"
            : "text-red-800 bg-red-100 border-red-300"
        }`}
      >
        {value ? "✓ true" : "✗ false"}
      </span>
    </div>
  );
}

