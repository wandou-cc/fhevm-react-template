"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFhevmClient, useFhevmInstance, useBatchDecrypt } from "~~/hooks/fhevm";
import { useWagmiEthers } from "~~/hooks/wagmi/useWagmiEthers";
import { toFhevmSigner, GenericStringInMemoryStorage, type DecryptRequest } from "@fhevm-sdk";
import { useReadContract } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/helper";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { ethers } from "ethers";

/**
 * Batch Decrypt Demo Component
 * 
 * 展示批量解密功能的演示页面
 * - 可以查看批量解密的状态和结果
 * - 支持添加多个 handles 进行批量解密
 * - 展示解密过程和结果
 */
export const BatchDecryptDemo = () => {
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
    return undefined;
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

  // Get contract info for FHECounter
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheCounter } = useDeployedContractInfo({
    contractName: "FHECounter",
    chainId: allowedChainId,
  });

  // Read count handle from contract
  const readResult = useReadContract({
    address: fheCounter?.address as `0x${string}` | undefined,
    abi: (fheCounter?.abi as any) || [],
    functionName: "getCount",
    query: {
      enabled: Boolean(fheCounter?.address),
      refetchInterval: 3000, // Refresh every 3 seconds
    },
  });

  const countHandle = useMemo(
    () => (readResult.data as string | undefined) ?? undefined,
    [readResult.data]
  );

  // State for managing multiple handles
  const [customHandles, setCustomHandles] = useState<
    Array<{ handle: string; contractAddress: string; label?: string }>
  >([]);
  const [newHandle, setNewHandle] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // Build decrypt requests
  const requests = useMemo<DecryptRequest[]>(() => {
    const reqs: DecryptRequest[] = [];

    // Add count handle if available
    if (fheCounter?.address && countHandle && countHandle !== ethers.ZeroHash) {
      reqs.push({
        handle: countHandle,
        contractAddress: fheCounter.address,
      });
    }

    // Add custom handles
    customHandles.forEach((item) => {
      reqs.push({
        handle: item.handle,
        contractAddress: item.contractAddress,
      });
    });

    return reqs;
  }, [fheCounter?.address, countHandle, customHandles]);

  // FHEVM signer
  const fhevmSigner = useMemo(() => {
    return ethersSigner ? toFhevmSigner(ethersSigner) : undefined;
  }, [ethersSigner]);

  // Batch decrypt hook
  const {
    batchDecryptData,
    results,
    isDecrypting,
    canDecrypt,
    message: decryptMessage,
    requestCount,
    resultCount,
    error,
  } = useBatchDecrypt(client, {
    instance,
    signer: fhevmSigner,
    requests: requests.length > 0 ? requests : undefined,
    usePublicDecrypt: false,
  });

  // Add custom handle
  const handleAddHandle = () => {
    if (!newHandle.trim() || !fheCounter?.address) return;

    setCustomHandles([
      ...customHandles,
      {
        handle: newHandle.trim(),
        contractAddress: fheCounter.address,
        label: newLabel.trim() || undefined,
      },
    ]);
    setNewHandle("");
    setNewLabel("");
  };

  // Remove custom handle
  const handleRemoveHandle = (index: number) => {
    setCustomHandles(customHandles.filter((_, i) => i !== index));
  };

  // Clear all custom handles
  const handleClearAll = () => {
    setCustomHandles([]);
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

  const dangerButtonClass =
    buttonClass +
    " bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 cursor-pointer";

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
            <p className="text-gray-700 mb-6">请连接钱包以使用批量解密功能。</p>
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
        <h1 className="text-3xl font-bold mb-2">批量解密演示</h1>
        <p className="text-gray-600">一次性解密多个 FHE handles</p>
      </div>

      {/* FHEVM Status */}
      <div className={sectionClass}>
        <h3 className={titleClass}>🔧 FHEVM 状态</h3>
        <div className="grid grid-cols-2 gap-4">
          {printProperty("实例状态", instance ? "✅ 已连接" : "❌ 未连接")}
          {printProperty("状态", fhevmStatus)}
          {printProperty("合约地址", fheCounter?.address || "未找到")}
          {printProperty("Chain ID", chainId || "未知")}
        </div>
      </div>

      {/* Handle Management */}
      <div className={sectionClass}>
        <h3 className={titleClass}>📋 Handle 管理</h3>

        {/* Count Handle from Contract */}
        {countHandle && countHandle !== ethers.ZeroHash && (
          <div className="mb-4 p-4 bg-white border border-gray-300 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-700 mb-1">
                  📊 合约 Count Handle
                </div>
                <div className="font-mono text-sm text-gray-600 break-all">{countHandle}</div>
                <div className="text-xs text-gray-500 mt-1">
                  合约: {fheCounter?.address}
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                自动
              </span>
            </div>
          </div>
        )}

        {/* Add Custom Handle */}
        <div className="mb-4 p-4 bg-white border border-gray-300 rounded-lg">
          <div className="font-semibold text-gray-700 mb-3">添加自定义 Handle</div>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Handle (0x...)"
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
            />
            <input
              type="text"
              placeholder="标签 (可选)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
            />
            <button
              onClick={handleAddHandle}
              disabled={!newHandle.trim() || !fheCounter?.address}
              className={secondaryButtonClass + " w-full"}
            >
              ➕ 添加 Handle
            </button>
          </div>
        </div>

        {/* Custom Handles List */}
        {customHandles.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-700">自定义 Handles ({customHandles.length})</div>
              <button onClick={handleClearAll} className={dangerButtonClass + " text-sm px-3 py-1"}>
                清除全部
              </button>
            </div>
            <div className="space-y-2">
              {customHandles.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-white border border-gray-300 rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    {item.label && (
                      <div className="font-semibold text-gray-700 mb-1">{item.label}</div>
                    )}
                    <div className="font-mono text-sm text-gray-600 break-all">{item.handle}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      合约: {item.contractAddress.slice(0, 20)}...
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveHandle(index)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Request Summary */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            {printProperty("总 Handle 数", requestCount)}
            {printProperty("合约地址", fheCounter?.address ? "已设置" : "未设置")}
          </div>
        </div>
      </div>

      {/* Batch Decrypt Action */}
      <div className={sectionClass}>
        <h3 className={titleClass}>🔓 批量解密</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={batchDecryptData}
              disabled={!canDecrypt || isDecrypting || requestCount === 0}
              className={primaryButtonClass + " flex-1"}
            >
              {isDecrypting
                ? "⏳ 解密中..."
                : requestCount > 0
                  ? `🔓 批量解密 ${requestCount} 个 Handle`
                  : "❌ 没有可解密的 Handle"}
            </button>
          </div>

          {decryptMessage && (
            <div className="p-4 bg-white border border-gray-300 rounded-lg">
              <div className="text-gray-800">{decryptMessage}</div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
              <div className="text-red-800 font-semibold">错误:</div>
              <div className="text-red-700 mt-1">{error.message}</div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {resultCount > 0 && (
        <div className={sectionClass}>
          <h3 className={titleClass}>✅ 解密结果 ({resultCount})</h3>
          <div className="space-y-3">
            {requests.map((req, index) => {
              const handle = req.handle;
              const value = results[handle];
              const handleInfo = index === 0 && countHandle === handle
                ? { label: "合约 Count Handle", isAuto: true }
                : customHandles.find((h) => h.handle === handle)
                  ? { label: customHandles.find((h) => h.handle === handle)?.label || "自定义 Handle", isAuto: false }
                  : { label: "Handle", isAuto: false };

              return (
                <div
                  key={`${handle}-${index}`}
                  className="p-4 bg-white border border-gray-300 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-700 mb-1">
                        {handleInfo.label}
                        {handleInfo.isAuto && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                            自动
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-gray-600 break-all mb-2">{handle}</div>
                      <div className="text-xs text-gray-500">
                        合约: {req.contractAddress.slice(0, 20)}...
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">解密值</div>
                      <div className="text-2xl font-bold text-[#A38025]">
                        {typeof value === "bigint" ? String(value) : String(value)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className={sectionClass}>
        <h3 className={titleClass}>📊 统计信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {printProperty("请求数量", requestCount)}
          {printProperty("结果数量", resultCount)}
          {printProperty("解密状态", isDecrypting ? "进行中" : "空闲")}
          {printProperty("可解密", canDecrypt ? "是" : "否")}
        </div>
      </div>
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
  } else if (value instanceof Error) {
    displayValue = value.message;
  } else {
    displayValue = JSON.stringify(value);
  }
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 rounded">
      <span className="text-gray-800 font-medium">{name}</span>
      <span className="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300 rounded">
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

