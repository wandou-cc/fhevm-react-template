"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFhevmClient, useFhevmInstance } from "~~/hooks/fhevm";
import { useWagmiEthers } from "~~/hooks/wagmi/useWagmiEthers";
import {
  FheWorker,
  FheWorkerManager,
  encryptWithWorker,
  type FheWorkerConfig,
  buildParamsFromAbi,
  getEncryptionMethod,
  toFhevmSigner,
} from "@fhevm-sdk";
import { GenericStringInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";
import { useDeployedContractInfo } from "~~/hooks/helper";

/**
 * WebWorker Demo Component
 * 
 * 展示使用 WebWorker 进行 FHE 加密的演示页面
 */
export const WebWorkerDemo = () => {
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

  // State
  const [worker, setWorker] = useState<FheWorker | null>(null);
  const [manager, setManager] = useState<FheWorkerManager | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isCallingContract, setIsCallingContract] = useState(false);
  const [encryptValue, setEncryptValue] = useState("42");
  const [encryptType, setEncryptType] = useState<"uint8" | "uint16" | "uint32" | "uint64" | "bool">("uint32");
  const [wasmPath, setWasmPath] = useState(""); // Empty by default - will use JS fallback
  const [contractAddress, setContractAddress] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [encryptResult, setEncryptResult] = useState<any>(null);
  const [batchValues, setBatchValues] = useState<Array<{ type: string; value: string }>>([
    { type: "uint32", value: "1" },
  ]);

  // Get deployed contract info
  const allowedChainId = typeof chainId === "number" ? (chainId as any) : undefined;
  const { data: fheCounter } = useDeployedContractInfo({ contractName: "FHECounter", chainId: allowedChainId });
  
  // Auto-fill contract address if available
  useEffect(() => {
    if (fheCounter?.address && !contractAddress) {
      setContractAddress(fheCounter.address);
    }
  }, [fheCounter?.address, contractAddress]);

  // Initialize worker
  const initializeWorker = async () => {
    setIsInitializing(true);
    setError(null);
    setMessage("初始化 Worker...");

    try {
      const config: FheWorkerConfig = {
        wasmPath: wasmPath || undefined,
        debug: true,
      };

      const w = new FheWorker(config);
      await w.init();
      setWorker(w);
      setMessage("Worker 初始化成功!");
    } catch (err: any) {
      setError(err.message || "Worker 初始化失败");
      setMessage("初始化失败");
    } finally {
      setIsInitializing(false);
    }
  };

  // Initialize manager
  const initializeManager = async () => {
    setIsInitializing(true);
    setError(null);
    setMessage("初始化 Worker Manager...");

    try {
      const m = new FheWorkerManager({
        wasmPath: wasmPath || undefined,
        debug: true,
      });
      const w = await m.getWorker();
      setManager(m);
      setMessage("Worker Manager 初始化成功!");
    } catch (err: any) {
      setError(err.message || "Manager 初始化失败");
      setMessage("初始化失败");
    } finally {
      setIsInitializing(false);
    }
  };

  // Encrypt with worker
  const handleEncrypt = async () => {
    if (!worker) {
      setError("Worker 未初始化");
      return;
    }

    if (!contractAddress || !userAddress) {
      setError("请填写合约地址和用户地址");
      return;
    }

    setIsEncrypting(true);
    setError(null);
    setMessage("加密中... (不阻塞主线程)");

    try {
      let value: number | bigint | boolean;
      if (encryptType === "bool") {
        value = encryptValue === "true";
      } else if (encryptType.startsWith("uint")) {
        const parsed = parseInt(encryptValue);
        if (isNaN(parsed)) {
          setError("无效的数值");
          return;
        }
        value = parsed;
      } else {
        setError("不支持的类型");
        return;
      }

      const ciphertext = await worker.encrypt(value, {
        type: encryptType,
        contractAddress,
        userAddress,
      });

      setResult(`加密结果: ${Array.from(ciphertext).slice(0, 20).join(", ")}...`);
      setMessage("加密完成!");
    } catch (err: any) {
      setError(err.message || "加密失败");
      setMessage("加密失败");
    } finally {
      setIsEncrypting(false);
    }
  };

  // Batch encrypt with encryptWithWorker
  const handleBatchEncrypt = async () => {
    if (!instance) {
      setError("FHEVM 实例未初始化");
      return;
    }

    if (!contractAddress || !userAddress) {
      setError("请填写合约地址和用户地址");
      return;
    }

    setIsEncrypting(true);
    setError(null);
    setMessage("批量加密中... (使用 WebWorker)");

    try {
      const values = batchValues
        .filter((v) => v.value)
        .map((v) => ({
          type: v.type as any,
          value: v.type === "bool" 
            ? v.value === "true"
            : v.type.startsWith("uint")
            ? parseInt(v.value) || 0
            : v.value,
        }));

      const result = await encryptWithWorker(client, {
        instance,
        contractAddress,
        userAddress,
        workerConfig: {
          wasmPath: wasmPath || undefined,
          debug: true,
        },
        values,
      });

      setEncryptResult(result);
      setResult(
        `批量加密完成: ${result.handles.length} 个 handles, proof 大小 ${result.inputProof.length} bytes`
      );
      setMessage("批量加密完成! 可以调用合约验证");
    } catch (err: any) {
      setError(err.message || "批量加密失败");
      setMessage("批量加密失败");
    } finally {
      setIsEncrypting(false);
    }
  };

  // Call contract to verify encryption
  const handleCallContract = async (functionName: "increment" | "decrement") => {
    if (!encryptResult) {
      setError("请先进行加密");
      return;
    }

    if (!fheCounter?.address || !fheCounter?.abi) {
      setError("合约信息未找到");
      return;
    }

    if (!ethersSigner) {
      setError("钱包未连接或签名器不可用");
      return;
    }

    setIsCallingContract(true);
    setError(null);
    setMessage(`调用合约 ${functionName}...`);

    try {
      // Get function ABI
      const functionAbi = fheCounter.abi.find(
        (item: any) => item.type === "function" && item.name === functionName
      );

      if (!functionAbi || !functionAbi.inputs || functionAbi.inputs.length === 0) {
        throw new Error(`Function ${functionName} not found or has no inputs`);
      }

      // Build parameters from encrypted result
      const params = buildParamsFromAbi(encryptResult, [...fheCounter.abi] as any[], functionName);

      // Create contract instance
      const contract = new ethers.Contract(
        fheCounter.address,
        fheCounter.abi,
        ethersSigner
      );

      // Call contract function
      const tx = await contract[functionName](...params);
      setTxHash(tx.hash);
      setMessage(`交易已提交: ${tx.hash}`);

      // Wait for transaction
      const receipt = await tx.wait();
      setMessage(`交易确认! 区块: ${receipt.blockNumber}`);
      setResult(`合约调用成功! Transaction: ${tx.hash}\nBlock: ${receipt.blockNumber}`);
    } catch (err: any) {
      setError(err.message || `合约调用失败`);
      setMessage(`合约调用失败: ${err.message}`);
    } finally {
      setIsCallingContract(false);
    }
  };

  // Get encryption method from function ABI (same as homepage)
  const getEncryptionMethodFor = (functionName: "increment" | "decrement") => {
    if (!fheCounter?.abi) {
      return { method: undefined as string | undefined, error: "Contract ABI not available" } as const;
    }
    const functionAbi = fheCounter.abi.find(
      (item: any) => item.type === "function" && item.name === functionName
    );
    if (!functionAbi) {
      return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` } as const;
    }
    if (!functionAbi.inputs || functionAbi.inputs.length === 0) {
      return { method: undefined as string | undefined, error: `No inputs found for ${functionName}` } as const;
    }
    const firstInput = functionAbi.inputs[0]!;
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined } as const;
  };

  // Map encryption method to type string for WebWorker
  const methodToType = (method: string): "uint8" | "uint16" | "uint32" | "uint64" | "bool" => {
    if (method.includes("32")) return "uint32";
    if (method.includes("16")) return "uint16";
    if (method.includes("8")) return "uint8";
    if (method.includes("64")) return "uint64";
    if (method.includes("bool")) return "bool";
    return "uint32"; // default
  };

  // Encrypt and call contract in one flow
  const handleEncryptAndCallContract = async (functionName: "increment" | "decrement") => {
    if (!instance) {
      setError("FHEVM 实例未初始化");
      return;
    }

    if (!fheCounter?.address || !fheCounter?.abi) {
      setError("合约信息未找到");
      return;
    }

    if (!contractAddress || !userAddress) {
      setError("请填写合约地址和用户地址");
      return;
    }

    // Step 1: Encrypt
    setIsEncrypting(true);
    setError(null);
    setMessage("步骤 1/2: 加密中... (使用 WebWorker)");

    try {
      // Get encryption method from function ABI (same as homepage)
      const { method, error } = getEncryptionMethodFor(functionName);
      if (!method) {
        setError(error ?? "Encryption method not found");
        return;
      }

      const value = parseInt(encryptValue);
      if (isNaN(value) || value <= 0) {
        setError("请输入有效的正整数值");
        return;
      }

      // Convert method to type for WebWorker
      const type = methodToType(method);
      setMessage(`加密方法: ${method}, 类型: ${type}, 值: ${value}`);

      const values = [{ type, value }];

      const result = await encryptWithWorker(client, {
        instance,
        contractAddress,
        userAddress,
        workerConfig: {
          wasmPath: wasmPath || undefined,
          debug: true,
        },
        values,
      });

      setEncryptResult(result);
      setMessage("步骤 2/2: 调用合约...");

      // Step 2: Call contract
      await handleCallContract(functionName);
    } catch (err: any) {
      setError(err.message || "加密失败");
      setMessage(`加密失败: ${err.message}`);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (worker) {
        worker.terminate();
      }
      if (manager) {
        manager.terminate();
      }
    };
  }, [worker, manager]);

  // Get user address from signer
  useEffect(() => {
    if (ethersSigner) {
      ethersSigner.getAddress().then((addr) => {
        setUserAddress(addr);
      });
    }
  }, [ethersSigner]);

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
            <p className="text-gray-700 mb-6">请连接钱包以使用 WebWorker 加密功能。</p>
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
        <h1 className="text-3xl font-bold mb-2">WebWorker 加密演示</h1>
        <p className="text-gray-600">使用 WebWorker 进行异步 FHE 加密，不阻塞主线程</p>
      </div>

      {/* Status */}
      <div className={sectionClass}>
        <h3 className={titleClass}>🔧 连接状态</h3>
        <div className="grid grid-cols-2 gap-4">
          {printProperty("实例状态", instance ? "✅ 已连接" : "❌ 未连接")}
          {printProperty("Worker 状态", worker ? "✅ 已初始化" : "❌ 未初始化")}
          {printProperty("Manager 状态", manager ? "✅ 已初始化" : "❌ 未初始化")}
          {printProperty("状态", fhevmStatus)}
        </div>
      </div>

      {/* Worker Configuration */}
      <div className={sectionClass}>
        <h3 className={titleClass}>⚙️ Worker 配置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WASM 路径（可选，留空使用 JavaScript 实现）
            </label>
            <input
              type="text"
              placeholder="例如: /wasm/fhe.wasm 或留空使用 JS 实现"
              value={wasmPath}
              onChange={(e) => setWasmPath(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              提示: 如果没有 WASM 文件，可以留空使用内置的 JavaScript 实现（用于演示）
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={initializeWorker}
              disabled={isInitializing || !!worker}
              className={primaryButtonClass}
            >
              {isInitializing ? "初始化中..." : worker ? "✅ 已初始化" : "初始化 Worker"}
            </button>
            <button
              onClick={initializeManager}
              disabled={isInitializing || !!manager}
              className={secondaryButtonClass}
            >
              {isInitializing ? "初始化中..." : manager ? "✅ 已初始化" : "初始化 Manager"}
            </button>
          </div>
        </div>
      </div>

      {/* Single Encrypt */}
      <div className={sectionClass}>
        <h3 className={titleClass}>🔐 单个加密</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">值</label>
              <input
                type="text"
                placeholder="42"
                value={encryptValue}
                onChange={(e) => setEncryptValue(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">类型</label>
              <select
                value={encryptType}
                onChange={(e) => setEncryptType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
              >
                <option value="uint8">uint8</option>
                <option value="uint16">uint16</option>
                <option value="uint32">uint32</option>
                <option value="uint64">uint64</option>
                <option value="bool">bool</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">合约地址</label>
            <input
              type="text"
              placeholder="0x..."
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户地址</label>
            <input
              type="text"
              placeholder="0x..."
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
            />
          </div>
          <button
            onClick={handleEncrypt}
            disabled={!worker || isEncrypting || !contractAddress || !userAddress}
            className={primaryButtonClass + " w-full"}
          >
            {isEncrypting ? "加密中..." : "🔐 加密"}
          </button>
        </div>
      </div>

      {/* Encrypt and Call Contract */}
      <div className={sectionClass}>
        <h3 className={titleClass}>🚀 加密并调用合约验证</h3>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>流程:</strong> WebWorker 加密 → 构建参数 → 调用合约 → 验证结果
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">加密值 (uint32)</label>
              <input
                type="number"
                placeholder="1"
                value={encryptValue}
                onChange={(e) => setEncryptValue(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">操作</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleEncryptAndCallContract("increment")}
                  disabled={!instance || isEncrypting || isCallingContract || !contractAddress || !userAddress}
                  className={primaryButtonClass}
                >
                  {isEncrypting || isCallingContract ? "处理中..." : "⬆️ 增加"}
                </button>
                <button
                  onClick={() => handleEncryptAndCallContract("decrement")}
                  disabled={!instance || isEncrypting || isCallingContract || !contractAddress || !userAddress}
                  className={secondaryButtonClass}
                >
                  {isEncrypting || isCallingContract ? "处理中..." : "⬇️ 减少"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Encrypt */}
      <div className={sectionClass}>
        <h3 className={titleClass}>📦 批量加密</h3>
        <div className="space-y-4">
          {batchValues.map((item, index) => (
            <div key={index} className="grid grid-cols-3 gap-4">
              <select
                value={item.type}
                onChange={(e) => {
                  const newValues = [...batchValues];
                  newValues[index].type = e.target.value;
                  setBatchValues(newValues);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
              >
                <option value="uint8">uint8</option>
                <option value="uint16">uint16</option>
                <option value="uint32">uint32</option>
                <option value="uint64">uint64</option>
                <option value="bool">bool</option>
              </select>
              <input
                type="text"
                placeholder="值"
                value={item.value}
                onChange={(e) => {
                  const newValues = [...batchValues];
                  newValues[index].value = e.target.value;
                  setBatchValues(newValues);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD208] focus:border-transparent"
              />
              <button
                onClick={() => {
                  setBatchValues(batchValues.filter((_, i) => i !== index));
                }}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                删除
              </button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setBatchValues([...batchValues, { type: "uint32", value: "" }]);
              }}
              className={secondaryButtonClass}
            >
              ➕ 添加值
            </button>
            <button
              onClick={handleBatchEncrypt}
              disabled={!instance || isEncrypting || !contractAddress || !userAddress}
              className={primaryButtonClass}
            >
              {isEncrypting ? "批量加密中..." : "📦 批量加密"}
            </button>
          </div>
        </div>
      </div>

      {/* Call Contract (after encryption) */}
      {encryptResult && (
        <div className={sectionClass}>
          <h3 className={titleClass}>✅ 调用合约验证</h3>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✅ 加密已完成: {encryptResult.handles.length} 个 handles
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleCallContract("increment")}
                disabled={!fheCounter || isCallingContract || !ethersSigner}
                className={primaryButtonClass}
              >
                {isCallingContract ? "调用中..." : "⬆️ 调用 increment"}
              </button>
              <button
                onClick={() => handleCallContract("decrement")}
                disabled={!fheCounter || isCallingContract || !ethersSigner}
                className={secondaryButtonClass}
              >
                {isCallingContract ? "调用中..." : "⬇️ 调用 decrement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={sectionClass}>
          <h3 className={titleClass}>✅ 结果</h3>
          <div className="p-4 bg-white border border-gray-300 rounded-lg">
            <p className="text-gray-800 font-mono text-sm break-all whitespace-pre-wrap">{result}</p>
          </div>
        </div>
      )}

      {/* Transaction Hash */}
      {txHash && (
        <div className={sectionClass}>
          <h3 className={titleClass}>🔗 交易哈希</h3>
          <div className="p-4 bg-white border border-gray-300 rounded-lg">
            <p className="text-gray-800 font-mono text-sm break-all">{txHash}</p>
            {chainId && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline mt-2 inline-block"
              >
                在 Etherscan 查看 →
              </a>
            )}
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

